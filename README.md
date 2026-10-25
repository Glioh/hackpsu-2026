![Limbpossible — chaotic arena brawling with friends](docs/images/limbpossible-banner.png)

# Limbpossible

**Two players. One fighter. Zero coordination.**

A browser party brawler where your phones are the controllers. One teammate controls the legs, the other controls the arms. Tilt, jump, punch, and try to stay on the platform together.

## Run locally

Requires **Node.js 22+**.

```sh
npm ci
npm run dev
```

Open [localhost:3000/lobby](http://localhost:3000/lobby) on your laptop or projector. The live room lobby is the default screen.

## How to play

1. Gather **4 or more players**, with an even number of phones.
2. Scan the lobby QR code or enter the game PIN on your phone.
3. The host starts the game; players are paired and assigned arms or legs.
4. Pick your fighter, vote for an arena, then enable motion sensors and calibrate.
5. Work together to knock the other fighters off the platform.

**Phone play needs a trusted HTTPS server or tunnel** with WebSocket support. Set its URL under **Phone connection settings** to update the QR code.

No phones handy? Open **Developer Playground** in the host lobby for a keyboard/bot match, or [preview the phone controller](http://localhost:3000/controller?preview=1).

## Development

Built with **Three.js, Node.js, Express, and Socket.IO**.

- `npm start` — run without automatic restarts.
- `npm test` — run the test suite.
- [Deployment guide](docs/cloudflare-deploy.md) · [Project notes](docs/)
