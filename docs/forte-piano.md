# Forte Grand Piano

Choose **Forte Grand Piano** in the main game's arena picker. Start a phone match or use Developer Playground to start a keyboard / bot match. The 84 m keyboard has 88 correctly pitched keys (A0–C8). Walking or landing on a new key plays a synthesized piano tone. Jumping and landing retriggers it. Audio unlocks after a host click or keypress.

The concert grand includes an asymmetric lacquered case, curved soundboard, raised lid, brass strings, felt strip, music desk, tapered legs, casters, and three pedals. Shared key dimensions drive rendering and collision. Black keys are raised jump obstacles. The soundboard is walkable and open edges support ring-outs. Standard combat, phone controls, rematches, and bot navigation use the game systems.

The standalone preview remains available through a static server at `/art/prototypes/piano/`. Preview movement is separate from the game simulation. Regenerate its GLB with `node art/prototypes/piano/export.mjs`.

Rendering lives in `host/src/piano-model.js`; dimensions and pitches live in `shared/piano-layout.js`. Audio is synthesized rather than sampled. Run `node --test test/piano.test.js` for geometry and simulation checks. The browser smoke script uses game port 4186 and Chrome CDP port 9346.
