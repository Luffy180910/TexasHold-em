const RED_SUITS = ['♥', '♦'];

export default function Card({ card, large = false }) {
  // card 为 null 表示背面
  if (!card) {
    return <div className={`card card-back ${large ? 'card-large' : ''}`} />;
  }

  const isRed = RED_SUITS.includes(card.suit);
  return (
    <div className={`card ${isRed ? 'card-red' : 'card-black'} ${large ? 'card-large' : ''}`}>
      <span className="card-rank">{card.rank}</span>
      <span className="card-suit">{card.suit}</span>
    </div>
  );
}
