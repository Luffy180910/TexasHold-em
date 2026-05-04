const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { registerSocketHandlers } = require('./socket/handlers');
const roomRoutes = require('./routes/rooms');
const authRoutes = require('./routes/auth');
const { getLeaderboard } = require('./db/users');
const { initSchema } = require('./db/schema');
const pool = require('./db/pool');

const app = express();
const httpServer = createServer(app);

const isDev = process.env.NODE_ENV !== 'production';
const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const customOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = isDev
  ? [...new Set([...defaultOrigins, ...customOrigins])]
  : customOrigins.length > 0
    ? customOrigins
    : undefined; // 生产环境未配置时允许同源，但仍需显式处理

const corsOptions = {
  origin(origin, callback) {
    // 生产环境未配置 CORS_ORIGIN 时允许所有同源请求（无 origin 头）
    if (!isDev && customOrigins.length === 0) return callback(null, true);
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
app.use('/api/auth', authRoutes);

// 排行榜 API
app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const board = await getLeaderboard(limit);
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: '获取排行榜失败' });
  }
});

// ── 生产环境：托管前端构建产物 ──
if (!isDev) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  // SPA fallback：所有非 API 请求返回 index.html
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return; // 不应该到达这里，但保留保护
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── 注册所有 Socket 事件处理器 ──
registerSocketHandlers(io);

const PORT = process.env.PORT || 3001;

// 初始化数据库后启动服务
async function start() {
  try {
    await initSchema();
    await pool.query('SELECT 1');
    console.log('✅ 数据库已连接');
  } catch (err) {
    console.warn('⚠️  数据库不可用，部分功能降级:', err.message);
  }
  httpServer.listen(PORT, () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}${!isDev ? ' (生产模式)' : ''}`);
  });
}

start();
