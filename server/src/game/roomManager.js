// ════════════════════════════════════════
//  房间管理器（PostgreSQL + 内存双模存储）
//  - PG 可用时：房间元数据持久化
//  - PG 不可用时：优雅降级至内存存储
//  - 游戏实例始终在内存中（PokerGame 对象）
// ════════════════════════════════════════

const { v4: uuidv4 } = require('uuid');
const { PokerGame } = require('./engine');
const pool = require('../db/pool');
const { saveRound } = require('../db/history');
const { getLeaderboard } = require('../db/users');

// ── 内存降级存储 ──────────────────────
const memoryRooms = new Map(); // roomId → 房间元数据（不含 game 实例）
const memoryGames = new Map(); // roomId → PokerGame 实例

// ── PG 可用性检测 ──────────────────────
let pgChecked = false;
let pgAvailable = false;

async function checkPg() {
  if (pgChecked) return pgAvailable;
  try {
    await pool.query('SELECT 1');
    pgAvailable = true;
    console.log('✅ PostgreSQL 已连接');
  } catch {
    pgAvailable = false;
    console.warn('⚠️  PostgreSQL 不可用，使用内存存储作为降级方案');
  }
  pgChecked = true;
  return pgAvailable;
}

// ── 房间自动清理：30 分钟无活动删除 ──
const ROOM_IDLE_TTL = 30 * 60 * 1000;

// ════════════════════════════════════════
//  PG 操作
// ════════════════════════════════════════

async function pgGetRoom(roomId) {
  const result = await pool.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
  return result.rows[0] || null;
}

async function pgSetRoom(room) {
  await pool.query(
    `INSERT INTO rooms (id, host, players, status, max_players, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (id) DO UPDATE SET
       host = EXCLUDED.host,
       players = EXCLUDED.players,
       status = EXCLUDED.status,
       updated_at = NOW()`,
    [room.id, room.host, JSON.stringify(room.players), room.status, room.maxPlayers]
  );
}

async function pgDeleteRoom(roomId) {
  await pool.query('DELETE FROM rooms WHERE id = $1', [roomId]);
}

async function pgListRoomIds() {
  const result = await pool.query(
    "SELECT id FROM rooms WHERE status = 'waiting' ORDER BY created_at DESC"
  );
  return result.rows.map(r => r.id);
}

// ════════════════════════════════════════
//  统一 getRoom / saveRoom / deleteRoom
// ════════════════════════════════════════

async function getRoom(roomId) {
  const pgOk = await checkPg();
  if (pgOk) {
    const row = await pgGetRoom(roomId);
    if (!row) return null;
    return {
      id: row.id,
      host: row.host,
      players: row.players,
      status: row.status,
      maxPlayers: row.max_players,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
      game: memoryGames.get(roomId) || null,
    };
  }
  const room = memoryRooms.get(roomId);
  if (!room) return null;
  return { ...room, game: memoryGames.get(roomId) || null };
}

async function saveRoom(room) {
  const { game, ...meta } = room;
  meta.updatedAt = Date.now();
  const pgOk = await checkPg();
  if (pgOk) {
    await pgSetRoom(meta);
  } else {
    memoryRooms.set(room.id, meta);
  }
  // 游戏实例始终保存在内存中
  if (game) memoryGames.set(room.id, game);
}

async function deleteRoom(roomId) {
  const pgOk = await checkPg();
  if (pgOk) {
    await pgDeleteRoom(roomId);
  } else {
    memoryRooms.delete(roomId);
  }
  memoryGames.delete(roomId);
}

// ════════════════════════════════════════
//  公开 API（均为 async）
// ════════════════════════════════════════

async function createRoom(hostId, hostName) {
  const roomId = uuidv4().slice(0, 6).toUpperCase();
  const room = {
    id: roomId,
    host: hostId,
    players: [{ id: hostId, name: hostName, chips: 1000, ready: false }],
    game: null,
    status: 'waiting',
    maxPlayers: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveRoom(room);
  return roomId;
}

async function joinRoom(roomId, playerId, playerName) {
  const room = await getRoom(roomId);
  if (!room) return { error: '房间不存在' };
  if (room.status === 'playing') return { error: '游戏已开始' };
  if (room.players.length >= room.maxPlayers) return { error: '房间已满' };
  if (room.players.find(p => p.id === playerId)) return { error: '已在房间中' };

  room.players.push({ id: playerId, name: playerName, chips: 1000, ready: false });
  await saveRoom(room);
  return { success: true, room: _roomInfo(room) };
}

async function leaveRoom(roomId, playerId) {
  const room = await getRoom(roomId);
  if (!room) return;
  room.players = room.players.filter(p => p.id !== playerId);
  if (room.players.length === 0) {
    await deleteRoom(roomId);
  } else {
    if (room.host === playerId) {
      room.host = room.players[0].id;
    }
    await saveRoom(room);
  }
}

async function startGame(roomId) {
  const room = await getRoom(roomId);
  if (!room) return { error: '房间不存在' };
  if (room.players.length < 2) return { error: '至少需要2名玩家' };
  if (room.status === 'playing') return { error: '游戏已在进行中' };

  const game = new PokerGame(roomId, room.players);
  room.status = 'playing';
  room.game = game;
  await saveRoom(room);
  return game.startRound();
}

async function playerAction(roomId, playerId, action, amount) {
  const room = await getRoom(roomId);
  if (!room || !room.game) return { error: '游戏未开始' };

  const result = room.game.playerAction(playerId, action, amount);
  if (!result || result.error) return result;

  // 摊牌时记录游戏历史到 PG
  if (result.type === 'showdown') {
    saveRound(roomId, room.game.round, result).catch(err => {
      console.error('❌ 保存游戏记录失败:', err.message);
    });
  }

  // 每局结束后更新房间状态
  if (room.game.phase === 'showdown') {
    room.status = 'waiting';
    room.game = null;
    memoryGames.delete(roomId);
  }
  await saveRoom(room);
  return result;
}

async function nextRound(roomId) {
  const room = await getRoom(roomId);
  if (!room || !room.game) return { error: '游戏未开始' };
  const result = room.game.startRound();
  await saveRoom(room);
  return result;
}

async function getGameStateFor(roomId, playerId) {
  const room = await getRoom(roomId);
  if (!room || !room.game) return null;
  return room.game.getStateFor(playerId);
}

async function getRoomInfo(roomId) {
  const room = await getRoom(roomId);
  if (!room) return null;
  return _roomInfo(room);
}

async function listRooms() {
  const pgOk = await checkPg();
  if (pgOk) {
    const ids = await pgListRoomIds();
    const rooms = await Promise.all(ids.map(id => pgGetRoom(id)));
    return rooms
      .filter(r => r && r.status === 'waiting')
      .map(r => _roomInfo({
        id: r.id,
        host: r.host,
        players: r.players,
        status: r.status,
        maxPlayers: r.max_players,
      }));
  }
  return [...memoryRooms.values()]
    .filter(r => r.status === 'waiting')
    .map(_roomInfo);
}

function _roomInfo(room) {
  return {
    id: room.id,
    host: room.host,
    players: room.players,
    status: room.status,
    maxPlayers: room.maxPlayers,
  };
}

// ── 定时清理长时间无活动的内存房间（降级模式）──
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of memoryRooms) {
    if (now - (room.updatedAt ?? room.createdAt ?? now) > ROOM_IDLE_TTL) {
      memoryRooms.delete(roomId);
      memoryGames.delete(roomId);
      console.log(`🗑️  房间 ${roomId} 因长时间无活动已清理`);
    }
  }
}, 5 * 60 * 1000);

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  startGame,
  playerAction,
  nextRound,
  getGameStateFor,
  getRoomInfo,
  listRooms,
  getLeaderboard,
};
