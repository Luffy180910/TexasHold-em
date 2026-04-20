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

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS_LIST = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function makeDeck(hand, community) {
  if (!Array.isArray(hand) || !Array.isArray(community)) return [];
  const used = new Set([...hand, ...community].map((c) => c.rank + c.suit));
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS_LIST) {
      const key = rank + suit;
      if (!used.has(key)) deck.push({ rank, suit, value: RANKS_LIST.indexOf(rank) });
    }
  }
  return deck;
}

function shuffle(deck) {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function evaluateFiveCardHand(cards) {
  const vals = cards.map((c) => c.value).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const counts = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const grouped = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => (b.count - a.count) || (b.value - a.value));
  const groups = grouped.map((g) => g.count);

  const isFlush = suits.every((s) => s === suits[0]);
  let isStraight = false;
  let highStraight = 0;
  const uniqueVals = [...new Set(vals)].sort((a, b) => b - a);
  for (let i = 0; i <= uniqueVals.length - 5; i++) {
    if (uniqueVals[i] - uniqueVals[i + 4] === 4) {
      isStraight = true;
      highStraight = uniqueVals[i];
      break;
    }
  }
  if (!isStraight && uniqueVals.includes(12) && [0, 1, 2, 3].every((v) => uniqueVals.includes(v))) {
    isStraight = true;
    highStraight = 3;
  }

  let rank = 0;
  let tiebreak = [];
  if (isFlush && isStraight && highStraight === 12) {
    rank = 9;
    tiebreak = [12];
  } else if (isFlush && isStraight) {
    rank = 8;
    tiebreak = [highStraight];
  } else if (groups[0] === 4) {
    rank = 7;
    tiebreak = [
      grouped.find((g) => g.count === 4)?.value ?? 0,
      grouped.find((g) => g.count === 1)?.value ?? 0,
    ];
  } else if (groups[0] === 3 && groups[1] === 2) {
    rank = 6;
    tiebreak = [
      grouped.find((g) => g.count === 3)?.value ?? 0,
      grouped.find((g) => g.count === 2)?.value ?? 0,
    ];
  } else if (isFlush) {
    rank = 5;
    tiebreak = vals.slice();
  } else if (isStraight) {
    rank = 4;
    tiebreak = [highStraight];
  } else if (groups[0] === 3) {
    rank = 3;
    const trip = grouped.find((g) => g.count === 3)?.value ?? 0;
    const kickers = grouped
      .filter((g) => g.count === 1)
      .map((g) => g.value)
      .sort((a, b) => b - a);
    tiebreak = [trip, ...kickers];
  } else if (groups[0] === 2 && groups[1] === 2) {
    rank = 2;
    const pairs = grouped
      .filter((g) => g.count === 2)
      .map((g) => g.value)
      .sort((a, b) => b - a);
    const kicker = grouped.find((g) => g.count === 1)?.value ?? 0;
    tiebreak = [...pairs, kicker];
  } else if (groups[0] === 2) {
    rank = 1;
    const pair = grouped.find((g) => g.count === 2)?.value ?? 0;
    const kickers = grouped
      .filter((g) => g.count === 1)
      .map((g) => g.value)
      .sort((a, b) => b - a);
    tiebreak = [pair, ...kickers];
  } else {
    rank = 0;
    tiebreak = vals.slice();
  }
  return { rank, tiebreak };
}

function compareEvaluations(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.tiebreak[i] || 0) - (b.tiebreak[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function bestEvaluation(hand, community) {
  const all = [...hand, ...community];
  let best = null;
  for (let i = 0; i < all.length - 4; i++) {
    for (let j = i + 1; j < all.length - 3; j++) {
      for (let k = j + 1; k < all.length - 2; k++) {
        for (let l = k + 1; l < all.length - 1; l++) {
          for (let m = l + 1; m < all.length; m++) {
            const current = evaluateFiveCardHand([all[i], all[j], all[k], all[l], all[m]]);
            if (!best || compareEvaluations(current, best) > 0) best = current;
          }
        }
      }
    }
  }
  return best;
}

// 胜率估算（蒙特卡洛模拟，手牌 + 公共牌 → 胜率百分比）
export function estimateWinRate(hand, community, numOpponents = 1, simCount = 500) {
  if (!hand || hand.length < 2) return null;
  if (community.length > 5) return null;

  const parsedOpponents = Number(numOpponents);
  const parsedIterations = Number(simCount);
  const opponentCount = Number.isFinite(parsedOpponents) ? Math.max(1, Math.floor(parsedOpponents)) : 1;
  const iterations = Number.isFinite(parsedIterations) ? Math.max(1, Math.floor(parsedIterations)) : 500;
  const needed = 5 - community.length;
  let equity = 0;
  let validRuns = 0;

  for (let sim = 0; sim < iterations; sim++) {
    const deck = shuffle(makeDeck(hand, community));
    if (deck.length < needed + opponentCount * 2) continue;

    const board = [...community, ...deck.splice(0, needed)];
    const myEval = bestEvaluation(hand, board);
    let lost = false;
    let tieCount = 0;

    for (let o = 0; o < opponentCount; o++) {
      const oppHand = deck.splice(0, 2);
      const oppEval = bestEvaluation(oppHand, board);
      const diff = compareEvaluations(oppEval, myEval);
      if (diff > 0) {
        lost = true;
        break;
      }
      if (diff === 0) tieCount++;
    }

    if (!lost) equity += 1 / (tieCount + 1);
    validRuns++;
  }

  if (validRuns === 0) return null;
  return Math.round((equity / validRuns) * 100);
}
