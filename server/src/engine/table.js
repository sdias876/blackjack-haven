// One 6-seat Sit-and-Go table. The server owns this object; clients only send intents
// (bet, hit, stand...) and receive a per-player view from viewFor().
//
// Phases: waiting → betting → playing → dealer → result → (elimination) → betting … → finished
import { randomInt } from 'node:crypto';
import { newShoe, needsReshuffle } from './cards.js';
import { handValue, isBlackjack, isBust, isPair, dealerShouldHit, settleHand } from './hand.js';
import { basicStrategy, coachTip } from './strategy.js';
import { botBet, botMove, BOT_NAMES, PERSONALITIES } from './bots.js';
import { rankValue } from './cards.js';

export const SEATS = 6;
export const START_CHIPS = 1000;
export const ROUNDS = [
  { min: 10, max: 100 },
  { min: 25, max: 250 },
  { min: 50, max: 500 },
];
export const LENGTHS = { quick: 5, standard: 8 };

const TIMING = {
  fillMs: 20000, // seats left empty this long are filled with bots
  betMs: 15000,
  turnMs: 15000,
  botMinMs: 600,
  botMaxMs: 1500,
  awayMs: 1000, // auto-play delay for a disconnected player
  dealerStepMs: 700,
  resultMs: 2600,
};

/** Prize for 1st and 2nd: 90% of the entries, split 2:1. */
export function prizesFor(entry) {
  return { first: Math.round(entry * SEATS * 0.6), second: Math.round(entry * SEATS * 0.3) };
}

const cardStr = (cards) => cards.map((c) => c.r).join('-');

export class Table {
  constructor(opts = {}) {
    this.id = opts.id ?? String(randomInt(1e9));
    this.code = opts.code ?? null;
    this.isPrivate = Boolean(opts.isPrivate);
    this.practice = Boolean(opts.practice);
    this.length = LENGTHS[opts.length] ? opts.length : 'standard';
    this.handsPerRound = LENGTHS[this.length];
    this.entry = this.practice ? 0 : Math.max(0, Math.floor(opts.entry ?? 0));
    this.city = opts.city ?? 'New York';
    this.theme = opts.theme ?? 'royal-purple';
    this.rand = opts.rand ?? randomInt; // rand(n) → integer in [0, n)
    this.timing = { ...TIMING, ...(opts.timing ?? {}) };
    this.createdAt = opts.now ?? Date.now();

    this.seats = Array(SEATS).fill(null);
    this.phase = 'waiting';
    this.version = 0;
    this.round = 0; // index into ROUNDS
    this.handInRound = 0; // 0-based
    this.handNo = 0;
    this.dealer = { cards: [], holeHidden: true };
    this.turn = null; // { seat, hand }
    this.deadline = null;
    this.fillAt = null;
    this.log = [];
    this.shoe = newShoe(6, this.rand);
    this.shoeHashes = [this.shoe.hash];
  }

  // ---------- helpers ----------
  rand01() {
    return this.rand(1_000_000) / 1_000_000;
  }
  botDelay() {
    const { botMinMs, botMaxMs } = this.timing;
    return botMinMs + this.rand(Math.max(1, botMaxMs - botMinMs));
  }
  bump(msg) {
    this.version++;
    if (msg) {
      this.log.push(msg);
      if (this.log.length > 30) this.log.shift();
    }
  }
  get limits() {
    return ROUNDS[Math.min(this.round, ROUNDS.length - 1)];
  }
  get isCutHand() {
    return this.round < ROUNDS.length - 1 && this.handInRound === this.handsPerRound - 1;
  }
  get isFinalHand() {
    return this.round === ROUNDS.length - 1 && this.handInRound === this.handsPerRound - 1;
  }
  active() {
    return this.seats.filter((s) => s && !s.eliminated);
  }
  humans() {
    return this.seats.filter((s) => s && !s.bot);
  }
  seatOf(playerId) {
    return this.seats.findIndex((s) => s && s.id === playerId);
  }
  draw() {
    if (this.shoe.cards.length === 0) this.newShoe();
    return this.shoe.cards.pop();
  }
  newShoe() {
    this.shoe = newShoe(6, this.rand);
    this.shoeHashes.push(this.shoe.hash);
    this.bump('New shoe shuffled');
  }
  autoActor(seat) {
    return seat.bot || !seat.connected;
  }

  // ---------- seating ----------
  /** Seat a player. Returns the seat index, or -1 if the table cannot take them. */
  addPlayer({ playerId, name, avatar }, now = Date.now()) {
    const existing = this.seatOf(playerId);
    if (existing >= 0) {
      const s = this.seats[existing];
      s.connected = true;
      s.bot = false;
      this.bump(`${s.name} is back`);
      return existing;
    }
    if (this.phase !== 'waiting') return -1;
    const idx = this.seats.findIndex((s) => s === null);
    if (idx < 0) return -1;
    this.seats[idx] = this.newSeat({ id: playerId, name: name || 'Guest', avatar, bot: false });
    if (this.fillAt === null) this.fillAt = now + this.timing.fillMs;
    this.bump(`${this.seats[idx].name} sat down`);
    if (this.practice) this.start(now);
    else if (this.seats.every(Boolean)) this.start(now);
    return idx;
  }

  newSeat({ id, name, avatar = null, bot, personality = null }) {
    return {
      id,
      name,
      avatar,
      bot,
      personality,
      connected: true,
      chips: START_CHIPS,
      eliminated: false,
      place: null,
      bet: 0,
      secret: false,
      hasBet: false,
      hands: [],
      secretUsedRound: -1,
      nextActAt: null,
      stats: { decisions: 0, correct: 0, misses: [] },
    };
  }

  /** A player leaves. Before the start the seat is freed; after it, they keep their seat on auto-play. */
  removePlayer(playerId, now = Date.now()) {
    const idx = this.seatOf(playerId);
    if (idx < 0) return;
    const s = this.seats[idx];
    if (this.phase === 'waiting') {
      this.seats[idx] = null;
      if (this.humans().length === 0) this.fillAt = null;
      this.bump(`${s.name} left`);
    } else {
      s.connected = false;
      s.nextActAt = now + this.timing.awayMs;
      this.bump(`${s.name} is away (auto-play)`);
    }
  }

  setConnected(playerId, connected, now = Date.now()) {
    const s = this.seats[this.seatOf(playerId)];
    if (!s || s.bot) return;
    s.connected = connected;
    if (!connected) s.nextActAt = now + this.timing.awayMs;
    this.bump();
  }

  startNow(playerId, now = Date.now()) {
    if (this.phase !== 'waiting' || this.seatOf(playerId) < 0) return false;
    this.start(now);
    return true;
  }

  start(now) {
    const used = new Set(this.seats.filter(Boolean).map((s) => s.name));
    const names = BOT_NAMES.filter((n) => !used.has(n));
    const kinds = Object.keys(PERSONALITIES);
    for (let i = 0; i < SEATS; i++) {
      if (this.seats[i]) continue;
      const name = names.splice(this.rand(names.length), 1)[0] ?? `Bot ${i + 1}`;
      this.seats[i] = this.newSeat({
        id: `bot-${i}-${this.id}`,
        name,
        bot: true,
        personality: kinds[this.rand(kinds.length)],
      });
    }
    this.round = 0;
    this.handInRound = 0;
    this.bump('Tournament started');
    this.beginBetting(now);
  }

  // ---------- betting ----------
  beginBetting(now) {
    const { min } = this.limits;
    for (const s of this.active()) {
      if (s.chips < min) this.eliminate(s, `${s.name} is out of chips`);
    }
    if (this.active().length <= 1) return this.finish(now);
    if (needsReshuffle(this.shoe)) this.newShoe();

    this.phase = 'betting';
    this.handNo++;
    this.deadline = now + this.timing.betMs;
    this.dealer = { cards: [], holeHidden: true };
    this.turn = null;
    for (const s of this.active()) {
      s.bet = 0;
      s.secret = false;
      s.hasBet = false;
      s.hands = [];
      s.nextActAt = s.bot ? now + this.botDelay() : !s.connected ? now + this.timing.awayMs : null;
    }
    this.bump();
  }

  canSecret(seat) {
    return (this.isCutHand || this.isFinalHand) && seat.secretUsedRound !== this.round;
  }

  placeBet(idx, amount, secret = false, now = Date.now()) {
    const s = this.seats[idx];
    if (this.phase !== 'betting' || !s || s.eliminated || s.hasBet) return { ok: false, error: 'Not now' };
    const { min, max } = this.limits;
    const cap = Math.min(max, s.chips);
    amount = Math.floor(Number(amount));
    if (!Number.isFinite(amount) || amount < min || amount > cap) {
      return { ok: false, error: `Bet must be between ${min} and ${cap}` };
    }
    s.bet = amount;
    s.hasBet = true;
    if (secret && this.canSecret(s)) {
      s.secret = true;
      s.secretUsedRound = this.round;
    }
    this.bump();
    if (this.active().every((a) => a.hasBet)) this.deal(now);
    return { ok: true };
  }

  // ---------- dealing and play ----------
  deal(now) {
    const players = this.active();
    for (const s of players) {
      s.chips -= s.bet;
      s.hands = [{ cards: [], bet: s.bet, done: false, doubled: false, fromSplit: false, result: null }];
    }
    for (let pass = 0; pass < 2; pass++) {
      for (const s of players) s.hands[0].cards.push(this.draw());
      this.dealer.cards.push(this.draw());
    }
    for (const s of players) {
      if (isBlackjack(s.hands[0].cards)) s.hands[0].done = true;
    }
    this.bump(`Hand ${this.handInRound + 1} dealt`);

    const up = this.dealer.cards[0];
    if (rankValue(up.r) >= 10 && isBlackjack(this.dealer.cards)) {
      this.bump('Dealer has blackjack');
      return this.startDealer(now);
    }
    this.phase = 'playing';
    this.turn = { seat: -1, hand: 0 };
    this.nextTurn(now);
  }

  nextTurn(now) {
    let seat = this.turn ? this.turn.seat : -1;
    let hand = this.turn ? this.turn.hand : 0;
    const cur = this.seats[seat];
    // Another unfinished hand for the same seat (after a split)?
    if (cur && !cur.eliminated) {
      for (let h = hand; h < cur.hands.length; h++) {
        if (!cur.hands[h].done) return this.setTurn(seat, h, now);
      }
    }
    for (let i = seat + 1; i < SEATS; i++) {
      const s = this.seats[i];
      if (!s || s.eliminated) continue;
      const h = s.hands.findIndex((x) => !x.done);
      if (h >= 0) return this.setTurn(i, h, now);
    }
    this.startDealer(now);
  }

  setTurn(seat, hand, now) {
    this.turn = { seat, hand };
    this.deadline = now + this.timing.turnMs;
    const s = this.seats[seat];
    s.nextActAt = s.bot ? now + this.botDelay() : !s.connected ? now + this.timing.awayMs : null;
    this.bump();
  }

  legalFor(idx) {
    const s = this.seats[idx];
    if (this.phase !== 'playing' || !this.turn || this.turn.seat !== idx) return null;
    const hand = s.hands[this.turn.hand];
    const two = hand.cards.length === 2;
    return {
      hit: true,
      stand: true,
      double: two && s.chips >= hand.bet,
      split: two && isPair(hand.cards) && s.hands.length === 1 && s.chips >= hand.bet,
    };
  }

  act(idx, action, now = Date.now(), auto = false) {
    const legal = this.legalFor(idx);
    if (!legal || !legal[action]) return { ok: false, error: 'Not allowed' };
    const s = this.seats[idx];
    const hand = s.hands[this.turn.hand];
    const up = this.dealer.cards[0];

    if (!s.bot && !auto) {
      const best = basicStrategy(hand.cards, up, legal);
      s.stats.decisions++;
      if (best === action) s.stats.correct++;
      else if (s.stats.misses.length < 20) {
        s.stats.misses.push({ hand: cardStr(hand.cards), total: handValue(hand.cards).total, up: up.r, did: action, best });
      }
    }

    if (action === 'hit') {
      hand.cards.push(this.draw());
      const t = handValue(hand.cards).total;
      if (t >= 21) hand.done = true;
    } else if (action === 'stand') {
      hand.done = true;
    } else if (action === 'double') {
      s.chips -= hand.bet;
      hand.bet *= 2;
      hand.doubled = true;
      hand.cards.push(this.draw());
      hand.done = true;
    } else if (action === 'split') {
      s.chips -= hand.bet;
      const [a, b] = hand.cards;
      const aces = a.r === 'A';
      s.hands = [a, b].map((c) => ({
        cards: [c, this.draw()],
        bet: hand.bet,
        done: aces,
        doubled: false,
        fromSplit: true,
        result: null,
      }));
      for (const h of s.hands) if (handValue(h.cards).total === 21) h.done = true;
      this.turn.hand = 0;
    }
    this.bump();
    if (s.hands[this.turn.hand].done) this.nextTurn(now);
    else {
      this.deadline = now + this.timing.turnMs;
      s.nextActAt = this.autoActor(s) ? now + (s.bot ? this.botDelay() : this.timing.awayMs) : null;
    }
    return { ok: true };
  }

  startDealer(now) {
    this.phase = 'dealer';
    this.turn = null;
    this.dealer.holeHidden = false;
    this.deadline = now + this.timing.dealerStepMs;
    this.bump();
  }

  liveHands() {
    return this.active().flatMap((s) => s.hands).filter((h) => !isBust(h.cards) && !isBlackjack(h.cards, h.fromSplit));
  }

  settle(now) {
    for (const s of this.active()) {
      for (const h of s.hands) {
        const r = settleHand(h, this.dealer.cards);
        h.result = r.outcome;
        h.payout = r.payout;
        s.chips += r.payout;
      }
    }
    this.phase = 'result';
    this.deadline = now + this.timing.resultMs;
    const d = handValue(this.dealer.cards).total;
    this.bump(d > 21 ? 'Dealer busts' : `Dealer has ${d}`);
  }

  afterResult(now) {
    this.handInRound++;
    if (this.handInRound < this.handsPerRound) return this.beginBetting(now);
    // End of a round
    if (this.round < ROUNDS.length - 1) {
      const act = this.active();
      if (act.length > 2) {
        const sorted = [...act].sort((a, b) => a.chips - b.chips || this.rand(3) - 1);
        this.eliminate(sorted[0], `${sorted[0].name} is eliminated with the lowest stack`);
      }
      this.round++;
      this.handInRound = 0;
      this.bump(`Round ${this.round + 1}: bets ${this.limits.min}–${this.limits.max}`);
      return this.beginBetting(now);
    }
    this.finish(now);
  }

  eliminate(seat, msg) {
    seat.place = this.active().length;
    seat.eliminated = true;
    seat.hands = [];
    this.bump(msg);
  }

  finish(now) {
    const remaining = [...this.active()].sort((a, b) => b.chips - a.chips);
    remaining.forEach((s, i) => {
      s.place = i + 1;
    });
    this.phase = 'finished';
    this.turn = null;
    this.deadline = null;
    this.finishedAt = now;
    this.bump(`${remaining[0]?.name ?? 'Nobody'} wins the tournament`);
  }

  // ---------- clock ----------
  /** Advance timers, bots and the dealer. Returns true when the state changed. */
  tick(now = Date.now()) {
    const before = this.version;
    if (this.phase === 'waiting') {
      if (this.humans().length && this.fillAt !== null && now >= this.fillAt) this.start(now);
    } else if (this.phase === 'betting') {
      const { min } = this.limits;
      for (let i = 0; i < SEATS && this.phase === 'betting'; i++) {
        const s = this.seats[i];
        if (!s || s.eliminated || s.hasBet) continue;
        if (s.bot && s.nextActAt <= now) {
          const others = this.active().filter((o) => o !== s).map((o) => o.chips);
          const handsLeft = this.handsPerRound - this.handInRound;
          const b = botBet(
            { chips: s.chips, ...this.limits, others, handsLeft, isCutHand: this.isCutHand || this.isFinalHand, canSecret: this.canSecret(s) },
            s.personality,
            () => this.rand01(),
          );
          this.placeBet(i, b.amount, b.secret, now);
        } else if (!s.bot && ((!s.connected && s.nextActAt <= now) || now >= this.deadline)) {
          this.placeBet(i, Math.min(min, s.chips), false, now);
        }
      }
    } else if (this.phase === 'playing') {
      const i = this.turn.seat;
      const s = this.seats[i];
      const hand = s.hands[this.turn.hand];
      const legal = this.legalFor(i);
      const up = this.dealer.cards[0];
      if (s.bot && s.nextActAt <= now) {
        this.act(i, botMove(hand.cards, up, legal, s.personality, () => this.rand01()), now, true);
      } else if (!s.bot && ((!s.connected && s.nextActAt <= now) || now >= this.deadline)) {
        this.act(i, basicStrategy(hand.cards, up, legal), now, true);
      }
    } else if (this.phase === 'dealer') {
      if (now >= this.deadline) {
        if (this.liveHands().length && dealerShouldHit(this.dealer.cards)) {
          this.dealer.cards.push(this.draw());
          this.deadline = now + this.timing.dealerStepMs;
          this.bump();
        } else this.settle(now);
      }
    } else if (this.phase === 'result') {
      if (now >= this.deadline) this.afterResult(now);
    }
    return this.version !== before;
  }

  // ---------- views ----------
  /** The state one player is allowed to see. */
  viewFor(playerId, now = Date.now()) {
    const me = this.seatOf(playerId);
    const hideHole = this.dealer.holeHidden;
    const seats = this.seats.map((s, i) => {
      if (!s) return null;
      const hiddenBet = this.phase === 'betting' && s.secret && i !== me;
      return {
        name: s.name,
        avatar: s.avatar,
        bot: s.bot,
        connected: s.connected,
        chips: s.chips,
        eliminated: s.eliminated,
        place: s.place,
        hasBet: s.hasBet,
        bet: hiddenBet ? null : s.bet,
        secret: s.secret,
        hands: s.hands.map((h) => ({
          cards: h.cards,
          bet: h.bet,
          total: handValue(h.cards).total,
          soft: handValue(h.cards).soft,
          doubled: h.doubled,
          result: h.result,
          payout: h.payout ?? null,
        })),
      };
    });
    const dealerCards = hideHole && this.dealer.cards.length ? [this.dealer.cards[0], null] : this.dealer.cards;
    const shown = dealerCards.filter(Boolean);
    const view = {
      id: this.id,
      code: this.code,
      city: this.city,
      theme: this.theme,
      practice: this.practice,
      isPrivate: this.isPrivate,
      entry: this.entry,
      prizes: prizesFor(this.entry),
      phase: this.phase,
      version: this.version,
      round: this.round + 1,
      rounds: ROUNDS.length,
      hand: this.handInRound + 1,
      handsPerRound: this.handsPerRound,
      handsToCut: this.round < ROUNDS.length - 1 ? this.handsPerRound - this.handInRound : null,
      isCutHand: this.isCutHand,
      isFinalHand: this.isFinalHand,
      limits: this.limits,
      nextLimits: ROUNDS[this.round + 1] ?? null,
      msLeft: this.deadline ? Math.max(0, this.deadline - now) : null,
      fillMsLeft: this.phase === 'waiting' && this.fillAt ? Math.max(0, this.fillAt - now) : null,
      dealer: { cards: dealerCards, total: shown.length ? handValue(shown).total : 0 },
      turn: this.turn,
      seats,
      me,
      log: this.log.slice(-6),
      shoeHash: this.shoe.hash,
    };
    if (me >= 0) {
      const s = this.seats[me];
      view.legal = this.legalFor(me);
      view.canSecret = this.phase === 'betting' && this.canSecret(s);
      if (view.legal && this.practice) {
        view.coach = coachTip(s.hands[this.turn.hand].cards, this.dealer.cards[0], view.legal);
      }
      if (this.phase === 'finished' || s.eliminated) {
        const st = s.stats;
        view.myResult = {
          place: s.place,
          chips: s.chips,
          prize: s.place === 1 ? view.prizes.first : s.place === 2 ? view.prizes.second : 0,
          decisions: st.decisions,
          accuracy: st.decisions ? Math.round((st.correct / st.decisions) * 100) : null,
          misses: st.misses.slice(0, 5),
        };
      }
    }
    return view;
  }

  /** Short summary for the lobby list. */
  summary(now = Date.now()) {
    return {
      id: this.id,
      code: this.isPrivate ? null : this.code,
      city: this.city,
      theme: this.theme,
      entry: this.entry,
      length: this.length,
      phase: this.phase,
      players: this.seats.filter((s) => s && !s.bot).length,
      seated: this.seats.filter(Boolean).length,
      seats: SEATS,
      startsInMs: this.fillAt ? Math.max(0, this.fillAt - now) : null,
    };
  }
}
