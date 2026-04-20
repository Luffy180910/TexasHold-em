const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { registerSocketHandlers } = require('./socket/handlers');
const roomRoutes = require('./routes/rooms');

const app = express();
const httpServer = createServer(app);

// ── Socket.io 配置 ──
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173', // Vite 默认端口
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// ── REST API 路由（房间列表等）──
app.use('/api/rooms', roomRoutes);

// ── 注册所有 Socket 事件处理器 ──
registerSocketHandlers(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
});
