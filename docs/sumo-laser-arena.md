# Sumo Laser Arena

Select **Sumo Laser Arena** in the **Mid** map group during host setup. Its map ID is `sumo`. For local play, select the map and use **Developer Playground → Start keyboard / bot match**.

The raised stage has open edges on all four sides, with no fences or rails. Crank, Sir Squish, and Bonk-3000 overlook the left, rear, and right sides at 3.2 times their fighter scale. The front stays clear, and this map uses a wider elevated camera.

Each giant locks a circular target for 1.5 seconds. The colored crosshair and shrinking countdown ring warn before a 0.45-second beam and impact flash. Targets stop following fighters once marked. Giants take turns every two seconds and each repeats every six seconds. Move outside the marked circle before it fires.

The simulation applies 18 damage, upward launch, directional knockback away from the giant, and brief stun once per fighter per shot. Entering an active beam can still cause a hit. Fighters outside the stage, below it, or above the impact volume are excluded. Hazards use the same hit events and phone feedback path as combat. Rendering reads simulation time so pausing freezes telegraphs and beams together.

Validation: `npm test` includes `test/sumo.test.js` covering target locking, warning timing, damage, knockback, late entry, once-per-shot damage, rearming, dodging, height exclusion, bounded targeting, reset, hit-event forwarding, skipped beam intervals, and all four ring-out boundaries.
