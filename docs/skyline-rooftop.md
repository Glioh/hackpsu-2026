# Skyline Rooftop

Select **Skyline Rooftop** under **Mid** in the host's arena picker. The selection is remembered and locked during a match, like the other maps. Developer Playground supports keyboard testing without phones.

The approved compact concept is preserved under `art/prototypes/rooftop/approved-v1/`, including its GLB, source, preview, and standalone viewer. The original prototype also remains available. Neither copy is loaded by the game.

The game uses `host/assets/maps/skyline.glb`, derived from that saved concept with its scale mannequins removed and roof surface aligned to Y=0. It retains the split levels, incline, stairs, bridge, HVAC units, ducts, skylights, exhaust obstacles, rear service spine, and four open drop edges. The back edge is flush with the service structures, without a lower rear walkway.

`node scripts/build-rooftop.mjs` regenerates the game GLB and `host/src/rooftop-hulls.js` together from the approved source. Structural meshes provide conservative collision hulls; the incline and skylights use sloped top surfaces. Small surface markings, fan blades, windows, and antenna details are cosmetic. Cylindrical vents use conservative rectangular hulls. The simulation resolves sides, continuous ramp heights, stair risers, landings, overhead contacts, and falls. Other maps retain their existing movement logic.

Skyline has a higher camera angle and fades obstructing foreground meshes to keep fighters visible. The surrounding city is visual only, batched into two instanced draws, with its ground below the elimination height. The model and city load once and are reused when switching maps.

Checks: `node --test test/rooftop.test.js test/maps.test.js test/camera.test.js test/simulation.test.js`, plus `npm test` for the full suite. For browser QA, run the app on port 4175 and headless Chrome with CDP on port 9337, then run `node scripts/smoke-rooftop.mjs`. It checks selection, model loading, live keyboard input, rendering, and browser errors, and saves `art/prototypes/rooftop/gameplay.png`.
