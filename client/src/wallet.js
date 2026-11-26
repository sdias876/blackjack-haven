// Coins, level and results are free play money kept on this device.
// Coins have no cash value and can never be bought or cashed out.
const KEY = 'bjh.wallet.v1';
export const START_COINS = 50000;
export const FREE_COINS = 100;
export const FREE_EVERY_MS = 60 * 60 * 1000;

const blank = () => ({ coins: START_COINS, xp: 0, lastFree: 0, results: [], paid: {} });

export function loadWallet() {
  try {
    return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return blank();
  }
}

export function saveWallet(w) {
  try {
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    /* storage can be unavailable (private mode); play continues */
  }
  return w;
}

export const levelOf = (xp) => 1 + Math.floor(xp / 300);
export const xpForPlace = (place) => 50 + ({ 1: 200, 2: 120, 3: 60 }[place] ?? 0);

export function playerId() {
  let id = null;
  try {
    id = localStorage.getItem('bjh.playerId');
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now();
      localStorage.setItem('bjh.playerId', id);
    }
  } catch {
    id = id || 'guest-' + Math.random().toString(36).slice(2, 12);
  }
  return id;
}

export function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem('bjh.profile') || 'null');
  } catch {
    return null;
  }
}
export function saveProfile(p) {
  try {
    localStorage.setItem('bjh.profile', JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
