// Same-origin sockets for a normal Node deployment. The Vercel proxy build
// replaces this file with the persistent backend's public HTTPS origin.
globalThis.BRAWL_SOCKET_ORIGIN = '';
