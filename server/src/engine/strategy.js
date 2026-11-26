// Basic strategy for 6 decks, dealer stands on soft 17, double after split allowed.
// Used by the bots, by auto-play on timeouts, and by the Smart Coach.
import { rankValue } from './cards.js';
import { handValue, isPair } from './hand.js';

const between = (v, lo, hi) => v >= lo && v <= hi;

/**
 * The basic-strategy move for a hand.
 * @param cards      the player's cards
 * @param upcard     the dealer's face-up card
 * @param legal      { double: bool, split: bool } what the player may do now
 * @returns 'hit' | 'stand' | 'double' | 'split'
 */
export function basicStrategy(cards, upcard, legal = { double: true, split: true }) {
  const up = rankValue(upcard.r); // 2..11
  const { total, soft } = handValue(cards);

  if (legal.split && isPair(cards)) {
    const p = rankValue(cards[0].r);
    const split =
      p === 11 ||
      p === 8 ||
      (p === 9 && (between(up, 2, 6) || up === 8 || up === 9)) ||
      (p === 7 && between(up, 2, 7)) ||
      (p === 6 && between(up, 2, 6)) ||
      (p === 4 && between(up, 5, 6)) ||
      ((p === 2 || p === 3) && between(up, 2, 7));
    if (split) return 'split';
  }

  const dbl = (cond, otherwise) => (cond ? (legal.double ? 'double' : otherwise) : null);

  if (soft) {
    if (total >= 19) return 'stand';
    if (total === 18) return dbl(between(up, 3, 6), 'stand') ?? (up <= 8 ? 'stand' : 'hit');
    if (total === 17) return dbl(between(up, 3, 6), 'hit') ?? 'hit';
    if (total === 15 || total === 16) return dbl(between(up, 4, 6), 'hit') ?? 'hit';
    if (total === 13 || total === 14) return dbl(between(up, 5, 6), 'hit') ?? 'hit';
    return 'hit';
  }

  if (total >= 17) return 'stand';
  if (between(total, 13, 16)) return up <= 6 ? 'stand' : 'hit';
  if (total === 12) return between(up, 4, 6) ? 'stand' : 'hit';
  if (total === 11) return dbl(up <= 10, 'hit') ?? 'hit';
  if (total === 10) return dbl(up <= 9, 'hit') ?? 'hit';
  if (total === 9) return dbl(between(up, 3, 6), 'hit') ?? 'hit';
  return 'hit';
}

// Approximate chance the dealer busts, by up-card (6 decks, S17).
const DEALER_BUST = { 2: 35, 3: 37, 4: 40, 5: 42, 6: 42, 7: 26, 8: 24, 9: 23, 10: 21, 11: 12 };

/** Chance (percent) that one more card busts this hand. */
export function bustChanceIfHit(cards) {
  const { total, soft } = handValue(cards);
  if (soft || total <= 11) return 0;
  const need = 21 - total; // highest safe card value
  // Card values 1..10 with 10 four times as likely; an ace counts as 1 here.
  let safe = 0;
  for (let v = 1; v <= 10; v++) if (v <= need) safe += v === 10 ? 4 : 1;
  return Math.round(((13 - safe) / 13) * 100);
}

const LABEL = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split' };

/** One-line Smart Coach tip, e.g. "Best move: Stand. The dealer goes over 21 about 42% of the time with a 6 showing." */
export function coachTip(cards, upcard, legal) {
  const move = basicStrategy(cards, upcard, legal);
  const up = rankValue(upcard.r);
  const upName = upcard.r === 'A' ? 'an ace' : up === 10 ? 'a 10' : up === 8 ? 'an 8' : `a ${up}`;
  let why = `The dealer goes over 21 about ${DEALER_BUST[up]}% of the time with ${upName} showing.`;
  const bust = bustChanceIfHit(cards);
  if (move === 'hit' && bust > 0) why = `Another card takes you over 21 ${bust}% of the time, but stopping here loses more often.`;
  if (move === 'split') why = 'Splitting turns one weak hand into two better ones.';
  if (move === 'double') why = 'You are the favorite here, so put more chips in.';
  return { move, text: `Best move: ${LABEL[move]}. ${why}` };
}
