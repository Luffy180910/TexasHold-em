import { useState, useEffect } from 'react';
import useStore from '../../store/gameStore';

export default function LobbyPage() {
  const {
    rooms, user, leaderboard,
    createRoom, joinRoom, logout, fetchLeaderboard,
  } = useStore();

  const defaultName = user?.username || '';
  const [name, setName] = useState(defaultName);
  const [joinId, setJoinId] = useState('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleCreate = () => {
    if (!name.trim()) return;
    createRoom(name.trim());
  };

  const handleJoin = (roomId) => {
    if (!name.trim()) return alert('请先输入名字');
    joinRoom(roomId, name.trim());
  };

  return (
    <div className="lobby">
      {/* 用户信息栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {user?.isGuest ? (
            <span>游客模式</span>
          ) : (
            <span>👤 {user?.username}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-small"
            style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'var(--text-muted)' }}
            onClick={() => { fetchLeaderboard(); setShowLeaderboard(v => !v); }}
          >
            {showLeaderboard ? '隐藏' : '排行榜'}
          </button>
          {user?.isGuest ? (
            <button
              className="btn btn-small"
              style={{ borderColor: 'var(--gold)', color: 'var(--gold-light)' }}
              onClick={logout}
            >
              登录/注册
            </button>
          ) : (
            <button
              className="btn btn-small"
              style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'var(--text-muted)' }}
              onClick={logout}
            >
              退出
            </button>
          )}
        </div>
      </div>

      <h1 className="lobby-title">♠ Texas Hold'em</h1>

      {/* 排行榜 */}
      {showLeaderboard && (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 10,
          padding: 16,
          marginBottom: 24,
          textAlign: 'left',
        }}>
          <h2 style={{ fontSize: 15, marginBottom: 12, color: 'var(--gold-light)' }}>
            🏆 排行榜
          </h2>
          {leaderboard.length === 0 ? (
            <p className="muted">暂无数据</p>
          ) : (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '6px 4px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '6px 4px', textAlign: 'left' }}>玩家</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>局数</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>胜场</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>胜率</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>盈利</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ padding: '6px 4px' }}>{row.username}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', color: 'var(--text-muted)' }}>{row.total_games}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{row.wins}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', color: row.win_rate > 50 ? '#66bb6a' : 'var(--text-muted)' }}>
                      {row.win_rate}%
                    </td>
                    <td style={{
                      padding: '6px 4px',
                      textAlign: 'right',
                      color: row.total_winnings > 0 ? '#66bb6a' : row.total_winnings < 0 ? '#ff8a80' : 'var(--text-muted)',
                    }}>
                      {row.total_winnings > 0 ? '+' : ''}{row.total_winnings}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="lobby-form">
        <input
          className="input"
          placeholder="你的名字"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={12}
        />
        <button className="btn btn-primary" onClick={handleCreate}>
          创建房间
        </button>
      </div>

      <div className="lobby-join">
        <input
          className="input"
          placeholder="房间号（6位）"
          value={joinId}
          onChange={e => setJoinId(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <button className="btn btn-secondary" onClick={() => handleJoin(joinId)}>
          加入房间
        </button>
      </div>

      <div className="room-list">
        <h2>开放房间</h2>
        {rooms.length === 0 && <p className="muted">暂无开放房间</p>}
        {rooms.map(room => (
          <div key={room.id} className="room-item">
            <span className="room-id">#{room.id}</span>
            <span className="room-players">{room.players.length}/{room.maxPlayers} 人</span>
            <button className="btn btn-small" onClick={() => handleJoin(room.id)}>
              加入
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
