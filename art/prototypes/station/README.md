# Crossline — train station concept

Standalone Three.js mockup following the Skyline rooftop concept format. From the repository root run `python -m http.server 4174 --bind 127.0.0.1` and open http://localhost:4174/art/prototypes/station/ . Uses the installed Three.js dependency without a CDN.

The central 30 × 11m island is flanked by sunken tracks in front and behind. Rear trains move left to right; front trains move right to left. Each line independently picks a random 5?18 second clear gap after every eight-second pass, with three seconds of amber signal warning before arrival. Initial arrivals are randomized between 4 and 12 seconds. The station footprint is 40% larger in both horizontal directions (96% more platform area), preserving fighter and train scale and the original elevations. Pause the animation or use Show both trains to inspect their scale.

The layout has a +0.6m base platform, +1.9m west waiting terrace, +1.4m luggage podium, and +4.9m overhead footbridge. Broad stairs connect the levels, while benches, ticket machine, and luggage interrupt the fighting lanes. The hall is a cutaway with open steel ribs so the arena remains visible. Two mannequins indicate fighter scale.

Orbit, zoom, pan, and switch between perspective, top, and player-height camera views. Download `station.glb` for a reusable static model, including both trains. Regenerate with `node art/prototypes/station/export.mjs`. Train movement is in the preview, not embedded in the GLB.

This remains the standalone visual review prototype. The playable version is now available as **Crossline Station** in the game map picker, with solid collision and randomized train impacts. See `docs/crossline-station.md`; rebuild its model and collision with `node scripts/build-station.mjs`.
