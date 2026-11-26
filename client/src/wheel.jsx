// Mega Bonus wheel: one free spin every few hours for free play coins.
// Coins are play money on this device; nothing here can be bought.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, fmt } from './ui.jsx';
import { SPIN_EVERY_MS } from './wallet.js';

// Clockwise from the pointer at the top. `w` is the relative chance.
export const SEGMENTS = [
  { coins: 500, w: 20, c: ['#8a4bff', '#4a1ab0'] },
  { coins: 1000, w: 14, c: ['#2a8fe0', '#0d4a8a'] },
  { coins: 250, w: 22, c: ['#ff5a6e', '#a3122a'] },
  { coins: 2000, w: 8, c: ['#3be07a', '#0f7a35'] },
  { coins: 500, w: 20, c: ['#8a4bff', '#4a1ab0'] },
  { coins: 5000, w: 3, c: ['#ffd75e', '#c97800'], gold: true },
  { coins: 250, w: 22, c: ['#ff5a6e', '#a3122a'] },
  { coins: 1000, w: 14, c: ['#2a8fe0', '#0d4a8a'] },
  { coins: 500, w: 20, c: ['#8a4bff', '#4a1ab0'] },
  { coins: 2500, w: 6, c: ['#3be07a', '#0f7a35'] },
  { coins: 250, w: 22, c: ['#ff5a6e', '#a3122a'] },
  { coins: 10000, w: 1, c: ['#ffd75e', '#c97800'], gold: true, mega: true },
];
const N = SEGMENTS.length;
const SLICE = 360 / N;

/** Weighted pick using the browser's secure random numbers. */
export function pickSegment(rand = Math.random) {
  const total = SEGMENTS.reduce((a, s) => a + s.w, 0);
  let r = rand() * total;
  for (let i = 0; i < N; i++) {
    r -= SEGMENTS[i].w;
    if (r < 0) return i;
  }
  return N - 1;
}

const secureRand = () => {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 2 ** 32;
  } catch {
    return Math.random();
  }
};

export const spinLeft = (wallet, now = Date.now()) => Math.max(0, (wallet.lastSpin || 0) + SPIN_EVERY_MS - now);
export const fmtWait = (ms) => {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
};

function WheelFace() {
  const R = 150;
  const pt = (deg, r) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [160 + r * Math.cos(a), 160 + r * Math.sin(a)];
  };
  return (
    <svg viewBox="0 0 320 320" className="wheel-svg" aria-hidden="true">
      <defs>
        {SEGMENTS.map((s, i) => (
          <radialGradient key={i} id={`seg${i}`} cx="160" cy="160" r="150" gradientUnits="userSpaceOnUse">
            <stop offset="0.2" stopColor={s.c[1]} />
            <stop offset="1" stopColor={s.c[0]} />
          </radialGradient>
        ))}
      </defs>
      {SEGMENTS.map((s, i) => {
        const a0 = i * SLICE - SLICE / 2;
        const a1 = a0 + SLICE;
        const [x0, y0] = pt(a0, R);
        const [x1, y1] = pt(a1, R);
        const [tx, ty] = pt(i * SLICE, R * 0.66);
        return (
          <g key={i}>
            <path d={`M160 160 L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z`} fill={`url(#seg${i})`} stroke="#ffe7a0" strokeWidth="2" />
            <text x={tx} y={ty} transform={`rotate(${i * SLICE} ${tx} ${ty})`} textAnchor="middle" dominantBaseline="middle" className={`wheel-num ${s.gold ? 'dark' : ''}`}>
              {s.mega ? '10K' : s.coins >= 1000 ? `${s.coins / 1000}K` : s.coins}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MegaWheel({ wallet, updateWallet, onClose }) {
  const [now, setNow] = useState(Date.now());
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      clearInterval(t);
      clearTimeout(timer.current);
    };
  }, []);
  const left = spinLeft(wallet, now);
  const ready = left === 0 && !spinning && won == null;

  const spin = () => {
    if (!ready) return;
    const i = pickSegment(secureRand);
    const prize = SEGMENTS[i].coins;
    // Pay and record the spin before the animation, so closing or reloading can't repeat it.
    updateWallet((w) => ({ ...w, coins: w.coins + prize, lastSpin: Date.now() }));
    const jitter = (secureRand() - 0.5) * SLICE * 0.6;
    const target = angle - (angle % 360) + 360 * 6 + (360 - i * SLICE) + jitter;
    setSpinning(true);
    setAngle(target);
    timer.current = setTimeout(() => {
      setSpinning(false);
      setWon(prize);
    }, 5200);
  };

  return (
    <Modal title="MEGA BONUS" onClose={spinning ? null : onClose}>
      <div className="mega">
        <p className="explain center">One free spin every {SPIN_EVERY_MS / 3600000} hours. Every slice wins coins!</p>
        <div className={`wheel-wrap ${spinning ? 'spinning' : ''} ${ready ? 'ready' : ''}`}>
          <div className="wheel-pointer" aria-hidden="true" />
          <div className="wheel-rim">
            {Array.from({ length: 24 }, (_, k) => {
              const a = (k * 15 * Math.PI) / 180;
              return <i key={k} className="bulb" style={{ left: `${50 + 47.6 * Math.sin(a)}%`, top: `${50 - 47.6 * Math.cos(a)}%` }} />;
            })}
            <div className="wheel-spin" style={{ transform: `rotate(${angle}deg)` }}>
              <WheelFace />
            </div>
            <button className="wheel-hub" onClick={spin} disabled={!ready} aria-label="Spin the wheel">
              {spinning ? '♠' : ready ? 'SPIN' : '♠'}
            </button>
          </div>
        </div>
        {won != null ? (
          <div className="mega-win">
            <img src="/art/icons/coins.webp" alt="" />
            <div>
              <small>YOU WON</small>
              <b>{fmt(won)} COINS</b>
            </div>
          </div>
        ) : null}
        {won != null ? (
          <button className="pill green big wide" onClick={onClose}>
            COLLECT
          </button>
        ) : (
          <button className="pill gold big wide" onClick={spin} disabled={!ready}>
            {spinning ? 'GOOD LUCK…' : ready ? 'SPIN THE WHEEL' : `NEXT SPIN IN ${fmtWait(left).toUpperCase()}`}
          </button>
        )}
        <p className="fine center">Coins are play money with no cash value.</p>
      </div>
    </Modal>
  );
}
