import { create } from 'zustand';
import socket from '../utils/socket';

const API_BASE = '/api';

// ── 事件名称（与服务端同步）──
export const EVENTS = {
  CREATE_ROOM:   'room:create',
  JOIN_ROOM:     'room:join',
  LEAVE_ROOM:    'room:leave',
  START_GAME:    'game:start',
  PLAYER_ACTION: 'player:action',
  NEXT_ROUND:    'game:nextRound',
  LEADERBOARD_GET: 'leaderboard:get',
  ROOM_UPDATED:  'room:updated',
  GAME_STATE:    'game:state',
  GAME_SHOWDOWN: 'game:showdown',
  GAME_ERROR:    'game:error',
  ROOMS_LIST:    'rooms:list',
  LEADERBOARD_RESULT: 'leaderboard:result',
};

// ── REST API 辅助 ──
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

const useStore = create((set, get) => ({
  // ── Auth 状态 ──
  user: null,
  token: localStorage.getItem('token') || null,

  // ── 游戏状态 ──
  myId: null,
  myName: '',
  page: 'lobby',
  rooms: [],
  currentRoom: null,
  gameState: null,
  showdown: null,
  error: null,
  leaderboard: [],
  socketInited: false,
  socketListeners: null,

  // ── Auth 动作 ──
  login: async (username, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('token', data.token);
    socket.setAuthToken(data.token);
    set({ user: data.user, token: data.token });
    return data;
  },

  register: async (username, password) => {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('token', data.token);
    socket.setAuthToken(data.token);
    set({ user: data.user, token: data.token });
    return data;
  },

  loginAsGuest: () => {
    set({
      user: { id: null, username: '', isGuest: true },
      token: null,
    });
  },

  logout: () => {
    localStorage.removeItem('token');
    socket.clearAuth();
    set({ user: null, token: null, page: 'lobby' });
  },

  fetchMe: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const data = await api('/auth/me');
      set({ user: data.user });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null });
    }
  },

  fetchLeaderboard: () => {
    socket.emit(EVENTS.LEADERBOARD_GET);
  },

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
    const onLeaderboard = (data) => set({ leaderboard: data });
    const onConnect = () => set({ myId: socket.id });

    set({ myId: socket.id });

    socket.on(EVENTS.ROOMS_LIST, onRoomsList);
    socket.on(EVENTS.ROOM_UPDATED, onRoomUpdated);
    socket.on(EVENTS.GAME_STATE, onGameState);
    socket.on(EVENTS.GAME_SHOWDOWN, onGameShowdown);
    socket.on(EVENTS.GAME_ERROR, onGameError);
    socket.on(EVENTS.LEADERBOARD_RESULT, onLeaderboard);
    socket.on('connect', onConnect);

    set({
      socketInited: true,
      socketListeners: {
        [EVENTS.ROOMS_LIST]: onRoomsList,
        [EVENTS.ROOM_UPDATED]: onRoomUpdated,
        [EVENTS.GAME_STATE]: onGameState,
        [EVENTS.GAME_SHOWDOWN]: onGameShowdown,
        [EVENTS.GAME_ERROR]: onGameError,
        [EVENTS.LEADERBOARD_RESULT]: onLeaderboard,
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
    socket.off(EVENTS.LEADERBOARD_RESULT, listeners[EVENTS.LEADERBOARD_RESULT]);
    socket.off('connect', listeners.connect);
    set({ socketInited: false, socketListeners: null });
  },

  // ── 游戏动作 ──
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
