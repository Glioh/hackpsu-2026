# Demo release checks

Automated verification: `npm test` — 10 passing tests. Physical and deployment checks require the intended setup; none are claimed complete.

| Check | Status | Proof to record |
|---|---|---|
| HTTP routes, room lifecycle, role integrity, debug start | Automated pass | `npm test` |
| Spatial movement, collision, punch, ring-out, rematch reset | Automated pass | `npm test` |
| Host WebGL, readable depth and responsive UI | Pending | Browser/projector screenshot |
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
