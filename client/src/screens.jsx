import React, { useEffect, useState } from 'react';
import { Logo, Avatar, CoinPill, Modal, Stepper, THEMES, fmt, AVATAR_COUNT, cityArt } from './ui.jsx';
import { FREE_EVERY_MS } from './wallet.js';
import { spinLeft, fmtWait } from './wheel.jsx';

// ---------------- Welcome ----------------
export function Welcome({ onStart, profile }) {
  const [name, setName] = useState(profile?.name ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? Math.floor(Math.random() * AVATAR_COUNT));
  const go = () => onStart({ name: name.trim() || `Guest${Math.floor(10000 + Math.random() * 89999)}`, avatar });
  return (
    <div className="screen welcome suits-bg">
      <div className="welcome-inner">
        <Logo />
        <div className="glow-line" />
        <div className="me-preview">
          <Avatar name={name || 'You'} index={avatar} size={110} />
          <div>
            <label className="field-label" htmlFor="nm">
              1. Type your name
            </label>
            <input id="nm" className="field" maxLength={16} placeholder="Guest" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
          </div>
        </div>
        <div className="field-label">2. Pick your picture</div>
        <div className="avatar-pick" role="radiogroup" aria-label="Pick a picture">
          {Array.from({ length: AVATAR_COUNT }, (_, i) => (
            <button key={i} role="radio" aria-checked={avatar === i} aria-label={`Picture ${i + 1}`} className={avatar === i ? 'on' : ''} onClick={() => setAvatar(i)}>
              <Avatar name="" index={i} size={58} ring={avatar === i ? 'gold' : 'silver'} />
            </button>
          ))}
        </div>
        <button className="pill green big" onClick={go}>
          <img className="pill-img" src="/art/icons/play.webp" alt="" /> {profile ? 'SAVE' : "LET'S PLAY"}
        </button>
        <p className="fine">Free to play. Coins are play money with no cash value and can never be bought or cashed out.</p>
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
  const wheelLeft = spinLeft(wallet, now);
  return (
    <div className="screen menu suits-bg">
      <header className="topbar">
        <button className="me-btn" onClick={onRename} aria-label="Change name or picture" title="Change name or picture">
          <Avatar name={profile.name} index={profile.avatar} size={58} />
          <span className="me-name">{profile.name}</span>
        </button>
        <CoinPill coins={wallet.coins} onPlus={claimFree} />
        <div className="level-pill">
          <span className="star">★</span> LEVEL {level}
        </div>
        <div className="spacer" />
        <button className="round-gold" onClick={() => setModal({ kind: 'tour' })} aria-label="How to play" title="How to play">
          ?
        </button>
      </header>

      <main className="menu-main">
        <aside className="side-tiles">
          <button className={`tile gold mega-tile ${wheelLeft ? '' : 'ready'}`} onClick={() => setModal({ kind: 'wheel' })}>
            <span className="mini-wheel" aria-hidden="true" />
            <b>MEGA BONUS</b>
            <small>{wheelLeft ? fmtWait(wheelLeft).toUpperCase() : 'FREE SPIN!'}</small>
            {!wheelLeft && <em className="badge">1</em>}
          </button>
          <button className="tile red" onClick={claimFree}>
            <img src="/art/icons/gift.webp" alt="" />
            <b>{freeLeft ? `${Math.ceil(freeLeft / 60000)} MIN` : '+100 FREE'}</b>
            <small>{freeLeft ? 'NEXT FREE COINS' : 'TAP TO COLLECT'}</small>
          </button>
          <button className="tile purple" onClick={onPractice}>
            <img src="/art/icons/crown.webp" alt="" />
            <b>PRACTICE</b>
            <small>FREE · WITH TIPS</small>
          </button>
          <button className="tile green" onClick={() => setModal({ kind: 'tour' })}>
            <img src="/art/icons/crowned-card.webp" alt="" />
            <b>HOW TO</b>
            <small>PLAY IN 1 MIN</small>
          </button>
        </aside>

        <div className="big-buttons">
          <button className="big-btn" onClick={onPlayNow}>
            <span className="ring">
              <img src="/art/icons/play.webp" alt="" />
            </span>
            <span className="pill green">PLAY NOW</span>
            <small className="under">Join a 6-player game right away · 100 coins</small>
          </button>
          <button className="big-btn" onClick={onLobby}>
            <span className="ring blue">
              <img src="/art/icons/globe.webp" alt="" />
            </span>
            <span className="pill blue">ONLINE LOBBY</span>
            <small className="under">Choose a table and an entry</small>
          </button>
          <button className="big-btn" onClick={onPrivate}>
            <span className="ring purple">
              <img src="/art/icons/friends-table.webp" alt="" />
            </span>
            <span className="pill purple">PLAY WITH FRIENDS</span>
            <small className="under">Make a table and share the code</small>
          </button>
        </div>
      </main>

      <nav className="bottombar">
        <button onClick={() => setModal({ kind: 'leaders' })}>
          <img src="/art/icons/podium.webp" alt="" />
          MY STATS
        </button>
        <button onClick={() => setModal({ kind: 'trophies' })}>
          <img src="/art/icons/trophy.webp" alt="" />
          TROPHIES
        </button>
        <button onClick={onPractice}>
          <img src="/art/icons/crown.webp" alt="" />
          PRACTICE
        </button>
        <button onClick={() => setModal({ kind: 'help' })}>
          <img src="/art/icons/chat.webp" alt="" />
          RULES
        </button>
      </nav>
    </div>
  );
}

// ---------------- Online lobby ----------------
const TYPES = [
  { id: 'standard', label: 'STANDARD · 8 HANDS' },
  { id: 'quick', label: 'QUICK · 5 HANDS' },
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
          <h4>GAME LENGTH</h4>
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
          <h4>ENTRY COINS</h4>
          <Stepper value={ENTRY_FILTER[ef] === 'ANY' ? 'ANY' : fmt(ENTRY_FILTER[ef])} onMinus={() => setEf((ef + ENTRY_FILTER.length - 1) % ENTRY_FILTER.length)} onPlus={() => setEf((ef + 1) % ENTRY_FILTER.length)} />
        </div>
        <div className="spacer" />
        <CoinPill coins={wallet.coins} />
      </header>

      <main className="lobby-main">
        <div className="create-col">
          <img src="/art/icons/create-table.webp" alt="" className="float" />
          <button className="pill gold" onClick={() => setModal({ kind: 'create', isPrivate: false })}>
            CREATE TABLE
          </button>
          <small className="under">Start your own table. Others can join it here.</small>
        </div>
        <div className="table-list">
          {tables === null ? (
            <div className="empty-card">
              <p>Loading tables…</p>
            </div>
          ) : shown.length === 0 ? (
            <div className="empty-card">
              <img src="/art/icons/friends-table.webp" alt="" />
              <div>
                <h3>NO OPEN TABLES RIGHT NOW</h3>
                <p>Tables with real players show up here as soon as someone sits down. Create one and others can join you, or press Play Now on the menu. Empty seats are filled by computer players.</p>
                <button className="pill gold" onClick={() => setModal({ kind: 'create', isPrivate: false })}>
                  CREATE A TABLE
                </button>
              </div>
            </div>
          ) : (
            shown.map((t) => (
              <div className="table-row" key={t.id} style={{ '--city': `url(${cityArt(t.city)})` }}>
                <div>
                  <b className="city">{t.city}</b>
                  <small>
                    {t.length === 'quick' ? 'Quick · 5 hands a round' : 'Standard · 8 hands a round'} · {fmt(t.entry)} coins to join
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
const cityFor = (e) => (e >= 10000 ? 'London' : e >= 2500 ? 'Monte Carlo' : e >= 500 ? 'Las Vegas' : 'New York');

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
        <div className="city-banner" style={{ backgroundImage: `linear-gradient(180deg, rgba(10,6,40,.15), rgba(10,6,40,.75)), url(${cityArt(city)})` }}>
          <h5>{isPrivate ? 'TABLE FOR FRIENDS' : 'CREATE A TABLE'}</h5>
          <h2>{city}</h2>
        </div>
      }
    >
      <div className="bet-head">
        <span className="bet-pill">
          <img src="/art/icons/coins.webp" alt="" /> ENTRY {fmt(entry)}
        </span>
      </div>
      <p className="explain">Each player pays {fmt(entry)} coins to sit down. Bigger entries take you to a new city.</p>
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
        <img src="/art/icons/medal-gold.webp" alt="" /> 1st wins {fmt(prize1)} · <img src="/art/icons/medal-silver.webp" alt="" /> 2nd wins {fmt(prize2)}
      </div>

      <div className="opt-box">
        <h4>GAME LENGTH</h4>
        <div className="seg">
          <button className={length === 'quick' ? 'on' : ''} onClick={() => setLength('quick')}>
            QUICK <small>5 hands a round · about 5 min</small>
          </button>
          <button className={length === 'standard' ? 'on' : ''} onClick={() => setLength('standard')}>
            STANDARD <small>8 hands a round · about 10 min</small>
          </button>
        </div>
      </div>

      <h6 className="mini-title">TABLE COLOUR</h6>
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
                {locked && <em><img src="/art/icons/lock.webp" alt="Locked" /></em>}
              </span>
              <small>{locked ? `Level ${t.level}` : t.name}</small>
            </button>
          );
        })}
      </div>

      <button className="pill green big wide" disabled={wallet.coins < entry} onClick={() => onCreate({ isPrivate, length, entry, theme })}>
        {wallet.coins < entry ? 'NOT ENOUGH COINS' : isPrivate ? 'CREATE TABLE' : 'PLAY NOW'}
      </button>
    </Modal>
  );
}

// ---------------- Private game ----------------
export function PrivateGame({ onClose, onCreate, onJoin }) {
  const [code, setCode] = useState('');
  return (
    <Modal title="PLAY WITH FRIENDS" onClose={onClose}>
      <img src="/art/icons/friends.webp" alt="" className="modal-art" />
      <ol className="steps">
        <li>Create a table. You get a 5-letter code and an invite link.</li>
        <li>Send the code or link to your friends.</li>
        <li>Press Start when everyone is in. Computer players fill any empty seats.</li>
      </ol>
      <button className="pill gold big wide" onClick={onCreate}>
        CREATE A TABLE
      </button>
      <div className="or">Got a code from a friend?</div>
      <div className="join-row">
        <input className="field code" maxLength={5} placeholder="CODE" aria-label="Table code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && code.length === 5 && onJoin(code)} />
        <button className="pill green" disabled={code.length < 5} onClick={() => onJoin(code)}>
          JOIN
        </button>
      </div>
    </Modal>
  );
}

// ---------------- Quick tour (first visit, and "How to play") ----------------
const TOUR = [
  {
    art: '/art/icons/chips.webp',
    title: 'Everyone gets 1,000 chips',
    text: 'Six players sit at one table and play the same dealer. You are not just trying to beat the dealer: you want more chips than the other players.',
  },
  {
    art: '/art/icons/crowned-card.webp',
    title: 'Get closer to 21 than the dealer',
    text: 'Number cards count as their number, J Q K count 10, and an Ace counts 1 or 11. Go over 21 and you lose the hand.',
    moves: [
      ['HIT', 'green', 'Take another card'],
      ['STAND', 'red', 'Keep what you have'],
      ['DOUBLE', 'gold', 'Double your bet, get 1 card'],
      ['SPLIT', 'blue', 'Turn a pair into 2 hands'],
    ],
  },
  {
    art: '/art/icons/shield.webp',
    title: 'Lowest stack is out',
    text: 'There are 3 rounds. After rounds 1 and 2, the player with the fewest chips leaves the table. The bar at the top counts the hands left, and the player in danger glows red.',
  },
  {
    art: '/art/icons/trophy.webp',
    title: 'Most chips wins',
    text: 'After round 3, the biggest stack wins. 1st and 2nd place win coins. Want to learn first? Practice is free and shows you the best move every time.',
  },
];

export function Tour({ onClose, onPractice }) {
  const [i, setI] = useState(0);
  const step = TOUR[i];
  const last = i === TOUR.length - 1;
  return (
    <Modal title="HOW TO PLAY" onClose={onClose}>
      <div className="tour">
        <img src={step.art} alt="" className="modal-art" />
        <small className="tour-count">
          STEP {i + 1} OF {TOUR.length}
        </small>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        {step.moves && (
          <div className="moves">
            {step.moves.map(([m, c, d]) => (
              <div key={m}>
                <span className={`pill sm ${c}`}>{m}</span>
                <small>{d}</small>
              </div>
            ))}
          </div>
        )}
        <div className="dots" aria-hidden="true">
          {TOUR.map((_, n) => (
            <i key={n} className={n === i ? 'on' : ''} />
          ))}
        </div>
        <div className="row-btns">
          {i > 0 && (
            <button className="pill blue" onClick={() => setI(i - 1)}>
              BACK
            </button>
          )}
          {!last && (
            <button className="pill green" onClick={() => setI(i + 1)}>
              NEXT
            </button>
          )}
          {last && onPractice && (
            <button className="pill purple" onClick={onPractice}>
              TRY PRACTICE
            </button>
          )}
          {last && (
            <button className="pill green" onClick={onClose}>
              GOT IT
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Help (full rules) ----------------
export function Help({ onClose, onTour }) {
  return (
    <Modal title="RULES" onClose={onClose} wide>
      <div className="help">
        {onTour && (
          <button className="pill gold sm" onClick={onTour}>
            SHOW THE 1-MINUTE GUIDE
          </button>
        )}
        <h4>The goal</h4>
        <p>Have the most chips at the end. Everyone starts with 1,000 tournament chips and plays the same dealer.</p>
        <h4>Each hand</h4>
        <ul>
          <li>Choose your bet, then press Place Bet.</li>
          <li>Get closer to 21 than the dealer without going over. Ace = 1 or 11, J Q K = 10.</li>
          <li>Hit = take a card. Stand = stop. Double = double your bet and take exactly 1 card. Split = turn a pair into 2 hands.</li>
          <li>Win and you get your bet back plus the same again. Blackjack (an Ace and a 10-card) pays 1½ times your bet.</li>
        </ul>
        <h4>Rounds and the cut</h4>
        <ul>
          <li>3 rounds of 8 hands (Quick: 5 hands). Bets go up each round: 10–100, then 25–250, then 50–500.</li>
          <li>After rounds 1 and 2, the player with the fewest chips is out. The top bar shows how many hands are left.</li>
          <li>After round 3, the biggest stack wins. 1st and 2nd win coins.</li>
        </ul>
        <h4>Secret Bet</h4>
        <p>On the last hand of each round you can hide your bet, so nobody can copy you.</p>
        <h4>Time limit</h4>
        <p>You have 15 seconds for each choice. If time runs out, the game picks the best move for you and keeps your seat.</p>
        <h4>Table details</h4>
        <p className="fine">6 decks, reshuffled at 75%. Dealer stands on all 17s and checks for blackjack. Split once; split Aces get one card each.</p>
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
    <Modal title="MY STATS" onClose={onClose}>
      <img src="/art/icons/podium.webp" alt="" className="modal-art" />
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
          <small>Best-move score</small>
        </div>
      </div>
      <p className="fine center">{profile.name}'s results on this device. Weekly leagues with other players are coming next.</p>
    </Modal>
  );
}

export function Trophies({ wallet, onClose }) {
  return (
    <Modal title="TROPHY ROOM" onClose={onClose}>
      <img src="/art/icons/trophy-laurel.webp" alt="" className="modal-art rounded" />
      {wallet.results.length === 0 ? (
        <p className="center">Finish a tournament to see your results here.</p>
      ) : (
        <ul className="results-list">
          {wallet.results.map((r, i) => (
            <li key={i}>
              <span className={`place p${r.place}`}>
                {r.place <= 3 && <img src={MEDALS[r.place]} alt="" />}
                {ordinal(r.place)}
              </span>
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

export const MEDALS = { 1: '/art/icons/medal-gold.webp', 2: '/art/icons/medal-silver.webp', 3: '/art/icons/medal-bronze.webp' };

export const ordinal = (n) => (n ? n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th') : '–');
