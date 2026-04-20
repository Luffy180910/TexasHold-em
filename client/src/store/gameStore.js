import { create } from 'zustand';
import socket from '../utils/socket';

// ── 事件名称（与服务端同步）──
export const EVENTS = {
  CREATE_ROOM:   'room:create',
  JOIN_ROOM:     'room:join',
  LEAVE_ROOM:    'room:leave',
  START_GAME:    'game:start',
  PLAYER_ACTION: 'player:action',
  NEXT_ROUND:    'game:nextRound',
  ROOM_UPDATED:  'room:updated',
  GAME_STATE:    'game:state',
  GAME_SHOWDOWN: 'game:showdown',
  GAME_ERROR:    'game:error',
  ROOMS_LIST:    'rooms:list',
};

const useStore = create((set, get) => ({
  // ── 状态 ──
  myId: null,           // 本玩家 socket.id
  myName: '',           // 本玩家名字
  page: 'lobby',        // lobby | room | game
  rooms: [],            // 大厅房间列表
  currentRoom: null,    // 当前所在房间信息
  gameState: null,      // 游戏状态
  showdown: null,       // 摊牌结果
  error: null,          // 错误信息
  socketInited: false,  // socket 监听是否已初始化
  socketListeners: null,

  // ── 初始化（挂载 socket 监听）──
  initSocket: () => {
    if (get().socketInited) {
      set({ myId: socket.id });
      return;
    }

    const onRoomsList = (rooms) => set({ rooms });
    const onRoomUpdated = (room) => set({ currentRoom: room, page: 'room' });
    const onGameState = (state) => set({ gameState: state, page: 'game', showdown: null });
    const onGameShowdown = (result) => set({ showdown: result });
    const onGameError = (msg) => {
      set({ error: msg });
      setTimeout(() => set({ error: null }), 3000);
    };
    const onConnect = () => set({ myId: socket.id });

    set({ myId: socket.id });

    socket.on(EVENTS.ROOMS_LIST, onRoomsList);
    socket.on(EVENTS.ROOM_UPDATED, onRoomUpdated);
    socket.on(EVENTS.GAME_STATE, onGameState);
    socket.on(EVENTS.GAME_SHOWDOWN, onGameShowdown);
    socket.on(EVENTS.GAME_ERROR, onGameError);
    socket.on('connect', onConnect);

    set({
      socketInited: true,
      socketListeners: {
        [EVENTS.ROOMS_LIST]: onRoomsList,
        [EVENTS.ROOM_UPDATED]: onRoomUpdated,
        [EVENTS.GAME_STATE]: onGameState,
        [EVENTS.GAME_SHOWDOWN]: onGameShowdown,
        [EVENTS.GAME_ERROR]: onGameError,
        connect: onConnect,
      },
    });
  },

  cleanupSocket: () => {
    const listeners = get().socketListeners;
    if (!listeners) return;
    socket.off(EVENTS.ROOMS_LIST, listeners[EVENTS.ROOMS_LIST]);
    socket.off(EVENTS.ROOM_UPDATED, listeners[EVENTS.ROOM_UPDATED]);
    socket.off(EVENTS.GAME_STATE, listeners[EVENTS.GAME_STATE]);
    socket.off(EVENTS.GAME_SHOWDOWN, listeners[EVENTS.GAME_SHOWDOWN]);
    socket.off(EVENTS.GAME_ERROR, listeners[EVENTS.GAME_ERROR]);
    socket.off('connect', listeners.connect);
    set({ socketInited: false, socketListeners: null });
  },

  // ── 动作 ──
  createRoom: (playerName) => {
    set({ myName: playerName });
    socket.emit(EVENTS.CREATE_ROOM, { playerName });
  },

  joinRoom: (roomId, playerName) => {
    set({ myName: playerName });
    socket.emit(EVENTS.JOIN_ROOM, { roomId, playerName });
  },

  leaveRoom: () => {
    socket.emit(EVENTS.LEAVE_ROOM);
    set({ currentRoom: null, gameState: null, page: 'lobby' });
  },

  startGame: () => {
    socket.emit(EVENTS.START_GAME);
  },

  playerAction: (action, amount) => {
    socket.emit(EVENTS.PLAYER_ACTION, { action, amount });
  },

  nextRound: () => {
    socket.emit(EVENTS.NEXT_ROUND);
    set({ showdown: null });
  },
}));

export default useStore;
