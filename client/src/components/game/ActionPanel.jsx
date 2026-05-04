import { useState, useEffect } from 'react';

export default function ActionPanel({ isMyTurn, me, currentBet, onAction }) {
  const [raiseAmount, setRaiseAmount] = useState('');
  const [showRaise, setShowRaise] = useState(false);

  const canCheck = me && me.bet >= currentBet;
  const callAmount = me ? Math.min(currentBet - me.bet, me.chips) : 0;
  const minRaise = currentBet + 10;

  const handleRaise = () => {
    const amount = parseInt(raiseAmount);
    if (!amount || amount < minRaise) return;
    onAction('raise', amount);
    setShowRaise(false);
    setRaiseAmount('');
  };

  useEffect(() => {
    if (!isMyTurn) return;
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key.toLowerCase()) {
        case 'f': onAction('fold'); break;
        case 'c': onAction(canCheck ? 'check' : 'call'); break;
        case 'r': setShowRaise(v => !v); break;
        case 'a': onAction('allin'); break;
        case 'enter': if (showRaise) handleRaise(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMyTurn, canCheck, showRaise, raiseAmount]);

  if (!isMyTurn) return null;

  return (
    <div className="action-panel">
      <div className="action-hint">
        当前注: <strong>{currentBet}</strong>
        <span className="shortcut-hint">F 弃牌 C 过牌/跟注 R 加注 A 全押</span>
      </div>

      <div className="action-buttons">
        <button className="btn btn-fold" onClick={() => onAction('fold')}>
          弃牌 <kbd>F</kbd>
        </button>

        {canCheck
          ? <button className="btn btn-check" onClick={() => onAction('check')}>
              过牌 <kbd>C</kbd>
            </button>
          : <button className="btn btn-call" onClick={() => onAction('call')}>
              跟注 {callAmount} <kbd>C</kbd>
            </button>
        }

        <button
          className={`btn btn-raise ${showRaise ? 'btn-active' : ''}`}
          onClick={() => setShowRaise(v => !v)}
        >
          加注 <kbd>R</kbd>
        </button>

        <button className="btn btn-allin" onClick={() => onAction('allin')}>
          全押 <kbd>A</kbd>
        </button>
      </div>

      {showRaise && (
        <div className="raise-row">
          <input
            autoFocus
            type="number"
            className="input raise-input"
            placeholder={`最低 ${minRaise}`}
            value={raiseAmount}
            onChange={e => setRaiseAmount(e.target.value)}
            min={minRaise}
            step={10}
          />
          <button className="btn btn-primary" onClick={handleRaise}>
            确认 <kbd>↵</kbd>
          </button>
          <button className="btn btn-ghost" onClick={() => setShowRaise(false)}>
            取消
          </button>
        </div>
      )}
    </div>
  );
}
