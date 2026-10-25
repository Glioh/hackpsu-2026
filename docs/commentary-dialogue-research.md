# Context-aware two-host game commentary

Research checked 2026-10-25. This document records the design recommendation; configuration and live-provider testing must be verified separately.

## Starting point

The previous `host/src/commentary.js` selected entries from a finite script bank. Alternating speakers and avoiding recent IDs could not make the second host understand the first. The live endpoint in `server/commentary.js` meant speech synthesis, not new writing. Both narrator voice defaults were also the same ID; distinct configured voice IDs are needed for distinct voices.

ElevenLabs Text to Dialogue converts supplied text/voice pairs into audio. Its continuity fields condition delivery; they do not supply a game-aware writing system. Its `previous_text` field is limited to 100 characters and described as prosodic continuity. Therefore a shared writer must produce the words before speech synthesis. [ElevenLabs dialogue API](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert)

## Recommended minimum design

Use one conversation director and one server-side writer, with two named speaker personas. This is an architectural recommendation, not an API requirement. Two autonomous voice agents add synchronization without adding knowledge that a shared transcript cannot provide.

For each selected game event, provide the writer with validated map and fighter facts, event evidence, current round, both personas, and the recent transcript labeled with speaker names. Ask for two brief alternating turns: a game observation, then a reply to that observation. Permit friendly disagreement, callbacks, and direct references to the other host; prohibit invented hits, outcomes, player intentions, and claims that a prediction has already happened. Keep names and game data separate from instructions.

ElevenLabs Agents can run in chat mode with no audio input or output, receive text messages, and return an `agent_response`. One text-only agent can therefore write both hosts' lines while the existing ElevenLabs TTS voices speak them. The application sends the shared transcript and game facts in each text message, excluding canceled or unfinished turns. No separate OpenAI key, vector database, or agent-memory service is needed. [ElevenLabs chat mode](https://elevenlabs.io/docs/eleven-agents/guides/chat-mode), [Agent WebSocket API](https://elevenlabs.io/docs/eleven-agents/api-reference/eleven-agents/websocket).

Request raw JSON containing `lead` and `reply`, each with speaker `a` or `b` and a short text string. Validate speaker order, length, characters, and duplicate text on the server. Invalid JSON, refusal, missing output, and timeout must fall back safely. Prompted JSON is not provider-enforced schema compliance, and neither JSON validation nor prompting guarantees factual truth. This validation policy is an application design choice.

## No narrator overlap

Only the director may start speech. Keep its busy state until actual audio completion, including every scheduled PCM chunk. The Web Audio specification defines `ended` on scheduled sources; `stop()` stops an active source or prevents a future scheduled start. Use these audio lifecycle signals rather than wall-clock estimates of clip duration. AudioContext suspension can make a timeout expire before sound finishes. [Web Audio specification](https://www.w3.org/TR/webaudio-1.1/#AudioScheduledSourceNode)

On pause, reset, disable, disconnect, or a result that supersedes current commentary, invalidate the generation, abort its request, and stop all its scheduled sources. Every asynchronous continuation must check that it still owns the active generation. A late response must never start new audio or stop a newer exchange. Preserve transcript only for turns actually presented, and identify interrupted speech if partial turns are retained.

Keep the existing per-turn ElevenLabs streaming path for deterministic sequential playback and per-speaker captions. The TTS request accepts the text, selected voice ID, and optional previous text; streaming reduces waiting for a complete file. The provider documents continuity fields for concatenated generations. This is speech continuity, separate from the writer's semantic transcript. [ElevenLabs streaming TTS API](https://elevenlabs.io/docs/api-reference/text-to-speech/stream)

## Freshness, latency, and limits

Generate fresh text for each exchange rather than choosing a prerecorded script. Send recent dialogue as explicit anti-repetition context, vary which host opens, and reject recently repeated normalized lines. A second host should add a response, correction, or joke rather than restate the event. These are application-level design choices. Fresh generation cannot guarantee that every interaction will be semantically unique forever; bounded repetition checks can give a concrete, testable guarantee.

Keep exchanges short and request only selected events, not every simulation frame. Bound input history, output length, pending events, request time, and per-host request rate. Drop stale observations rather than narrating an obsolete event after synthesis. Retain captions and a clearly identified finite-script fallback when generation or audio is unavailable; do not describe fallback as unique generated dialogue.

Text generation adds latency and usage charges before the existing speech request. Measure event-to-first-audio and exchange duration in this app; provider marketing latency is not an end-to-end guarantee. No cost figure or account/model availability is assumed here.

## Credentials and trust boundary

An ElevenLabs API key with the required account permissions supports both the writer agent and TTS. A dedicated private writer agent must also exist in that account. Keep the key on the server, obtain its signed WebSocket URL server-side, and preserve host authorization and bounded requests. The signed URL must also remain server-side in this implementation. [ElevenLabs signed URLs](https://elevenlabs.io/docs/api-reference/conversations/get-signed-url).

The integration uses `COMMENTARY_DIALOGUE=1`, `ELEVENLABS_API_KEY`, and `ELEVENLABS_COMMENTARY_AGENT_ID` to opt into writing. `COMMENTARY_LIVE=1` separately enables ElevenLabs speech with `ELEVENLABS_VOICE_A` and `ELEVENLABS_VOICE_B`. The writer's model is selected in ElevenLabs. Generated dialogue can still appear as captions or browser speech when live TTS is disabled. Never put the key in browser configuration.

The server uses runtime overrides for its writer prompt, empty first message, and text-only mode. Those overrides are disabled by default and must be enabled in the agent's Security settings. Configure `agent_response` events and keep the writer free of external tools or workflows. Actual model availability, latency, retention, and usage charges depend on the ElevenLabs account. [ElevenLabs overrides](https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides).

## Acceptance checks

- While host A's audio remains active, host B cannot start, even when wall-clock time advances or AudioContext suspends.
- Reset or pause during fetch, decode, or playback prevents all late audio and transcript mutations.
- Each writer request includes both hosts' recent presented dialogue and current validated game facts.
- An exchange contains two allowed, alternating speakers; repeated or oversized generated lines are rejected.
- Missing credentials, provider errors, malformed responses, and stalled audio cannot block gameplay.
- Listening checks confirm two intended voices, natural replies, and callbacks without invented game events.
