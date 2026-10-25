import { Container, getContainer } from '@cloudflare/containers';

export class GameServer extends Container {
  defaultPort = 3000;
  sleepAfter = '30m';
  enableInternet = true;
  constructor(ctx, env) {
    super(ctx, env);
    this.envVars = { PORT: '3000', NODE_ENV: 'production', APP_COMMIT: env.APP_COMMIT || 'local' };
    for (const key of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_MODEL', 'COMMENTARY_DIALOGUE', 'COMMENTARY_LIVE',
      'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_A', 'ELEVENLABS_MODEL_ID']) {
      if (typeof env[key] === 'string' && env[key]) this.envVars[key] = env[key];
    }
  }
}

export default {
  fetch(request, env) {
    // Rooms live in one Node process. Every page, polling request, and WebSocket
    // must reach the same named container. Return upgrades without rewrapping.
    return getContainer(env.GAME_SERVER, 'two-body-brawl').fetch(request);
  },
};
