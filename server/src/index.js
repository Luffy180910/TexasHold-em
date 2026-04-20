const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { registerSocketHandlers } = require('./socket/handlers');
const roomRoutes = require('./routes/rooms');
const { isAvailable } = require('./redis/client');

// 预加载 Redis 客户端（建立连接）
require('./redis/client').getClient();

const app = express();
const httpServer = createServer(app);

const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const customOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...customOrigins])];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
};

// ── Socket.io 配置 ──
const io = new Server(httpServer, {
  cors: corsOptions,
});

app.use(cors(corsOptions));
app.use(express.json());

// ── REST API 路由（房间列表等）──
app.use('/api/rooms', roomRoutes);

// ── 健康检查 endpoint ──
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    redis: isAvailable() ? 'connected' : 'unavailable (using memory fallback)',
    uptime: Math.floor(process.uptime()),
  });
});

// ── 注册所有 Socket 事件处理器 ──
registerSocketHandlers(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
});
