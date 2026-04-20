import useStore from '../../store/gameStore';
import Card from './Card';
import PlayerSeat from './PlayerSeat';
import ActionPanel from './ActionPanel';
import WinRateDisplay from './WinRateDisplay';

const PHASE_LABELS = {
  preflop: '翻牌前', flop: '翻牌', turn: '转牌', river: '河牌', showdown: '摊牌',
};

export default function GamePage() {
  const { gameState, showdown, myId, playerAction, nextRound } = useStore();

  if (!gameState) return <div className="loading">加载游戏中...</div>;

  const { players, community, pot, currentBet, currentPlayer, phase, log } = gameState;
  const me = players.find(p => p.id === myId);
  const isMyTurn = currentPlayer === myId && !me?.folded && !me?.allIn;
  const opponents = players.filter(p => p.id !== myId);
  const numOpponents = opponents.filter(p => !p.folded).length;

  return (
    <div className="game-table">

      {/* 对手区域（顶部） */}
      <div className="opponents-row">
        {opponents.map(p => (
          <PlayerSeat
            key={p.id}
            player={p}
            isActive={p.id === currentPlayer}
          />
        ))}
      </div>

      {/* 牌桌中央 */}
      <div className="table-center">
        <div className="pot-display">
          <span className="chip-icon">●</span> 底池: {pot}
        </div>
        <div className="community-cards">
          {community.length === 0
            ? <span className="waiting-text">等待发牌…</span>
            : community.map((card, i) => <Card key={i} card={card} />)
          }
        </div>
        <div className="phase-tag">{PHASE_LABELS[phase] || phase}</div>
      </div>

      {/* 我的区域（底部） */}
      <div className="my-area">
        {me && (
          <>
            <div className="my-hand-row">
              <div className="my-cards">
                {me.hand?.map((card, i) => <Card key={i} card={card} large />)}
              </div>
              <WinRateDisplay
                hand={me.hand}
                community={community}
                numOpponents={numOpponents || 1}
              />
            </div>
            <div className="my-info-row">
              <span className="my-name">{me.name}</span>
              <span className="my-chips">💰 {me.chips}</span>
              {me.bet > 0 && <span className="my-bet">已下注: {me.bet}</span>}
              {me.folded && <span className="tag-fold">已弃牌</span>}
              {me.allIn && <span className="tag-allin">ALL IN</span>}
            </div>
          </>
        )}

        <ActionPanel
          isMyTurn={isMyTurn}
          me={me}
          currentBet={currentBet}
          onAction={(action, amount) => playerAction(action, amount)}
        />

        {!isMyTurn && me && !me.folded && !me.allIn && (
          <div className="waiting-hint">
            等待 <strong>{players.find(p => p.id === currentPlayer)?.name || '...'}</strong> 操作…
          </div>
        )}
      </div>

      {/* 游戏日志 */}
      <div className="game-log">
        {log?.slice(0, 4).map((entry, i) => (
          <div key={i} className={`log-entry ${i === 0 ? 'log-latest' : ''}`}>
            {entry}
          </div>
        ))}
      </div>

      {/* 摊牌结果弹窗 */}
      {showdown && (
        <div className="modal-overlay">
          <div className="modal showdown-modal">
            <div className="modal-trophy">🏆</div>
            <h2>{showdown.winner.name} 获胜！</h2>
            <div className="winner-hand-tag">{showdown.winner.hand}</div>
            <p className="winner-pot">赢得底池 <strong>{showdown.winner.pot}</strong> 筹码</p>
            <div className="showdown-results">
              {showdown.players.map(p => (
                <div key={p.id} className="showdown-row">
                  <div className="showdown-player-info">
                    <span className="showdown-name">{p.name}</span>
                    <span className="showdown-rank">{p.rank}</span>
                  </div>
                  <div className="showdown-cards">
                    {p.hand?.map((card, i) => <Card key={i} card={card} />)}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-large" onClick={nextRound}>
              下一局 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
