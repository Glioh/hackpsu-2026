# Twinspire

Choose **Twinspire** in the game's **Mid** arena group. Start a phone match or a keyboard / bot match from Developer Playground.

Red starts on the west rooftop at (-13, 0), blue on the east rooftop at (13, 0), facing each other. Two narrow bridges cross the six-meter void. Walking or getting knocked off a roof or bridge causes a normal ring-out. Access rooms and HVAC equipment block movement; the service stairs lead to raised decks. Bots route across bridges with extra clearance from the open drop.

The prototype and live game use the same model in `host/src/twinspire-model.js`. Structural dimensions in `shared/twinspire-layout.js` drive both visible meshes and collision. Static prototype fighters are omitted in game; the normal selected characters are used. Elevated camera framing follows both players, and foreground structures fade when they obscure a fighter.

The standalone orbit preview remains at `/art/prototypes/twinspire/` when served from the repository root. Regenerate its downloadable model with `node art/prototypes/twinspire/export.mjs`.

Run `node --test test/twinspire.test.js` to verify opposing spawns, both crossings, open-edge ring-outs, equipment collision, stairs, bot pursuit, and visual/collision agreement.
