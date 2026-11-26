// All live tables, indexed by id and by join code.
import { randomInt } from 'node:crypto';
import { Table } from './engine/table.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const CITIES = [
  { name: 'New York', entry: 100 },
  { name: 'Las Vegas', entry: 500 },
  { name: 'Monte Carlo', entry: 2500 },
  { name: 'London', entry: 10000 },
];
// TIMING_SCALE=0.2 speeds every timer up 5× (handy for testing a whole tournament).
const SCALE = Number(process.env.TIMING_SCALE) || 1;
const BASE = { fillMs: 20000, betMs: 15000, turnMs: 15000, botMinMs: 600, botMaxMs: 1500, awayMs: 1000, dealerStepMs: 700, resultMs: 2600 };
const scaledTiming = () => Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, Math.round(v * SCALE)]));

export const cityFor = (entry) => [...CITIES].reverse().find((c) => entry >= c.entry)?.name ?? 'New York';

export class Rooms {
  constructor() {
    this.byId = new Map();
    this.byCode = new Map();
  }

  newCode() {
    let code;
    do {
      code = Array.from({ length: 5 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
    } while (this.byCode.has(code));
    return code;
  }

  create(opts) {
    const code = this.newCode();
    const entry = opts.practice ? 0 : Math.max(0, Math.floor(opts.entry ?? 100));
    const t = new Table({ ...opts, code, entry, city: opts.practice ? 'Practice' : cityFor(entry), timing: scaledTiming() });
    this.byId.set(t.id, t);
    this.byCode.set(code, t);
    return t;
  }

  get(idOrCode) {
    if (!idOrCode) return null;
    return this.byId.get(idOrCode) ?? this.byCode.get(String(idOrCode).toUpperCase()) ?? null;
  }

  remove(t) {
    this.byId.delete(t.id);
    this.byCode.delete(t.code);
  }

  /** An open public table with the same length and entry, or a new one. */
  quickJoinTable({ length = 'standard', entry = 100 }) {
    for (const t of this.byId.values()) {
      if (!t.isPrivate && !t.practice && t.phase === 'waiting' && t.length === length && t.entry === entry && t.seats.some((s) => s === null)) {
        return t;
      }
    }
    return this.create({ length, entry });
  }

  publicList(now = Date.now()) {
    return [...this.byId.values()]
      .filter((t) => !t.isPrivate && !t.practice && t.phase !== 'finished')
      .map((t) => t.summary(now))
      .sort((a, b) => (a.phase === 'waiting' ? 0 : 1) - (b.phase === 'waiting' ? 0 : 1) || a.entry - b.entry);
  }
}
