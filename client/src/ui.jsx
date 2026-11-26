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

// Spade Haven Canva art: 49 portraits (people first, then animals and characters).
export const AVATAR_COUNT = 49;
export const avatarSrc = (i) => `/art/avatars/${((Number(i) % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT}.webp`;

// City scene for each table (entry level) — the same pictures as Spade Haven.
const CITY_ART = { 'New York': 'new-york', 'Las Vegas': 'las-vegas', 'Monte Carlo': 'monte-carlo', London: 'london' };
export const cityArt = (city) => (CITY_ART[city] ? `/art/cities/${CITY_ART[city]}.webp` : '/art/bg/practice.webp');

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

export function Avatar({ name = '?', index = 0, size = 64, ring = 'gold', empty = false }) {
  return (
    <div className={`avatar ring-${ring}`} style={{ width: size, height: size }}>
      {empty ? (
        <img className="avatar-face" src="/art/icons/avatar-empty.webp" alt="Empty seat" />
      ) : (
        <img className="avatar-face photo" src={avatarSrc(index)} alt={name} loading="lazy" />
      )}
    </div>
  );
}

export function CoinPill({ coins, onPlus }) {
  return (
    <div className="coin-pill">
      <img className="coin-img" src="/art/icons/coins.webp" alt="" />
      <b>{fmt(coins)}</b>
      {onPlus && (
        <button className="plus" onClick={onPlus} aria-label="Get free coins" title="Get free coins">
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
