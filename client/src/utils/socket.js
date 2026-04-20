import { io } from 'socket.io-client';

function getSocketUrl() {
  const envUrl = import.meta.env.VITE_SOCKET_URL?.trim();
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3001`;
  }
  return 'http://localhost:3001';
}

// 全局单例，整个应用共享同一个 socket 连接
const socket = io(getSocketUrl(), {
  autoConnect: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

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
