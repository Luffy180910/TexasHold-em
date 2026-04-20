// ── Redis 客户端（连接管理与可用性检测）──
const Redis = require('ioredis');

let redisClient = null;
let redisAvailable = false;

function createRedisClient() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  if (!process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  生产环境中未设置 REDIS_URL，将使用默认本地地址（不推荐）');
  }

  const client = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    // 最多重试 3 次，之后放弃并降级到内存存储
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
    maxRetriesPerRequest: 1,
  });

  client.on('connect', () => {
    redisAvailable = true;
    console.log('✅ Redis 已连接');
  });

  client.on('ready', () => {
    redisAvailable = true;
  });

  client.on('error', (err) => {
    if (redisAvailable) {
      console.warn(`⚠️  Redis 错误（降级为内存存储）: ${err.message}`);
    }
    redisAvailable = false;
  });

  client.on('close', () => {
    redisAvailable = false;
  });

  // 尝试连接（不阻塞启动）
  client.connect().catch(() => {
    console.warn('⚠️  Redis 不可用，使用内存存储作为降级方案');
  });

  return client;
}

function getClient() {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

function isAvailable() {
  return redisAvailable;
}

module.exports = { getClient, isAvailable };
