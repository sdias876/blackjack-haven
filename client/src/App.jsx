import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { loadWallet, saveWallet, playerId, loadProfile, saveProfile, levelOf, xpForPlace, FREE_COINS, FREE_EVERY_MS } from './wallet.js';
import { Welcome, Menu, Lobby, CreateTable, PrivateGame, Help, Leaders, Trophies, Tour } from './screens.jsx';

const TOUR_KEY = 'bjh-tour-seen';
const tourSeen = () => {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return true;
  }
};
import TableView from './TableView.jsx';
import { MegaWheel } from './wheel.jsx';

export default function App() {
  const pid = useMemo(() => playerId(), []);
  const [profile, setProfile] = useState(loadProfile);
  const [wallet, setWallet] = useState(loadWallet);
  const [screen, setScreen] = useState(profile ? 'menu' : 'welcome');
  const [modal, setModal] = useState(null); // { kind, ...props }
  const [view, setView] = useState(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [toast, setToast] = useState('');
  const [connected, setConnected] = useState(false);
  const sockRef = useRef(null);
  const pendingJoin = useRef(new URLSearchParams(location.search).get('join'));

  const updateWallet = useCallback((fn) => setWallet((w) => saveWallet(fn({ ...w }))), []);
  const say = useCallback((msg) => {
    setToast(msg);
    clearTimeout(say.t);
    say.t = setTimeout(() => setToast(''), 3200);
  }, []);

  // ----- socket -----
  useEffect(() => {
    if (!profile) return undefined;
    const s = io({ transports: ['websocket', 'polling'] });
    sockRef.current = s;
    s.on('connect', () => {
      setConnected(true);
      s.emit('hello', { playerId: pid, name: profile.name, avatar: profile.avatar }, (r) => {
        if (r?.tableId) setScreen('table');
        else if (pendingJoin.current) {
          const code = pendingJoin.current;
          pendingJoin.current = null;
          history.replaceState(null, '', location.pathname);
          s.emit('joinTable', { code }, (j) => (j.ok ? setScreen('table') : say(j.error)));
        }
      });
    });
    s.on('disconnect', () => setConnected(false));
    s.on('state', (v) => {
      setView(v);
      setReceivedAt(Date.now());
    });
    return () => s.disconnect();
  }, [profile, pid, say]);

  const emit = useCallback((ev, data) => new Promise((res) => sockRef.current?.emit(ev, data, (r) => res(r ?? { ok: false }))), []);

  // ----- paying entries and prizes -----
  const join = useCallback(
    async (ev, data, entry = 0) => {
      if (entry > 0 && wallet.coins < entry) {
        say('Not enough coins. Grab your free coins on the menu.');
        return;
      }
      const r = await emit(ev, data);
      if (!r.ok) return say(r.error || 'Could not join');
      const cost = r.entry ?? entry;
      if (cost > wallet.coins) {
        await emit('leave', {});
        return say('Not enough coins for that table. Grab your free coins on the menu.');
      }
      if (cost > 0 && !wallet.paid[r.tableId]) {
        updateWallet((w) => ({ ...w, coins: w.coins - cost, paid: { ...w.paid, [r.tableId]: { entry: cost, settled: false } } }));
      }
      setModal(null);
      setScreen('table');
    },
    [emit, wallet, updateWallet, say],
  );

  useEffect(() => {
    const res = view?.myResult;
    if (!res || !view?.id) return;
    const done = view.phase === 'finished' || view.seats[view.me]?.eliminated;
    if (!done) return;
    updateWallet((w) => {
      const key = 'r:' + view.id;
      if (w.paid[key]) return w;
      const prize = res.prize || 0;
      return {
        ...w,
        coins: w.coins + prize,
        xp: w.xp + (view.practice ? 20 : xpForPlace(res.place)),
        paid: { ...w.paid, [key]: true },
        results: [{ at: Date.now(), place: res.place, prize, entry: view.entry, city: view.city, accuracy: res.accuracy, practice: view.practice }, ...w.results].slice(0, 30),
      };
    });
  }, [view, updateWallet]);

  const leaveTable = useCallback(async () => {
    const v = view;
    await emit('leave', {});
    // Refund the entry if the tournament never started
    if (v && v.phase === 'waiting' && wallet.paid[v.id] && !wallet.paid[v.id].settled) {
      updateWallet((w) => ({ ...w, coins: w.coins + v.entry, paid: { ...w.paid, [v.id]: { ...w.paid[v.id], settled: true } } }));
    }
    setView(null);
    setScreen('menu');
  }, [emit, view, wallet.paid, updateWallet]);

  const claimFree = () => {
    const left = wallet.lastFree + FREE_EVERY_MS - Date.now();
    if (left > 0) return say(`Next free coins in ${Math.ceil(left / 60000)} min`);
    updateWallet((w) => ({ ...w, coins: w.coins + FREE_COINS, lastFree: Date.now() }));
    say(`+${FREE_COINS} free coins!`);
  };

  const level = levelOf(wallet.xp);
  const common = { wallet, level, profile, say, setModal, claimFree };

  let body;
  if (screen === 'welcome' || !profile) {
    body = (
      <Welcome
        profile={profile}
        onStart={(p) => {
          saveProfile(p);
          setProfile(p);
          setScreen('menu');
          if (!tourSeen()) setModal({ kind: 'tour', first: true });
        }}
      />
    );
  } else if (screen === 'table' && view) {
    body = <TableView key={view.id} view={view} receivedAt={receivedAt} emit={emit} onLeave={leaveTable} onHelp={() => setModal({ kind: 'tour' })} onRules={() => setModal({ kind: 'help' })} say={say} wallet={wallet} profile={profile} join={join} />;
  } else if (screen === 'lobby') {
    body = <Lobby {...common} emit={emit} join={join} onBack={() => setScreen('menu')} />;
  } else {
    body = (
      <Menu
        {...common}
        onPlayNow={() => join('quickJoin', { length: 'standard', entry: 100 }, 100)}
        onLobby={() => setScreen('lobby')}
        onPrivate={() => setModal({ kind: 'private' })}
        onPractice={() => join('practice', { length: 'quick' }, 0)}
        onRename={() => setScreen('welcome')}
      />
    );
  }

  return (
    <div className="app">
      {body}
      {!connected && profile && screen !== 'welcome' && <div className="offline">Connecting to the game server…</div>}
      {modal?.kind === 'help' && <Help onClose={() => setModal(null)} onTour={() => setModal({ kind: 'tour' })} />}
      {modal?.kind === 'wheel' && <MegaWheel wallet={wallet} updateWallet={updateWallet} onClose={() => setModal(null)} />}
      {modal?.kind === 'tour' && (
        <Tour
          onClose={() => {
            try {
              localStorage.setItem(TOUR_KEY, '1');
            } catch {}
            setModal(null);
          }}
          onPractice={
            screen === 'table'
              ? null
              : () => {
                  try {
                    localStorage.setItem(TOUR_KEY, '1');
                  } catch {}
                  join('practice', { length: 'quick' }, 0);
                }
          }
        />
      )}
      {modal?.kind === 'leaders' && <Leaders wallet={wallet} profile={profile} onClose={() => setModal(null)} />}
      {modal?.kind === 'trophies' && <Trophies wallet={wallet} onClose={() => setModal(null)} />}
      {modal?.kind === 'private' && (
        <PrivateGame
          onClose={() => setModal(null)}
          onCreate={() => setModal({ kind: 'create', isPrivate: true })}
          onJoin={(code) => join('joinTable', { code }, 0)}
        />
      )}
      {modal?.kind === 'create' && (
        <CreateTable
          {...common}
          isPrivate={modal.isPrivate}
          onClose={() => setModal(null)}
          onCreate={(opts) => join('createTable', opts, opts.entry)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
