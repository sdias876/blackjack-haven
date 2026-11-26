# ♠ Blackjack Haven

Free Blackjack tournaments in the Spade Haven style. Six players start with 1,000 chips, play the same dealer, and the lowest stack is cut after each round. **Free to play:** coins are play money with no cash value and can never be bought or cashed out.

This is the first playable version (roadmap Phases 0–1): the full rules engine, Sit-and-Go tournaments against bots or friends, practice tables with the Smart Coach, and the Spade Haven look on desktop and phones.

## What works

- **Spade Haven art:** the Canva pictures from Spade Haven: 49 player portraits (players pick one, bots get one), city scenes for each table, and the game icons (`client/public/art/`).
- **Easy to learn:** a 4-step guide on the first visit (also behind every **?** button), plain-language labels, a "Your turn" prompt showing your total and the dealer's card, and a short hint on every move button.
- **Play Now:** joins the next public Sit-and-Go (100 coins entry). Empty seats fill with bots after 20 seconds, or press **Start now**.
- **Online Lobby:** open tables by type (Sit-and-Go or Quick) and entry, with **Create table**: entry slider (the city picture changes with the entry: New York, Las Vegas, Monte Carlo, London), game length, and table themes (Sunset, Neon Night and Royal Gold unlock with levels).
- **Private Game:** create a table with a 5-letter code and an invite link (`/?join=CODE`), or join with a code.
- **Practice:** free table against 5 bots with the **Smart Coach** (highlights the basic-strategy move and explains why).
- **Tournament rules:** 3 rounds (Standard 8 hands, Quick 5 hands); bets 10–100, 25–250, 50–500; lowest stack eliminated after rounds 1 and 2; biggest stack wins after round 3. 1st and 2nd split 90% of the entries 2:1. **Secret Bet** once per round on the cut hand and the final hand.
- **Blackjack rules:** 6 decks, reshuffle at 75%, dealer stands on all 17s, blackjack pays 3:2, dealer peeks for blackjack, double on any two cards, split once (split aces get one card).
- **Fair play:** the server deals from a `crypto.randomInt` Fisher–Yates shoe and logs a SHA-256 hash of each shoe; clients only send intents and never see the hole card or the shoe. 15-second turn timer; on timeout or disconnect the server plays basic strategy for you and keeps your seat.
- **Bots:** basic strategy with small personality-based mistakes (Cautious, Steady, Gambler) and tournament-aware betting: protect a lead, chase when about to be cut, Secret Bet when leading.
- **After the game:** finishing place, prize, and how many of your decisions matched basic strategy, with your costliest misses.
- **Free coins:** 50,000 to start, +100 free coins every hour. Coins, level and results are stored on the device (`localStorage`).

## Run it

```bash
npm install
npm run dev        # server on :3001, client on http://localhost:5173
npm test           # rules engine, 40 simulated tournaments, Socket.io end-to-end
npm run build && npm start   # production: one process on $PORT (default 3001)
```

`TIMING_SCALE=0.2 npm start` speeds every timer up 5×, which is handy for testing a whole tournament.

## Deploy

`render.yaml` is a Render Blueprint: one web service builds the client and runs the server (`/healthz` health check). Use a paid instance: free instances sleep and drop live tables.

## Layout

```
server/src/engine/   cards.js (shoe), hand.js (values, payouts), strategy.js (basic strategy, coach),
                     bots.js (bot play and betting), table.js (Sit-and-Go state machine)
server/src/          index.js (Express + Socket.io), rooms.js (tables, codes, lobby list)
server/test/         node:test suites
client/src/          App.jsx (socket, wallet, routing), screens.jsx (welcome, menu, lobby, create table,
                     private game, help, leaders, trophies), TableView.jsx (the table), styles.css
client/public/art/   Spade Haven Canva art: avatars/ (49 portraits), cities/, bg/, icons/
```

## Next (from the roadmap)

Scheduled multi-table tournaments with table balancing, Google Play Games and email sign-in with server-side coins, the Mega Bonus wheel and daily gifts, weekly leagues and missions, skill-based matchmaking and the integrity worker, the 60-second interactive tutorial, sound, and chat/emotes.
