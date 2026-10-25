# Live Gemini commentary

The game has one announcer. Gemini writes a fresh, short reaction to a real game event; the same text appears as a caption and is spoken through the configured ElevenLabs voice. The countdown uses cached voice clips preloaded in the lobby so starting a match never waits for Gemini. Missing clips leave the visual countdown active without substituting a browser voice.

## Setup

Create a [Gemini API key in Google AI Studio](https://aistudio.google.com/api-keys). Add it to the gitignored `.env` file on the game server, together with the existing ElevenLabs configuration:

```dotenv
GEMINI_API_KEY=your_private_gemini_key
GEMINI_MODEL=gemini-3.5-flash-lite
COMMENTARY_DIALOGUE=1
ELEVENLABS_API_KEY=your_private_speech_key
ELEVENLABS_VOICE_A=your_selected_voice_id
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
COMMENTARY_LIVE=1
```

`GOOGLE_API_KEY` is accepted when `GEMINI_API_KEY` is absent. Only `ELEVENLABS_VOICE_A` is used; no second voice or ElevenLabs Agent is required. Both `ELEVENLABS_VOICE_A` and `ELEVENLABS_MODEL_ID` must be set explicitly; the server never substitutes a default voice or model. The Gemini model can be overridden using `GEMINI_MODEL`.

Run `npm start`, then open http://localhost:3000 and start a match. Both `npm start` and `npm run dev` load `.env`. Restart the server and refresh the host after changing credentials. In the host's commentary settings, successful generation shows **Gemini live commentary**.

For Render or another Node host, set the same variables in the game server's environment and deploy the updated code. A browser-only proxy cannot hold these credentials. Cloudflare deployments forward these Worker secrets/variables to the Node container and permit outbound requests to Gemini and ElevenLabs. Local `.env` files are not copied into the Docker image.

## How it works

1. `host/src/commentary.js` detects game events: heavy hits, pressure, counters, hazards, quiet play and match results. Selection favors fresh lines matching the active arena and characters.
2. `host/src/commentary-audio.js` sends an authenticated request to `/api/commentary/dialogue` with the event, actual resolved arena, selected characters, damage, grounded state, remaining lives, winner and up to twelve completed commentary lines. Random Map uses the resolved arena ID.
3. `server/commentary-dialogue.js` calls the [Gemini generateContent API](https://ai.google.dev/api/generate-content) with a rapid-fire single-announcer prompt and [structured JSON output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output). The default is [Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite). Only validated game fields are forwarded; characters and arenas are identified using the game's own roster.
4. The server validates a single line of at most sixteen words and 180 characters. The announcer uses quick, playful roasts aimed at the losing team, controller coordination and in-game fumbles. Exact normalized repeats and reused four-word phrases are rejected against the transcript and the session's recent generated text, with one retry. A winner claim is rejected while `game.winner` is unset. A nonfinal ring-out produces a life-loss event so Gemini can roast the team that fell without falsely announcing a winner. The prompt explains that damage is launch vulnerability and each fighter starts with two lives. These checks constrain output, but do not guarantee every generated description is factually correct.
5. The browser displays the generated text and requests its server-owned speech ID. ElevenLabs converts that exact text to the selected `ELEVENLABS_VOICE_A`, using `ELEVENLABS_MODEL_ID` with speech speed 1.15; the client schedules streamed 24 kHz PCM using Web Audio. No API keys reach the browser.

Only room hosts can authorize generation or speech. Generated IDs belong to that host, expire after 45 seconds and are consumed once. Arbitrary browser-supplied text cannot be sent directly to speech synthesis. Gemini receives the selected game facts and recent commentary; ElevenLabs receives the selected spoken text.

## Timing and fallback

Generation is limited to one active request per host. Normal events can request a new line every 2.5 seconds; losing a life or ending the match can take priority after one second. Completed generated lines leave a 0.35-second gap. The client allows 4.5 seconds for generation; the server aborts after five seconds.

In generated mode, Gemini supplies every commentary line and ElevenLabs only voices that text. Cooldowns, missing credentials, errors and rejected output skip a line rather than replaying canned commentary. Recent history and up to forty recently generated lines help avoid repeats; each request also varies its comic angle. Cached audio is loaded only for the countdown in this mode. Set `COMMENTARY_DIALOGUE=0` explicitly to opt into the older scripted mode.

The simulation continues while generation runs. Pausing, returning to the lobby, disconnecting or starting another round invalidates pending commentary. Stale generated text cannot replace the current round's captions or audio. Only completed playback enters the shared transcript. The countdown is always local and never generated by Gemini.

`COMMENTARY_LIVE=1` enables ElevenLabs speech for newly generated lines. Commentary captions appear only after matching voice audio is scheduled, and clear when that playback finishes or is canceled. Missing, empty or failed speech skips the line rather than displaying an unspoken caption; the voice status explains the failure. Muting commentary skips these lines. Failed speech never swaps to a browser voice. Disabling Gemini does not disable the existing cached voice bank. Use `/host/commentary-audition.html` to listen to cached lines.

## Verification

Run:

```sh
node --test test/commentary.test.js test/commentary-dialogue.test.js test/commentary-audio.test.js test/commentary-speech.test.js test/map-preview.test.js
```

Tests cover Gemini request structure and facts, one announcer, matching captions and speech, credential isolation, response validation, duplicate rejection, premature winner claims, host authorization, generation throttling, one-time speech IDs, fallback, cancellation and late responses. Provider HTTP responses and Web Audio are mocked in these automated tests. A real Gemini request and listening test require a configured key; automated test success alone does not establish provider availability or audible latency.
