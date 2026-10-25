# Broadcast commentary

Rex (veteran showman) and Vera (composed, witty anchor) are original hosts. The scripts and voice briefs do not claim to reproduce Scotty, June, or their performers. Voice IDs are selected by the operator; the application does not create or clone identities.

## Run

`npm ci`, then `npm start`, then open http://localhost:3000. Start a keyboard/bot match in Developer Playground, or connect four phones. Commentary is host-only. Phones keep their existing hit feedback. The fullscreen arena contains commentary enable, voice mute, volume and caption controls. Captions work without provider credentials; missing clips never delay simulation. Start/rematch/resume gestures unlock Web Audio. The status reports the number of decoded clips.

Optional server environment (never put these values in shared files or browser code):

```
ELEVENLABS_API_KEY=your_private_key
ELEVENLABS_VOICE_A=your_original_showman_voice_id
ELEVENLABS_VOICE_B=your_original_anchor_voice_id
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
COMMENTARY_LIVE=0
```

Use process environment variables, or a gitignored `.env`. Generation loads `.env` automatically. To run the server with that file use `node --env-file-if-exists=.env server/index.js`. Restart after changing configuration. `COMMENTARY_LIVE=1` explicitly permits paid runtime provider calls. Both voice IDs and a key are required. There are no credentials in this worktree, and no generated voice bank is included. A failed provider request falls back to captions. No LLM, voice recognition, or video delay is needed.

## Generate and audition

1. Select two authorized original voices using the briefs in [voice direction](commentary-latency-and-voices.md). Audition normal, excited and dry delivery; prioritize clean consonants and complete word endings.
2. Configure the environment and run `npm run commentary:generate`. This intentionally incurs provider usage when credentials are present. The finite starter bank has 33 complete utterances, including both team colors and both speakers; expand approved variants in `shared/commentary-scripts.js` if needed. No arbitrary browser text reaches synthesis. Plain scripts use no model-specific performance tags by default.
3. Start the server with the same voice/model settings and visit `/host/commentary-audition.html`. Each complete clip has native audio controls. Review loudness, excess silence, diction, personality and repetition. The workflow is generate/cache, human audition, then use; it does not automatically score or normalize voices.
4. Clips and `manifest.json` live in `host/audio/commentary/`. Cache identity includes full script metadata, voice, model, format and mix version, excluding the API key. Restart/reload after regeneration. Only matching cache entries appear in the catalog. To audition another take, remove its hashed MP3 and regenerate. You may trim/normalize the MP3 offline and adjust its manifest offset (seconds); do not splice names into phrases. Ship only reviewed audio. Generated artifacts are ignored by git; package your approved directory separately for a demo.

Generation uses MP3 44.1 kHz/128 kbps. A three-worker loader downloads and fully decodes the small core bank outside simulation; playback uses AudioBufferSourceNode. Wait for the ready count before starting an audio acceptance run. Preload begins on the first Start gesture; the first round may use captions while files load. There are no bundled substitute browser voices pretending to be the selected hosts.

## Runtime architecture and limits

The host observes every fixed physics tick. Fighter hits explicitly include attacker, victim, attack ID, pre-contact states and post-launch state. Map shoves and train impacts explicitly identify hazards; train IDs include lane/pass. Damage is accumulated launch vulnerability, never remaining health. The detector recognizes heavy hits (15+ damage), three unanswered hits in four seconds, same-tick trades, two-hit pressure reversals, train impacts, resolved ring-outs/draws and quiet intervals. Quiet jokes require ten seconds without contact and grounded, unstunned fighters, then thirty seconds between jokes. Ordinary jumping and terrace descent cannot generate invented danger/save calls. Geometry-dependent saves, danger, escapes and whiff punishes remain deliberately deferred, as recommended by the research.

One director owns both voices, recent script memory, one active line and at most one pending story. Priorities collapse overlapping stories; finishes interrupt speech and replace pending chatter. Ordinary events expire in 1.5 seconds, streaks/reversals in three; results in eight seconds. A short gap after each line limits occupancy. No optional second speaker is forced into every event. The director prefers the other speaker on each exchange and uses least-recent selection within that speaker. Regression tests cover repeated events beyond the recent-memory length. Eight seconds / eighty hits of source history supports conservative finish wording. A train finish says it followed a collision, without claiming another fighter deliberately caused it. Fighter finishes announce winner/fall without claiming an unproven killing punch.

Pause, hidden-tab pause, lobby, disconnect and rematch cancel playback and pending generation. Generation tokens prevent an old promise from changing new-round state; detector time freezes while paused. Rematch clears history and script memory. Results are detected before the existing finish tableau; simulation and presentation timing are unchanged.

The backend uses the [documented ElevenLabs HTTP streaming TTS endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/stream), without deprecated `optimize_streaming_latency`. Flash v2.5 is the configurable baseline. Model availability must be checked against your account; unverified v4 dialogue protocols are not implemented. An authenticated socket host obtains a private bearer token for live requests. Controllers cannot obtain one. Only finite script IDs are accepted; one request per host, at least five seconds between requests, seven-second server timeout, and twelve seconds of maximum audio. Provider failures do not expose provider bodies or credentials. Disconnect revokes tokens and aborts the provider request.

Live synthesis requests signed little-endian mono `pcm_24000`. Browser playback preserves odd-byte chunk boundaries, converts int16 to Float32, and lets Web Audio resample native 24 kHz buffers to the output device. It schedules chunks on one timeline with an initial 80 ms lead and at most approximately one second of buffered speech. HTTP backpressure bounds buffering. It does not feed incomplete MP3 fragments to decodeAudioData. Cancellation stops all scheduled sources and aborts fetch. First-audio expiry is checked before scheduling; normal event expiry can cancel a slow provider. Device suspension/jitter can still produce gaps: this path needs real-network listening tests before enabling it at a live demo. No warm-WebSocket comparison or AudioWorklet implementation is claimed.

## Validation and latency

`npm test`: 131 tests pass, including fourteen commentary tests covering detector sequences, hazard/finish attribution, quiet/reset windows, bounded scheduling, stale expiry, old callback invalidation, provider request/cache behavior, host authorization/missing-config routes, streaming relay/rate limits, and real-simulation simultaneous-hit telemetry. `git diff --check` and changed module syntax checks pass. Existing physics, maps, station, rooms, controllers and lifecycle checks remain green.

Practical headless Chrome validation on this worktree: rendered keyboard/bot game; captions and missing-bank status; lobby/start round cleanup; fullscreen caption placement; no page errors. Synthetic WAV playback exercised actual decoding and AudioBufferSource scheduling, followed by pause clearing captions. A second browser test streamed synthetic 24 kHz PCM with odd-byte chunk boundaries, scheduled its first buffer in 1.1 ms, and cleared captions on pause; this used a mocked provider, not the network or an ElevenLabs voice. One synthetic local sample measured 0.4 ms from detector delivery to scheduling, with browser-reported base latency 10 ms and output latency 32 ms. These are single-run software observations, not event-to-audible latency or a percentile benchmark, and not an ElevenLabs audition.

Not measured: actual voice quality, provider latency, live-account format/model access, network jitter/underruns, physical speaker onset, phone multiplayer listening, wired/HDMI/Bluetooth differences, Flash vs v4, or thirty-trial p50/p95 results. The under-100-ms local onset and sub-second live goals in the research remain targets. Capture audio loopback with the real game active and both voices before making end-to-end claims. The implementation records bounded local scheduling / live first-scheduling metrics internally; clocks are host-local and never subtracted from server timestamps.
