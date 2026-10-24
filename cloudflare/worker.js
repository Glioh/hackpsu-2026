import { Container, getContainer } from '@cloudflare/containers';

export class GameServer extends Container {
  defaultPort = 3000;
  sleepAfter = '30m';
  enableInternet = false;
  constructor(ctx, env) {
    super(ctx, env);
    this.envVars = { PORT: '3000', NODE_ENV: 'production', APP_COMMIT: env.APP_COMMIT || 'local' };
  }
}

export default {
  fetch(request, env) {
    // Rooms live in one Node process. Every page, polling request, and WebSocket
    // must reach the same named container. Return upgrades without rewrapping.
    return getContainer(env.GAME_SERVER, 'two-body-brawl').fetch(request);
  },
};
