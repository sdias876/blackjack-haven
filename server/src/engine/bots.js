// Bot opponents: basic strategy for decisions, tournament-aware betting.
import { basicStrategy } from './strategy.js';
import { handValue } from './hand.js';

export const PERSONALITIES = {
  cautious: { label: 'Cautious', deviation: 0, baseMult: 1 },
  steady: { label: 'Steady', deviation: 0.02, baseMult: 2 },
  gambler: { label: 'Gambler', deviation: 0.08, baseMult: 4 },
};

export const BOT_NAMES = ['Viper', 'Lucky Lou', 'Aurora', 'Kodiak', 'Maverick', 'Juniper', 'Ace', 'Tundra', 'Nova', 'Raven'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * How much a bot bets this hand.
 * ctx: { chips, min, max, others: number[] (other active stacks), handsLeft, isCutHand, canSecret }
 * Returns { amount, secret }.
 */
export function botBet(ctx, personality, rand01) {
  const p = PERSONALITIES[personality] ?? PERSONALITIES.steady;
  const { chips, min, max, others, handsLeft, isCutHand, canSecret } = ctx;
  const cap = Math.min(max, chips);
  const lowestOther = others.length ? Math.min(...others) : 0;
  const amLowest = others.every((o) => chips <= o);
  const amLeader = others.every((o) => chips >= o);
  let amount;

  if (amLowest && handsLeft <= 2) {
    // In the elimination zone near the cut: bet enough to pass the next stack on a win.
    const target = others.filter((o) => o >= chips).sort((a, b) => a - b)[0] ?? chips;
    amount = target - chips + 1;
  } else if (!amLowest && chips - lowestOther > max * handsLeft) {
    // Safely ahead of the cut line: protect the stack.
    amount = min;
  } else {
    amount = min * p.baseMult * (1 + Math.floor(rand01() * 2));
  }
  amount = clamp(Math.round(amount), min, cap);
  return { amount, secret: Boolean(isCutHand && canSecret && amLeader) };
}

/** A bot's move: basic strategy with an occasional, personality-driven deviation. */
export function botMove(cards, upcard, legal, personality, rand01) {
  const move = basicStrategy(cards, upcard, legal);
  const p = PERSONALITIES[personality] ?? PERSONALITIES.steady;
  const { total } = handValue(cards);
  // Deviate only on the close calls (12–16) a person might also get wrong.
  if (total >= 12 && total <= 16 && rand01() < p.deviation) {
    if (move === 'hit') return 'stand';
    if (move === 'stand') return 'hit';
  }
  return move;
}
