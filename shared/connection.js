export function connectSocket() {
  const origin = globalThis.BRAWL_SOCKET_ORIGIN;
  return origin ? io(origin, { transports: ['websocket'] }) : io();
}
