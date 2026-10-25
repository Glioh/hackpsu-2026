# Twinspire — opposing skyscrapers

Standalone Three.js map prototype following the train station and Skyline rooftop studies.

From the repository root run `python -m http.server 4174 --bind 127.0.0.1` and open http://localhost:4174/art/prototypes/twinspire/ . Uses the installed Three.js dependency, without a CDN.

Two 16 × 20 m rooftops sit on 36 m towers with a 6 m void between them. Red spawns on the west skyscraper at (-13, 0, 0); blue spawns on the east skyscraper at (13, 0, 0). Both face the opposing tower. Colored rings and fighter mannequins mark the starts. Two 2.3 m wide skybridges provide alternate approaches; their exposed sides create knock-off opportunities. Rooftop access rooms, raised HVAC decks, and stairs interrupt the rear lanes while the center remains clear.

Orbit, zoom, pan, or choose perspective, map, player-height, and individual spawn views. Download `twinspire.glb` for the reusable model, including spawn metadata in the root extras. Regenerate it with `node art/prototypes/twinspire/export.mjs`. Surrounding city context is preview-only.

This page is a visual review prototype with static player mannequins. The map is also integrated into the game: select **Twinspire** in the **Mid** arena group for live combat, opposing spawns, terrain collision, bridge traversal, ring-outs, and bot support. See `docs/twinspire.md`. The preview and game share the model and structural dimensions.
