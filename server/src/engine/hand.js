// Hand values and the rules for settling a hand against the dealer.
import { rankValue } from './cards.js';

/** { total, soft } where soft means an ace is still counted as 11. */
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += rankValue(c.r);
    if (c.r === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

/** A two-card 21. A 21 made after a split is not a blackjack. */
export function isBlackjack(cards, fromSplit = false) {
  return !fromSplit && cards.length === 2 && handValue(cards).total === 21;
}

export const isBust = (cards) => handValue(cards).total > 21;

/** Dealer stands on all 17s (S17). */
export function dealerShouldHit(cards) {
  return handValue(cards).total < 17;
}

/** Two cards of equal point value can be split (10-J counts as a pair). */
export function isPair(cards) {
  return cards.length === 2 && rankValue(cards[0].r) === rankValue(cards[1].r);
}

/**
 * What a finished hand returns to the player, stake included:
 * 0 for a loss, bet for a push, 2×bet for a win, 2.5×bet for a blackjack (3:2).
 */
export function settleHand(hand, dealerCards) {
  const player = handValue(hand.cards).total;
  const dealer = handValue(dealerCards).total;
  const playerBJ = isBlackjack(hand.cards, hand.fromSplit);
  const dealerBJ = isBlackjack(dealerCards);
  let outcome;
  if (player > 21) outcome = 'bust';
  else if (playerBJ && dealerBJ) outcome = 'push';
  else if (playerBJ) outcome = 'blackjack';
  else if (dealerBJ) outcome = 'lose';
  else if (dealer > 21) outcome = 'win';
  else if (player > dealer) outcome = 'win';
  else if (player === dealer) outcome = 'push';
  else outcome = 'lose';
  const payout = {
    bust: 0,
    lose: 0,
    push: hand.bet,
    win: hand.bet * 2,
    blackjack: Math.floor(hand.bet * 2.5),
  }[outcome];
  return { outcome, payout };
}
