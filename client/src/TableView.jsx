import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Card, CoinPill, Modal, fmt, themeOf } from './ui.jsx';
import { ordinal } from './screens.jsx';

const RESULT_LABEL = { win: 'WIN', blackjack: 'BLACKJACK', push: 'PUSH', lose: 'LOSE', bust: 'BUST' };

function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export default function TableView({ view, receivedAt, emit, onLeave, onHelp, say, wallet, join }) {
  const now = useNow();
  const v = view;
  const me = v.me;
  const mine = me >= 0 ? v.seats[me] : null;
  const msLeft = v.msLeft == null ? null : Math.max(0, v.msLeft - (now - receivedAt));
  const secs = msLeft == null ? null : Math.ceil(msLeft / 1000);
  const theme = themeOf(v.theme);
  const [bet, setBet] = useState(v.limits.min);
  const [secret, setSecret] = useState(false);
  const [menu, setMenu] = useState(false);
  const [hideResult, setHideResult] = useState(false);

  // Reset the bet tray each new betting phase.
  useEffect(() => {
    if (v.phase === 'betting') {
      setBet((b) => Math.min(Math.max(b, v.limits.min), Math.min(v.limits.max, mine?.chips ?? v.limits.max)));
      setSecret(false);
    }
  }, [v.phase, v.limits.min, v.limits.max, mine?.chips]);

  const active = v.seats.filter((s) => s && !s.eliminated);
  const ranked = useMemo(
    () => v.seats.map((s, i) => ({ ...s, i })).filter((s) => s.name).sort((a, b) => (a.eliminated - b.eliminated) || (a.eliminated ? a.place - b.place : b.chips - a.chips)),
    [v.seats],
  );
  const cutSeat = v.handsToCut != null && active.length > 2 && v.phase !== 'waiting' ? ranked.filter((s) => !s.eliminated).at(-1)?.i : -1;
  const myRank = mine ? ranked.findIndex((s) => s.i === me) + 1 : null;

  const send = async (ev, data) => {
    const r = await emit(ev, data);
    if (!r.ok && r.error) say(r.error);
  };
  const cap = Math.min(v.limits.max, mine?.chips ?? 0);
  const clampBet = (x) => Math.max(v.limits.min, Math.min(cap, Math.round(x)));

  const showResult = v.myResult && (v.phase === 'finished' || mine?.eliminated) && !hideResult;
  const waitingHumans = v.seats.filter((s) => s && !s.bot).length;

  return (
    <div className="screen table-screen" style={{ '--felt-a': theme.a, '--felt-b': theme.b }}>
      <div className="city-night" aria-hidden="true" />
      <header className="table-top">
        <CoinPill coins={wallet.coins} />
        <div className="hud">
          <b>{v.practice ? 'PRACTICE' : v.city.toUpperCase()}</b>
          <span>
            ROUND {v.round}/{v.rounds} · HAND {v.hand}/{v.handsPerRound}
          </span>
          {v.handsToCut != null && v.phase !== 'waiting' && v.phase !== 'finished' && (
            <span className={`cut ${v.isCutHand ? 'hot' : ''}`}>{v.isCutHand ? 'ELIMINATION HAND' : `${v.handsToCut} HANDS TO CUT`}</span>
          )}
          {v.isFinalHand && <span className="cut hot">FINAL HAND</span>}
          {myRank && v.phase !== 'waiting' && <span className="rank">{ordinal(myRank)} OF 6</span>}
        </div>
        <div className="spacer" />
        <button className="round-blue" onClick={onHelp} aria-label="How to play">
          ?
        </button>
        <div className="menu-wrap">
          <button className="round-blue" onClick={() => setMenu(!menu)} aria-label="Menu">
            ☰
          </button>
          {menu && (
            <div className="dropdown">
              <button onClick={onLeave}>{v.phase === 'waiting' ? 'Leave table (refund)' : 'Leave table'}</button>
              <button onClick={() => setMenu(false)}>Close</button>
            </div>
          )}
        </div>
      </header>

      <div className="table-wrap">
        <div className="table-felt">
          {/* Dealer */}
          <div className="dealer">
            <span className="dealer-label">DEALER</span>
            <div className="cards">
              {v.dealer.cards.map((c, i) => (
                <Card key={i} card={c} />
              ))}
            </div>
            {v.dealer.cards.length > 0 && <span className="total-pill">{v.dealer.total > 21 ? 'BUST' : v.dealer.total}</span>}
          </div>

          {/* Info + standings cards (wide screens) */}
          <div className="info-card">
            <h3>{v.practice ? 'PRACTICE' : v.city.toUpperCase()}</h3>
            {!v.practice && (
              <div className="row">
                <span>PRIZE:</span>
                <img src="/ui/coins.webp" alt="" />
                <b>{fmt(v.prizes.first)}</b>
              </div>
            )}
            <div className="row">
              <span>BETS:</span>
              <b>
                {v.limits.min}–{v.limits.max}
              </b>
            </div>
            <div className={`row small ${v.isCutHand ? 'hot' : ''}`}>
              {v.phase === 'waiting' ? `${v.handsPerRound} HANDS A ROUND` : v.handsToCut != null ? (v.isCutHand ? 'ELIMINATION HAND' : `${v.handsToCut} HANDS TO CUT`) : 'FINAL ROUND'}
            </div>
            {v.canSecret && <div className="secret-badge">SECRET BET AVAILABLE</div>}
          </div>

          <div className="standings">
            <h3>SIT-AND-GO ♠</h3>
            <ol>
              {ranked.map((s, n) => (
                <li key={s.i} className={`${s.i === me ? 'me' : ''} ${s.eliminated ? 'out' : ''} ${s.i === cutSeat ? 'cut' : ''}`}>
                  <span>{s.eliminated ? ordinal(s.place) : n + 1}</span>
                  <b>{s.name}</b>
                  <em>{s.eliminated ? 'OUT' : fmt(s.chips)}</em>
                </li>
              ))}
            </ol>
          </div>

          {/* Center messages */}
          <div className="center-msg">
            {v.phase === 'waiting' && (
              <>
                <h2>WAITING FOR PLAYERS...</h2>
                {v.code && v.isPrivate && (
                  <div className="invite">
                    TABLE CODE <b>{v.code}</b>
                    <button
                      className="pill gold sm"
                      onClick={() => {
                        const url = `${location.origin}/?join=${v.code}`;
                        (navigator.share ? navigator.share({ title: 'Blackjack Haven', text: 'Join my table', url }) : navigator.clipboard.writeText(url)).then(() => say('Invite link ready to share'), () => {});
                      }}
                    >
                      INVITE
                    </button>
                  </div>
                )}
                <div className="wait-pill">
                  Waiting for {6 - waitingHumans} more · computer players join in {Math.ceil((v.fillMsLeft ?? 0) / 1000 - (now - receivedAt) / 1000) > 0 ? Math.ceil(v.fillMsLeft / 1000 - (now - receivedAt) / 1000) : 0}s
                  <button className="pill purple sm" onClick={() => send('startNow', {})}>
                    START NOW
                  </button>
                </div>
              </>
            )}
            {v.phase === 'betting' && (!mine || mine.hasBet || mine.eliminated) && <h2 className="soft">PLACE YOUR BETS · {secs}s</h2>}
            {v.phase === 'result' && mine && !mine.eliminated && mine.hands.length > 0 && (
              <div className="result-banner">
                {mine.hands.map((h, i) => (
                  <span key={i} className={`res ${h.result}`}>
                    {RESULT_LABEL[h.result]}
                    {h.payout - h.bet !== 0 && ` ${h.payout - h.bet > 0 ? '+' : '−'}${fmt(Math.abs(h.payout - h.bet))}`}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Seats */}
          {v.seats.map((s, i) => {
            const rel = me >= 0 ? (i - me + 6) % 6 : i;
            const isTurn = v.turn && v.turn.seat === i && v.phase === 'playing';
            const ring = s?.eliminated ? 'grey' : isTurn ? 'glow' : i === me ? 'gold' : i === cutSeat ? 'red' : 'silver';
            return (
              <div key={i} className={`seat pos-${rel} ${isTurn ? 'turn' : ''} ${s?.eliminated ? 'out' : ''}`}>
                <div className="hands">
                  {s?.hands?.map((h, hi) => (
                    <div key={hi} className={`hand ${isTurn && v.turn.hand === hi ? 'active' : ''}`}>
                      <div className="cards">
                        {h.cards.map((c, ci) => (
                          <Card key={ci} card={c} small={i !== me} />
                        ))}
                      </div>
                      <span className={`total-pill ${h.result ? 'res-' + h.result : ''}`}>
                        {h.result ? RESULT_LABEL[h.result] : `${h.soft && h.total < 21 ? 'soft ' : ''}${h.total}`}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="seat-core">
                  <div className="portrait" style={isTurn && msLeft != null ? { '--p': `${(msLeft / 15000) * 100}%` } : undefined}>
                    <Avatar name={s?.name} index={s?.avatar ?? i} size={i === me ? 72 : 58} ring={ring} bot={s?.bot} empty={!s} />
                    {s?.bot && <span className="tag">BOT</span>}
                    {s && !s.bot && !s.connected && <span className="tag away">AWAY</span>}
                  </div>
                  {s && (
                    <div className="chip-pill">
                      {s.eliminated ? ordinal(s.place) : fmt(s.chips)}
                      {s.hasBet && !s.eliminated && (v.phase === 'betting' || s.hands.length > 0) && (
                        <small>{s.bet == null ? 'SECRET' : `bet ${fmt(s.hands.reduce((a, h) => a + h.bet, 0) || s.bet)}`}</small>
                      )}
                    </div>
                  )}
                </div>
                {s && <div className="name-pill">{s.name}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        {v.coach && <div className="coach">💡 {v.coach.text}</div>}
        {v.phase === 'betting' && mine && !mine.eliminated && !mine.hasBet && (
          <div className="bet-tray">
            <div className="bet-line">
              <span className="bet-pill">
                <img src="/ui/coins.webp" alt="" /> BET {fmt(bet)}
              </span>
              <span className="timer">{secs}s</span>
            </div>
            <div className="slider-row">
              <button className="gold-round" onClick={() => setBet(clampBet(bet - v.limits.min))} aria-label="Lower bet">
                −
              </button>
              <input type="range" min={v.limits.min} max={cap} step={v.limits.min >= 25 ? 5 : 1} value={bet} onChange={(e) => setBet(clampBet(Number(e.target.value)))} aria-label="Bet" />
              <button className="gold-round" onClick={() => setBet(clampBet(bet + v.limits.min))} aria-label="Raise bet">
                +
              </button>
            </div>
            <div className="quick-bets">
              <button onClick={() => setBet(clampBet(v.limits.min))}>MIN</button>
              <button onClick={() => setBet(clampBet(v.limits.min * 2))}>2×</button>
              <button onClick={() => setBet(clampBet(mine.chips / 2))}>HALF STACK</button>
              <button onClick={() => setBet(clampBet(cap))}>ALL-IN</button>
              {v.canSecret && (
                <label className={`secret ${secret ? 'on' : ''}`}>
                  <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} /> SECRET BET
                </label>
              )}
            </div>
            <button className="pill gold big wide" onClick={() => send('bet', { amount: bet, secret })}>
              CONFIRM BET
            </button>
          </div>
        )}
        {v.legal && (
          <div className="action-bar">
            {[
              ['hit', 'HIT', 'green'],
              ['stand', 'STAND', 'red'],
              ['double', 'DOUBLE', 'gold'],
              ['split', 'SPLIT', 'blue'],
            ]
              .filter(([a]) => v.legal[a])
              .map(([a, label, color]) => (
                <button key={a} className={`pill ${color} act ${v.coach?.move === a ? 'coach-pick' : ''}`} onClick={() => send('action', { action: a })}>
                  {label}
                </button>
              ))}
            <span className="timer">{secs}s</span>
          </div>
        )}
        {v.log.length > 0 && <div className="log">{v.log.at(-1)}</div>}
      </div>

      {showResult && (
        <Modal title="RESULT" onClose={() => setHideResult(true)}>
          <img src={v.myResult.place === 1 ? '/ui/trophy.webp' : v.myResult.place <= 3 ? '/ui/podium.webp' : '/ui/coins.webp'} alt="" className="modal-art" />
          <h3 className="big-place">
            {ordinal(v.myResult.place)} OF 6{v.myResult.place === 1 ? ' — YOU WIN!' : ''}
          </h3>
          {!v.practice && <p className="center">{v.myResult.prize ? `+${fmt(v.myResult.prize)} coins` : `Entry ${fmt(v.entry)} coins`}</p>}
          {v.myResult.accuracy != null && (
            <div className="accuracy">
              <b>{v.myResult.accuracy}%</b> of your {v.myResult.decisions} decisions matched basic strategy.
              {v.myResult.misses.length > 0 && (
                <ul>
                  {v.myResult.misses.map((m, i) => (
                    <li key={i}>
                      {m.hand} ({m.total}) vs dealer {m.up}: you chose <b>{m.did}</b>, best was <b>{m.best}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="row-btns">
            <button className="pill green" onClick={() => (v.practice ? join('practice', { length: 'quick' }, 0) : join('quickJoin', { length: 'standard', entry: v.entry || 100 }, v.entry || 100))}>
              PLAY AGAIN
            </button>
            <button className="pill blue" onClick={onLeave}>
              LOBBY
            </button>
          </div>
          {v.phase !== 'finished' && <p className="fine center">You can keep watching the rest of the tournament.</p>}
        </Modal>
      )}
    </div>
  );
}
