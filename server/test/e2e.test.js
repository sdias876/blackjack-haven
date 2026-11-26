// Starts the real server and plays the first hand of a practice table over Socket.io.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const PORT = 3999;

test('a guest can open a practice table, bet and act over Socket.io', async (t) => {
  const srv = spawn(process.execPath, ['src/index.js'], { env: { ...process.env, PORT: String(PORT), TIMING_SCALE: '0.1' }, stdio: 'pipe' });
  t.after(() => srv.kill());
  await new Promise((res) => srv.stdout.on('data', (d) => String(d).includes('server on') && res()));

  const s = io(`http://localhost:${PORT}`, { transports: ['websocket'] });
  t.after(() => s.disconnect());
  const call = (ev, data) => new Promise((res) => s.emit(ev, data, res));
  let last = null;
  const waitFor = (pred, ms = 8000) =>
    new Promise((res, rej) => {
      const end = setTimeout(() => rej(new Error('timeout')), ms);
      const check = (v) => {
        last = v;
        if (pred(v)) {
          clearTimeout(end);
          s.off('state', check);
          res(v);
        }
      };
      s.on('state', check);
      if (last) check(last);
    });

  await new Promise((res) => s.on('connect', res));
  assert.equal((await call('hello', { playerId: 'test-player-0001', name: 'Tester', avatar: 2 })).ok, true);
  const joined = await call('practice', { length: 'quick' });
  assert.equal(joined.ok, true);
  assert.equal(joined.entry, 0);

  const betting = await waitFor((v) => v.phase === 'betting');
  assert.equal(betting.practice, true);
  assert.equal(betting.seats.filter((x) => x?.bot).length, 5);
  assert.equal((await call('bet', { amount: 1 })).ok, false, 'server rejects a bet below the minimum');
  assert.equal((await call('bet', { amount: betting.limits.min })).ok, true);

  const after = await waitFor((v) => (v.phase === 'playing' && v.legal) || v.phase === 'result');
  if (after.legal) {
    assert.ok(after.coach, 'practice sends a coach tip');
    assert.equal((await call('action', { action: 'stand' })).ok, true);
  }
  const done = await waitFor((v) => v.phase === 'result' || (v.phase === 'betting' && v.hand === 2));
  assert.ok(done.seats[done.me].chips >= 0);
});
