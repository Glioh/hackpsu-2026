import { randomBytes } from 'node:crypto';
import { CONFIG, validInput } from '../shared/config.js';
import { CALIBRATION, validCalibration } from '../shared/calibration.js';
import { CHARACTERS, makeMatch, shuffled, voteLeaders, makeRoll, SELECTION_MS } from '../shared/party.js';
import { MAPS } from '../shared/maps.js';

export function installParty(io, rooms, { controllerTimeoutMs = 2500, watchdogIntervalMs = 500, selectionMs = SELECTION_MS, rollScale = 1 } = {}) {
  const timers = new Map();
  const schedule = (room, callback, ms) => {
    const timer = setTimeout(() => { timers.get(room.code)?.delete(timer); if (rooms.has(room.code)) callback(); }, ms);
    timer.unref();
    if (!timers.has(room.code)) timers.set(room.code, new Set());
    timers.get(room.code).add(timer);
  };
  const clearTimers = room => { for (const timer of timers.get(room.code) || []) clearTimeout(timer); timers.delete(room.code); };
  const allReady = room => room.match?.fighters.every(f => f.players.every(id => {
    const p = room.players.get(id); return p?.socketId && p.ready;
  }));
  function publicState(room) {
    return { phase: room.phase, winner: room.winner, debug: room.debug, interruption: room.interruption,
      match: room.match, selection: room.selection, serverTime: Date.now() };
  }
  function broadcast(room, resumed = false) { io.to(room.code).emit('game:state', { ...publicState(room), resumed }); }
  function roster(room) {
    io.to(room.code).emit('room:roster', { slots: [...room.players].map(([id, p]) => ({
      id, key: p.fighterId ? `${p.fighterId}:${p.role}` : id, name: p.name, team: p.side, role: p.role,
      fighterId: p.fighterId, occupied: true, connected: !!p.socketId, ready: !!p.ready,
      status: p.status, message: CALIBRATION[p.status],
    })) });
  }
  function assignment(room, p) {
    return { playerId: p.id, name: p.name, team: p.side ?? null, role: p.role ?? null,
      fighterLabel: room.match?.fighters.find(f => f.id === p.fighterId)?.label,
      fighterId: p.fighterId ?? null, key: p.fighterId ? `${p.fighterId}:${p.role}` : p.id,
      partner: room.match?.fighters.find(f => f.id === p.fighterId)?.players.filter(id => id !== p.id).map(id => room.players.get(id)?.name).join(', '),
      clientToken: p.token, roomCode: room.code };
  }
  function assign(room, p) { if (p.socketId) io.to(p.socketId).emit('player:assign', assignment(room, p)); }
  function phase(room, value, interruption = null, resumed = false) {
    room.phase = value; room.interruption = interruption; broadcast(room, resumed);
  }
  function calibrate(room, p, status) {
    p.status = status; p.ready = status === 'calibrated'; p.lastSeen = Date.now(); roster(room);
    if (!p.ready && room.phase === 'playing' && !room.debug) phase(room, 'paused', { key: `${p.name} / ${p.role}`, status, message: CALIBRATION[status] });
    else if (room.phase === 'paused' && room.interruption?.status !== 'host-paused' && allReady(room)) phase(room, 'playing', null, true);
    else if (room.phase === 'calibrating' && allReady(room)) phase(room, 'playing');
  }
  function beginMaps(room) {
    room.selection = { options: shuffled(MAPS).slice(0, 6).map(m => m.id), votes: {}, deadline: Date.now() + selectionMs, roll: null };
    phase(room, 'map-vote'); schedule(room, () => finishMaps(room), selectionMs);
  }
  function finishCharacters(room) {
    if (room.phase !== 'character-select') return;
    clearTimers(room);
    let duration = 0;
    for (const fighter of room.match.fighters) {
      const votes = fighter.players.map(id => room.selection.votes[id]).filter(Boolean);
      const options = [...new Set(votes.length ? votes : CHARACTERS.map(c => c.id))];
      const roll = makeRoll(options, { unanimous: votes.length === 2 && options.length === 1 });
      roll.duration *= rollScale; roll.frames = roll.frames.map(f => ({ ...f, at: f.at * rollScale }));
      fighter.character = roll.winner; room.selection.rolls[fighter.id] = roll;
      duration = Math.max(duration, roll.duration);
    }
    phase(room, 'character-roll'); schedule(room, () => beginMaps(room), duration);
  }
  function finishMaps(room) {
    if (room.phase !== 'map-vote') return;
    clearTimers(room);
    const options = voteLeaders(room.selection.votes, room.selection.options);
    const roll = makeRoll(options); roll.duration *= rollScale; roll.frames = roll.frames.map(f => ({ ...f, at: f.at * rollScale }));
    room.selection.roll = roll; room.match.mapId = roll.winner;
    phase(room, 'map-roll'); schedule(room, () => {
      room.selection = null; phase(room, allReady(room) ? 'playing' : 'calibrating');
    }, roll.duration);
  }
  function returnLobby(room) {
    clearTimers(room); room.match = null; room.selection = null; room.debug = false; room.winner = null;
    for (const [id, p] of room.players) {
      if (!p.socketId) { room.players.delete(id); continue; }
      p.side = p.role = p.fighterId = null; assign(room, p);
    }
    phase(room, 'lobby'); roster(room);
  }
  const watchdog = setInterval(() => {
    for (const room of rooms.values()) for (const p of room.players.values()) {
      if (p.ready && Date.now() - p.lastSeen > controllerTimeoutMs) calibrate(room, p, 'sensor-stale');
      if (room.phase === 'lobby' && !p.socketId && Date.now() - p.leftAt > CONFIG.reconnectMs) { room.players.delete(p.id); roster(room); }
    }
  }, watchdogIntervalMs);
  watchdog.unref();
  io.on('close', () => { clearInterval(watchdog); for (const room of rooms.values()) clearTimers(room); });
  io.on('connection', socket => {
    socket.emit('server:hello', { version: CONFIG.version });
    const reply = (ack, value) => { if (typeof ack === 'function') ack(value); };
    const roomFor = () => rooms.get(socket.data.room);
    const playerFor = room => { const p = room?.players.get(socket.data.playerId); return p?.socketId === socket.id ? p : null; };
    socket.on('room:create', (_, ack) => {
      if (socket.data.room) return reply(ack, { error: 'Already in a room.' });
      let code; do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
      const room = { code, host: socket.id, players: new Map(), revokedTokens: new Set(), phase: 'lobby', debug: false, match: null, selection: null };
      rooms.set(code, room); socket.data.room = code; socket.data.host = true; socket.join(code);
      reply(ack, { roomCode: code }); roster(room); broadcast(room);
    });
    socket.on('room:join', (payload, ack) => {
      if (socket.data.room) return reply(ack, { error: 'Already in a room.' });
      const room = rooms.get(String(payload?.roomCode || '').toUpperCase());
      if (!room) return reply(ack, { error: 'Room not found. Check the code or ask the host.' });
      if (room.revokedTokens.has(payload?.clientToken)) return reply(ack, { error: 'The host removed this controller. Ask the host before joining again.' });
      let p = [...room.players.values()].find(p => p.token === payload?.clientToken);
      if (p?.socketId) return reply(ack, { error: "You're already in this room on another tab or device. Return to that screen to continue." });
      if (!p) {
        if (room.phase !== 'lobby') return reply(ack, { error: 'Match already started. Join the next lobby.' });
        const id = randomBytes(8).toString('hex');
        const name = String(payload?.name || `Player ${room.players.size + 1}`).trim().replace(/[\u0000-\u001f]/g, '').slice(0, 20) || 'Player';
        p = { id, name, token: randomBytes(24).toString('hex') }; room.players.set(id, p);
      }
      Object.assign(p, { socketId: socket.id, ready: false, status: 'calibration-required', lastSeen: Date.now(), seq: -1 });
      socket.data.room = room.code; socket.data.playerId = p.id; socket.data.key = p.fighterId ? `${p.fighterId}:${p.role}` : p.id; socket.join(room.code);
      reply(ack, assignment(room, p)); assign(room, p); socket.emit('game:state', publicState(room)); roster(room);
    });
    socket.on('player:kick', (payload, ack) => {
      const room = roomFor();
      if (room?.host !== socket.id) return reply(ack, { error: 'Only the host can remove players.' });
      const p = [...room.players.values()].find(p => p.id === payload?.key || `${p.fighterId}:${p.role}` === payload?.key);
      if (!p) return reply(ack, { error: 'That player has already left.' });
      const client = io.sockets.sockets.get(p.socketId);
      room.revokedTokens.add(p.token); room.players.delete(p.id);
      if (client) { client.leave(room.code); client.data = {}; client.emit('player:kicked'); }
      if (room.phase !== 'lobby') returnLobby(room); else roster(room);
      reply(ack, { ok: true });
    });
    socket.on('player:ready', ready => { const room = roomFor(), p = playerFor(room); if (p) calibrate(room, p, ready === true ? 'calibrated' : 'calibration-required'); });
    socket.on('player:calibration', payload => { const room = roomFor(), p = playerFor(room); if (p && validCalibration(payload?.status)) calibrate(room, p, payload.status); });
    socket.on('player:heartbeat', () => { const p = playerFor(roomFor()); if (p) p.lastSeen = Date.now(); });
    for (const role of ['legs', 'arm']) socket.on('input:' + role, data => {
      const room = roomFor(), p = playerFor(room);
      if (!p || p.role !== role || !validInput(role, data) || data.seq <= p.seq) return;
      p.seq = data.seq; p.lastSeen = Date.now();
      io.to(room.host).emit('input:' + role, { ...data, key: `${p.fighterId}:${role}` });
    });
    socket.on('character:vote', (payload, ack) => {
      const room = roomFor(), p = playerFor(room);
      if (!p || room.phase !== 'character-select' || !CHARACTERS.some(c => c.id === payload?.id)) return reply(ack, { error: 'Character voting is closed or pick is invalid.' });
      room.selection.votes[p.id] = payload.id; broadcast(room); reply(ack, { ok: true });
      if ([...room.players.keys()].every(id => room.selection.votes[id])) finishCharacters(room);
    });
    socket.on('map:vote', (payload, ack) => {
      const room = roomFor(), p = playerFor(room);
      if (!p || room.phase !== 'map-vote' || !room.selection.options.includes(payload?.id)) return reply(ack, { error: 'Map voting is closed or pick is invalid.' });
      room.selection.votes[p.id] = payload.id; broadcast(room); reply(ack, { ok: true });
      if ([...room.players.keys()].every(id => room.selection.votes[id])) finishMaps(room);
    });
    socket.on('game:start', (payload, ack) => {
      const room = roomFor();
      if (room?.host !== socket.id) return reply(ack, { error: 'Only the host can start.' });
      if (!['lobby', 'results'].includes(room.phase)) return reply(ack, { error: 'Return to the lobby before starting again.' });
      if (room.phase === 'results' && room.match && payload?.debug !== true) {
        clearTimers(room); room.winner = null;
        const ready = allReady(room);
        phase(room, 'playing');
        if (!ready) phase(room, 'paused', { status: 'calibration-required', message: 'Reconnect and recalibrate every phone to continue.' });
        return reply(ack, { ok: true });
      }
      if (payload?.debug === true) {
        clearTimers(room); room.debug = true; room.match = null; room.selection = null; room.winner = null;
        phase(room, 'playing'); return reply(ack, { ok: true });
      }
      const players = [...room.players.values()].filter(p => p.socketId);
      if (players.length < 4 || players.length % 2) return reply(ack, { error: 'Need an even number of connected players, at least 4.' });
      clearTimers(room); for (const [id, p] of room.players) if (!p.socketId) room.players.delete(id);
      room.match = makeMatch(players.map(p => p.id)); room.debug = false; room.winner = null;
      for (const f of room.match.fighters) f.players.forEach((id, i) => {
        const p = room.players.get(id); p.fighterId = f.id; p.side = f.side; p.role = i ? 'arm' : 'legs'; p.seq = -1;
        const client = io.sockets.sockets.get(p.socketId); if (client) client.data.key = `${f.id}:${p.role}`;
        assign(room, p);
      });
      room.selection = { votes: {}, rolls: {}, deadline: Date.now() + selectionMs };
      phase(room, 'character-select'); roster(room); schedule(room, () => finishCharacters(room), selectionMs);
      reply(ack, { ok: true });
    });
    socket.on('game:pause', (_, ack) => {
      const room = roomFor();
      if (room?.host !== socket.id || !['playing', 'paused'].includes(room.phase)) return reply(ack, { error: 'No active host match.' });
      phase(room, 'paused', { status: 'host-paused', message: 'The host paused the match.' }); reply(ack, { ok: true });
    });
    socket.on('game:resume', (_, ack) => {
      const room = roomFor();
      if (room?.host !== socket.id || room.phase !== 'paused') return reply(ack, { error: 'Only the host can resume a paused match.' });
      if (!room.debug && !allReady(room)) return reply(ack, { error: 'Recalibrate every phone before resuming.' });
      phase(room, 'playing', null, true); reply(ack, { ok: true });
    });
    socket.on('game:state', payload => {
      const room = roomFor(); if (room?.host !== socket.id) return;
      if (payload?.phase === 'lobby') return returnLobby(room);
      const winners = room.match?.mode === 'ffa' ? room.match.fighters.map(f => f.id) : ['red', 'blue'];
      if (payload?.phase !== 'results' || room.phase !== 'playing' || ![...winners, 'draw'].includes(payload.winner)) return;
      room.winner = payload.winner; phase(room, 'results');
    });
    socket.on('player:hit', payload => {
      const room = roomFor();
      if (room?.host !== socket.id || room.phase !== 'playing') return;
      for (const p of room.players.values()) if (p.socketId && p.fighterId === payload?.team) io.to(p.socketId).emit('player:hit', { strength: 1 });
    });
    socket.on('disconnect', () => {
      const room = roomFor(); if (!room) return;
      if (room.host === socket.id) {
        clearTimers(room); io.to(room.code).emit('room:closed');
        for (const client of io.sockets.sockets.values()) if (client.data.room === room.code) { client.leave(room.code); client.data = {}; }
        rooms.delete(room.code); return;
      }
      const p = playerFor(room);
      if (p) { p.socketId = null; p.leftAt = Date.now(); calibrate(room, p, 'disconnected'); }
    });
  });
  return () => { clearInterval(watchdog); for (const room of rooms.values()) clearTimers(room); };
}
