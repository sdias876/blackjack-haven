import React, { useEffect, useState } from 'react';
import { Logo, Avatar, CoinPill, Modal, Stepper, THEMES, fmt } from './ui.jsx';
import { FREE_EVERY_MS } from './wallet.js';

// ---------------- Welcome ----------------
export function Welcome({ onStart }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(0);
  const go = () => onStart({ name: name.trim() || `Guest${Math.floor(10000 + Math.random() * 89999)}`, avatar });
  return (
    <div className="screen welcome suits-bg">
      <div className="welcome-inner">
        <Logo />
        <div className="glow-line" />
        <label className="field-label" htmlFor="nm">
          Your table name
        </label>
        <input id="nm" className="field" maxLength={16} placeholder="Guest" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
        <div className="avatar-pick" role="radiogroup" aria-label="Pick a picture">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <button key={i} role="radio" aria-checked={avatar === i} className={avatar === i ? 'on' : ''} onClick={() => setAvatar(i)}>
              <Avatar name={name || 'G'} index={i} size={52} ring={avatar === i ? 'gold' : 'silver'} />
            </button>
          ))}
        </div>
        <button className="pill green big" onClick={go}>
          <span className="pill-ic">▶</span> Continue as guest
        </button>
        <p className="fine">Free to play. Coins are play money with no cash value. Google Play Games and email sign-in are coming soon.</p>
      </div>
    </div>
  );
}

// ---------------- Main menu ----------------
export function Menu({ wallet, level, profile, setModal, claimFree, onPlayNow, onLobby, onPrivate, onPractice, onRename }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  const freeLeft = Math.max(0, wallet.lastFree + FREE_EVERY_MS - now);
  return (
    <div className="screen menu suits-bg">
      <header className="topbar">
        <button className="me-btn" onClick={onRename} aria-label="Change name or picture">
          <Avatar name={profile.name} index={profile.avatar} size={58} />
        </button>
        <CoinPill coins={wallet.coins} onPlus={claimFree} />
        <div className="level-pill">
          <span className="star">★</span> LEVEL {level}
        </div>
        <div className="spacer" />
        <button className="round-gold" onClick={() => setModal({ kind: 'help' })} aria-label="How to play">
          ?
        </button>
      </header>

      <main className="menu-main">
        <aside className="side-tiles">
          <button className="tile red" onClick={claimFree}>
            <img src="/ui/coins.webp" alt="" />
            <b>+100</b>
            <small>{freeLeft ? `${Math.ceil(freeLeft / 60000)} MIN` : 'FREE COINS'}</small>
          </button>
          <button className="tile purple" onClick={onPractice}>
            <img src="/ui/crown.webp" alt="" />
            <b>PRACTICE</b>
            <small>SMART COACH</small>
          </button>
          <button className="tile green" onClick={() => setModal({ kind: 'help' })}>
            <img src="/ui/chat.webp" alt="" />
            <b>HOW TO</b>
            <small>PLAY</small>
          </button>
        </aside>

        <div className="big-buttons">
          <button className="big-btn" onClick={onPlayNow}>
            <span className="ring">
              <span className="play-disc">▶</span>
            </span>
            <span className="pill green">PLAY NOW</span>
            <small className="under">Sit-and-Go · 100 coins entry</small>
          </button>
          <button className="big-btn" onClick={onLobby}>
            <span className="ring blue">
              <img src="/ui/friends-table.webp" alt="" />
            </span>
            <span className="pill blue">ONLINE LOBBY</span>
          </button>
          <button className="big-btn" onClick={onPrivate}>
            <span className="ring purple">
              <img src="/ui/create-table.webp" alt="" />
            </span>
            <span className="pill purple">PRIVATE GAME</span>
            <small className="neon">NOW OPEN</small>
          </button>
        </div>
      </main>

      <nav className="bottombar">
        <button onClick={() => setModal({ kind: 'leaders' })}>
          <img src="/ui/podium.webp" alt="" />
          LEADERS
        </button>
        <button onClick={() => setModal({ kind: 'trophies' })}>
          <img src="/ui/trophy.webp" alt="" />
          TROPHY
        </button>
        <button onClick={onPractice}>
          <img src="/ui/crown.webp" alt="" />
          PRACTICE
        </button>
        <button onClick={() => setModal({ kind: 'help' })}>
          <img src="/ui/chat.webp" alt="" />
          HELP
        </button>
      </nav>
    </div>
  );
}

// ---------------- Online lobby ----------------
const TYPES = [
  { id: 'standard', label: 'SIT-AND-GO' },
  { id: 'quick', label: 'QUICK SIT-AND-GO' },
];
const ENTRY_FILTER = ['ANY', 100, 500, 2500, 10000];

export function Lobby({ wallet, emit, join, onBack, setModal }) {
  const [type, setType] = useState(0);
  const [ef, setEf] = useState(0);
  const [tables, setTables] = useState(null);
  useEffect(() => {
    let live = true;
    const load = () => emit('listTables', {}).then((r) => live && setTables(r.tables ?? []));
    load();
    const t = setInterval(load, 3000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [emit]);
  const shown = (tables ?? []).filter((t) => t.length === TYPES[type].id && (ef === 0 || t.entry === ENTRY_FILTER[ef]));
  return (
    <div className="screen lobby lobby-bg">
      <header className="lobby-top">
        <button className="back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <div className="panel">
          <h4>ROOM TYPE</h4>
          <div className="switch">
            <button className="gold-round" onClick={() => setType((type + TYPES.length - 1) % TYPES.length)} aria-label="Previous type">
              ‹
            </button>
            <span className="step-val wide">{TYPES[type].label}</span>
            <button className="gold-round" onClick={() => setType((type + 1) % TYPES.length)} aria-label="Next type">
              ›
            </button>
          </div>
        </div>
        <div className="panel">
          <h4>ENTRY</h4>
          <Stepper value={ENTRY_FILTER[ef] === 'ANY' ? 'ANY' : fmt(ENTRY_FILTER[ef])} onMinus={() => setEf((ef + ENTRY_FILTER.length - 1) % ENTRY_FILTER.length)} onPlus={() => setEf((ef + 1) % ENTRY_FILTER.length)} />
        </div>
        <div className="spacer" />
        <CoinPill coins={wallet.coins} />
      </header>

      <main className="lobby-main">
        <div className="create-col">
          <img src="/ui/create-table.webp" alt="" className="float" />
          <button className="pill gold" onClick={() => setModal({ kind: 'create', isPrivate: false })}>
            CREATE TABLE
          </button>
        </div>
        <div className="table-list">
          {tables === null ? (
            <div className="empty-card">
              <p>Loading tables…</p>
            </div>
          ) : shown.length === 0 ? (
            <div className="empty-card">
              <img src="/ui/friends-table.webp" alt="" />
              <div>
                <h3>NO ONE IS PLAYING {TYPES[type].label} RIGHT NOW</h3>
                <p>Tables with real players show up here as soon as someone sits down. Create one and others can join you.</p>
                <button className="pill gold" onClick={() => setModal({ kind: 'create', isPrivate: false })}>
                  CREATE A TABLE
                </button>
              </div>
            </div>
          ) : (
            shown.map((t) => (
              <div className="table-row" key={t.id}>
                <div>
                  <b className="city">{t.city}</b>
                  <small>
                    {t.length === 'quick' ? 'Quick' : 'Standard'} · entry {fmt(t.entry)}
                  </small>
                </div>
                <div className="seats-dots" aria-label={`${t.seated} of ${t.seats} seats`}>
                  {Array.from({ length: t.seats }, (_, i) => (
                    <i key={i} className={i < t.seated ? 'on' : ''} />
                  ))}
                  <span>
                    {t.seated}/{t.seats}
                  </span>
                </div>
                {t.phase === 'waiting' ? (
                  <button className="pill green sm" onClick={() => join('joinTable', { code: t.code }, t.entry)}>
                    JOIN
                  </button>
                ) : (
                  <span className="playing-tag">PLAYING</span>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

// ---------------- Create table window ----------------
const ENTRIES = [100, 250, 500, 1000, 2500, 5000, 10000];
const cityFor = (e) => (e >= 10000 ? 'Macau' : e >= 2500 ? 'Monte Carlo' : e >= 500 ? 'Las Vegas' : 'New York');

export function CreateTable({ wallet, level, isPrivate, onClose, onCreate }) {
  const [ei, setEi] = useState(0);
  const [length, setLength] = useState('standard');
  const [theme, setTheme] = useState('royal-purple');
  const entry = ENTRIES[ei];
  const prize1 = Math.round(entry * 6 * 0.6);
  const prize2 = Math.round(entry * 6 * 0.3);
  const city = cityFor(entry);
  return (
    <Modal
      title="Create table"
      onClose={onClose}
      wide
      banner={
        <div className={`city-banner city-${city.toLowerCase().replace(' ', '-')}`}>
          <h5>CREATE {isPrivate ? 'PRIVATE' : 'SIT-AND-GO'} TABLE</h5>
          <h2>{city}</h2>
        </div>
      }
    >
      <div className="bet-head">
        <span className="bet-pill">
          <img src="/ui/coins.webp" alt="" /> ENTRY {fmt(entry)}
        </span>
      </div>
      <div className="slider-row">
        <button className="gold-round" onClick={() => setEi(Math.max(0, ei - 1))} aria-label="Lower entry">
          −
        </button>
        <input type="range" min={0} max={ENTRIES.length - 1} value={ei} onChange={(e) => setEi(Number(e.target.value))} aria-label="Entry" />
        <button className="gold-round" onClick={() => setEi(Math.min(ENTRIES.length - 1, ei + 1))} aria-label="Raise entry">
          +
        </button>
      </div>
      <div className="prize-pill">
        Prize for 1st: <span className="coin-dot sm">♠</span> {fmt(prize1)} · 2nd: {fmt(prize2)}
      </div>

      <div className="opt-box">
        <h4>GAME LENGTH</h4>
        <div className="seg">
          <button className={length === 'quick' ? 'on' : ''} onClick={() => setLength('quick')}>
            QUICK <small>3 rounds × 5 hands · ~5 min</small>
          </button>
          <button className={length === 'standard' ? 'on' : ''} onClick={() => setLength('standard')}>
            STANDARD <small>3 rounds × 8 hands · ~10 min</small>
          </button>
        </div>
      </div>

      <h6 className="mini-title">TABLE &amp; CARDS</h6>
      <div className="themes">
        {THEMES.map((t) => {
          const locked = level < t.level;
          return (
            <button key={t.id} className={`theme ${theme === t.id ? 'on' : ''}`} disabled={locked} onClick={() => setTheme(t.id)} title={locked ? `Unlocks at level ${t.level}` : t.name}>
              <span className="sw" style={{ background: `radial-gradient(ellipse at 50% 30%, ${t.a}, ${t.b})` }}>
                <i>♠</i>
                <i className="r">♥</i>
                <i>♣</i>
                <i className="r">♦</i>
                {locked && <em>🔒</em>}
              </span>
              <small>{t.name}</small>
            </button>
          );
        })}
      </div>

      <button className="pill green big wide" disabled={wallet.coins < entry} onClick={() => onCreate({ isPrivate, length, entry, theme })}>
        {wallet.coins < entry ? 'NOT ENOUGH COINS' : 'PLAY NOW'}
      </button>
    </Modal>
  );
}

// ---------------- Private game ----------------
export function PrivateGame({ onClose, onCreate, onJoin }) {
  const [code, setCode] = useState('');
  return (
    <Modal title="PRIVATE GAME" onClose={onClose}>
      <p className="center">Play with friends at your own table. Bots fill any empty seats when you start.</p>
      <button className="pill gold big wide" onClick={onCreate}>
        CREATE PRIVATE TABLE
      </button>
      <div className="or">or join with a code</div>
      <div className="join-row">
        <input className="field code" maxLength={5} placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <button className="pill green" disabled={code.length < 5} onClick={() => onJoin(code)}>
          JOIN
        </button>
      </div>
    </Modal>
  );
}

// ---------------- Help ----------------
export function Help({ onClose }) {
  return (
    <Modal title="HOW TO PLAY" onClose={onClose} wide>
      <div className="help">
        <h4>Beat the table, not just the dealer</h4>
        <p>Everyone starts with 1,000 tournament chips and plays the same dealer. What matters is your chip count compared with the other players.</p>
        <h4>Rounds and the cut</h4>
        <ul>
          <li>3 rounds of 8 hands (Quick: 5 hands). Bets go up each round: 10–100, then 25–250, then 50–500.</li>
          <li>After rounds 1 and 2, the lowest stack at the table is eliminated. The top bar shows how many hands are left before the cut.</li>
          <li>After round 3, the biggest stack wins. 1st and 2nd share the prize.</li>
        </ul>
        <h4>Secret Bet</h4>
        <p>On the last hand of each round you may hide your bet. Nobody sees it until the cards are dealt, so leaders can't simply copy you.</p>
        <h4>The rules</h4>
        <ul>
          <li>6 decks. Dealer stands on all 17s. Blackjack pays 3:2.</li>
          <li>Double on any first two cards. Split a pair once; split aces get one card each.</li>
          <li>15 seconds per decision. If time runs out, the game plays basic strategy for you.</li>
        </ul>
        <h4>Practice</h4>
        <p>Practice tables are free and turn on the Smart Coach, which highlights the best move and explains why.</p>
        <p className="fine">Blackjack Haven is free. Coins are play money with no cash value and can never be bought or cashed out.</p>
      </div>
    </Modal>
  );
}

// ---------------- Leaders and trophies (this device) ----------------
export function Leaders({ wallet, profile, onClose }) {
  const real = wallet.results.filter((r) => !r.practice);
  const wins = real.filter((r) => r.place === 1).length;
  const top2 = real.filter((r) => r.place <= 2).length;
  const acc = wallet.results.filter((r) => r.accuracy != null);
  const avgAcc = acc.length ? Math.round(acc.reduce((a, r) => a + r.accuracy, 0) / acc.length) : null;
  return (
    <Modal title="LEADERS" onClose={onClose}>
      <img src="/ui/podium.webp" alt="" className="modal-art" />
      <div className="stat-grid">
        <div>
          <b>{real.length}</b>
          <small>Tournaments</small>
        </div>
        <div>
          <b>{wins}</b>
          <small>Wins</small>
        </div>
        <div>
          <b>{top2}</b>
          <small>Top 2</small>
        </div>
        <div>
          <b>{avgAcc ?? '–'}%</b>
          <small>Strategy accuracy</small>
        </div>
      </div>
      <p className="fine center">{profile.name}'s results on this device. Weekly leagues with other players are coming next.</p>
    </Modal>
  );
}

export function Trophies({ wallet, onClose }) {
  return (
    <Modal title="TROPHY ROOM" onClose={onClose}>
      <img src="/ui/trophy.webp" alt="" className="modal-art" />
      {wallet.results.length === 0 ? (
        <p className="center">Finish a tournament to see your results here.</p>
      ) : (
        <ul className="results-list">
          {wallet.results.map((r, i) => (
            <li key={i}>
              <span className={`place p${r.place}`}>{ordinal(r.place)}</span>
              <span>{r.practice ? 'Practice' : r.city}</span>
              <span>{r.prize ? `+${fmt(r.prize)}` : r.practice ? '' : `−${fmt(r.entry)}`}</span>
              <small>{new Date(r.at).toLocaleDateString()}</small>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export const ordinal = (n) => (n ? n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th') : '–');
