import express from 'express';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import { CONFIG, SLOTS, validInput } from '../shared/config.js';

export function createApp() {
  const app = express(), http = createServer(app), io = new Server(http, { maxHttpBufferSize: 8192 });
  const rooms = new Map();
  const root = fileURLToPath(new URL('../', import.meta.url));
  // A Vercel HTTP proxy can serve the pages while sockets connect directly to
  // the persistent HTTPS server (Vercel Functions cannot host WebSockets).
  app.get('/shared/connection-config.js', (_, res) => {
    res.set('Cache-Control', 'no-store').type('js').send(
      `globalThis.BRAWL_SOCKET_ORIGIN = ${JSON.stringify(process.env.PUBLIC_SOCKET_ORIGIN || '')};`
    );
  });
  app.get('/health', (_, res) => res.json({ ok: true, version: CONFIG.version }));
  app.get('/', (_, res) => res.sendFile(root + 'host/index.html'));
  app.get('/controller', (_, res) => res.sendFile(root + 'controller/index.html'));
  for (const dir of ['host', 'controller', 'shared']) app.use('/' + dir, express.static(root + dir));
  app.use('/vendor/three/addons', express.static(root + 'node_modules/three/examples/jsm'));
  app.use('/vendor/three', express.static(root + 'node_modules/three/build'));
  app.get('/qr', async (req, res) => {
    const value = typeof req.query.url === 'string' ? req.query.url : '';
    if (value.length > 512 || !/^https?:\/\//.test(value)) return res.sendStatus(400);
    res.type('svg').send(await QRCode.toString(value, { type: 'svg', margin: 1, width: 220 }));
  });
  function roster(room) {
    io.to(room.code).emit('room:roster', { slots: SLOTS.map(key => {
      const p = room.players.get(key);
      return { key, connected: !!p?.socketId, ready: !!p?.ready };
    }) });
  }
  function state(room, phase, winner = null) {
    room.phase = phase; io.to(room.code).emit('game:state', { phase, winner, debug: room.debug });
  }
  io.on('connection', socket => {
    socket.emit('server:hello', { version: CONFIG.version });
    const reply = (ack, value) => { if (typeof ack === 'function') ack(value); };
    socket.on('room:create', (_, ack) => {
      if (socket.data.room) return reply(ack, { error: 'Already in a room.' });
      let code;
      do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
      const room = { code, host: socket.id, players: new Map(), phase: 'lobby', debug: false };
      rooms.set(code, room); socket.data.room = code; socket.data.host = true; socket.join(code);
      reply(ack, { roomCode: code }); roster(room);
    });
    socket.on('room:join', (payload, ack) => {
      if (socket.data.room) return reply(ack, { error: 'Already assigned. Reload to reconnect.' });
      const room = rooms.get(String(payload?.roomCode || '').toUpperCase());
      if (!room) return reply(ack, { error: 'Room not found. Check the code or ask the host.' });
      const now = Date.now();
      for (const [key, p] of room.players) if (!p.socketId && now - p.leftAt > CONFIG.reconnectMs) room.players.delete(key);
      let entry = [...room.players].find(([, p]) => p.token === payload?.clientToken);
      if (entry?.[1].socketId) return reply(ack, { error: 'This controller is already connected.' });
      if (!entry) {
        const key = SLOTS.find(k => !room.players.has(k));
        if (!key) return reply(ack, { error: 'All four roles are occupied or reserved for reconnect.' });
        entry = [key, { token: randomBytes(24).toString('hex') }]; room.players.set(...entry);
      }
      const [key, p] = entry;
      Object.assign(p, { socketId: socket.id, ready: false, seq: -1 });
      socket.data.room = room.code; socket.data.key = key; socket.join(room.code);
      const [team, role] = key.split(':');
      const assignment = { team, role, clientToken: p.token, roomCode: room.code };
      reply(ack, assignment); socket.emit('player:assign', assignment);
      socket.emit('game:state', { phase: room.phase, debug: room.debug }); roster(room);
    });
    socket.on('player:ready', ready => {
      const room = rooms.get(socket.data.room), p = room?.players.get(socket.data.key);
      if (p?.socketId === socket.id) { p.ready = ready === true; roster(room); if (!p.ready && room.phase === 'playing' && !room.debug) state(room, 'lobby'); }
    });
    for (const role of ['legs', 'arm']) socket.on('input:' + role, p => {
      const room = rooms.get(socket.data.room), player = room?.players.get(socket.data.key);
      if (!player || player.socketId !== socket.id || !socket.data.key.endsWith(':' + role) || !validInput(role, p) || p.seq <= player.seq) return;
      player.seq = p.seq;
      io.to(room.host).emit('input:' + role, { ...p, key: socket.data.key });
    });
    socket.on('game:start', (payload, ack) => {
      const room = rooms.get(socket.data.room);
      if (room?.host !== socket.id) return;
      const debug = payload?.debug === true;
      if (!debug && !SLOTS.every(k => { const p = room.players.get(k); return p?.socketId && p.ready; })) return reply(ack, { error: 'Four connected, calibrated phones are required.' });
      room.debug = debug; state(room, 'playing'); reply(ack, { ok: true });
    });
    socket.on('game:state', p => {
      const room = rooms.get(socket.data.room);
      if (room?.host !== socket.id || !['lobby', 'results'].includes(p?.phase)) return;
      if (p.phase === 'results' && (room.phase !== 'playing' || !['red', 'blue', 'draw'].includes(p.winner))) return;
      state(room, p.phase, p.winner);
    });
    socket.on('player:hit', p => {
      const room = rooms.get(socket.data.room);
      if (room?.host === socket.id && ['red', 'blue'].includes(p?.team)) for (const [key, player] of room.players) if (key.startsWith(p.team + ':') && player.socketId) io.to(player.socketId).emit('player:hit', { strength: 1 });
    });
    socket.on('disconnect', () => {
      const room = rooms.get(socket.data.room);
      if (!room) return;
      if (room.host === socket.id) {
        io.to(room.code).emit('room:closed');
        for (const client of io.sockets.sockets.values()) if (client.data.room === room.code) { client.leave(room.code); client.data = {}; }
        rooms.delete(room.code); return;
      }
      const p = room.players.get(socket.data.key);
      if (p?.socketId === socket.id) { Object.assign(p, { socketId: null, ready: false, leftAt: Date.now() }); if (room.phase === 'playing' && !room.debug) state(room, 'lobby'); roster(room); }
    });
  });
  return { app, http, io, rooms };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { http } = createApp();
  http.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => console.log('Two-Body Brawl: http://localhost:' + (process.env.PORT || 3000)));
}
