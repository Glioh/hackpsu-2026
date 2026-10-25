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
COMMENTARY_DIALOGUE=0
ELEVENLABS_COMMENTARY_AGENT_ID=your_private_writer_agent_id
```

Use process environment variables, or a gitignored `.env`. Generation loads `.env` automatically. To run the server with that file use `node --env-file-if-exists=.env server/index.js`. Restart after changing configuration. `COMMENTARY_LIVE=1` permits paid runtime ElevenLabs speech calls. `COMMENTARY_DIALOGUE=1` separately permits paid ElevenLabs Agents conversations that write fresh dialogue. Both use the same ElevenLabs API key; no OpenAI key is needed. Set two distinct intended voice IDs to hear distinct narrators. Missing services retain the existing script bank, browser speech fallback, and captions.

## Fresh dialogue with ElevenLabs

Create a dedicated private ElevenLabs Agent for the writer. In its Security settings enable overrides for **System prompt**, **First message**, and **Text-only mode**. Enable the `agent_response` client event. The server overrides the writer prompt, suppresses the opening greeting, and runs the conversation in text-only mode; it speaks no audio itself. Select the writer's language model in ElevenLabs. Use a writer without external tools or workflows. Configure its agent ID above, set `COMMENTARY_DIALOGUE=1`, and set `COMMENTARY_LIVE=1` for ElevenLabs voices. The key needs access to that agent and speech synthesis. [Chat mode](https://elevenlabs.io/docs/eleven-agents/guides/chat-mode), [override settings](https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides).

For each selected story, one writer receives the current map, selected characters, fighter damage and grounded state, event and hazard, resolved winner, and up to twelve completed narrator turns. It writes a short Rex/Vera exchange whose second line responds to the first. Server validation limits each line to twenty words and 180 characters, checks speaker order, and rejects normalized repeats against the supplied transcript and forty recently generated lines. A duplicate or invalid pair gets one regeneration attempt. This creates varied exchanges, but cannot guarantee unlimited semantic uniqueness. Canceled or unfinished turns never enter the completed transcript.

The server obtains a private signed WebSocket URL, sends validated context to the ElevenLabs Agent, and closes the connection after the response. Generation is host-only, limited to one request at a time and one start per eight seconds, with a five-second total deadline. Generated speech IDs are server-owned, single-use, and expire after 45 seconds; the browser cannot send arbitrary text directly to TTS. Selected game data and recent dialogue are sent to ElevenLabs; conversation retention follows the agent/account settings. [Agent WebSocket API](https://elevenlabs.io/docs/eleven-agents/api-reference/eleven-agents/websocket), [signed URLs](https://elevenlabs.io/docs/api-reference/conversations/get-signed-url).

Both voices share one playback owner. The reply starts only after every audio source for the first turn emits `ended`. Pausing, disabling, faceoff completion, a superseding result, rematching, and disconnecting cancel the current exchange. An old stream failure can stop only its own audio nodes. Generation errors, invalid output, missing configuration, and rate limits show a scripted-fallback status instead of claiming the dialogue is fresh.

Setup and live listening require ElevenLabs credentials and an agent in the operator's account. Neither is configured in this checkout. Automated checks use mocked agent WebSockets and synthetic PCM, not paid provider calls. See [research and rationale](commentary-dialogue-research.md).

## Generate and audition

1. Select two authorized original voices using the briefs in [voice direction](commentary-latency-and-voices.md). Audition normal, excited and dry delivery; prioritize clean consonants and complete word endings.
2. Configure the environment and run `npm run commentary:generate`. This intentionally incurs provider usage when credentials are present. The finite fallback bank includes both team colors, both speakers, and arena/character-specific variants in `shared/commentary-scripts.js`. No arbitrary browser text reaches synthesis. Plain scripts use no model-specific performance tags by default.
3. Start the server with the same voice/model settings and visit `/host/commentary-audition.html`. Each complete clip has native audio controls. Review loudness, excess silence, diction, personality and repetition. The workflow is generate/cache, human audition, then use; it does not automatically score or normalize voices.
4. Clips and `manifest.json` live in `host/audio/commentary/`. Cache identity includes full script metadata, voice, model, format and mix version, excluding the API key. Restart/reload after regeneration. Only matching cache entries appear in the catalog. To audition another take, remove its hashed MP3 and regenerate. You may trim/normalize the MP3 offline and adjust its manifest offset (seconds); do not splice names into phrases. Ship only reviewed audio. Generated artifacts are ignored by git; package your approved directory separately for a demo.

Generation uses MP3 44.1 kHz/128 kbps. A three-worker loader downloads and fully decodes the bank outside simulation; playback uses AudioBufferSourceNode. Wait for the ready count before starting an audio acceptance run. Preload begins on the first Start gesture. If ElevenLabs audio is unavailable, existing browser speech can read the scripts; those are device voices rather than the configured ElevenLabs voices.

## Runtime architecture and limits

The host observes every fixed physics tick. Fighter hits explicitly include attacker, victim, attack ID, pre-contact states and post-launch state. Map shoves and train impacts explicitly identify hazards; train IDs include lane/pass. Damage is accumulated launch vulnerability, never remaining health. The detector recognizes heavy hits (15+ damage), three unanswered hits in four seconds, same-tick trades, two-hit pressure reversals, train impacts, resolved ring-outs/draws and quiet intervals. Quiet jokes require ten seconds without contact and grounded, unstunned fighters, then thirty seconds between jokes. Ordinary jumping and terrace descent cannot generate invented danger/save calls. Geometry-dependent saves, danger, escapes and whiff punishes remain deliberately deferred, as recommended by the research.

One director owns both voices, recent script memory, one active exchange and at most one pending story. Priorities collapse overlapping stories; finishes interrupt speech and replace pending chatter. Scripted events expire in 1.5 seconds, streaks/reversals in three; fresh dialogue gets a five-second preparation window, results eight seconds. A two-second gap after each exchange limits occupancy. The fallback bank prefers fresh arena/character-specific lines and remembers 128 recent IDs across rematches. Eight seconds / eighty hits of source history supports conservative finish wording. A train finish says it followed a collision, without claiming another fighter deliberately caused it.

Pause, hidden-tab pause, lobby, disconnect and rematch cancel playback and pending generation. Generation tokens prevent an old promise from changing new-round state; detector time freezes while paused. Rematch clears the shared transcript while retaining script freshness memory. Results are detected before the existing finish tableau; simulation and presentation timing are unchanged.

The backend uses the [documented ElevenLabs HTTP streaming TTS endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/stream), without deprecated `optimize_streaming_latency`. Flash v2.5 is the configurable baseline. An authenticated socket host obtains a private bearer token; controllers cannot obtain one. Speech accepts finite script IDs or the host's unexpired generated IDs. There is one active speech request per host, a seven-second server timeout, and twelve seconds of maximum audio. Static scripts are rate-limited to five seconds; single-use generated IDs permit the immediate second speaker. Provider failures do not expose provider bodies or credentials. Disconnect revokes tokens and aborts provider requests.

Live synthesis requests signed little-endian mono `pcm_24000`. Browser playback preserves odd-byte chunk boundaries, converts int16 to Float32, and lets Web Audio resample native 24 kHz buffers to the output device. It schedules chunks on one timeline with an initial 80 ms lead and at most approximately one second of buffered speech. HTTP backpressure bounds buffering. It does not feed incomplete MP3 fragments to decodeAudioData. Cancellation stops all scheduled sources and aborts fetch. First-audio expiry is checked before scheduling; normal event expiry can cancel a slow provider. Device suspension/jitter can still produce gaps: this path needs real-network listening tests before enabling it at a live demo. No warm-WebSocket comparison or AudioWorklet implementation is claimed.

## Validation and latency

Run `npm test` for gameplay and commentary regression checks. New checks cover stalled audio clocks, every streamed chunk ending before the reply, canceled old streams, shared transcript delivery, late-generation cancellation, duplicate rejection, host authorization, one-time speech IDs, and missing provider configuration. The audio regressions fail against the previous timeout-based player. Full validation totals are recorded with the completed change rather than inferred from historical results below.

Practical headless Chrome validation on this worktree: rendered keyboard/bot game; captions and missing-bank status; lobby/start round cleanup; fullscreen caption placement; no page errors. Synthetic WAV playback exercised actual decoding and AudioBufferSource scheduling, followed by pause clearing captions. A second browser test streamed synthetic 24 kHz PCM with odd-byte chunk boundaries, scheduled its first buffer in 1.1 ms, and cleared captions on pause; this used a mocked provider, not the network or an ElevenLabs voice. One synthetic local sample measured 0.4 ms from detector delivery to scheduling, with browser-reported base latency 10 ms and output latency 32 ms. These are single-run software observations, not event-to-audible latency or a percentile benchmark, and not an ElevenLabs audition.

Not measured: actual voice quality, provider latency, live-account format/model access, network jitter/underruns, physical speaker onset, phone multiplayer listening, wired/HDMI/Bluetooth differences, Flash vs v4, or thirty-trial p50/p95 results. The under-100-ms local onset and sub-second live goals in the research remain targets. Capture audio loopback with the real game active and both voices before making end-to-end claims. The implementation records bounded local scheduling / live first-scheduling metrics internally; clocks are host-local and never subtracted from server timestamps.
