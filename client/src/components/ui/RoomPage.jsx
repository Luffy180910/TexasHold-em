import { useState } from 'react';
import useStore from '../../store/gameStore';

export default function RoomPage() {
  const { currentRoom, myId, startGame, leaveRoom } = useStore();
  const [copied, setCopied] = useState(false);
  if (!currentRoom) return null;

  const isHost = currentRoom.host === myId;
  const canStart = currentRoom.players.length >= 2;

  const handleCopy = () => {
    navigator.clipboard?.writeText(currentRoom.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="room-page">
      <div className="room-header">
        <div className="room-code-display">
          <span className="room-code-label">房间号</span>
          <span className="room-code-value">{currentRoom.id}</span>
          <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
            {copied ? '已复制' : '复制'}
          </button>
        </div>
        <button className="btn btn-danger" onClick={leaveRoom}>离开</button>
      </div>

      <div className="player-list">
        <h3>玩家列表 ({currentRoom.players.length}/{currentRoom.maxPlayers})</h3>
        {currentRoom.players.map(p => (
          <div key={p.id} className="player-slot">
            <div className="player-avatar">{p.name[0]}</div>
            <span className="player-slot-name">{p.name}</span>
            {p.id === currentRoom.host && <span className="badge badge-host">房主</span>}
            {p.id === myId && <span className="badge badge-you">你</span>}
          </div>
        ))}
      </div>

      <div className="room-hint">
        {isHost
          ? canStart ? '点击开始游戏' : '等待更多玩家加入（至少2人）'
          : '等待房主开始游戏...'}
      </div>

      {isHost && (
        <button
          className={`btn btn-primary btn-large ${canStart ? 'btn-pulse' : ''}`}
          onClick={startGame}
          disabled={!canStart}
          style={{ width: '100%' }}
        >
          开始游戏
        </button>
      )}
    </div>
  );
}
