// Blackjack Haven game server: Express serves the built client, Socket.io carries the game.
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rooms, CITIES } from './rooms.js';
import { LENGTHS } from './engine/table.js';

const PORT = Number(process.env.PORT) || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../../client/dist');

const app = express();
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.use(express.static(dist));
app.get('*', (_req, res, next) => res.sendFile(path.join(dist, 'index.html'), (err) => err && next()));

const http = createServer(app);
const io = new Server(http, { cors: { origin: true } });
const rooms = new Rooms();

/** playerId → { name, avatar, tableId, sockets:Set } */
const players = new Map();

const clean = (s, max = 16) => String(s ?? '').replace(/[^\p{L}\p{N} _.'-]/gu, '').trim().slice(0, max);
const roomName = (t) => `t:${t.id}`;

function broadcast(t) {
  const now = Date.now();
  for (const sock of io.sockets.adapter.rooms.get(roomName(t)) ?? []) {
    const s = io.sockets.sockets.get(sock);
    if (s?.data.playerId) s.emit('state', t.viewFor(s.data.playerId, now));
  }
}

function seat(socket, t, ack) {
  const p = players.get(socket.data.playerId);
  if (!p) return ack?.({ ok: false, error: 'Say hello first' });
  // Leave any other table first
  const old = rooms.get(p.tableId);
  if (old && old !== t) {
    old.removePlayer(socket.data.playerId);
    socket.leave(roomName(old));
    broadcast(old);
  }
  const idx = t.addPlayer({ playerId: socket.data.playerId, name: p.name, avatar: p.avatar });
  if (idx < 0) return ack?.({ ok: false, error: 'That table is full or already playing' });
  p.tableId = t.id;
  socket.join(roomName(t));
  ack?.({ ok: true, tableId: t.id, code: t.code, entry: t.entry });
  broadcast(t);
}

function currentTable(socket) {
  const p = players.get(socket.data.playerId);
  return p ? rooms.get(p.tableId) : null;
}

io.on('connection', (socket) => {
  socket.on('hello', ({ playerId, name, avatar } = {}, ack) => {
    const id = clean(playerId, 40);
    if (id.length < 8) return ack?.({ ok: false, error: 'Bad player id' });
    socket.data.playerId = id;
    const p = players.get(id) ?? { tableId: null, sockets: new Set() };
    p.name = clean(name) || 'Guest';
    p.avatar = Number.isInteger(avatar) && avatar >= 0 && avatar < 49 ? avatar : 0;
    p.sockets.add(socket.id);
    players.set(id, p);
    // Reconnect to a table in progress
    const t = rooms.get(p.tableId);
    if (t && t.seatOf(id) >= 0) {
      t.setConnected(id, true);
      socket.join(roomName(t));
      broadcast(t);
      return ack?.({ ok: true, tableId: t.id });
    }
    p.tableId = null;
    ack?.({ ok: true, tableId: null, cities: CITIES, lengths: Object.keys(LENGTHS) });
  });

  socket.on('listTables', (_q, ack) => ack?.({ ok: true, tables: rooms.publicList() }));

  socket.on('quickJoin', ({ length, entry } = {}, ack) => {
    const t = rooms.quickJoinTable({ length: LENGTHS[length] ? length : 'standard', entry: Math.max(0, Math.floor(entry ?? 100)) });
    seat(socket, t, ack);
  });

  socket.on('practice', ({ length } = {}, ack) => {
    seat(socket, rooms.create({ practice: true, isPrivate: true, length }), ack);
  });

  socket.on('createTable', ({ isPrivate, length, entry, theme } = {}, ack) => {
    const t = rooms.create({ isPrivate: Boolean(isPrivate), length, entry, theme: clean(theme, 20) || 'royal-purple' });
    seat(socket, t, ack);
  });

  socket.on('joinTable', ({ code } = {}, ack) => {
    const t = rooms.get(clean(code, 12));
    if (!t || t.phase === 'finished') return ack?.({ ok: false, error: 'No table with that code' });
    seat(socket, t, ack);
  });

  socket.on('startNow', (_q, ack) => {
    const t = currentTable(socket);
    if (!t) return ack?.({ ok: false });
    ack?.({ ok: t.startNow(socket.data.playerId) });
    broadcast(t);
  });

  socket.on('bet', ({ amount, secret } = {}, ack) => {
    const t = currentTable(socket);
    if (!t) return ack?.({ ok: false, error: 'No table' });
    const r = t.placeBet(t.seatOf(socket.data.playerId), amount, Boolean(secret));
    ack?.(r);
    if (r.ok) broadcast(t);
  });

  socket.on('action', ({ action } = {}, ack) => {
    const t = currentTable(socket);
    if (!t) return ack?.({ ok: false, error: 'No table' });
    const r = t.act(t.seatOf(socket.data.playerId), String(action));
    ack?.(r);
    if (r.ok) broadcast(t);
  });

  socket.on('leave', (_q, ack) => {
    const t = currentTable(socket);
    const p = players.get(socket.data.playerId);
    if (t) {
      t.removePlayer(socket.data.playerId);
      socket.leave(roomName(t));
      broadcast(t);
    }
    if (p) p.tableId = null;
    ack?.({ ok: true });
  });

  socket.on('disconnect', () => {
    const p = players.get(socket.data.playerId);
    if (!p) return;
    p.sockets.delete(socket.id);
    if (p.sockets.size === 0) {
      const t = rooms.get(p.tableId);
      if (t) {
        if (t.phase === 'waiting') t.removePlayer(socket.data.playerId);
        else t.setConnected(socket.data.playerId, false);
        broadcast(t);
      }
    }
  });
});

// The clock: bots, timers and the dealer move here.
setInterval(() => {
  const now = Date.now();
  for (const t of rooms.byId.values()) {
    if (t.tick(now)) broadcast(t);
    const connected = t.seats.some((s) => s && !s.bot && s.connected);
    if (connected) t.lastHumanAt = now;
    const idleFor = now - (t.lastHumanAt ?? t.createdAt);
    const empty = t.phase === 'waiting' && t.humans().length === 0 && now - t.createdAt > 5000;
    if (empty || (t.phase === 'finished' && now - t.finishedAt > 10 * 60_000) || idleFor > 10 * 60_000) rooms.remove(t);
  }
}, 200);

http.listen(PORT, () => console.log(`Blackjack Haven server on :${PORT}`));
