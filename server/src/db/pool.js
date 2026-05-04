const { Pool } = require('pg');

const useSSL = process.env.NODE_ENV === 'production' || (process.env.DATABASE_URL || '').includes('ondigitalocean');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL 连接池异常:', err.message);
});

module.exports = pool;
