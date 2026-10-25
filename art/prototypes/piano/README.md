# Forte — grand piano arena

This prototype is now integrated into the main game as **Forte Grand Piano**, with an 88-key keyboard. See [current map documentation](../../../docs/forte-piano.md). The notes below describe the earlier standalone study.

Standalone Three.js visual map prototype, matching Twinspire's review workflow.

From the repository root run `python -m http.server 4174 --bind 127.0.0.1`, then open http://localhost:4174/art/prototypes/piano/ . Uses the installed Three.js dependency without a CDN.

An 84 m keyboard fronts a curved grand piano soundboard. Red and blue spawn markers sit at opposite ends of the ivory lane. The footprint is three times wider and deeper than the original prototype (nine times the area), while the player remains human-sized. Raised black keys repeat in groups of two and three; a rear action platform and short stairs offer an alternate route into the open soundboard. Brass strings, a raised lid, legs, and pedals establish the instrument silhouette. Open perimeter edges provide potential knock-off locations.

Orbit, zoom, pan, or choose perspective, map, player-height, and spawn views. Download `piano.glb` for the reusable model with spawn and route metadata. Regenerate it with `node art/prototypes/piano/export.mjs`. The concert stage is preview-only.

Click Play / enable sound, then use WASD or arrows to walk, Shift to run, Space to jump, and R to respawn. The camera follows movement while remaining orbitable. Landing on a white or black key plays its chromatic pitch (C2 through B5), with a decaying harmonic piano-like synthesis and a gold contact highlight. Moving off a key releases the highlight; jumping and landing can retrigger it. Audio runs locally through Web Audio after a user gesture.

This is a standalone interactive prototype, not integrated into the main game. Basic surface landing and fall respawn are implemented; full combat collision, sampled piano audio, and multiplayer are not.
