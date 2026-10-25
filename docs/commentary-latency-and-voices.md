# Commentary: minimum latency and broadcast voice direction

Researched October 25, 2026. This is a proposed design, not an implemented or benchmarked audio pipeline. Companion: [event research](commentary-research.md).

## Decision

Use directed, pre-generated ElevenLabs audio for urgent reactions, prefetch contextual lines before likely outcomes, and reserve live synthesis for genuinely new commentary. Run one commentary director and two consistent voices. Compare v4 Turbo against Flash using the same voices and scripts. Do not choose solely on advertised inference latency.

The reference pair is Scotty and June. We can target their polished game-show broadcast feel, contrasting personalities, and confident articulation. Exact vocal identity and exact delivery cannot be guaranteed by a prompt; that would require appropriate access to the original voice assets/performers and a matching production process. The voice briefs below specify original hosts rather than claiming to reproduce the actual performers.

## What the sources establish

- [RDY Creative's production account](https://www.wearerdy.com/project-spotlight) confirms casting, recording, voice direction, and post-production for THE FINALS' commentators. That makes directed performance a useful reference for our process. It does not publish Embark's synthesis configuration or audio-processing chain.
- [ElevenLabs models](https://elevenlabs.io/docs/overview/models) currently lists Flash v2.5 at about 75 ms inference and v4 Turbo at about 100 ms median inference. v4 Turbo supports expressive direction. These are provider figures, not measured event-to-speaker latency for this project.
- [TTS versus dialogue WebSockets](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/tts-vs-ttd-websockets) distinguishes model-specific endpoints. v4 Turbo permits one registered voice per dialogue connection; full v4 supports multiple voices. Use two Turbo connections for two hosts, subject to available dialogue-session quota.
- [Realtime dialogue guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd) documents explicit flushing for short inputs, turn boundaries, and keep-alive messages. A short call should not wait indefinitely for the server's text threshold.
- [Streaming concepts](https://elevenlabs.io/docs/eleven-api/concepts/audio-streaming) explains why early token-by-token synthesis can trade natural sentence prosody for faster onset. Complete short clauses are a useful compromise for announcers.

## Three audio paths

### 1. Local reactions: best latency and most exact direction

Prepare complete lines in advance, audition takes, trim excess leading silence, normalize levels, and load/decode a curated bank before the round. On an event, select an already-decoded buffer and play it on the host. No runtime network or text generation is involved.

Initial bank: approximately 80-120 approved individual clips covering both team colors, starts, heavy hits, pressure, trades, saves, train impacts, ring-outs, draws, and a small set of replies. Use several emotional intensities. Prioritize event coverage before multiplying every map/character combination. Store whole utterances; avoid cutting names and generic sentence fragments together.

An engineering target for an idle speaker slot is under 100 ms from confirmed event to audible onset on the demo setup, subject to actual browser/device/output latency. This is not a measured claim. A local clip cannot speak immediately if the director intentionally lets an existing line finish.

Memory estimate: 100 mono clips averaging 3 s at 48 kHz occupy about 58 MB as decoded Float32 samples. Compressed download size is smaller. Decode only the active map's essential bank plus core calls; defer flavor. The catalog should carry text, speaker, event, intensity, team/map constraints, duration, leading-silence offset, and cache version.

### 2. Prefetched contextual lines: personalized but ready before the event

At lobby/round start, generate introductions, team/character mentions, and both possible winner lines. At a meaningful stable state change, prepare one likely contextual observation or paired reply asynchronously. Cache against voice ID, model, script, settings, pronunciation version, and audio mix version.

Speculation must never become premature speech. Prepare both winner variants, but play only the confirmed winner. A prepared recovery call requires an actual verified recovery. Bound speculative requests and cancel obsolete work; do not synthesize every hypothetical outcome every frame.

Use cached name-specific lines only if the names are known before the round and have been pronunciation-checked. Our current red/blue teams make a finite, high-quality bank much easier than arbitrary usernames.

### 3. Live synthesis: new observations and banter

Path: host detects event -> persistent backend channel -> bounded writer/template -> provider stream -> binary relay -> host audio player. Keep credentials on the backend. Skip speech recognition and voice-activity detection: this is telemetry-driven narration.

Start benchmarking v4 Turbo for expressive live speech and Flash v2.5 as the speed baseline/fallback. Use independently selected streams and a shared playback timeline. Availability, session quotas, accepted formats, and settings must be verified against the actual account before implementation.

For full short template text, benchmark HTTP streaming with reused connections against warm WebSockets. WebSockets are not inherently the lowest-latency choice for every complete-text request. For incremental writer output, stream coherent clauses and explicitly end/flush them using the selected endpoint's documented protocol. Do not send v4 tags or v4 protocol fields to Flash blindly.

## Remove avoidable delay

1. **Detect on the host.** Observe each fixed simulation step, not a server round trip or periodic screen capture. At 60 Hz, a primitive event has roughly 0-16.7 ms tick alignment, before rendering/frame scheduling effects. A three-hit streak only exists after the third hit; a save may require deliberate confirmation time.
2. **Do not await audio in combat.** Enqueue event facts after each step. Keep writing, provider I/O, decoding, and playback separate from physics.
3. **Warm connections in the lobby.** Initialize actual streams once needed, keep them alive as documented, reconnect proactively, and avoid fresh DNS/TLS/session setup per line. Avoid a useless paid generation just to claim the connection is warm.
4. **Use one backend hop.** Reuse the existing Node service path where feasible. Ensure proxy layers flush chunks rather than aggregate the full response. Prefer a backend region with low measured combined host-to-backend and backend-to-provider delay; test local Node as a demo baseline too.
5. **Bound the writer.** Templates for immediate calls, a compact structured context for novel analysis, a short output limit, and no research/tools/reasoning loop per hit. Prepare the second host's reply while the first speaks.
6. **Stream playback correctly.** Avoid collecting all chunks into a Blob before playing. For PCM, use a bounded worklet queue with explicit sample rate and resampling, correct sample framing, and a small adaptive startup buffer. Test 40, 80, and 120 ms buffering; select the smallest stable value under real network jitter.
7. **Control the queue.** One active line and at most one pending story. Drop stale action chatter, invalidate old round IDs, and let confirmed finishes replace pending banter. When interrupting, stop current playback and ignore remaining chunks from the cancelled generation.
8. **Measure the output device.** Use laptop/wired audio as a baseline. Bluetooth, HDMI/projector processing, browser suspension, and sound-system DSP can hide improvements in TTS time.

[MDN AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) documents processing on a separate Web Audio thread. [MDN decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData) requires complete file data, so it is suitable for preloading clips but not decoding arbitrary MP3 response fragments individually. [AudioContext options](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext) allows an interactive latency hint; it is a request, not a hardware guarantee. Unlock/resume audio from the Start button's user gesture.

[The stream API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/stream) marks `optimize_streaming_latency` deprecated. Do not make old blog advice to set it to 4 the basis of our implementation. Use currently supported endpoints and settings. For PCM, verify sample-rate/plan support; mono 24 kHz 16-bit PCM is about 48 KB/s before transport overhead and can be adequate for speech if available.

## Voice design and articulation

These are creative direction hypotheses to audition, not measured acoustic descriptions of THE FINALS recordings.

### Host A: veteran showman

Voice Design prompt:

> An original male game-show sports commentator in his fifties. Warm resonant baritone, a lightly weathered texture, clear General American English. A charismatic former arena competitor who loves an audacious play and occasionally oversells his own expertise. Confident broadcast projection, crisp consonants, clean word endings, short deliberate pauses, and dynamic sentence emphasis. Friendly competitive excitement, with headroom to rise for a finish. Close-miked studio recording, dry clean audio. Conversational broadcast delivery between highlights.

Personality: loves commitment and power, tells brief self-aggrandizing stories, enjoys the other host's teasing, sincerely respects a great recovery. He should sound experienced even when the joke is that his advice is questionable.

### Host B: composed anchor with a mischievous edge

Voice Design prompt:

> An original female game-show sports broadcaster in her late thirties to forties. Clear warm mid-register voice, precise General American English, smooth bright presence, and excellent diction. An assured analytical anchor with restrained amusement and dry comic timing. Confident compact phrasing, controlled pace, clean consonants and sentence endings. A slight smile in playful lines, genuine energy for an unexpected reversal, never flat or dismissive. Close-miked studio recording, dry clean audio.

Personality: notices consequences, keeps the broadcast moving, punctures Host A's grandstanding with affection, occasionally delivers the sharper joke. She also gets excited; she is not just the person who corrects him.

[ElevenLabs Voice Design](https://elevenlabs.io/docs/eleven-creative/voices/voice-design) supports descriptive prompts and notes that preview text steers performance. Audition the same varied script with every candidate. A good voice must work at normal, excited, and dry delivery, not just win on one dramatic sample.

### Direct the line, not just the voice

For each line annotate intention, energy (1-5), emphasized word, pace, and intended handoff. Prefer one meaningful emphasis and one breath group for immediate calls. Start auditioning normal speech around 155-175 words/minute and highlights around 175-195, then adjust by intelligibility. These are audition targets, not measured reference rates.

Spell unusual terms and numbers explicitly in the speech script: `Bonk three thousand`, `one hundred percent`, `two unanswered hits`. Keep the display caption separately. Do not hand a voice the raw token `BONK-3000` and assume identical readings across models.

[Pronunciation dictionaries](https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/pronunciation-dictionaries) can define canonical name readings. Verify alias/phoneme support for the chosen model; support is not uniform. A dictionary fixes sounds, not an entire performance's rhythm.

For v4-family models, audition sparse tags such as `[excited]` or a concise delivery direction. [Official audio-tag guidance](https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4) confirms v4 Turbo support. Tags are direction, not a deterministic prosody score. Do not promise word-for-word timing or identical regenerated takes.

For compatible Flash settings, test stability around 0.4-0.6, style 0, speaker boost off, and speed near 1.0-1.08. These are trial values, not verified best settings. [The product guide](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech) says style exaggeration and speaker boost can add computation/latency. Do not assume those controls apply identically to v4 Turbo. Voice choice and actual performance must carry the style.

### Highest control for the cached bank

Record our own performer delivering original lines with the exact emphasis and timing we want, then use an appropriate selected voice through [ElevenLabs Voice Changer](https://elevenlabs.io/docs/overview/capabilities/voice-changer). The service is designed to preserve performance nuance while changing the voice. Generate and audition offline; retain only approved takes. This adds no runtime synthesis latency. A directed performer plus fixed audio is the practical route to reliably repeatable articulation.

## Chemistry, writing, and mix

Give the hosts shared history and recurring disagreements, with a small original fiction around their own arena show. Alternate who starts exchanges. Include supportive observations as well as jokes. Keep sponsors and lore sparse and original; never invent gameplay facts to land a joke.

Example original exchange, with explicit delivery notes:

- A, energy 4, stress BACK: "Blue makes it BACK! I thought that was the end!"
- B, energy 2, amused, brief pause after 'faith': "A little faith. There are two people working on it."
- A, energy 2, mock wounded: "And yet nobody listens when I give advice."

Use that length for occasional downtime, not every recovery. Most action gets a single compact call; an optional B reply can be 5-10 words. Begin with 120-250 ms handoff gaps as an audition choice, not a fixed rule or a measured THE FINALS value. Avoid artificial overlaps until clean sequencing works.

Build a clean dedicated dialogue bus. Match host loudness, use gentle compression/EQ/de-essing and a limiter as needed, and duck music under speech. Keep voices close and intelligible rather than applying a distant stadium PA effect. These are our proposed mix choices, not a claim about Embark's chain. Large reverb and excessive compression can obscure the consonants we are trying to preserve.

## Benchmark and acceptance plan

Track detector confirmation time, host send, backend receipt, writer first clause, provider request, provider first audio, host first audio bytes, playback scheduling, and estimated output time. Measure durations on each machine's monotonic clock; do not subtract unsynchronized client and server wall-clock timestamps. Capture actual audible onset via loopback/recording for the final result. First chunk arrival is not first audible speech, particularly if the chunk starts with silence.

Compare: local decoded clips; Flash full-text HTTP; warm Flash WebSocket; warm v4 Turbo dialogue sockets; each with template and generated text. Use both host voices and a balanced script set covering short calls, names, percentages, excited speech, and quiet replies. Measure cold and warm sessions, at least 30 trials per finalist condition, p50/p95, audio underruns, stale cancellations, and human-rated diction/personality. Test with the real 3D game active, not an idle benchmark page.

Initial design goals, not measured promises:

| Path | Event-to-audible target when no line already owns the slot |
| --- | --- |
| Predecoded local call | p95 under 100 ms on the demo audio setup |
| Warm live TTS, known text | p50 under 500 ms, p95 under 1 s |
| Generated contextual line | p50 under 1 s, with fallback/drop when stale |

The game's 1.8 s finish tableau creates a concrete requirement: a decisive call should begin during that tableau. Preloaded results are the dependable default. Do not wait for an LLM to discover who won, and do not slow gameplay to hide voice delay.

No provider calls, voice generations, source-audio auditions, or latency measurements were performed in this research pass. Exact reference-voice matching remains unverified.
