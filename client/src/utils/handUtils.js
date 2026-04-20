// 客户端牌型工具函数（用于 UI 展示提示）

export const HAND_RANKS = [
  '高牌', '一对', '两对', '三条',
  '顺子', '同花', '葫芦', '四条',
  '同花顺', '皇家同花顺',
];

export const HAND_DESCRIPTIONS = {
  '高牌':    '没有组合，以最大单牌比较',
  '一对':    '两张相同点数的牌',
  '两对':    '两组不同点数的对子',
  '三条':    '三张相同点数的牌',
  '顺子':    '五张连续点数的牌',
  '同花':    '五张相同花色的牌',
  '葫芦':    '三条 + 一对',
  '四条':    '四张相同点数的牌',
  '同花顺':  '五张连续且同花色的牌',
  '皇家同花顺': 'A-K-Q-J-10 同花色，最强牌型',
};

// 胜率估算（蒙特卡洛模拟，手牌 + 公共牌 → 胜率百分比）
export function estimateWinRate(hand, community, numOpponents = 1, simCount = 500) {
  if (!hand || hand.length < 2) return null;

  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS_LIST = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

  function makeDeck() {
    const used = new Set([...hand, ...community].map(c => c.rank + c.suit));
    const deck = [];
    for (const s of SUITS)
      for (const r of RANKS_LIST) {
        const key = r + s;
        if (!used.has(key)) deck.push({ rank: r, suit: s, value: RANKS_LIST.indexOf(r) });
      }
    return deck;
  }

  function shuffle(d) {
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function handScore(cards) {
    const vals = cards.map(c => c.value).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);
    const counts = {};
    for (const v of vals) counts[v] = (counts[v] || 0) + 1;
    const groups = Object.values(counts).sort((a, b) => b - a);
    const isFlush = suits.every(s => s === suits[0]);
    const uv = [...new Set(vals)].sort((a, b) => b - a);
    let isStraight = false, highS = 0;
    for (let i = 0; i <= uv.length - 5; i++) {
      if (uv[i] - uv[i + 4] === 4) { isStraight = true; highS = uv[i]; break; }
    }
    if (!isStraight && uv.includes(12) && [0,1,2,3].every(v => uv.includes(v))) {
      isStraight = true; highS = 3;
    }
    if (isFlush && isStraight) return 800 + highS;
    if (groups[0] === 4) return 700 + vals[0];
    if (groups[0] === 3 && groups[1] === 2) return 600 + vals[0];
    if (isFlush) return 500 + vals[0];
    if (isStraight) return 400 + highS;
    if (groups[0] === 3) return 300 + vals[0];
    if (groups[0] === 2 && groups[1] === 2) return 200 + vals[0];
    if (groups[0] === 2) return 100 + vals[0];
    return vals[0];
  }

  function bestScore(h, comm) {
    const all = [...h, ...comm];
    let best = 0;
    for (let i = 0; i < all.length - 4; i++)
      for (let j = i+1; j < all.length - 3; j++)
        for (let k = j+1; k < all.length - 2; k++)
          for (let l = k+1; l < all.length - 1; l++)
            for (let m = l+1; m < all.length; m++) {
              const s = handScore([all[i],all[j],all[k],all[l],all[m]]);
              if (s > best) best = s;
            }
    return best;
  }

  let wins = 0;
  const needed = 5 - community.length;

  for (let sim = 0; sim < simCount; sim++) {
    const deck = shuffle(makeDeck());
    const board = [...community, ...deck.splice(0, needed)];
    const myScore = bestScore(hand, board);
    let lost = false;
    for (let o = 0; o < numOpponents; o++) {
      const oppHand = deck.splice(0, 2);
      if (oppHand.length < 2) break;
      if (bestScore(oppHand, board) > myScore) { lost = true; break; }
    }
    if (!lost) wins++;
  }

  return Math.round((wins / simCount) * 100);
}
