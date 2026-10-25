import { io as connect } from 'socket.io-client';
import { createApp } from '../../server/index.js';

export function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, listener); reject(Error('Timed out: ' + name)); }, 4000);
    function listener(value) { if (predicate(value)) { clearTimeout(timer); socket.off(name, listener); resolve(value); } }
    socket.on(name, listener);
  });
}
export const emit = (socket, name, payload = {}) => new Promise((resolve, reject) => socket.timeout(2000).emit(name, payload, (error, result) => error ? reject(error) : resolve(result)));

export async function lobby(t, count = 4, options = {}) {
  const app = createApp({ rollScale: .001, controllerTimeoutMs: 60000, ...options });
  await new Promise(resolve => app.http.listen(0, '127.0.0.1', resolve));
  const sockets = [], url = 'http://127.0.0.1:' + app.http.address().port;
  const client = async () => {
    const socket = connect(url, { transports: ['websocket'], forceNew: true, reconnection: false });
    sockets.push(socket); await event(socket, 'connect');
    socket.on('game:state', state => { socket.state = state; });
    socket.on('player:assign', assignment => { socket.assignment = assignment; });
    return socket;
  };
  t.after(async () => { sockets.forEach(s => s.disconnect()); await new Promise(resolve => app.io.close(resolve)); });
  const host = await client(), { roomCode } = await emit(host, 'room:create'), phones = [];
  for (let i = 0; i < count; i++) { const phone = await client(); phone.assignment = await emit(phone, 'room:join', { roomCode, name: 'Friend ' + (i + 1) }); phones.push(phone); }
  return { ...app, url, client, host, phones, roomCode, room: app.rooms.get(roomCode) };
}

export async function startMatch(context, { characters, maps, calibrate = true } = {}) {
  const { host, phones } = context;
  if (calibrate) for (const phone of phones) phone.emit('player:ready', true);
  const started = await emit(host, 'game:start');
  if (started.error) throw Error(started.error);
  const mapVote = event(host, 'game:state', state => state.phase === 'map-vote');
  for (let i = 0; i < phones.length; i++) await emit(phones[i], 'character:vote', { id: characters?.[i] || 'crank' });
  const state = await mapVote;
  const final = event(host, 'game:state', state => ['playing', 'calibrating'].includes(state.phase));
  for (let i = 0; i < phones.length; i++) await emit(phones[i], 'map:vote', { id: maps?.(state.selection.options, i) || state.selection.options[0] });
  return final;
}
