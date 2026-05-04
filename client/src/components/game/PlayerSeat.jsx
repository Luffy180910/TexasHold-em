import Card from './Card';

export default function PlayerSeat({ player, isActive }) {
  const { name, chips, bet, folded, allIn, hand } = player;

  return (
    <div className={`player-seat ${isActive ? 'seat-active' : ''} ${folded ? 'seat-folded' : ''}`}>
      <div className="seat-name">{name}</div>
      <div className="seat-chips">
        <span className="chip-icon" /> {chips}
      </div>
      {bet > 0 && <div className="seat-bet">下注: {bet}</div>}
      <div className="seat-cards">
        {hand?.map((card, i) => <Card key={i} card={card} />)}
      </div>
      {folded && <div className="seat-tag tag-fold">已弃牌</div>}
      {allIn && <div className="seat-tag tag-allin">全押!</div>}
    </div>
  );
}
