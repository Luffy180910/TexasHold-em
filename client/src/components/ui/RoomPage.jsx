import useStore from '../../store/gameStore';

export default function RoomPage() {
  const { currentRoom, myId, startGame, leaveRoom } = useStore();
  if (!currentRoom) return null;

  const isHost = currentRoom.host === myId;
  const canStart = currentRoom.players.length >= 2;

  return (
    <div className="room-page">
      <div className="room-header">
        <h2>房间号：<span className="room-code">{currentRoom.id}</span></h2>
        <button className="btn btn-danger" onClick={leaveRoom}>离开</button>
      </div>

      <div className="player-list">
        <h3>玩家列表 ({currentRoom.players.length}/{currentRoom.maxPlayers})</h3>
        {currentRoom.players.map(p => (
          <div key={p.id} className="player-item">
            <span>{p.name}</span>
            {p.id === currentRoom.host && <span className="host-badge">房主</span>}
            {p.id === myId && <span className="you-badge">你</span>}
          </div>
        ))}
      </div>

      <div className="room-hint">
        {isHost
          ? canStart
            ? '点击开始游戏'
            : '等待更多玩家加入（至少2人）'
          : '等待房主开始游戏...'}
      </div>

      {isHost && (
        <button
          className="btn btn-primary btn-large"
          onClick={startGame}
          disabled={!canStart}
        >
          开始游戏
        </button>
      )}
    </div>
  );
}
