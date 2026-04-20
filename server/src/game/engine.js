// ════════════════════════════════════════
//  德州扑克核心游戏引擎
// ════════════════════════════════════════

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// ── 牌组 ──────────────────────────────
function makeDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ suit, rank, value: RANKS.indexOf(rank) });
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ── 牌型判断 ──────────────────────────
function handRank(cards) {
  const vals = cards.map(c => c.value).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const counts = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const grouped = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => (b.count - a.count) || (b.value - a.value));
  const groups = grouped.map(g => g.count);

  const isFlush = suits.every(s => s === suits[0]);
  let isStraight = false, highStraight = 0;
  const uv = [...new Set(vals)].sort((a, b) => b - a);
  for (let i = 0; i <= uv.length - 5; i++) {
    if (uv[i] - uv[i + 4] === 4) { isStraight = true; highStraight = uv[i]; break; }
  }
  // 轮顺 A-2-3-4-5
  if (!isStraight && uv.includes(12) && [0,1,2,3].every(v => uv.includes(v))) {
    isStraight = true; highStraight = 3;
  }

  let rank, label;
  if (isFlush && isStraight && highStraight === 12) { rank = 9; label = '皇家同花顺'; }
  else if (isFlush && isStraight) { rank = 8; label = '同花顺'; }
  else if (groups[0] === 4) { rank = 7; label = '四条'; }
  else if (groups[0] === 3 && groups[1] === 2) { rank = 6; label = '葫芦'; }
  else if (isFlush) { rank = 5; label = '同花'; }
  else if (isStraight) { rank = 4; label = '顺子'; }
  else if (groups[0] === 3) { rank = 3; label = '三条'; }
  else if (groups[0] === 2 && groups[1] === 2) { rank = 2; label = '两对'; }
  else if (groups[0] === 2) { rank = 1; label = '一对'; }
  else { rank = 0; label = '高牌'; }

  let tiebreak = [];
  if (rank === 9 || rank === 8 || rank === 4) {
    tiebreak = [highStraight];
  } else if (rank === 7) {
    const quad = grouped.find(g => g.count === 4)?.value;
    const kicker = grouped.find(g => g.count === 1)?.value;
    tiebreak = [quad, kicker];
  } else if (rank === 6) {
    const trip = grouped.find(g => g.count === 3)?.value;
    const pair = grouped.find(g => g.count === 2)?.value;
    tiebreak = [trip, pair];
  } else if (rank === 5 || rank === 0) {
    tiebreak = vals.slice();
  } else if (rank === 3) {
    const trip = grouped.find(g => g.count === 3)?.value;
    const kickers = grouped.filter(g => g.count === 1).map(g => g.value).sort((a, b) => b - a);
    tiebreak = [trip, ...kickers];
  } else if (rank === 2) {
    const pairs = grouped.filter(g => g.count === 2).map(g => g.value).sort((a, b) => b - a);
    const kicker = grouped.find(g => g.count === 1)?.value;
    tiebreak = [...pairs, kicker];
  } else if (rank === 1) {
    const pair = grouped.find(g => g.count === 2)?.value;
    const kickers = grouped.filter(g => g.count === 1).map(g => g.value).sort((a, b) => b - a);
    tiebreak = [pair, ...kickers];
  }

  return { rank, high: isStraight ? highStraight : tiebreak[0], label, tiebreak };
}

function bestHand(hand, community) {
  const all = [...hand, ...community];
  let best = null;
  for (let i = 0; i < all.length - 4; i++)
    for (let j = i+1; j < all.length - 3; j++)
      for (let k = j+1; k < all.length - 2; k++)
        for (let l = k+1; l < all.length - 1; l++)
          for (let m = l+1; m < all.length; m++) {
            const h = handRank([all[i], all[j], all[k], all[l], all[m]]);
            if (!best || h.rank > best.rank ||
               (h.rank === best.rank && compareTiebreak(h, best) > 0)) best = h;
          }
  return best;
}

function compareTiebreak(a, b) {
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const diff = (a.tiebreak[i] || 0) - (b.tiebreak[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// ── 游戏状态机 ────────────────────────
class PokerGame {
  constructor(roomId, players) {
    this.roomId = roomId;
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips || 1000,
      hand: [],
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
    }));
    this.deck = [];
    this.community = [];
    this.pot = 0;
    this.sidePots = [];
    this.phase = 'waiting'; // waiting | preflop | flop | turn | river | showdown
    this.dealer = 0;
    this.currentPlayer = 0;
    this.currentBet = 0;
    this.smallBlind = 5;
    this.bigBlind = 10;
    this.round = 0;
    this.actedThisRound = new Set();
    this.log = [];
  }

  // 开始新一局
  startRound() {
    this.round++;
    this.deck = shuffle(makeDeck());
    this.community = [];
    this.pot = 0;
    this.sidePots = [];
    this.phase = 'preflop';
    this.currentBet = this.bigBlind;
    this.actedThisRound = new Set();

    for (const p of this.players) {
      p.hand = [];
      p.bet = 0;
      p.totalBet = 0;
      p.folded = false;
      p.allIn = false;
      if (p.chips <= 0) p.chips = 500; // 重买
    }

    // 发手牌
    for (let i = 0; i < 2; i++)
      for (const p of this.players)
        p.hand.push(this.deck.pop());

    // 盲注
    const sbIdx = (this.dealer + 1) % this.players.length;
    const bbIdx = (this.dealer + 2) % this.players.length;
    this._placeBet(sbIdx, this.smallBlind);
    this._placeBet(bbIdx, this.bigBlind);
    this.actedThisRound = new Set([sbIdx, bbIdx]);
    this.currentPlayer = (this.dealer + 3) % this.players.length;

    this._addLog(`第 ${this.round} 局开始 · 庄家: ${this.players[this.dealer].name}`);
    return this._getState();
  }

  // 玩家行动
  playerAction(playerId, action, amount = 0) {
    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx !== this.currentPlayer) return { error: '不是你的回合' };
    if (this.players[idx].folded || this.players[idx].allIn) return { error: '无效操作' };

    const p = this.players[idx];

    switch (action) {
      case 'fold':
        p.folded = true;
        this._addLog(`${p.name} 弃牌`);
        break;

      case 'check':
        if (p.bet < this.currentBet) return { error: '需要跟注或弃牌' };
        this._addLog(`${p.name} 过牌`);
        break;

      case 'call': {
        const need = Math.min(this.currentBet - p.bet, p.chips);
        this._placeBet(idx, need);
        if (p.chips === 0) p.allIn = true;
        this._addLog(`${p.name} 跟注 ${need}`);
        break;
      }

      case 'raise': {
        const totalBet = Math.min(amount, p.chips + p.bet);
        if (totalBet <= this.currentBet) return { error: '加注金额不足' };
        const need = totalBet - p.bet;
        this._placeBet(idx, need);
        this.currentBet = totalBet;
        if (p.chips === 0) p.allIn = true;
        this.actedThisRound = new Set([idx]); // 重置行动
        this._addLog(`${p.name} 加注至 ${totalBet}`);
        break;
      }

      case 'allin': {
        const total = p.chips + p.bet;
        this._placeBet(idx, p.chips);
        if (total > this.currentBet) {
          this.currentBet = total;
          this.actedThisRound = new Set([idx]);
        }
        p.allIn = true;
        this._addLog(`${p.name} 全押 ${total}!`);
        break;
      }

      default:
        return { error: '未知操作' };
    }

    this.actedThisRound.add(idx);
    return this._nextTurn();
  }

  // ── 内部方法 ──

  _placeBet(idx, amount) {
    const p = this.players[idx];
    const actual = Math.min(amount, p.chips);
    p.chips -= actual;
    p.bet += actual;
    p.totalBet += actual;
    this.pot += actual;
    return actual;
  }

  _activePlayers() {
    return this.players.filter(p => !p.folded && !p.allIn);
  }

  _activeCount() {
    return this.players.filter(p => !p.folded).length;
  }

  _nextTurn() {
    if (this._activeCount() === 1) return this._showdown();

    // 检查本轮是否结束
    const active = this._activePlayers();
    const roundDone = active.every(p => {
      const i = this.players.indexOf(p);
      return this.actedThisRound.has(i) && p.bet === this.currentBet;
    });

    if (roundDone || active.length === 0) return this._advancePhase();

    // 找下一个可行动玩家
    let next = (this.currentPlayer + 1) % this.players.length;
    let tries = 0;
    while ((this.players[next].folded || this.players[next].allIn) && tries < this.players.length) {
      next = (next + 1) % this.players.length;
      tries++;
    }
    this.currentPlayer = next;
    return { type: 'state', state: this._getState() };
  }

  _advancePhase() {
    const phases = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const idx = phases.indexOf(this.phase);
    if (idx >= phases.length - 2) return this._showdown();

    this.phase = phases[idx + 1];
    for (const p of this.players) p.bet = 0;
    this.currentBet = 0;
    this.actedThisRound = new Set();

    if (this.phase === 'flop') {
      this.community.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
    } else if (this.phase === 'turn' || this.phase === 'river') {
      this.community.push(this.deck.pop());
    }

    // 从庄家后第一个未弃牌玩家开始
    let first = (this.dealer + 1) % this.players.length;
    let tries = 0;
    while ((this.players[first].folded || this.players[first].allIn) && tries < this.players.length) {
      first = (first + 1) % this.players.length;
      tries++;
    }
    this.currentPlayer = first;

    const phaseNames = { flop:'翻牌', turn:'转牌', river:'河牌' };
    this._addLog(`── ${phaseNames[this.phase] || this.phase} ──`);

    if (this.phase === 'showdown') return this._showdown();
    return { type: 'state', state: this._getState() };
  }

  _showdown() {
    this.phase = 'showdown';
    const alive = this.players.filter(p => !p.folded);
    let bestR = null;
    const winners = [];

    for (const p of alive) {
      const r = bestHand(p.hand, this.community);
      p._rank = r;
      if (!bestR) {
        bestR = r;
        winners.length = 0;
        winners.push(p);
        continue;
      }
      if (r.rank > bestR.rank || (r.rank === bestR.rank && compareTiebreak(r, bestR) > 0)) {
        bestR = r;
        winners.length = 0;
        winners.push(p);
      } else if (r.rank === bestR.rank && compareTiebreak(r, bestR) === 0) {
        winners.push(p);
      }
    }

    const totalPot = this.pot;
    const split = Math.floor(totalPot / winners.length);
    let remainder = totalPot % winners.length;
    const winnerResults = winners.map((p) => {
      const gain = split + (remainder-- > 0 ? 1 : 0);
      p.chips += gain;
      return { id: p.id, name: p.name, hand: bestR.label, gain };
    });

    if (winnerResults.length === 1) {
      this._addLog(`${winnerResults[0].name} 赢得底池 ${totalPot} · ${bestR.label}`);
    } else {
      this._addLog(`${winnerResults.map(w => w.name).join(' / ')} 平分底池 ${totalPot} · ${bestR.label}`);
    }
    this.dealer = (this.dealer + 1) % this.players.length;

    return {
      type: 'showdown',
      winner: {
        id: winnerResults[0].id,
        name: winnerResults.map(w => w.name).join(' / '),
        hand: bestR.label,
        pot: totalPot,
      },
      winners: winnerResults,
      players: alive.map(p => ({ id: p.id, name: p.name, hand: p.hand, rank: p._rank?.label })),
      state: this._getState(),
    };
  }

  _addLog(msg) {
    this.log.unshift(msg);
    if (this.log.length > 50) this.log.pop();
  }

  // 构建发给客户端的状态（隐藏其他玩家手牌）
  getStateFor(playerId) {
    const state = this._getState();
    state.players = state.players.map(p => ({
      ...p,
      hand: p.id === playerId ? p.hand : p.hand.map(() => null), // null 表示背面
    }));
    return state;
  }

  _getState() {
    return {
      roomId: this.roomId,
      phase: this.phase,
      community: this.community,
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayer: this.players[this.currentPlayer]?.id,
      dealer: this.players[this.dealer]?.id,
      round: this.round,
      log: this.log.slice(0, 10),
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
        hand: p.hand,
      })),
    };
  }
}

module.exports = { PokerGame };
