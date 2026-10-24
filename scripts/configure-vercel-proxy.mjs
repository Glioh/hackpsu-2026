import { mkdir, writeFile } from 'node:fs/promises';

// Vercel serves HTTP routes; live sockets go directly to this same persistent
// backend using a generated /shared/connection-config.js. Keep that server and its
// HTTPS URL alive. Only deploy the generated .deployment directory.
const origin = new URL(process.argv[2]);
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('Pass the persistent backend HTTPS origin only.');
}
await mkdir('.deployment/shared', { recursive: true });
await writeFile('.deployment/vercel.json', JSON.stringify({
  version: 2,
  routes: [{ handle: 'filesystem' }, { src: '/(.*)', dest: `${origin.origin}/$1` }],
}, null, 2) + '\n');
await writeFile('.deployment/shared/connection-config.js',
  `globalThis.BRAWL_SOCKET_ORIGIN = ${JSON.stringify(origin.origin)};\n`);
console.log('Created the Vercel HTTP proxy and direct WebSocket configuration in .deployment.');
