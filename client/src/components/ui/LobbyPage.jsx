import { useState } from 'react';
import useStore from '../../store/gameStore';

export default function LobbyPage() {
  const { rooms, createRoom, joinRoom } = useStore();
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');

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
      <h1 className="lobby-title">♠ Texas Hold'em</h1>

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
