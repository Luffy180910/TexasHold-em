const pool = require('./pool');
const { updateStats } = require('./users');

async function saveRound(roomId, roundNum, showdown) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const winnerNames = showdown.winners.map(w => w.name);
    const result = await client.query(
      `INSERT INTO game_rounds (room_id, round_num, winner_names, winner_hand, pot, player_count)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [roomId, roundNum, winnerNames, showdown.winner.hand, showdown.winner.pot, showdown.players.length]
    );
    const roundId = result.rows[0].id;

    for (const p of showdown.players) {
      const won = showdown.winners.some(w => w.id === p.id) ? winningsForPlayer(p, showdown) : 0;
      await client.query(
        `INSERT INTO player_rounds (round_id, player_name, final_hand, chips_won, folded)
         VALUES ($1, $2, $3, $4, $5)`,
        [roundId, p.name, p.rank, won, !p.hand || p.hand.every(c => c === null)]
      );

      // 更新用户战绩（如果该玩家有关联的 user_id）
      await updateStatsForPlayer(client, p.id, showdown);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 保存游戏记录失败:', err.message);
  } finally {
    client.release();
  }
}

function winningsForPlayer(player, showdown) {
  const winner = showdown.winners.find(w => w.id === player.id);
  return winner ? winner.gain : 0;
}

async function updateStatsForPlayer(client, playerId, showdown) {
  const winner = showdown.winners.find(w => w.id === playerId);
  const winnings = winner ? winner.gain : 0;
  await client.query(
    `UPDATE users SET
       total_games = total_games + 1,
       wins = wins + CASE WHEN $2 > 0 THEN 1 ELSE 0 END,
       total_winnings = total_winnings + ($2),
       updated_at = NOW()
     WHERE id = $1`,
    [playerId, winnings]
  );
}

async function getUserHistory(userId, limit = 20) {
  const result = await pool.query(
    `SELECT gr.id, gr.room_id, gr.round_num, gr.winner_names, gr.winner_hand,
            gr.pot, pr.chips_won, pr.final_hand, pr.folded, pr.all_in, gr.created_at
     FROM game_rounds gr
     JOIN player_rounds pr ON pr.round_id = gr.id
     WHERE pr.user_id = $1
     ORDER BY gr.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

async function getUserStats(userId) {
  const result = await pool.query(
    `SELECT total_games, wins, total_winnings,
       CASE WHEN total_games > 0 THEN ROUND(wins::numeric / total_games * 100, 1) ELSE 0 END AS win_rate
     FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

module.exports = { saveRound, getUserHistory, getUserStats };
