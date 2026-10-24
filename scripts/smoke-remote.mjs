import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const hostOrigin = new URL(process.argv[2]).origin;
const clients = [];
const ack = (socket, name, payload) => new Promise((resolve, reject) => {
  socket.timeout(10000).emit(name, payload, (error, result) => error ? reject(error) : resolve(result));
});
try {
  for (const path of ['/', '/controller', '/health', '/shared/connection.js', '/vendor/three/three.module.js']) {
    const response = await fetch(hostOrigin + path, { signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, path);
  }
  const config = await (await fetch(hostOrigin + '/shared/connection-config.js')).text();
  const socketOrigin = JSON.parse(config.match(/BRAWL_SOCKET_ORIGIN\s*=\s*('[^']*'|"[^"]*")/)?.[1].replaceAll("'", '"') || '""') || hostOrigin;
  async function connect() {
    const socket = io(socketOrigin, { transports: ['websocket'], forceNew: true, reconnection: false, timeout: 15000 });
    clients.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    return socket;
  }
  const host = await connect();
  const { roomCode } = await ack(host, 'room:create', {});
  assert.match(roomCode, /^[A-F0-9]{6}$/);
  const phones = [], roles = [];
  for (let i = 0; i < 4; i++) {
    const phone = await connect(); phones.push(phone);
    const assignment = await ack(phone, 'room:join', { roomCode });
    roles.push(`${assignment.team}:${assignment.role}`);
  }
  assert.equal(new Set(roles).size, 4);
  const inputReceived = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Input relay timed out')), 10000);
    host.once('input:legs', input => { clearTimeout(timeout); resolve(input); });
  });
  phones[0].emit('input:legs', { seq: 1, moveX: 0.5, moveZ: 0, jumpId: 0 });
  assert.equal((await inputReceived).key, 'red:legs');
  const qr = await fetch(hostOrigin + '/qr?url=' + encodeURIComponent(hostOrigin + '/controller?room=' + roomCode));
  assert.equal(qr.status, 200); assert.match(await qr.text(), /<svg/);
  console.log(JSON.stringify({ ok: true, hostOrigin, socketOrigin, roles, checks: ['HTTPS pages', 'WebSocket host + four controllers', 'role assignment', 'live input relay', 'room QR SVG'] }, null, 2));
} finally {
  clients.forEach(socket => socket.disconnect());
}
