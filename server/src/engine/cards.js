// Cards, the 6-deck shoe and a cryptographically secure shuffle.
import { randomInt, createHash } from 'node:crypto';

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['S', 'H', 'D', 'C'];

/** Point value of one rank, counting an ace as 11 (hand.js lowers it when needed). */
export function rankValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

/**
 * A shuffled shoe of `decks` decks. `rand(n)` must return an integer in [0, n);
 * by default it is Node's crypto.randomInt, so the order cannot be predicted.
 */
export function newShoe(decks = 6, rand = randomInt) {
  const cards = [];
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) for (const r of RANKS) cards.push({ r, s });
  }
  // Fisher–Yates
  for (let i = cards.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  const order = cards.map((c) => c.r + c.s).join(',');
  return {
    cards,
    size: cards.length,
    // Logged before the first card is dealt so any hand can be audited later.
    hash: createHash('sha256').update(order).digest('hex'),
  };
}

/** True when 75% of the shoe has been dealt. */
export function needsReshuffle(shoe) {
  return shoe.cards.length < shoe.size * 0.25;
}
