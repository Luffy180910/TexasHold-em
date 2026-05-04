const pool = require('./pool');
const bcrypt = require('bcryptjs');

async function createUser(username, password) {
  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING
     RETURNING id, username, total_games, wins, total_winnings, created_at`,
    [username, hash]
  );
  return result.rows[0] || null;
}

async function findUser(username, password) {
  const result = await pool.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  const user = result.rows[0];
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

async function getUserById(id) {
  const result = await pool.query(
    'SELECT id, username, total_games, wins, total_winnings, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function updateStats(userId, { won, winnings }) {
  await pool.query(
    `UPDATE users SET
       total_games = total_games + 1,
       wins = wins + CASE WHEN $2 > 0 THEN 1 ELSE 0 END,
       total_winnings = total_winnings + $2,
       updated_at = NOW()
     WHERE id = $1`,
    [userId, winnings]
  );
}

async function getLeaderboard(limit = 10) {
  const result = await pool.query(
    `SELECT username, total_games, wins, total_winnings,
       CASE WHEN total_games > 0 THEN ROUND(wins::numeric / total_games * 100, 1) ELSE 0 END AS win_rate
     FROM users
     ORDER BY total_winnings DESC, wins DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

module.exports = { createUser, findUser, getUserById, updateStats, getLeaderboard };
