# PLAN.md — Limb-Possible

> **Status:** Implementation plan for the HackPSU MVP  
> **Source of truth:** `CONTEXT.md` (game requirements and design decisions)  
> **Pitch:** *Four friends, two bodies, zero coordination.*

## 0. Mission and non-negotiables

Deliver a **working browser-based 2v2 spatial party brawler** in which four people use their own phones to collaboratively control two goofy fighters on a shared laptop/projector screen. A complete match must run from **QR join → role assignment → combat → ring-out → results → rematch**.

The following are **locked**:

- **2.5D parent/host screen:** fixed three-quarter camera, arena with visible depth, and characters moving in actual spatial gameplay space, like the broad arena feel of *Gang Beasts*.
- **Spatial movement:** X = left/right, Z = forward/back across the arena, Y = jumping/falling. Do **not** revert to a side-view, one-dimensional fighting lane.
- **Four real phones minimum:** two teammates per fighter; roles are **Legs** and **Arm**. The lobby cannot begin a normal match with fewer than four assigned, connected players.
- **Motion-only gameplay inputs:** calibrated phone tilt for continuous control; phone jolts for one-shot actions. Taps are allowed for joining, permissions, calibration, and menus—not as substitute gameplay controls.
- **Role mapping:** Legs use **two-axis tilt for ground-plane movement** and **jolt to jump**; Arm use **left/right tilt to turn body facing** and **jolt to punch**. Item/grab behavior is a stretch feature.
- **Host-authoritative:** the host tab runs game state and physics. Node.js + Socket.io manages rooms/roles and relays inputs; phones do not simulate combat.
- **Hackathon-feasible physics:** Three.js for spatial rendering, a small custom movement/collision simulation for MVP, and procedural wobble/flail animation. **Do not attempt full 3D articulated ragdoll physics for the MVP.**
- **One arena, ring-out win condition, rematch, keyboard/bot debugging, and real-device testing** are required.

## 1. Definition of done (demo-critical)

The MVP is **done only if** each item below passes on the intended demo setup:

- [ ] Host opens a room and displays a working room code and QR URL.
- [ ] Four separate phones join the same room, get stable team/role assignment, and show connection/calibration status.
- [ ] Both Legs players can walk **left/right and toward/away from camera** using calibrated tilt; both Arm players can steer their fighters' headings using tilt.
- [ ] Physical phone jolts trigger **jump** for Legs and **punch** for Arm, without frequent tilt-induced false positives.
- [ ] On the host's fixed three-quarter view, both fighters visibly occupy a 3D-looking arena with readable depth and boundaries.
- [ ] Characters collide; punches cause readable hit reactions and knockback; fighters can be knocked out of the arena from its edges.
- [ ] A ring-out ends the round, displays the winning team, and supports a rematch without rejoining all phones.
- [ ] A lost controller has a clear handling path (pause/return to lobby/reconnect); no invisible stuck inputs.
- [ ] Keyboard/bot debug mode can exercise a complete match without four people; real gameplay still requires four connected phones.
- [ ] At least one actual iPhone **and** one Android phone are tested for orientation, impulse, permission flow, and connection.
- [ ] The final deployed/demo network is tested end to end. Demo gameplay never depends on unsupported local sensor permissions.

## 2. Architecture and folder layout

```text
Limb-Possible/
├── CONTEXT.md
├── PLAN.md
├── package.json                 # workspace scripts, if using workspaces
├── shared/
│   ├── protocol.js             # event names, validation ranges, constants
│   └── config.js               # gameplay/sensor tuning defaults
├── server/
│   ├── index.js                # HTTP + Socket.io
│   ├── rooms.js                # create/join/reconnect/leave
│   └── roles.js                # two teams × (legs, arm)
├── host/
│   ├── index.html
│   └── src/
│       ├── main.js             # host initialization & loop
│       ├── net.js              # room events, input ingestion
│       ├── game.js             # lobby/playing/results FSM
│       ├── simulation.js       # authoritative X/Z/Y movement & combat
│       ├── fighter.js          # simple collider/state/attack cooldowns
│       ├── arena.js            # platform bounds, gravity, ring-outs
│       ├── render.js           # Three.js scene, camera, lighting
│       ├── animations.js       # cosmetic floppy limbs, recoil
│       ├── hud.js              # room QR, teams, win/rematch
│       └── debug.js            # local keyboard/bots & testing toggles
└── controller/
    ├── index.html
    └── src/
        ├── main.js            # join/assignment UI
        ├── net.js             # Socket.io events and reconnect
        ├── sensors.js         # permission, calibration, filtering
        ├── input.js           # role mapping + one-shot impulse edges
        └── ui.js              # role, team color, sensor debug, safety
```

This structure is a suggested interface boundary, **not a requirement to create all files before a vertical slice works**. Use plain JS or Vite, whichever the team can ship fastest. If using a monorepo, expose one obvious `dev` command for host, controller, and server.

**Runtime flow:**

```text
Phone device sensors → calibration/filtering → normalized role input
    → Socket.io server (room authentication/relay)
    → authoritative host input snapshot
    → fixed-step simulation → Three.js render / host HUD
    → game-phase + hit feedback back through server to phones
```

**Host disconnect rule:** stop or invalidate the room; the server must never silently elect a phone as the new game authority.

## 3. Implementation sequence and gates

Build **one working vertical slice** before making it pretty. The gates are cumulative: do not start a later phase while a prior demo-critical gate is failing.

### Phase 0 — Repo, decisions, and smoke test

**Goal:** A shared project that runs from fresh checkout.

- [ ] Pick plain JS or Vite and establish a single documented local start procedure.
- [ ] Establish shared input/event names, versionable configuration constants, and team/role IDs.
- [ ] Build a server with a `/health` endpoint and Socket.io `connect` acknowledgement.
- [ ] Serve/open both host and controller routes, locally and from a phone.
- [ ] Confirm a *secure HTTPS context* for actual mobile sensor tests, especially iOS. A phone loading a laptop's ordinary `http://<LAN-IP>` URL may not be able to access motion sensors.
- [ ] Decide early how to reach the demo environment over HTTPS (persistent hosted origin, or a tested secure tunnel for the laptop/hotspot fallback).

**Gate 0:** One host browser and one phone connect through the chosen setup; no mysterious local dependency.

### Phase 1 — Spatial single-machine playtest (highest gameplay risk)

**Goal:** Two colorful placeholder fighters battle in a convincing fixed-camera spatial arena using keyboard/debug inputs.

- [ ] Create a Three.js scene with fixed **three-quarter** camera, lighting, visible floor thickness, edge contrast, and shadows.
- [ ] Define a rectangular arena in **X/Z**; use **Y** for jump/fall. Use one collision footprint per fighter (circle or capsule approximation).
- [ ] Implement normalized X/Z movement, acceleration, damping, max speed, facing angle, and jump/gravity.
- [ ] Implement fighter-to-fighter collision resolution on the ground plane; keep motion stable during contact.
- [ ] Implement arm punch: wind-up/cooldown, range/front-facing check, brief attack window, hit reaction, and knockback.
- [ ] Detect a ring-out whenever a fighter leaves platform support and falls below a defined elimination height. Avoid immediate false losses when briefly crossing an edge during a jump.
- [ ] Add simple cosmetic body/arm/leg meshes with bob, turn lag, recoil, and flailing. **Visual-only limbs must not destabilize the collider.**
- [ ] Create deterministic keyboard/debug controls for both fighters; optionally add a basic walking bot.
- [ ] Add a single debug overlay for fighter positions, heading, movement, grounded state, punch cooldown, and ring-out state.

**Gate 1:** Two fighters can move **both ground-plane axes**, circle one another, punch, knock one another off any arena edge, and complete a round. From the camera view, depth/movement are immediately recognizable.

### Phase 2 — Phone motion proof (highest device risk)

**Goal:** Real phones reliably produce normalized continuous tilt inputs and isolated jolt events.

- [ ] Make the controller screen show team, role, connection, **Calibrate**, sensor readouts, and safety instruction to stay in place/secure phone.
- [ ] Request iOS sensor permission from a **user tap**, on HTTPS; handle denied/unavailable permissions with an explicit error and diagnostics.
- [ ] Read `deviceorientation` beta/gamma; capture neutral offsets; handle landscape/portrait assumptions deliberately.
- [ ] Convert calibrated two-axis tilt to a normalized `moveX`, `moveZ` vector for Legs. Define whether values are camera-relative or body-relative and implement exactly that in host simulation. **Default: body-relative** (host rotates input by fighter heading).
- [ ] Convert Arm left/right tilt to normalized `turn`; establish a consistent sign across phones or a calibration flip.
- [ ] Low-pass filter tilt; start near an **8° dead zone** and **30–40° saturation**. Make constants tweakable, not hardcoded across multiple files.
- [ ] Read `devicemotion` acceleration without gravity when supplied; detect magnitude impulses, initial threshold near **12 m/s²**, cooldown ~**350 ms**, and `power = min(1, magnitude / 35)`.
- [ ] Send input at approximately **30 Hz**. Pause repeated actions while an impulse is on cooldown; briefly hold Legs move or Arm turn ~100 ms after the jolt.
- [ ] Test idle, ordinary tilting, walking in place, and intentional jolts on an iPhone and an Android phone; tune false positives and sensor axis signs.
- [ ] Fall back to diagnostic/manual **debug mode only** when motion inputs are unavailable; do not silently substitute tap controls in normal matches.

**Gate 2:** A tester can calibrate and repeatedly tilt/jolt each phone, get the correct independent directional values and *one* action per jolt, with no major false triggers.

### Phase 3 — Room system and end-to-end 2v2

**Goal:** Four real phones control the two fighters through the server relay and host game loop.

- [ ] Host creates a room; server generates a short code with collision handling and expiration on host close.
- [ ] Show join QR code and textual code. QR contains an HTTPS URL that opens the controller with the room prefilled.
- [ ] Server assigns exactly four MVP slots: Red/Blue × Legs/Arm; reject duplicate/invalid assignments and handle simultaneous joins.
- [ ] Associate each socket with server-authorized room, team, and role. **Never trust a client-supplied role or `playerId` for authorization.**
- [ ] Forward each normalized input to the room's host. Maintain the newest snapshot per role and consume discrete actions once.
- [ ] Make the host run the simulation at a steady fixed tick (e.g., **60 Hz**) and render at animation frame rate; avoid speed varying with browser FPS.
- [ ] Assign input event sequence numbers or one-shot event IDs so an impulse is not lost or accidentally replayed when messages batch/reconnect.
- [ ] Add a configurable stale-input timeout (~**250–500 ms**): return motion input to zero after silence, not indefinitely retain the last tilt.
- [ ] Implement lobby readiness and **minimum-four-phone** start validation; host sends `lobby | playing | results` transitions.
- [ ] Emit hit feedback and winner/results to the correct room/players. Support rematch after resetting positions, cooldowns, and round state.
- [ ] Handle phone disconnect/reconnect: preserve the slot briefly using a reconnect token if practical; otherwise return to lobby/require role reassignment. Explicitly prevent stuck movement.
- [ ] Test QR join, mixed phone types, refresh, drop/rejoin, all slots full, and no fifth phone taking over an occupied role.

**Gate 3:** Four phones successfully complete **three consecutive** 2v2 matches with correct role mapping, no stuck inputs, and functional rematch.

### Phase 4 — Usability, resilience, and polish

**Goal:** Make the complete loop obvious and dependable for judges.

- [ ] Add readable host overlays: lobby/assigned slots, countdown, round winner, rematch instructions, and connection health.
- [ ] Display phone role-specific instructions: **Legs: tilt to walk / jolt to jump**; **Arm: tilt to steer / jolt to punch**.
- [ ] Add obvious hit feedback (squash/recoil, particles, screen shake) and simple sound if budget permits.
- [ ] Add a large landing-area UI affordance and clearly visible arena limits; ensure camera never obscures important action.
- [ ] Verify graceful errors for no sensors, denied permissions, duplicate joins, lost socket, room expired, and host closed.
- [ ] Deploy the chosen build and verify that the **exact judge-facing URL and network** work on real phones.
- [ ] Keep an offline/local fallback only if it has been tested end to end with secure sensor permissions.

**Gate 4:** A new group can join and finish a round after reading only the on-screen instructions. The team can recover from a phone refresh without rewriting game state.

### Phase 5 — Freeze, regression, and demonstration

- [ ] **Freeze gameplay features** before final testing; remaining work is fixes and low-risk presentation only.
- [ ] Perform the full test matrix below on the actual demo machine, projector resolution, and network.
- [ ] Prepare two sets of test devices/chargers if available; keep a printed/text backup room URL.
- [ ] Rehearse the pitch and one full match with four people (including a clean rematch).
- [ ] Keep a working debug/bot demonstration route for technical failure, but clearly distinguish it from the full four-phone experience.
- [ ] Tag the final known-good commit and record the exact start/deploy procedure in `README.md`.

**Ship gate:** Every item in **Definition of done** is checked; no showstopper remains in iOS permissions, networking, movement, combat, or ring-out handling.

## 4. Contracts to agree on before parallel work

Use Socket.io named events with minimal payloads (names may change once, but not separately on host/controller/server):

| Direction | Event | Payload / expectation |
|---|---|---|
| Host → server | `room:create` | Room request; response includes `roomCode` + host identity |
| Phone → server | `room:join` | `{ roomCode, clientToken? }` |
| Server → phone | `player:assign` | `{ team: 'red'\|'blue', role: 'legs'\|'arm', color }` |
| Phone → host, via server | `input:legs` | `{ seq, moveX, moveZ, jumpId? }` where movement components ∈ [-1,1] |
| Phone → host, via server | `input:arm` | `{ seq, turn, actId?, power }` where `turn` ∈ [-1,1], `power` ∈ [0,1] |
| Host → server → phones | `game:state` | `{ phase: 'lobby'\|'playing'\|'results', winner? }` |
| Host → server → phone(s) | `player:hit` | `{ strength }` for optional feedback |
| Server → host/phone | `room:roster` | Slot assignment + connection/ready status |

**Protocol rules:** Server authenticates slot ownership from the socket; host ignores out-of-range values and replayed discrete action IDs; default input is neutral until received; stale snapshots expire; one-shot events are queued or consumed once; results are computed by host only. Start with one shared constant/config module if workspace imports are feasible, otherwise copy a single agreed schema and test it.

**Simulation defaults (tune at runtime):** arena bounds; movement speed and damping; turn rate; jump impulse and gravity; punch reach/angle/cooldown; knockback; hit stun; ring-out threshold; sensor dead zone and thresholds. Prefer a debug/tuning panel over repeated source edits.

## 5. Workstreams and dependency-aware division of labor

Assign owners based on actual skills (team roster is not yet confirmed). These workstreams can run in parallel **after Phase 0 contracts are agreed**:

| Workstream | Primary deliverable | Needs | Ready for integration when… |
|---|---|---|---|
| **Host simulation** | X/Z/Y movement, combat, arena, ring-out, game state | Movement/attack contract | Keyboard playtest meets Gate 1 |
| **Host visual/UI** | Three.js camera, fighters, lobby QR, HUD, results | Fighter state schema | Can render mock state and display room code |
| **Phone controls** | Sensor permission, calibration, Legs/Arm mapping, debug | Input contract + HTTPS origin | Gate 2 passes on iOS + Android |
| **Networking/deployment** | Room server, slot assignment, relay, URL, reconnect | Event contract | Host + 4 phone connections work across target network |
| **Integration/QA** | End-to-end smoke runs, test matrix, known-good build | All prior pieces | Gate 3 and Gate 4 pass |

**Integration rule:** Commit a vertical slice regularly. Do not allow four separately designed data models to meet for the first time near demo time.

## 6. Test matrix

| Case | How to test | Expected result |
|---|---|---|
| Spatial camera | Move debug fighter around all sides of opponent | Both X and Z are visible; arena edges read correctly |
| Multi-axis motion | Tilt Legs phone on each axis and diagonal | Movement matches calibrated direction and diagonal is not faster |
| Turning | Tilt Arm left/right while Legs walks | Heading turns without input conflicts or camera movement |
| Impulse isolation | Tilt normally, then intentionally jolt | Normal tilt does not spam jump/punch; intentional impulse triggers once |
| iOS permissions | Fresh HTTPS load on iPhone Safari | Explicit permission tap works; denied state is explained |
| Android sensors | Fresh load on Android Chrome | Calibration, axes, and impulse values are sensible |
| Join/roles | Connect four phones simultaneously | Unique Red/Blue × Legs/Arm assignments |
| Role integrity | Send forged team/role in input | Server/host does not allow commandeering another slot |
| Network dropout | Disable/re-enable Wi-Fi on one phone | No stuck movement; clear reconnection/rejoin behavior |
| Ring-outs | Knock fighter past each arena edge | Falling fighter loses, correct winner shown |
| Jump near edge | Jump toward boundary and return | No premature elimination while support is recoverable |
| Rematch | Finish match; start again | All players stay assigned; states/cooldowns reset |
| Full match | Four humans play three rounds | No dead input, freeze, duplicate actions, or wrong results |
| Demo environment | Actual host/projection/network/QR | Complete join and match on intended deployment |

## 7. Scope, cut list, and escalation rules

**P0 — absolutely required:** 2.5D spatial view, four-phone join, roles, tilt, impulse, walking, turning, jumping, punching, knockback, ring-out, win/rematch, debug mode, deployable setup.

**P1 — only after P0 is stable:** clearer character wobble, SFX, screen shake, hit feedback/vibration, better lobby instructions.

**P2 — cut first:** pickup/grab/throw system, hazards, second arena, advanced damage/floppiness, 3v3/4v4, real joint-based ragdolls, dynamic camera, extra characters.

When blocked, follow these fallbacks **without violating the central premise**:

1. **Full ragdoll too difficult?** Keep simple colliders and cosmetic floppy meshes; preserve spatial combat.
2. **Advanced collisions unstable?** Use circle footprints, simple separation impulses, one platform, and deterministic hitboxes.
3. **Jolt detection unreliable?** Tune threshold/cooldown, use an accessible calibration/reset UI, and ship robust magnitude-based detection before attempting directional jump detection.
4. **Deployment unreliable?** Switch to the previously tested secure fallback; don't assume ordinary LAN HTTP will grant iOS motion access.
5. **Team short on people?** Use keyboard/bots for development, but still test and demo four phones for judging.
6. **Time pressure?** Cut *all P2 features* and finish the full join-to-rematch flow.

## 8. Practical demo runbook

1. Launch the host and open the lobby on a laptop/projector. Confirm the room QR and readable code.
2. Four people scan the QR, grant motion permissions, calibrate their phones, and see their teams and roles.
3. Say the pitch: **“Four friends, two bodies, zero coordination.”**
4. Explain the mapping in one sentence: **“Legs tilt to walk and jolt to jump; Arm tilts to steer and jolts to punch.”**
5. Start the match. Show real depth movement, miscoordination, jumps, punches, and a ring-out.
6. Show the winner, rematch immediately, and let a judge try one of the roles.
7. If Wi-Fi/sensors fail, show the diagnostic status and switch to the rehearsed fallback; never claim keyboard mode satisfies the motion constraint.

## 9. Tracking and sign-off

Track execution in this file or GitHub Issues. Every task should have: **owner**, **status** (`todo`, `in-progress`, `blocked`, `done`), **dependency**, and **proof** (test, screenshot, or demonstration). Use the phase gates to make integration decisions.

| Milestone | Owner | Status | Proof / blocker |
|---|---|---|---|
| Gate 0: server/host/phone connected, HTTPS verified | TBD | todo | |
| Gate 1: keyboard spatial fighting + ring-out | TBD | todo | |
| Gate 2: real iOS/Android motion validated | TBD | todo | |
| Gate 3: four-phone 2v2 match + rematch | TBD | todo | |
| Gate 4: usability and deployed demo | TBD | todo | |
| Final ship gate: test matrix passed | TBD | todo | |

### The rule for every feature decision

**Does it make four people controlling two floppy bodies in a spatial arena more playable, more legible, or funnier—without endangering the demo?** If not, cut it.
