const pool = require('./pool');

async function initSchema() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(20) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        total_games INT DEFAULT 0,
        wins INT DEFAULT 0,
        total_winnings INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS game_rounds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id VARCHAR(6) NOT NULL,
        round_num INT NOT NULL,
        winner_names TEXT[] DEFAULT '{}',
        winner_hand VARCHAR(50),
        pot INT DEFAULT 0,
        player_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS player_rounds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        round_id UUID REFERENCES game_rounds(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        player_name VARCHAR(100) NOT NULL,
        final_hand VARCHAR(50),
        chips_won INT DEFAULT 0,
        folded BOOLEAN DEFAULT false,
        all_in BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 房间表：替代内存/Redis 存储
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(6) PRIMARY KEY,
        host VARCHAR(255),
        players JSONB DEFAULT '[]',
        status VARCHAR(20) DEFAULT 'waiting',
        max_players INT DEFAULT 4,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_player_rounds_user_id ON player_rounds(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_player_rounds_round_id ON player_rounds(round_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_game_rounds_room_id ON game_rounds(room_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
    `);

    await client.query('COMMIT');
    console.log('✅ 数据库表结构已就绪');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 数据库初始化失败:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { initSchema };
