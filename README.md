# Two-Body Brawl

**Four friends. Two bodies. Zero coordination.**

A spatial browser party brawler: two phone controllers share each fighter. Legs tilt on two axes to walk and jolt to jump; Arm tilts to turn and jolts to punch. Knock out the other team or push them off the platform to win.

## Run

Requires Node.js 22 or later.

```sh
npm ci
npm start
```

Open **http://localhost:3000** on the laptop/projector. `npm run dev` restarts after edits (invalidating existing rooms). `npm test` runs simulation and Socket.IO integration checks. No build step or external asset service is required for gameplay; optional Google Fonts fall back to installed fonts.

For a single-machine match, expand **Developer Playground**, then **Start keyboard / bot match**. Red: WASD body-relative movement, Q/E turn, Space jump, F punch. Blue: arrows move, J/L turn, I jump, K punch. Disable the Blue bot to use those keys. The stats toggle shows positions, speed, heading, grounded state, and cooldowns. Debug mode is labeled and does not satisfy the four-phone demo requirements.

Each fighter starts at **0% damage**. Two-arm uppercuts add damage based on punch strength and forward momentum (at most 18 percentage points per hit). Accumulated damage gently raises horizontal knockback and upward recoil, with launch growth capped at 180%. There are no health knockouts: knock the other team off the platform to win. Damage resets on rematch and is preserved while paused. Tilt uses a 5-degree neutral dead zone relative to the calibrated holding angle. Forward/back movement reaches full speed at 25 degrees; left/right movement and Arm rotation reach full speed at 55 degrees.

Combat uses each selected GLB model's part bounds and swept hand volumes along the same two-arm uppercut animation. Main torso geometry controls body separation; hands, limbs, and accessories remain hittable. Cosmetic jelly and gear wobble do not change the combat volumes.

**Spring body motion** enables cosmetic torso inertia, head lag, arm follow-through, distance-driven steps, and jump/landing reactions. Compare **Subtle** (default), **Floppy**, and **Lively** in Developer Playground, or turn the checkbox off for a rigid baseline. Pose updates run at 60 Hz and interpolate with the root movement; results freeze the pose and rematches reset all motion. The extra wobble is damped, walking no longer squashes the body, and jump/hit scaling stays within 4%. These are visual effects; collisions and combat still use the existing root simulation.

Pick each team's character (Sir Squish, Crank or Bonk-3000) under **03 / Choose your fighters** on the host page. Picks swap live, are remembered per browser, and lock while a round is live. Character art and build scripts live in `art/characters/`; the browser models are `host/assets/characters/*.glb`, listed in `host/src/fighter-model.js`.

## Skyline rooftop map

Choose **Skyline Rooftop** in the host map picker under **Mid**. The rooftop has ramps, stairs, raised terraces, collidable rooftop utilities, and open edges for ring-outs. Its playable footprint is 27.9 by 20.88 m, and the developer bot plans routes around equipment and onto the raised sections. The approved prototype is saved separately in `art/prototypes/rooftop/approved-v1/`. See [Skyline map notes](docs/skyline-rooftop.md) for assets, rebuilding, and checks.

## Cloudpeak mountain map

Choose **Cloudpeak Dojo** under **Mid** for a mountain kung fu arena with stone terraces, stairs, training dummies, boulders, a gong, and open cliff edges. The bot can navigate obstacles and climb to the upper terrace. See [Cloudpeak map notes](docs/cloudpeak-dojo.md).

## Crossline station map

Choose **Crossline Station** under **Mid** for the enlarged train station with raised waiting areas, stairs, an overhead footbridge, and trains arriving at random intervals on the front and rear tracks. Amber signals warn before each pass; train impacts add damage and launch fighters along the tracks. See [Crossline map notes](docs/crossline-station.md).

## Preview the mobile controller

Open `/controller?preview=1` on the local server or deployed HTTPS origin, or select **Preview mobile controller** on the phone join page. No room, host, or other phones are required. The preview uses the real controller UI with a disconnected socket, so it never joins or sends inputs to a match.

Use the collapsible **Controller preview** panel to choose role, team, and screen state. Simulated tilt sliders work on desktop without sensor permissions; **Idle** centers the inputs. Preview calibration failures, recover all phones, and simulate jolts and hits. Select **Phone sensors**, then enable motion and calibrate using the recovery controls to try it on one phone. Close the panel to inspect the screen unobstructed.

## Play with phones

1. Run this Node server behind a trusted **HTTPS** origin with Socket.IO support. An ordinary laptop LAN HTTP URL is insufficient for mobile motion sensors. A deployment or secure tunnel must forward all routes and `/socket.io/` to this process.
2. Open the host through that origin, or paste it into **Phone-accessible origin** and press the arrow to update the QR. This changes the join link; it does not create a tunnel or deploy the application.
3. Scan with four separate phones. The server assigns Red Legs, Red Arm, Blue Legs, Blue Arm in that order.
4. Tap **Enable motion sensors**, allow access, hold the phone comfortably in portrait, then **Hold neutral & calibrate**. Both orientation and acceleration streams are required.
5. Once all four slots show ready, press **Start the brawl**. The arena enters fullscreen (or fills the browser viewport if fullscreen is unavailable). Phone calibration appears in the corner. Legs movement follows the fighter's facing, controlled by the Arm teammate.
6. Knockout and ring-out results offer **Run it back** without rejoining. Hold phones securely and use small jolts while standing still.

The steering flip checkbox reverses left/right; recalibration resets neutral. Rotating, backgrounding, losing sensors, or reconnecting requires recalibration. Calibration errors and controller disconnects pause normal matches in place. The corner status identifies the affected role; recalibrate on the phone and the same round resumes automatically once all four phones are ready. Explicit host pauses still require **Resume match**. Silent controllers are marked stale after 2.5 seconds. The original controller can reclaim its role using its stored token for 30 seconds. Occupied slots cannot be replaced. After host disconnect/reload, the room expires; phones must join the new code. Results or **Return to lobby** exit fullscreen.

## Deploy

Use a Node.js service supporting persistent processes, HTTPS, and WebSockets. Install: `npm ci --omit=dev`. Start: `npm start`. The process binds `0.0.0.0` and honors `PORT` (default 3000). `/health` returns a JSON health response.

Use **one server process/instance**: rooms live in memory, so restarts invalidate rooms and multiple instances need shared storage/routing. The host remains the combat authority; keep its tab visible and active. Hiding it pauses the match.

For cloud hosting with automatic updates on pushes to `main`, use the included [GitHub → Cloudflare deployment workflow](docs/cloudflare-deploy.md). It runs the Node/WebSocket server in one Cloudflare Container, provides a stable HTTPS URL, and offers a manual **Run workflow** action. Activation requires Cloudflare account credentials stored in GitHub Actions secrets and a Workers Paid account with Containers enabled. The laptop's temporary quick tunnel is separate from this workflow.

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
- `host/src/characters.js`: neutral character meshes with waist, neck, shoulder, and hip pivots.
- `host/src/motion.js`: exact bounded angular springs, movement inertia, event reactions, pose snapshots, and root/pose interpolation.
- `host/src/camera.js`: wide, low-angle camera that smoothly pans horizontally with the fighters at a steady height and fits both bodies as they separate. The arena is 22 by 16 units; both arms sweep upward together for each uppercut.
- `host/src/main.js`: host UI, simulation loop, stale input expiry, one-shot consumption, keyboard/bot debug.
- `controller/src/sensors.js`: permissions, calibration, smoothing, dead zone, impulse detection, gravity filtering fallback.
- `controller/src/main.js`: join, reconnect, instructions, diagnostics, 30 Hz input, feedback.

Slot identity comes from the socket's server assignment. Client-supplied team/key fields cannot change the relay destination. Packets carry sequence numbers and cumulative action IDs; the host consumes actions once, observes cumulative IDs after dropped volatile packets, and expires continuous input after 400 ms. Initial sensor tuning: 12 m/s² jolt threshold, 350 ms cooldown, 100 ms tilt suppression. These values still require device testing.

## Verification status

`npm test`: 32 passing tests covering gameplay and room behavior, calibration interruption/resume and stale-controller detection, fullscreen fallback, camera framing, spring decay and bounds, neutral model hierarchy, directional inertia, distance-driven gait, baseline mode, punch timing, landing reactions, heading wrapping, full pose reset, once-per-tick motion events, and identical fixed-step pose evolution under simulated 30/60/120/144 Hz render schedules.

Desktop WebGL rendering, normal/debug native fullscreen, the corner calibration HUD, round-end fullscreen exit, and a visible calibration-error pause were inspected in Brave through the temporary HTTPS tunnel. The pause check used four simulated Socket.IO controllers. The tunnel also passed automated role assignment, input relay, and room QR checks. Real iPhone/Android motion, four-human matches, and Cloudflare container deployment remain **not tested**. See [QA.md](QA.md) for release gates.

API references: [Socket.IO](https://socket.io/docs/v4/server-initialization/), [Three.js](https://threejs.org/manual/en/installation.html), [motion permissions](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission_static).

### Mobile action and recovery screens

Joined phones show live movement, steering, jump, and uppercut commands on black. Only a phone needing calibration shows recovery controls; other phones identify affected team/body slots and show their own control tips. Calibration pauses resume the same round automatically once all four phones are connected and calibrated. Host pauses still require host resume. Hits flash red on both phones belonging to the hit fighter and request vibration where supported.

## Broadcast commentary

Original two-host commentary, caption fallback, optional ElevenLabs audio and bank generation: see [setup, audition and validation](docs/commentary-implementation.md). The copied research documents are in `docs/`.
