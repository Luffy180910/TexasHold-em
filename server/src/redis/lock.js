// ── 基于 Redis 的分布式锁 ──
// 使用 SET NX PX 原语实现，支持安全释放（Lua 脚本保证原子性）

const { getClient, isAvailable } = require('./client');

const DEFAULT_TTL_MS = 3000; // 默认锁超时 3 秒

// Lua 脚本：仅当锁持有者匹配时才释放，防止误删他人的锁
const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

/**
 * 尝试获取分布式锁
 * @param {string} resource  锁定的资源标识（如房间 ID）
 * @param {number} ttlMs     锁的超时毫秒数
 * @returns {string|null}    成功返回 token，失败返回 null
 */
async function acquireLock(resource, ttlMs = DEFAULT_TTL_MS) {
  if (!isAvailable()) return null;
  const client = getClient();
  const lockKey = `lock:${resource}`;
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const result = await client.set(lockKey, token, 'PX', ttlMs, 'NX');
  return result === 'OK' ? token : null;
}

/**
 * 释放分布式锁（原子操作，防止误删）
 * @param {string} resource
 * @param {string} token
 */
async function releaseLock(resource, token) {
  if (!isAvailable()) return;
  const client = getClient();
  const lockKey = `lock:${resource}`;
  await client.eval(RELEASE_SCRIPT, 1, lockKey, token);
}

/**
 * 带锁执行函数
 * - Redis 可用时：获取分布式锁，执行后释放
 * - Redis 不可用时：直接执行（单进程 Node.js 无并发问题）
 * @param {string}   resource  锁资源名称
 * @param {Function} fn        要在锁保护下执行的异步函数
 * @param {number}   ttlMs     锁超时毫秒数
 */
async function withLock(resource, fn, ttlMs = DEFAULT_TTL_MS) {
  if (!isAvailable()) {
    return fn();
  }

  const token = await acquireLock(resource, ttlMs);
  if (!token) {
    throw new Error(`获取锁失败: ${resource}，请稍后重试`);
  }
  try {
    return await fn();
  } finally {
    await releaseLock(resource, token);
  }
}

module.exports = { acquireLock, releaseLock, withLock };
