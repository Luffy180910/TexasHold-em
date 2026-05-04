import { io } from 'socket.io-client';

function getSocketUrl() {
  const envUrl = (import.meta.env.VITE_SOCKET_URL || '').trim();
  if (envUrl) return envUrl;
  // 生产环境：客户端由服务端同一端口托管，直接使用同源地址
  // 开发环境：Vite dev server (:5173) 和 Express (:3001) 不同端口，
  //           通过 VITE_SOCKET_URL 环境变量配置（见 client/.env）
  if (typeof window !== 'undefined') {
    return window.location.origin;
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
