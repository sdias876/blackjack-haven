import test from 'node:test';
import assert from 'node:assert/strict';
import { newShoe, needsReshuffle } from '../src/engine/cards.js';
import { handValue, isBlackjack, dealerShouldHit, settleHand, isPair } from '../src/engine/hand.js';
import { basicStrategy, bustChanceIfHit, coachTip } from '../src/engine/strategy.js';
import { botBet } from '../src/engine/bots.js';

const C = (s) => s.split(' ').map((r) => ({ r, s: 'S' }));

test('a 6-deck shoe has 312 unique-by-position cards and a hash', () => {
  const shoe = newShoe(6);
  assert.equal(shoe.cards.length, 312);
  assert.equal(shoe.cards.filter((c) => c.r === 'A').length, 24);
  assert.match(shoe.hash, /^[0-9a-f]{64}$/);
  assert.equal(needsReshuffle(shoe), false);
  shoe.cards.splice(0, 240);
  assert.equal(needsReshuffle(shoe), true);
});

test('hand values count aces as 1 or 11', () => {
  assert.deepEqual(handValue(C('A K')), { total: 21, soft: true });
  assert.deepEqual(handValue(C('A A 9')), { total: 21, soft: true });
  assert.deepEqual(handValue(C('A 6 K')), { total: 17, soft: false });
  assert.deepEqual(handValue(C('A A A A')), { total: 14, soft: true });
  assert.deepEqual(handValue(C('K Q 5')), { total: 25, soft: false });
});

test('blackjack, pairs and the dealer standing on all 17s', () => {
  assert.equal(isBlackjack(C('A Q')), true);
  assert.equal(isBlackjack(C('A Q'), true), false, 'not after a split');
  assert.equal(isBlackjack(C('7 7 7')), false);
  assert.equal(isPair(C('10 K')), true);
  assert.equal(isPair(C('9 10')), false);
  assert.equal(dealerShouldHit(C('10 6')), true);
  assert.equal(dealerShouldHit(C('A 6')), false, 'stands on soft 17');
  assert.equal(dealerShouldHit(C('10 7')), false);
});

test('settling pays 3:2, 1:1 and pushes', () => {
  const h = (s, bet = 100, fromSplit = false) => ({ cards: C(s), bet, fromSplit });
  assert.deepEqual(settleHand(h('A K'), C('10 9')), { outcome: 'blackjack', payout: 250 });
  assert.deepEqual(settleHand(h('A K'), C('A Q')), { outcome: 'push', payout: 100 });
  assert.deepEqual(settleHand(h('10 9'), C('A Q')), { outcome: 'lose', payout: 0 });
  assert.deepEqual(settleHand(h('10 9'), C('10 6 8')), { outcome: 'win', payout: 200 });
  assert.deepEqual(settleHand(h('10 6 9'), C('10 6 8')), { outcome: 'bust', payout: 0 }, 'player busts first');
  assert.deepEqual(settleHand(h('10 8'), C('10 8')), { outcome: 'push', payout: 100 });
  assert.deepEqual(settleHand(h('A K', 100, true), C('10 9')), { outcome: 'win', payout: 200 }, 'split 21 pays 1:1');
  assert.equal(settleHand(h('A K', 25), C('10 9')).payout, 62, 'odd 3:2 rounds down');
});

test('basic strategy matches the 6-deck S17 chart on key hands', () => {
  const up = (r) => ({ r, s: 'H' });
  const all = { double: true, split: true };
  const cases = [
    ['10 6', '7', 'hit'],
    ['10 6', '6', 'stand'],
    ['10 2', '3', 'hit'],
    ['10 2', '4', 'stand'],
    ['6 5', 'A', 'hit'],
    ['6 5', '10', 'double'],
    ['5 5', '9', 'double'],
    ['5 4', '2', 'hit'],
    ['5 4', '3', 'double'],
    ['A 7', '2', 'stand'],
    ['A 7', '6', 'double'],
    ['A 7', '9', 'hit'],
    ['A 6', '3', 'double'],
    ['A 2', '4', 'hit'],
    ['A A', '10', 'split'],
    ['8 8', 'A', 'split'],
    ['9 9', '7', 'stand'],
    ['9 9', '8', 'split'],
    ['10 K', '6', 'stand'],
    ['4 4', '5', 'split'],
    ['4 4', '4', 'hit'],
  ];
  for (const [cards, u, want] of cases) {
    assert.equal(basicStrategy(C(cards), up(u), all), want, `${cards} vs ${u}`);
  }
  // Without double/split the fallbacks apply
  assert.equal(basicStrategy(C('6 5'), up('6'), { double: false, split: false }), 'hit');
  assert.equal(basicStrategy(C('A 7'), up('5'), { double: false, split: false }), 'stand');
  assert.equal(basicStrategy(C('8 8'), up('10'), { double: true, split: false }), 'hit');
});

test('bust chance and coach tips', () => {
  assert.equal(bustChanceIfHit(C('10 2')), 31); // 10s only
  assert.equal(bustChanceIfHit(C('10 6')), 62);
  assert.equal(bustChanceIfHit(C('A 5')), 0);
  const tip = coachTip(C('10 6'), { r: '6', s: 'H' }, { double: true, split: false });
  assert.equal(tip.move, 'stand');
  assert.match(tip.text, /Dealer busts about 42% from a 6/);
});

test('bots protect a lead and gamble when they are about to be cut', () => {
  const r = () => 0.5;
  const safe = botBet({ chips: 2000, min: 10, max: 100, others: [900, 1000], handsLeft: 3, isCutHand: false, canSecret: false }, 'gambler', r);
  assert.equal(safe.amount, 10);
  const lowest = botBet({ chips: 700, min: 10, max: 100, others: [760, 1000], handsLeft: 1, isCutHand: true, canSecret: true }, 'cautious', r);
  assert.equal(lowest.amount, 61, 'enough to pass 760 on a win');
  assert.equal(lowest.secret, false);
  const leader = botBet({ chips: 1500, min: 10, max: 100, others: [1400], handsLeft: 1, isCutHand: true, canSecret: true }, 'steady', r);
  assert.equal(leader.secret, true);
});
