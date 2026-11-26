// Small shared pieces: logo, avatar, coin pill, playing card, modal.
import React from 'react';

export const fmt = (n) => (n ?? 0).toLocaleString('en-US');

export const THEMES = [
  { id: 'royal-purple', name: 'Royal Purple', a: '#7b3cf0', b: '#3a1a9a', level: 1 },
  { id: 'emerald', name: 'Emerald', a: '#25a35c', b: '#0d5a32', level: 1 },
  { id: 'ocean', name: 'Ocean', a: '#2a8fe0', b: '#0d4a8a', level: 1 },
  { id: 'ruby', name: 'Ruby', a: '#c8244e', b: '#6a0b25', level: 1 },
  { id: 'sunset', name: 'Sunset', a: '#e8724a', b: '#8a2a4a', level: 2 },
  { id: 'neon-night', name: 'Neon Night', a: '#2b1a6a', b: '#0b0820', level: 3 },
  { id: 'royal-gold', name: 'Royal Gold', a: '#3a3020', b: '#15110a', level: 5 },
];
export const themeOf = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];

const AVATAR_COLORS = [
  ['#ff9a5a', '#c2410c'],
  ['#7dd3fc', '#1d4ed8'],
  ['#c4b5fd', '#6d28d9'],
  ['#86efac', '#15803d'],
  ['#fda4af', '#be123c'],
  ['#fde68a', '#b45309'],
];

export function Logo({ small }) {
  return (
    <div className={`logo ${small ? 'small' : ''}`}>
      <div className="logo-disc" aria-hidden="true">
        <span>♠</span>
      </div>
      <div className="logo-words">
        <span>BLACKJACK</span>
        <span>HAVEN</span>
      </div>
    </div>
  );
}

export function Avatar({ name = '?', index = 0, size = 64, ring = 'gold', bot = false, empty = false }) {
  const [a, b] = AVATAR_COLORS[Math.abs(index) % AVATAR_COLORS.length];
  return (
    <div className={`avatar ring-${ring}`} style={{ width: size, height: size }}>
      {empty ? (
        <div className="avatar-face empty">
          <svg viewBox="0 0 24 24" width="55%" aria-hidden="true">
            <circle cx="12" cy="8" r="4.2" fill="currentColor" />
            <path d="M3.5 21c.8-4.6 4.2-7 8.5-7s7.7 2.4 8.5 7z" fill="currentColor" />
          </svg>
        </div>
      ) : (
        <div className="avatar-face" style={{ background: `radial-gradient(circle at 35% 30%, ${a}, ${b})`, fontSize: size * 0.42 }}>
          {bot ? '🤖' : name.trim().charAt(0).toUpperCase() || '?'}
        </div>
      )}
    </div>
  );
}

export function CoinPill({ coins, onPlus }) {
  return (
    <div className="coin-pill">
      <span className="coin-dot">♠</span>
      <b>{fmt(coins)}</b>
      {onPlus && (
        <button className="plus" onClick={onPlus} aria-label="Get free coins">
          +
        </button>
      )}
    </div>
  );
}

const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
export function Card({ card, small }) {
  if (!card) return <div className={`card back ${small ? 'sm' : ''}`} aria-label="Face-down card" />;
  const red = card.s === 'H' || card.s === 'D';
  return (
    <div className={`card ${red ? 'red' : ''} ${small ? 'sm' : ''}`} aria-label={`${card.r} of ${SUIT[card.s]}`}>
      <span className="ci">
        <b>{card.r}</b>
        <i>{SUIT[card.s]}</i>
      </span>
      <span className="cs">{SUIT[card.s]}</span>
    </div>
  );
}

export function Modal({ title, onClose, children, wide, banner }) {
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        {banner}
        {!banner && <h2>{title}</h2>}
        {onClose && (
          <button className="close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Stepper({ label, value, onMinus, onPlus }) {
  return (
    <div className="stepper">
      {label && <small>{label}</small>}
      <button className="gold-round" onClick={onMinus} aria-label={`Lower ${label || ''}`}>
        −
      </button>
      <span className="step-val">{value}</span>
      <button className="gold-round" onClick={onPlus} aria-label={`Raise ${label || ''}`}>
        +
      </button>
    </div>
  );
}
