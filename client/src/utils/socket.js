import { io } from 'socket.io-client';

function getSocketUrl() {
  const envUrl = (import.meta.env.VITE_SOCKET_URL || '').trim();
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3001';
}

function getStoredToken() {
  try {
    return localStorage.getItem('token') || undefined;
  } catch {
    return undefined;
  }
}

// 全局单例，整个应用共享同一个 socket 连接
const socket = io(getSocketUrl(), {
  autoConnect: true,
  auth: { token: getStoredToken() },
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// 登录后更新认证信息
socket.setAuthToken = function (token) {
  try {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  } catch { /* ignore */ }
  socket.auth = { token };
  if (socket.connected) {
    socket.disconnect().connect();
  }
};

// 清除认证（退出登录）
socket.clearAuth = function () {
  socket.setAuthToken(undefined);
};

socket.on('connect', () => {
  console.log('✅ Socket 已连接:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.warn('❌ Socket 断开:', reason);
});

socket.on('connect_error', (err) => {
  console.error('连接错误:', err.message);
});

export default socket;
