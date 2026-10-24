# Two-Body Brawl

**Four friends. Two bodies. Zero coordination.**

A spatial browser party brawler: two phone controllers share each fighter. Legs tilt on two axes to walk and jolt to jump; Arm tilts to turn and jolts to punch. Knock the other team off the platform to win.

## Run

Requires Node.js 22 or later.

```sh
npm ci
npm start
```

Open **http://localhost:3000** on the laptop/projector. `npm run dev` restarts after edits (invalidating existing rooms). `npm test` runs simulation and Socket.IO integration checks. No build step or external asset service is required for gameplay; optional Google Fonts fall back to installed fonts.

For a single-machine match, expand **Developer Playground**, then **Start keyboard / bot match**. Red: WASD body-relative movement, Q/E turn, Space jump, F punch. Blue: arrows move, J/L turn, I jump, K punch. Disable the Blue bot to use those keys. The stats toggle shows positions, speed, heading, grounded state, and cooldowns. Debug mode is labeled and does not satisfy the four-phone demo requirements.

Pick each team's character (Sir Squish, Crank or Bonk-3000) under **03 / Choose your fighters** on the host page. Picks swap live, are remembered per browser, and lock while a round is live. Character art and build scripts live in `art/characters/`; the browser models are `host/assets/characters/*.glb`, listed in `host/src/fighter-model.js`.

## Play with phones

1. Run this Node server behind a trusted **HTTPS** origin with Socket.IO support. An ordinary laptop LAN HTTP URL is insufficient for mobile motion sensors. A deployment or secure tunnel must forward all routes and `/socket.io/` to this process.
2. Open the host through that origin, or paste it into **Phone-accessible origin** and press the arrow to update the QR. This changes the join link; it does not create a tunnel or deploy the application.
3. Scan with four separate phones. The server assigns Red Legs, Red Arm, Blue Legs, Blue Arm in that order.
4. Tap **Enable motion sensors**, allow access, hold the phone comfortably in portrait, then **Hold neutral & calibrate**. Both orientation and acceleration streams are required.
5. Once all four slots show ready, press **Start the brawl**. Watch the shared screen. Legs movement follows the fighter's facing, controlled by the Arm teammate.
6. Ring-out results offer **Run it back** without rejoining. Hold phones securely and use small jolts while standing still.

The steering flip checkbox reverses left/right; recalibration resets neutral. Rotating, backgrounding, losing sensors, or reconnecting requires recalibration. A controller disconnect during normal play returns everyone to the lobby. The original controller can reclaim its role using its stored token for 30 seconds. Occupied slots cannot be replaced. After host disconnect/reload, the room expires; phones must join the new code.

## Deploy

Use a Node.js service supporting persistent processes, HTTPS, and WebSockets. Install: `npm ci --omit=dev`. Start: `npm start`. The process binds `0.0.0.0` and honors `PORT` (default 3000). `/health` returns a JSON health response.

Use **one server process/instance**: rooms live in memory, so restarts invalidate rooms and multiple instances need shared storage/routing. The host remains the combat authority; keep its tab visible and active. Hiding it returns the match to the lobby.

### Vercel gateway with a persistent backend

Vercel Functions cannot run this game's persistent Socket.IO server. A Vercel deployment can proxy HTTP pages and assets to an existing HTTPS Node server, while browsers connect WebSockets directly to that backend. Both the backend and its public HTTPS URL must stay available.

Generate the gateway files with `node scripts/configure-vercel-proxy.mjs https://YOUR-BACKEND-ORIGIN`. Deploy only the generated `.deployment` directory to Vercel. It contains routing and a browser connection configuration; the Node game server continues running separately. The default source configuration keeps normal local and single-server deployments using same-origin sockets. `PUBLIC_SOCKET_ORIGIN` can optionally override the direct backend origin when starting a new Node process.

Check either the direct HTTPS backend or the deployed Vercel origin with `node scripts/smoke-remote.mjs https://YOUR-PUBLIC-ORIGIN`. This checks public pages, host plus four controller WebSocket connections, unique role assignments, input relay, and QR generation. It does not test physical phone motion sensors.

For this session, an HTTPS Cloudflare quick tunnel to the existing port 3000 process was created and passed those checks. A quick tunnel is temporary: closing its process, stopping the game server, disconnecting the laptop, or putting it to sleep breaks access. A Vercel project was created, but deployment requires the connected Vercel account to authorize its team scope. The generated `.deployment` files are ready for that deployment.

## Implementation

- `server/index.js`: HTTP, QR, Socket.IO room authority, role authentication, ready gate, reconnect reservations, host expiry.
- `shared/config.js`: version, slots, input validation, physics and sensor tuning.
- `host/src/simulation.js`: fixed-step X/Z movement, Y gravity, circle separation, facing, punch windup/cooldown, knockback and ring-outs.
- `host/src/render.js`: Three.js three-quarter camera, thick platform, boundaries, shadows, cosmetic limbs and recoil.
- `host/src/camera.js`: wide, low-angle camera that smoothly pans horizontally with the fighters at a steady height and fits both bodies as they separate. The arena is 22 by 16 units; accepted punches alternate arms independently for each fighter.
- `host/src/main.js`: host UI, simulation loop, stale input expiry, one-shot consumption, keyboard/bot debug.
- `controller/src/sensors.js`: permissions, calibration, smoothing, dead zone, impulse detection, gravity filtering fallback.
- `controller/src/main.js`: join, reconnect, instructions, diagnostics, 30 Hz input, feedback.

Slot identity comes from the socket's server assignment. Client-supplied team/key fields cannot change the relay destination. Packets carry sequence numbers and cumulative action IDs; the host consumes actions once, observes cumulative IDs after dropped volatile packets, and expires continuous input after 400 ms. Initial sensor tuning: 12 m/s² jolt threshold, 350 ms cooldown, 100 ms tilt suppression. These values still require device testing.

## Verification status

`npm test`: 14 passing tests for spatial/body-relative/normalized movement, collision, punch timing/knockback and alternating arms, four-edge ring-outs, airborne recovery, rematch reset, camera following and framing across aspect ratios, tilt normalization, role spoofing, duplicate sequences, full rooms, ready gate, reconnect, host expiry, and debug start.

Layout and actual WebGL rendering are **not browser-verified**. The temporary public HTTPS tunnel passed automated host/four-controller WebSocket, role assignment, input relay, and room QR checks. Real iPhone/Android motion and four-human matches remain **not tested**. See [QA.md](QA.md) for release gates. This implementation is not yet demo-qualified.

API references: [Socket.IO](https://socket.io/docs/v4/server-initialization/), [Three.js](https://threejs.org/manual/en/installation.html), [motion permissions](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission_static).
