# Demo release checks

Automated verification: `npm test` — 32 passing tests. Physical and deployment checks require the intended setup; none are claimed complete.

| Check | Status | Proof to record |
|---|---|---|
| HTTP routes, room lifecycle, role integrity, debug start | Automated pass | `npm test` |
| Spatial movement, collision, punch, ring-out, rematch reset | Automated pass | `npm test` |
| Springs, gait, event timing, heading wrap, motion reset, baseline toggle | Automated pass | `test/motion.test.js` |
| Identical pose evolution at simulated 30/60/120/144 Hz render schedules | Automated pass | `test/motion.test.js` |
| Calibration faults, silent controllers, host-only resume and preserved room | Automated pass | `test/calibration.test.js` |
| Fullscreen request lifecycle and viewport fallback | Automated + desktop browser pass | `test/presentation.test.js`; normal/debug start entered native fullscreen, HUD visible, round end exited fullscreen |
| Calibration interruption overlay and disabled resume | Desktop browser pass with simulated controllers | Four Socket.IO test controllers joined the visible host; injected Red Arm orientation error paused the match and displayed the affected role in the corner and overlay |
| Cloudflare Worker bundle and bindings | Dry-run pass | `npx wrangler deploy --dry-run --containers-rollout=none`; no container build or cloud deployment performed |
| GitHub → Cloudflare container deployment | Pending | Configure Actions secrets, Workers Paid/Containers, push workflow, run deploy; Docker is unavailable locally and GitHub CLI is signed out |
| Visual spring tuning and clips at 30/60/high refresh | Pending | Start/stop, reverse, turn, punches, hits, jumps, landings, edge fall, results and rematch; browser automation returned mismatched window content and detected user activity |
| Host WebGL and desktop game layout | Desktop browser pass; projector pending | Host characters, arena, native fullscreen, calibration HUD and pause overlay inspected in Brave through temporary HTTPS tunnel |
| Browser debug round and results/rematch UI | Pending | Complete keyboard/bot round |
| QR reaches exact HTTPS origin on phone | Pending | URL, network, phone/browser |
| iPhone permission, axes, neutral, tilt, impulse | Pending | iOS version and Safari result |
| Android permission, axes, neutral, tilt, impulse | Pending | Android version and Chrome result |
| Idle/ordinary tilt causes no unwanted actions | Pending | 60-second idle/tilt trial per device |
| Each deliberate jolt produces one action | Pending | 20 jolts per role/device |
| Four phones join simultaneously with unique roles | Pending | Device and role list |
| Three full rounds with rematches | Pending | Four-player rehearsal |
| Wi-Fi dropout / background / refresh | Pending | Lobby return, neutral inputs, reclaim, calibration |
| Rotate / deny sensors / unsupported browser | Pending | Errors and recovery |
| Host closes, phones join new room | Automated + device pending | Real phone test |
| Actual demo network, HTTPS and projector | Pending | Final URL and rehearsal date |

Before demo: tune `shared/config.js` from device results, rerun tests after changes, rehearse a secure fallback, record deployment/start details and tag the verified commit. Items/grabs, additional arenas, hazards and articulated ragdolls are outside this MVP.

Motion CPU sample on this laptop: 20,000 ticks for two fighters plus pose interpolation took approximately 198 ms (0.010 ms per tick) after warmup in Node. This excludes browser/WebGL frame cost, which remains pending. Motion snapshots and render outputs are reused. No character export script, helmet accessories, or reactor exists in this checkout.
