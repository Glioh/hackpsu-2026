import express from 'express';
import { installCommentary } from './commentary.js';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import { CONFIG } from '../shared/config.js';
import { installParty } from './party-room.js';

export function createApp(options = {}) {
  const app = express(), http = createServer(app), io = new Server(http, { maxHttpBufferSize: 8192 });
  const rooms = new Map();
  installCommentary(app, io);
  const root = fileURLToPath(new URL('../', import.meta.url));
  // A Vercel HTTP proxy can serve the pages while sockets connect directly to
  // the persistent HTTPS server (Vercel Functions cannot host WebSockets).
  app.get('/shared/connection-config.js', (_, res) => {
    res.set('Cache-Control', 'no-store').type('js').send(
      `globalThis.BRAWL_SOCKET_ORIGIN = ${JSON.stringify(process.env.PUBLIC_SOCKET_ORIGIN || '')};`
    );
  });
  app.get('/health', (_, res) => res.set('Cache-Control', 'no-store').json({ ok: true, version: CONFIG.version, commit: process.env.APP_COMMIT || null }));
  app.get(['/', '/lobby', '/host', '/host/', '/host/index.html'], (_, res) =>
    res.set('Cache-Control', 'no-store').sendFile(root + 'host/index.html'));
  app.get('/controller', (_, res) => res.sendFile(root + 'controller/index.html'));
  for (const dir of ['host', 'controller', 'shared']) app.use('/' + dir, express.static(root + dir));
  app.use('/vendor/three/addons', express.static(root + 'node_modules/three/examples/jsm'));
  app.use('/vendor/three', express.static(root + 'node_modules/three/build'));
  app.get('/qr', async (req, res) => {
    const value = typeof req.query.url === 'string' ? req.query.url : '';
    if (value.length > 512 || !/^https?:\/\//.test(value)) return res.sendStatus(400);
    res.type('svg').send(await QRCode.toString(value, { type: 'svg', margin: 1, width: 220 }));
  });
  const disposeParty = installParty(io, rooms, options);
  http.once('close', disposeParty);
  return { app, http, io, rooms };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { http } = createApp();
  http.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => console.log('Limb-Possible: http://localhost:' + (process.env.PORT || 3000)));
}
