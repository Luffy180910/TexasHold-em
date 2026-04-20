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

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`✅ 玩家连接: ${socket.id}`);
    let currentRoom = null;

    // 获取大厅房间列表
    socket.emit(EVENTS.ROOMS_LIST, listRooms());

    // ── 创建房间 ──────────────────────
    socket.on(EVENTS.CREATE_ROOM, ({ playerName }) => {
      const roomId = createRoom(socket.id, playerName);
      currentRoom = roomId;
      socket.join(roomId);
      socket.emit(EVENTS.ROOM_UPDATED, getRoomInfo(roomId));
      console.log(`🏠 房间创建: ${roomId} by ${playerName}`);
    });

    // ── 加入房间 ──────────────────────
    socket.on(EVENTS.JOIN_ROOM, ({ roomId, playerName }) => {
      const result = joinRoom(roomId, socket.id, playerName);
      if (result.error) {
        socket.emit(EVENTS.GAME_ERROR, result.error);
        return;
      }
      currentRoom = roomId;
      socket.join(roomId);
      // 广播给房间所有人
      io.to(roomId).emit(EVENTS.ROOM_UPDATED, getRoomInfo(roomId));
      console.log(`👤 ${playerName} 加入房间 ${roomId}`);
    });

    // ── 离开房间 ──────────────────────
    socket.on(EVENTS.LEAVE_ROOM, () => {
      handleLeave();
    });

    // ── 开始游戏（仅房主）─────────────
    socket.on(EVENTS.START_GAME, () => {
      if (!currentRoom) return;
      const result = startGame(currentRoom);
      if (result.error) {
        socket.emit(EVENTS.GAME_ERROR, result.error);
        return;
      }
      // 向每个玩家发送隐藏其他人手牌的状态
      broadcastGameState(io, currentRoom);
      console.log(`🃏 游戏开始: ${currentRoom}`);
    });

    // ── 玩家操作（弃牌/跟注/加注等）──
    socket.on(EVENTS.PLAYER_ACTION, ({ action, amount }) => {
      if (!currentRoom) return;
      const result = playerAction(currentRoom, socket.id, action, amount);
      if (!result || result.error) {
        socket.emit(EVENTS.GAME_ERROR, result?.error || '操作失败');
        return;
      }

      if (result.type === 'showdown') {
        // 摊牌：发送完整状态（含所有手牌）
        io.to(currentRoom).emit(EVENTS.GAME_SHOWDOWN, {
          winner: result.winner,
          players: result.players,
        });
      }
      broadcastGameState(io, currentRoom);
    });

    // ── 下一局 ────────────────────────
    socket.on(EVENTS.NEXT_ROUND, () => {
      if (!currentRoom) return;
      const result = nextRound(currentRoom);
      if (result?.error) {
        socket.emit(EVENTS.GAME_ERROR, result.error);
        return;
      }
      broadcastGameState(io, currentRoom);
      console.log(`🔄 下一局: ${currentRoom}`);
    });

    // ── 断线处理 ──────────────────────
    socket.on('disconnect', () => {
      console.log(`❌ 玩家断线: ${socket.id}`);
      handleLeave();
    });

    function handleLeave() {
      if (!currentRoom) return;
      leaveRoom(currentRoom, socket.id);
      const info = getRoomInfo(currentRoom);
      if (info) io.to(currentRoom).emit(EVENTS.ROOM_UPDATED, info);
      socket.leave(currentRoom);
      currentRoom = null;
    }
  });
}

// 向房间内每个玩家发送专属状态（隐藏他人手牌）
function broadcastGameState(io, roomId) {
  const sockets = io.sockets.adapter.rooms.get(roomId);
  if (!sockets) return;
  for (const socketId of sockets) {
    const state = getGameStateFor(roomId, socketId);
    if (state) io.to(socketId).emit(EVENTS.GAME_STATE, state);
  }
}

module.exports = { registerSocketHandlers, EVENTS };
