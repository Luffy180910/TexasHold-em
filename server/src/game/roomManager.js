// ════════════════════════════════════════
//  房间管理器（Redis + 内存双模存储）
//  - Redis 可用时：持久化存储，支持多进程扩展
//  - Redis 不可用时：优雅降级至内存存储
// ════════════════════════════════════════

const { v4: uuidv4 } = require('uuid');
const { PokerGame } = require('./engine');
const { getClient, isAvailable } = require('../redis/client');
const { withLock } = require('../redis/lock');

// ── 内存降级存储 ──────────────────────
const memoryRooms = new Map(); // roomId → 房间元数据（不含 game 实例）
const memoryGames = new Map(); // roomId → PokerGame 实例

// ── Redis Key 前缀 ────────────────────
const KEY_ROOM    = (id) => `room:${id}`;
const KEY_GAME    = (id) => `game:${id}`;
const KEY_ROOMS_SET = 'rooms:all';
const ROOM_TTL    = 86400; // 24 小时

// ── 房间自动清理：30 分钟无活动删除（内存模式）──
const ROOM_IDLE_TTL = 30 * 60 * 1000;

// ════════════════════════════════════════
//  内部辅助：Redis 读写
// ════════════════════════════════════════

async function redisGetRoom(roomId) {
  const raw = await getClient().get(KEY_ROOM(roomId));
  return raw ? JSON.parse(raw) : null;
}

async function redisSetRoom(room) {
  await getClient().set(KEY_ROOM(room.id), JSON.stringify(room), 'EX', ROOM_TTL);
  await getClient().sadd(KEY_ROOMS_SET, room.id);
}

async function redisDeleteRoom(roomId) {
  await getClient().del(KEY_ROOM(roomId));
  await getClient().del(KEY_GAME(roomId));
  await getClient().srem(KEY_ROOMS_SET, roomId);
}

async function redisGetGame(roomId) {
  const raw = await getClient().get(KEY_GAME(roomId));
  return raw ? PokerGame.fromJSON(JSON.parse(raw)) : null;
}

async function redisSetGame(roomId, game) {
  await getClient().set(KEY_GAME(roomId), JSON.stringify(game.toJSON()), 'EX', ROOM_TTL);
}

async function redisGetAllRoomIds() {
  return getClient().smembers(KEY_ROOMS_SET);
}

// ════════════════════════════════════════
//  统一 getRoom / saveRoom / deleteRoom
// ════════════════════════════════════════

async function getRoom(roomId) {
  if (isAvailable()) {
    const room = await redisGetRoom(roomId);
    if (!room) return null;
    if (room.status === 'playing') {
      room.game = await redisGetGame(roomId);
    }
    return room;
  }
  const room = memoryRooms.get(roomId);
  if (!room) return null;
  return { ...room, game: memoryGames.get(roomId) || null };
}

async function saveRoom(room) {
  const { game, ...meta } = room;
  meta.updatedAt = Date.now();
  if (isAvailable()) {
    await redisSetRoom(meta);
    if (game) await redisSetGame(room.id, game);
  } else {
    memoryRooms.set(room.id, meta);
    if (game) memoryGames.set(room.id, game);
  }
}

async function deleteRoom(roomId) {
  if (isAvailable()) {
    await redisDeleteRoom(roomId);
  } else {
    memoryRooms.delete(roomId);
    memoryGames.delete(roomId);
  }
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
  return withLock(roomId, async () => {
    const room = await getRoom(roomId);
    if (!room) return { error: '房间不存在' };
    if (room.status === 'playing') return { error: '游戏已开始' };
    if (room.players.length >= room.maxPlayers) return { error: '房间已满' };
    if (room.players.find((p) => p.id === playerId)) return { error: '已在房间中' };

    room.players.push({ id: playerId, name: playerName, chips: 1000, ready: false });
    await saveRoom(room);
    return { success: true, room: _roomInfo(room) };
  });
}

async function leaveRoom(roomId, playerId) {
  return withLock(roomId, async () => {
    const room = await getRoom(roomId);
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== playerId);
    if (room.players.length === 0) {
      await deleteRoom(roomId);
    } else {
      if (room.host === playerId) {
        room.host = room.players[0].id;
      }
      await saveRoom(room);
    }
  });
}

async function startGame(roomId) {
  return withLock(roomId, async () => {
    const room = await getRoom(roomId);
    if (!room) return { error: '房间不存在' };
    if (room.players.length < 2) return { error: '至少需要2名玩家' };
    if (room.status === 'playing') return { error: '游戏已在进行中' };

    const game = new PokerGame(roomId, room.players);
    room.status = 'playing';
    room.game = game;
    await saveRoom(room);
    return game.startRound();
  });
}

async function playerAction(roomId, playerId, action, amount) {
  return withLock(roomId, async () => {
    const room = await getRoom(roomId);
    if (!room || !room.game) return { error: '游戏未开始' };

    const result = room.game.playerAction(playerId, action, amount);
    if (!result || result.error) return result;

    await saveRoom(room);
    return result;
  });
}

async function nextRound(roomId) {
  return withLock(roomId, async () => {
    const room = await getRoom(roomId);
    if (!room || !room.game) return { error: '游戏未开始' };
    const result = room.game.startRound();
    await saveRoom(room);
    return result;
  });
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
  if (isAvailable()) {
    const ids = await redisGetAllRoomIds();
    const rooms = await Promise.all(ids.map((id) => redisGetRoom(id)));
    return rooms
      .filter((r) => r && r.status === 'waiting')
      .map(_roomInfo);
  }
  return [...memoryRooms.values()]
    .filter((r) => r.status === 'waiting')
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
};
