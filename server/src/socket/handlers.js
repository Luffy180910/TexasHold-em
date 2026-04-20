const {
  createRoom, joinRoom, leaveRoom,
  startGame, playerAction, nextRound,
  getGameStateFor, getRoomInfo, listRooms,
} = require('../game/roomManager');

// ── 事件名称常量 ──
const EVENTS = {
  // 客户端 → 服务端
  CREATE_ROOM:   'room:create',
  JOIN_ROOM:     'room:join',
  LEAVE_ROOM:    'room:leave',
  START_GAME:    'game:start',
  PLAYER_ACTION: 'player:action',
  NEXT_ROUND:    'game:nextRound',

  // 服务端 → 客户端
  ROOM_UPDATED:  'room:updated',
  GAME_STATE:    'game:state',
  GAME_SHOWDOWN: 'game:showdown',
  GAME_ERROR:    'game:error',
  ROOMS_LIST:    'rooms:list',
};

// ── 合法操作集合 ──
const VALID_ACTIONS = new Set(['fold', 'check', 'call', 'raise', 'allin']);
const MAX_BET_AMOUNT = 1e7; // 最大单次下注上限

// ════════════════════════════════════════
//  服务端输入验证工具
// ════════════════════════════════════════

function validatePlayerName(name) {
  if (typeof name !== 'string') return '玩家名称必须是字符串';
  const trimmed = name.trim();
  if (trimmed.length === 0) return '玩家名称不能为空';
  if (trimmed.length > 20) return '玩家名称最多20个字符';
  return null; // 验证通过
}

function validateRoomId(roomId) {
  if (typeof roomId !== 'string') return '房间 ID 格式错误';
  if (!/^[A-Z0-9]{6}$/.test(roomId)) return '房间 ID 格式错误';
  return null;
}

function validateAction(action, amount) {
  if (!VALID_ACTIONS.has(action)) return `非法操作: ${action}`;
  if ((action === 'raise' || action === 'allin') && amount !== undefined) {
    if (!Number.isFinite(amount) || amount <= 0) return '下注金额必须是正数';
    if (!Number.isInteger(amount)) return '下注金额必须是整数';
    if (amount > MAX_BET_AMOUNT) return '下注金额超出上限';
  }
  return null;
}

// ════════════════════════════════════════
//  Socket 事件注册
// ════════════════════════════════════════

function registerSocketHandlers(io) {
  const broadcastRoomsList = async () => {
    io.emit(EVENTS.ROOMS_LIST, await listRooms());
  };

  io.on('connection', (socket) => {
    console.log(`✅ 玩家连接: ${socket.id}`);
    let currentRoom = null;

    // 获取大厅房间列表
    listRooms().then((rooms) => socket.emit(EVENTS.ROOMS_LIST, rooms));

    // ── 创建房间 ──────────────────────
    socket.on(EVENTS.CREATE_ROOM, async ({ playerName } = {}) => {
      try {
        const nameErr = validatePlayerName(playerName);
        if (nameErr) { socket.emit(EVENTS.GAME_ERROR, nameErr); return; }

        const name = playerName.trim();
        const roomId = await createRoom(socket.id, name);
        currentRoom = roomId;
        socket.join(roomId);
        socket.emit(EVENTS.ROOM_UPDATED, await getRoomInfo(roomId));
        await broadcastRoomsList();
        console.log(`🏠 房间创建: ${roomId} by ${name}`);
      } catch (err) {
        console.error('create_room error:', err);
        socket.emit(EVENTS.GAME_ERROR, '创建房间失败，请重试');
      }
    });

    // ── 加入房间 ──────────────────────
    socket.on(EVENTS.JOIN_ROOM, async ({ roomId, playerName } = {}) => {
      try {
        const idErr = validateRoomId(roomId);
        if (idErr) { socket.emit(EVENTS.GAME_ERROR, idErr); return; }
        const nameErr = validatePlayerName(playerName);
        if (nameErr) { socket.emit(EVENTS.GAME_ERROR, nameErr); return; }

        const name = playerName.trim();
        const result = await joinRoom(roomId, socket.id, name);
        if (result && result.error) {
          socket.emit(EVENTS.GAME_ERROR, result.error);
          return;
        }
        currentRoom = roomId;
        socket.join(roomId);
        io.to(roomId).emit(EVENTS.ROOM_UPDATED, await getRoomInfo(roomId));
        await broadcastRoomsList();
        console.log(`👤 ${name} 加入房间 ${roomId}`);
      } catch (err) {
        console.error('join_room error:', err);
        socket.emit(EVENTS.GAME_ERROR, err.message || '加入房间失败，请重试');
      }
    });

    // ── 离开房间 ──────────────────────
    socket.on(EVENTS.LEAVE_ROOM, async () => {
      try {
        await handleLeave();
      } catch (err) {
        console.error('leave_room error:', err);
      }
    });

    // ── 开始游戏（仅房主）─────────────
    socket.on(EVENTS.START_GAME, async () => {
      try {
        if (!currentRoom) { socket.emit(EVENTS.GAME_ERROR, '未加入任何房间'); return; }

        const roomInfo = await getRoomInfo(currentRoom);
        if (!roomInfo) { socket.emit(EVENTS.GAME_ERROR, '房间不存在'); return; }
        if (roomInfo.host !== socket.id) {
          socket.emit(EVENTS.GAME_ERROR, '仅房主可开始游戏');
          return;
        }
        if (roomInfo.players.length < 2) {
          socket.emit(EVENTS.GAME_ERROR, '至少需要2名玩家');
          return;
        }

        const result = await startGame(currentRoom);
        if (result && result.error) {
          socket.emit(EVENTS.GAME_ERROR, result.error);
          return;
        }
        await broadcastRoomsList();
        await broadcastGameState(io, currentRoom);
        console.log(`🃏 游戏开始: ${currentRoom}`);
      } catch (err) {
        console.error('start_game error:', err);
        socket.emit(EVENTS.GAME_ERROR, err.message || '开始游戏失败');
      }
    });

    // ── 玩家操作（弃牌/跟注/加注等）──
    socket.on(EVENTS.PLAYER_ACTION, async ({ action, amount } = {}) => {
      try {
        if (!currentRoom) { socket.emit(EVENTS.GAME_ERROR, '未加入任何房间'); return; }

        const actionErr = validateAction(action, amount);
        if (actionErr) { socket.emit(EVENTS.GAME_ERROR, actionErr); return; }

        const safeAmount = Number.isFinite(amount) ? Math.floor(amount) : 0;
        const result = await playerAction(currentRoom, socket.id, action, safeAmount);
        if (!result || result.error) {
          socket.emit(EVENTS.GAME_ERROR, result?.error || '操作失败');
          return;
        }

        if (result.type === 'showdown') {
          io.to(currentRoom).emit(EVENTS.GAME_SHOWDOWN, {
            winner: result.winner,
            players: result.players,
          });
        }
        await broadcastGameState(io, currentRoom);
      } catch (err) {
        console.error('player_action error:', err);
        socket.emit(EVENTS.GAME_ERROR, err.message || '操作失败，请重试');
      }
    });

    // ── 下一局 ────────────────────────
    socket.on(EVENTS.NEXT_ROUND, async () => {
      try {
        if (!currentRoom) { socket.emit(EVENTS.GAME_ERROR, '未加入任何房间'); return; }

        const roomInfo = await getRoomInfo(currentRoom);
        if (!roomInfo) { socket.emit(EVENTS.GAME_ERROR, '房间不存在'); return; }
        if (roomInfo.host !== socket.id) {
          socket.emit(EVENTS.GAME_ERROR, '仅房主可开始下一局');
          return;
        }

        const result = await nextRound(currentRoom);
        if (result && result.error) {
          socket.emit(EVENTS.GAME_ERROR, result.error);
          return;
        }
        await broadcastGameState(io, currentRoom);
        console.log(`🔄 下一局: ${currentRoom}`);
      } catch (err) {
        console.error('next_round error:', err);
        socket.emit(EVENTS.GAME_ERROR, err.message || '开始下一局失败');
      }
    });

    // ── 断线处理 ──────────────────────
    socket.on('disconnect', async () => {
      console.log(`❌ 玩家断线: ${socket.id}`);
      try {
        await handleLeave();
      } catch (err) {
        console.error('disconnect error:', err);
      }
    });

    async function handleLeave() {
      if (!currentRoom) return;
      const roomId = currentRoom;
      currentRoom = null;
      await leaveRoom(roomId, socket.id);
      const info = await getRoomInfo(roomId);
      if (info) io.to(roomId).emit(EVENTS.ROOM_UPDATED, info);
      await broadcastRoomsList();
      socket.leave(roomId);
    }
  });
}

// ── 向房间内每个玩家发送专属状态（隐藏他人手牌）──
async function broadcastGameState(io, roomId) {
  const sockets = io.sockets.adapter.rooms.get(roomId);
  if (!sockets) return;
  for (const socketId of sockets) {
    const state = await getGameStateFor(roomId, socketId);
    if (state) io.to(socketId).emit(EVENTS.GAME_STATE, state);
  }
}

module.exports = { registerSocketHandlers, EVENTS };
