# Skyline Rooftop

Select **Skyline Rooftop** under **Mid** in the host's arena picker. The selection is remembered and locked during a match, like the other maps. Developer Playground supports keyboard testing without phones.

The approved compact concept is preserved under `art/prototypes/rooftop/approved-v1/`, including its GLB, source, preview, and standalone viewer. The original prototype also remains available. Neither copy is loaded by the game.

The game uses `host/assets/maps/skyline.glb`, derived from that saved concept with its scale mannequins removed and roof surface aligned to Y=0. The live map is 25% larger along X and Z (27.9 by 20.88 m, 56.25% more area); heights and fighter size remain unchanged. `shared/rooftop-config.js` controls that footprint multiplier, applied to both visual assets and collision hulls by the rebuild script. It retains the split levels, incline, stairs, bridge, HVAC units, ducts, skylights, exhaust obstacles, rear service spine, and four open drop edges. The back edge is flush with the service structures, without a lower rear walkway.

`node scripts/build-rooftop.mjs` regenerates the game GLB and `host/src/rooftop-hulls.js` together from the approved source. Structural meshes provide conservative collision hulls; the incline and skylights use sloped top surfaces. Small surface markings, fan blades, windows, and antenna details are cosmetic. Cylindrical vents use conservative rectangular hulls. The simulation resolves sides, continuous ramp heights, stair risers, landings, overhead contacts, and falls. Other maps retain their existing movement logic.

Skyline has a higher camera angle and fades obstructing foreground meshes to keep fighters visible. The surrounding city is visual only, batched into two instanced draws, with its ground below the elimination height. The model and city load once and are reused when switching maps.

Checks: `node --test test/rooftop.test.js test/maps.test.js test/camera.test.js test/simulation.test.js`, plus `npm test` for the full suite. For browser QA, run the app on port 4175 and headless Chrome with CDP on port 9337, then run `node scripts/smoke-rooftop.mjs`. It checks selection, model loading, live keyboard input, rendering, and browser errors, and saves `art/prototypes/rooftop/gameplay.png`.

The developer bot uses a lazy grid search whose movement edges are checked by the live collision resolver. It detours around equipment, climbs the ramp and staircase, and replans every 0.8 seconds or when blocked. Clearance uses the selected fighter radius; routes avoid open roof edges. Navigation is rebuilt on map changes, rematches, and character size changes. `node --test test/bot.test.js` covers obstacle detours, both upper routes, body clearance, and reset behavior.

Collision recovery allows moving away from or sliding along an existing terrain overlap after a landing or knockback, while blocking deeper penetration. The gameplay build shifts the left skylight into the wider central lane and removes the low pipe and its supports beneath the bridge to eliminate gaps too narrow for a fighter. These changes are applied by the build script; the approved concept archive remains intact. `test/terrain-collision.test.js` covers escape paths, wall blocking, former pinch points, bridge traversal, and ramp/stair descent.
