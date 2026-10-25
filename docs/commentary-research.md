# Limb-Possible: commentary research and event proposal

Research date: October 25, 2026. Proposal only; gameplay and audio integration are not implemented here. Thresholds below are starting hypotheses to tune from recorded play, not research-established constants.

## Grounding in the current game

The host owns the simulation. Each fighter has two human roles: legs control movement/jumping, arm controls facing/punching. Damage accumulates and increases launch strength; it is not remaining health. Winning requires the other fighter to cross the elimination height. There are no capture points, stocks, health kills, blocking, parrying, grabs, or character-specific special attacks in the inspected combat simulation.

Useful existing sources:

- `host/src/simulation.js`: fixed 60 Hz steps; fighter position, velocity, heading, damage, grounded/stun/attack state; per-step punch, hit, takeoff, landing events; winner transition.
- `shared/config.js`: 0.65 s punch cooldown, 18 maximum punch damage, 180 damage launch-growth soft cap, elimination Y = -5.
- `host/src/main.js`: processes each step and motion events, handles pause/rematch, and begins a 1.8 s finish presentation as soon as the winner is determined.
- `host/src/maps.js`: dynamic floor pieces, warnings, ice, quakes, splitting floors, conveyors, lava, and collapsing terrain.
- `host/src/station-map.js`: train pass identity and train impacts, already tagged `hazard: 'train'`.
- `host/src/solid-terrain.js`: support queries and landing detection for complex terrain.

No screen capture or vision model is needed to derive these events. Observe the same simulation that resolves the action.

## Research that informs the design

1. [MOBA-E2C, EMNLP 2022](https://aclanthology.org/2022.findings-emnlp.333/) uses game metadata and separate event handlers before generating language. Its four useful detector categories are state changes, counts, tracking sequences, and periodic summaries. Adapt that architecture to brawling rather than copying its Dota events. [Author repository](https://github.com/gamesmind/MOBA-E2C) contains data, processing scripts, and model resources; it is not a ready-made browser brawler integration.
2. [Real-time Fighting Game Commentary Generation via Strategic Rationale Distillation](https://xplorestaging.ieee.org/document/11263552) introduces a compressed representation of three-second battle segments. The relevant principle is to describe a short exchange with context rather than individual frames. [TeamFightingICE repository](https://github.com/TeamFightingICE/Small-Language-Model-for-Fighting-Game-Commentary) describes a frame analyzer and asynchronous T5 commentary system. At inspection, the visible root listing exposed only its README, despite the README describing several source files. Treat it as an architectural reference, not verified runnable code.
3. [Fighting Game Commentator with Pitch and Loudness Adjustment Utilizing Highlight Cues, 2021](https://arxiv.org/abs/2108.08112) combines match progression, actions, and distance into highlight cues. Its pilot supports varying delivery by excitement. Its HP-dependent formula does not transfer directly: our tension should depend on launch damage, unsafe position, and actual recovery possibilities.
4. [Pause-Aware Decoding, LREC 2026](https://arxiv.org/abs/2603.02655) treats utterance timing as a separate problem. Use audio duration and silence opportunities to schedule lines.
5. [Parallel Text Generation for Game Commentary, 2026](https://arxiv.org/abs/2606.13322) prepares candidates while speech plays and buffers outgoing broadcast video. We can prepare commentary during playback, but should not delay the player's view. Discard candidates that become stale.

These papers support the architecture; none validates the exact event thresholds proposed below. Repositories were inspected through their published pages, not run or benchmarked.

## Proposed event catalog

Use live simulation time for detector windows. Pause must freeze windows; rematch must reset them. Every event needs round ID, event ID, timestamp, affected team, evidence, priority, and expiry. Team is the subject of current hit events (the victim), not the attacker.

| Event | Initial detection rule | Priority / spoken treatment |
| --- | --- | --- |
| `round_start` | Transition into a new active round; not resume | Medium. One short matchup/map introduction. |
| `first_contact` | First confirmed fighter-sourced hit of the round | Low. Skip if a stronger highlight occurs. |
| `heavy_hit` | Confirmed fighter hit dealing at least 15 damage | Medium. Promote only with a dangerous launch or meaningful position change. |
| `pressure_run` | Same fighter lands 3 hits within 4 s without taking a fighter hit | Medium. Say "three unanswered hits," not "true combo." Trigger at threshold, then suppress repeated milestones for that exchange. |
| `trade` | Both fighters land a punch in the same simulation tick | Medium. Collapse both hit events into one exchange. |
| `whiff_punish` | A punch finishes without contact; its owner is hit by the opponent within 0.8 s afterward | Medium. Track attack IDs and results; verify the missed attack before claiming a punish. |
| `air_hit` | Fighter-sourced hit while attacker is airborne, confirmed with pre-contact state | Low/medium. Require recent deliberate takeoff to call it a "jumping uppercut"; ordinary knockback also makes a fighter airborne. |
| `danger_launch` | Fighter hit is followed by outward travel toward unsupported space, or an unsupported trajectory with a likely elimination | High. Say "sent toward the edge," never "out" before the winner resolves. |
| `close_save` | A danger episode ends with legal support and at least 0.4 s stable grounded survival | High. One call per danger episode. Falling from a terrace onto another floor is not automatically a save. |
| `counter_swing` | After taking at least 3 unanswered hits, the pressured fighter lands 2 unanswered hits within 5 s | Medium/high. Describe a reversal of pressure, not a confirmed comeback win. |
| `damage_milestone` | First crossing of 100 or 150 accumulated damage per fighter/round | Low. Only mention in a lull or combine with a danger launch; never call it low health. |
| `hazard_impact` | Explicit map-sourced impact, such as a train collision | High for train; medium otherwise. Combine with any ensuing ring-out. |
| `hazard_escape` | Track an exposed fighter during a particular hazard activation; verify they reach safety before the impact window closes | Medium. Deferred until map-specific exposure and outcome can be proven. |
| `terrain_escape` | Fighter leaves a warned/crumbling support and reaches stable support as the original support fails | Medium. Track support identity and failure time. |
| `ring_out` | Winner changes from null to red or blue | Highest. Attribute the decisive sequence only with recorded source history. |
| `double_fall` | Simulation resolves winner as `draw` | Highest. Current simulation resolves simultaneous elimination only when both cross the threshold in the same step. Do not infer a draw just because both are airborne. |
| `upset_finish` | Ring-out winner previously had at least 50 more accumulated damage than opponent shortly before the final exchange | High modifier of `ring_out`, not another queued line. Damage disadvantage is evidence of vulnerability, not an objective win probability. |
| `quiet_brawl` | At least 10 s with no confirmed contact, no current danger, and an available speech slot | Low. One rare joke or observation, then a long cooldown. |

For v1, ship round start, heavy hit, pressure run, trade, counter swing, train impact, ring-out/draw, and quiet brawl. Add danger launch and close save after geometry verification. Defer whiff punish and terrain/hazard escapes until richer instrumentation is present.

## Geometry and attribution requirements

Do not calculate danger using distance to the rectangular arena bounds. Twinspire has bridges and gaps; rooftop and dojo have multiple elevations; other maps have internal holes and moving floors. Do not use the nearest edge of an individual floor piece either: adjoining piece seams are not drop-offs.

Introduce a commentary-only support probe that considers the union of solid surfaces reachable at the fighter's feet height. Sample along current horizontal travel over roughly 0.5 s, accounting for vertical trajectory and moving geometry. Exclude overhead support. A missing floor beneath an ordinary jump is not enough for a danger event; check reachable landing surfaces. Start conservatively, suppress uncertain calls, and use map-specific metadata where general geometry cannot establish danger.

The current hit shape is insufficient for reliable attribution. Extend telemetry with explicit `source: 'fighter' | 'hazard'`, attacker team for combat, hazard ID, attack ID, pre/post position/velocity, and pre-contact grounded state. Some map shoves currently emit ordinary `hit` events without a hazard tag. Never assume every untagged hit came from the opponent.

Store a bounded 5-10 s history. For ring-outs, record the latest relevant impulse sequence: punch, hazard, subsequent control, stable recovery, then falling. A recent punch is not proof of a kill. Safe fallbacks are "Blue goes over the edge" or "Red wins"; use "Red punched Blue out" only with evidence. Similarly, say "Blue goes down on the tracks" rather than claiming Red deliberately pushed them into a train.

Do not claim a player was looking away or that the two human controllers disagreed based on a single miss. Shared-body jokes are theme, not inferred mental states. Physics already tracks punch strength and momentum; those are better evidence for a coordinated running hit.

## Turn raw actions into one story

Example: Blue takes a heavy punch, travels over unsupported space, lands safely, then hits Red twice. The resulting story can be "Blue survives the launch and answers back." It should not enqueue heavy hit, high damage, danger, landing, recovery, and retaliation as six separate calls.

Track danger and pressure episodes with IDs. Merge overlapping candidates. A resolved ring-out supersedes pending launch/save chatter. A train hit followed by elimination becomes a single train finish. An upset is a modifier on the finish, not a second announcement.

Suggested selection order: resolved finish > confirmed save/train impact > dangerous launch/reversal > pressure/trade/heavy hit > milestones > banter. Within a tier, favor consequence, rarity, and freshness. Expire ordinary action lines after about 1.5 s and pressure summaries after about 3 s; revalidate their facts just before playback. Persist terminal results only through the relevant result presentation.

Start with 3-6 s action lines and an ordinary minimum gap around 6 s, measuring whether actual players can hear each other. Optional replies should fit inside a combined 5-7 s exchange. These are tuning targets. Results can interrupt banter; normal hits should not constantly interrupt ongoing speech. Pause flushes pending action speech and pauses/cancels playback; rematch invalidates every old round callback.

## Two narrator direction

Use one director with two voices and shared recent-line memory. A is an excitable fight caller; B is a dry analyst amused by two humans sharing one body. B replies only when it adds analysis or a joke. Character names are cosmetic, so do not invent unique abilities for them.

Original sample pairs:

- Heavy hit: A: "Red puts everything into that uppercut!" B: "Both operators finally approved the same decision."
- Save: A: "Blue makes it back!" B: "The legs have filed a complaint with the arms."
- Pressure reversal: A: "Blue answers with two of their own!" B: "A meeting was held. Adjustments were made."
- Train impact: A: "Blue gets caught by the train!" B: "That connection was not on the itinerary."
- Twinspire ring-out: A: "Red wins! Blue goes over the side!" B: "The bridge had room for two. The argument did not."
- Quiet interval: A: "Still waiting for someone to commit." B: "Four people. Two bodies. No motion carried."

Do not use map flavor for mechanics that do not exist: the dojo gong is not a scoring objective and piano notes are not damage attacks. Repeat jokes rarely; joke about the shared-body premise rather than insulting real players.

## ElevenLabs implementation direction

[ElevenLabs TTS versus dialogue WebSockets](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets) documents separate single-voice TTS and multi-speaker dialogue paths. For this game's short-lived events, begin with two voice IDs and one playback director. Compare Flash TTS for quick calls with expressive dialogue synthesis for longer introductions and replies. Test supported models against the account's actual API access.

Pre-generate varied short reactions with ElevenLabs for immediate heavy hits, saves, train impacts, and results. Runtime generation can supply contextual exchanges and recaps. Cached audio is still AI-produced speech, while eliminating request latency for critical beats. Do not splice separately generated names into phrases unless transitions are demonstrably natural.

Keep API credentials on the Node backend. Host submits bounded event facts, not arbitrary unrestricted prompts. Put narration, TTS, and playback outside the simulation step; failures must never stall combat. Only host/projector needs the broadcast audio. Preserve the existing phone feedback path.

The [official latency guide](https://elevenlabs.io/docs/eleven-api/concepts/latency) distinguishes model inference from experienced latency. Measure event time to audible first sample, including writer time, network, buffering, and playback. If a generated line misses its expiry, drop it or replace it with a verified retrospective line.

## Validation before enabling narration

Record event traces across normal phone play and bot/debug sessions. Review at least these scenarios: center-stage heavy hit without danger; normal jump; terrace descent; gap crossing; genuine recovery; same-tick trade; misses; train after opponent hit; unassisted fall; simultaneous draw; pause during synthesis; rematch while old audio arrives.

Review detected events against the actual footage or live action. Track false claims, duplicate stories, stale lines, speech occupancy, and event-to-audio delay. Tune for reliable highlights before adding event variety. No new gameplay mechanic is required to make this commentary work.
