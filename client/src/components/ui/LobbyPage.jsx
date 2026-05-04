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

  const initial = (user?.username || '?')[0].toUpperCase();

  return (
    <div className="lobby">
      {/* 用户信息栏 */}
      <div className="profile-bar">
        <div className="avatar-circle">{initial}</div>
        <div style={{ flex: 1 }}>
          <div className="profile-name">{user?.isGuest ? '游客模式' : user?.username}</div>
          <div className="profile-meta">
            {user?.isGuest ? '登录后可保存战绩' : '已登录 · 战绩自动保存'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn btn-small ${showLeaderboard ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { fetchLeaderboard(); setShowLeaderboard(v => !v); }}
          >
            {showLeaderboard ? '隐藏' : '排行榜'}
          </button>
          <button className="btn btn-small btn-ghost" onClick={logout}>
            {user?.isGuest ? '登录' : '退出'}
          </button>
        </div>
      </div>

      <h1 className="lobby-title">Texas Hold'em</h1>

      {/* 排行榜 */}
      {showLeaderboard && (
        <div className="leaderboard-panel">
          <div className="leaderboard-title">排行榜</div>
          {leaderboard.length === 0 ? (
            <p className="muted">暂无数据</p>
          ) : (
            <table className="lb-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>玩家</th>
                  <th className="r">局数</th>
                  <th className="r">胜场</th>
                  <th className="r">胜率</th>
                  <th className="r">盈利</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={i}>
                    <td style={{ color: i < 3 ? ['#ffd700','#c0c0c0','#cd7f32'][i] : 'var(--text-muted)', fontWeight: 600 }}>
                      {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
                    </td>
                    <td>{row.username}</td>
                    <td className="r muted">{row.total_games}</td>
                    <td className="r">{row.wins}</td>
                    <td className={`r ${row.win_rate >= 50 ? 'text-win' : 'text-loss'}`}>
                      {row.win_rate}%
                    </td>
                    <td className={`r ${row.total_winnings >= 0 ? 'text-win' : 'text-loss'}`}>
                      {row.total_winnings > 0 ? '+' : ''}{row.total_winnings}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 创建房间 */}
      <div className="lobby-form">
        <input
          className="input"
          placeholder="你的名字"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={12}
        />
        <button className="btn btn-primary" onClick={handleCreate}>创建房间</button>
      </div>

      {/* 加入房间 */}
      <div className="lobby-join">
        <input
          className="input"
          placeholder="房间号（6位）"
          value={joinId}
          onChange={e => setJoinId(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <button className="btn btn-secondary" onClick={() => handleJoin(joinId)}>加入房间</button>
      </div>

      {/* 开放房间列表 */}
      <div className="room-list">
        <h2>开放房间</h2>
        {rooms.length === 0 && <p className="muted">暂无开放房间</p>}
        {rooms.map(room => (
          <div key={room.id} className="room-card" onClick={() => handleJoin(room.id)}>
            <span className="room-id">#{room.id}</span>
            <span className="room-players">{room.players.length}/{room.maxPlayers} 人</span>
            <button className="btn btn-small btn-primary">加入</button>
          </div>
        ))}
      </div>
    </div>
  );
}
