import test from 'node:test';
import assert from 'node:assert/strict';
import { Table, SEATS, START_CHIPS, ROUNDS, prizesFor } from '../src/engine/table.js';

// Small, deterministic random source so tests can be replayed.
function seeded(seed) {
  let x = seed >>> 0 || 1;
  return (n) => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x % n;
  };
}

/** Run the clock until the table finishes; returns the number of ticks. */
function runToEnd(t, now, onTick) {
  let ticks = 0;
  while (t.phase !== 'finished' && ticks < 200000) {
    now += 250;
    t.tick(now);
    onTick?.(t, now);
    ticks++;
  }
  return { ticks, now };
}

test('a full Sit-and-Go of 6 bots-plus-one-away-player always finishes with valid places', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const t = new Table({ rand: seeded(seed), length: seed % 2 ? 'quick' : 'standard', entry: 100, now: 0 });
    t.addPlayer({ playerId: 'p1', name: 'Sav' }, 0);
    t.removePlayer('p1', 0); // leaves before start → seat freed
    t.addPlayer({ playerId: 'p1', name: 'Sav' }, 0);
    t.startNow('p1', 0);
    t.setConnected('p1', false, 0); // plays on auto-pilot
    let maxTotal = 0;
    const { ticks } = runToEnd(t, 0, (tt) => {
      for (const s of tt.seats) assert.ok(s.chips >= 0, 'chips never negative');
      maxTotal = Math.max(maxTotal, tt.seats.reduce((a, s) => a + s.chips, 0));
    });
    assert.equal(t.phase, 'finished', `seed ${seed} finished in ${ticks} ticks`);
    const places = t.seats.map((s) => s.place).sort((a, b) => a - b);
    assert.deepEqual(places, [1, 2, 3, 4, 5, 6], `seed ${seed} places`);
    const winner = t.seats.find((s) => s.place === 1);
    assert.ok(!winner.eliminated);
    assert.ok(t.seats.filter((s) => s.eliminated).length >= ROUNDS.length - 1);
  }
});

test('betting limits, turn order and illegal actions are enforced by the server', () => {
  const t = new Table({ rand: seeded(7), practice: true, now: 0 });
  t.addPlayer({ playerId: 'me', name: 'Me' }, 0);
  assert.equal(t.phase, 'betting', 'practice starts at once with 5 bots');
  assert.equal(t.seats.filter((s) => s.bot).length, SEATS - 1);
  const me = t.seatOf('me');
  assert.equal(t.placeBet(me, 5).ok, false, 'below the minimum');
  assert.equal(t.placeBet(me, 101).ok, false, 'above the maximum');
  assert.equal(t.act(me, 'hit').ok, false, 'cannot act while betting');
  assert.equal(t.placeBet(me, 50).ok, true);
  assert.equal(t.placeBet(me, 50).ok, false, 'one bet per hand');

  // Let the bots bet and play until it is my turn (or the hand ends).
  let now = 0;
  while (!(t.phase === 'playing' && t.turn.seat === me) && t.phase !== 'result' && now < 60000) {
    now += 100;
    t.tick(now);
  }
  if (t.phase === 'playing') {
    const v = t.viewFor('me', now);
    assert.ok(v.legal.hit && v.legal.stand);
    assert.ok(v.coach && v.coach.text.startsWith('Best move'), 'practice shows the coach');
    assert.equal(v.dealer.cards[1], null, 'hole card hidden from players');
    const other = (me + 1) % SEATS;
    assert.equal(t.act(other, 'stand').ok, false, 'not their turn');
    assert.equal(t.act(me, 'stand', now).ok, true);
    assert.equal(t.seats[me].stats.decisions, 1);
  }
});

test('secret bets are hidden from other players until the cards are dealt', () => {
  const t = new Table({ rand: seeded(3), now: 0, length: 'quick' });
  t.addPlayer({ playerId: 'a', name: 'A' }, 0);
  t.addPlayer({ playerId: 'b', name: 'B' }, 0);
  t.startNow('a', 0);
  t.handInRound = t.handsPerRound - 1; // jump to the cut hand
  t.beginBetting(0);
  const a = t.seatOf('a');
  assert.equal(t.viewFor('a', 0).canSecret, true);
  t.placeBet(a, 40, true, 0);
  assert.equal(t.viewFor('b', 0).seats[a].bet, null, 'B cannot see the amount');
  assert.equal(t.viewFor('b', 0).seats[a].secret, true);
  assert.equal(t.viewFor('a', 0).seats[a].bet, 40, 'A sees their own bet');
  assert.equal(t.viewFor('a', 0).canSecret, false, 'once per round');
});

test('a player who times out is played by basic strategy', () => {
  const t = new Table({ rand: seeded(11), practice: true, now: 0, timing: { betMs: 1000, turnMs: 1000 } });
  t.addPlayer({ playerId: 'me', name: 'Me' }, 0);
  const me = t.seatOf('me');
  let now = 0;
  for (let i = 0; i < 400 && t.handNo < 4; i++) {
    now += 250;
    t.tick(now);
  }
  assert.ok(t.handNo >= 4, 'hands keep coming without any input');
  assert.equal(t.seats[me].stats.decisions, 0, 'auto-play does not count as your decisions');
  assert.ok(t.seats[me].chips <= START_CHIPS + 2000);
});

test('prizes are 90% of entries split 2:1', () => {
  assert.deepEqual(prizesFor(100), { first: 360, second: 180 });
  assert.deepEqual(prizesFor(0), { first: 0, second: 0 });
});
