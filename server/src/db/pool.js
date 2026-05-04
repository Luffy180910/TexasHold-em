const { Pool } = require('pg');

let connectionString = process.env.DATABASE_URL;

// DigitalOcean 的 DATABASE_URL 默认带 ?sslmode=require，
// pg 库解析后会以严格模式验证证书（DO 用自签名证书会失败）。
// 移除 sslmode 参数，改用下方 ssl 配置统一控制。
if (connectionString) {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    connectionString = url.toString();
  } catch {
    // URL 解析失败则保持原样
  }
}

const useSSL = process.env.NODE_ENV === 'production'
  || (process.env.DATABASE_URL || '').includes('ondigitalocean');

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL 连接池异常:', err.message);
});

module.exports = pool;
