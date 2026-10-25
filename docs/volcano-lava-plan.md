# Volcano lava arena plan

Updated requirement: the crust now breaks apart and falls into the lava. This supersedes the stable-platform requirements below. Nineteen outer chunks warn for two seconds, then fall one at a time from 10 seconds onward at 1.4-second intervals. A smaller central island remains; all chunks return on round reset. See `volcano-lava-validation.md` for current behavior and checks.

## Direction

Make the lava map feel like a fight inside an erupting volcano. Fighters stand on one stable, irregular island of cooling magma, surrounded by a molten lake. Tall, broken crater walls rise behind the arena. Bright lava waterfalls pour down those walls, while embers, ash, and glowing volcanic rocks fall from above.

The platform is a thick slab of dark magma crust with bright orange cracks, molten seams, and an incandescent underside. Its silhouette should be jagged and roughly oval, with asymmetric lobes rather than square corners. Keep the fighting surface readable and mostly level. The lava below moves; the platform does not repeatedly sink or disappear.

Keep map ID `lava` so existing selection and saved references still work. Suggested display name: **Volcano Crucible**.

## Current implementation

- `host/src/maps.js` creates a rectangular `grid('lava')`. Tiles warn for 1.2 seconds, become hot for 4 seconds, and launch grounded fighters. The lava map does not currently sink tiles; that behavior belongs to the separate `falling` map.
- `host/src/arena-view.js` draws the lava grid using generic box tops and bases. Dedicated map views already exist for archery, sumo, quake, and other arenas.
- `host/src/environment.js` assigns lava the outdoor industrial environment.
- `host/src/render.js` supplies a generic ground plane and camera framing; both need a lava-specific check so the volcano does not sit over a visible outdoor floor.
- Archery already demonstrates a custom nonrectangular `floorAt`, seeded falling hazards, fixed warning positions, impact timing, and a dedicated view. Follow that structure without introducing a generic hazard framework.

## Build sequence

### 1. Replace the grid with one shared magma outline

Add `shared/lava-layout.js` containing a fixed, ordered polygon and the few dimensions/timings used by both rendering and simulation. Start near the current arena footprint so movement and round length remain familiar. Give both spawn points equal room from the edge.

Add `host/src/lava-map.js` with `configureLava(arena, random)`. Keep one support piece with a bounding box for existing bounds consumers, but override `arena.floorAt(x, z, maxY)` using the actual polygon. Match the existing height-query convention. The renderer extrudes the exact same outline, so visible ledges and ring-out boundaries agree. Supply navigation bounds if required by existing bot navigation.

Remove the lava tile state cycle from `maps.js` and register the dedicated configurator. Keep the surface stable throughout the round. Crossing the outline causes the existing fall/ring-out behavior; the molten lake is scenery below the playable floor.

### 2. Build the crater and magma platform

Add `host/src/lava-view.js` and register it in `arena-view.js`, excluding lava from generic box rendering.

- Extruded jagged magma island: charcoal crust, bright branching cracks, glowing side fissures, and a hot lower rim. No visible tile seams.
- Broad animated lava lake below the island: slow directional flow, moving bright bands, and localized surface bursts. Use existing Three.js and procedural materials; no new dependencies or downloaded assets.
- Several tall, uneven basalt wall sections around the rear and sides, with a low/open foreground so fighters stay visible from the gameplay camera.
- Three to five prominent lava waterfalls at different heights and widths. Animate downward flow continuously; add bright splash pools where streams meet the lake.
- Small ember and ash particles, plus distant glowing rocks falling into the lake. Use shared geometry/materials and a fixed-size particle pool or instancing. Background debris never secretly damages fighters.

Build persistent scenery once. Reset round-specific effects on arena identity changes, hide the entire view when leaving lava, and bound/dispose transient resources using existing map-view conventions.

### 3. Give the platform fair volcanic hazards

Use two localized hazards instead of heating square tiles:

- **Magma vents:** a small crack patch brightens for about 1.2 seconds, then erupts once and applies the existing upward/outward hot-foot response to fighters inside its radius. The rest of the platform remains safe.
- **Volcanic bombs:** a large glowing rock falls toward a fixed marked circle. Show about 1.5 seconds of warning, animate the final descent, then apply one radial impact with a brief burst and capped camera shake. Start with grounded/low-height impact checks matching the established archery pattern, so jumping can evade the ground burst.

Keep hazard positions, warning/impact times, and hit resolution in the seeded simulation. The view only draws that state. Use existing hazard hit events, including their source and before/after data where required by combat consumers. Prevent repeated hits from a lingering visual effect.

Start with a quiet opening of roughly 3 seconds, then stagger vents and bombs. Shorten the interval gradually, with a hard limit on simultaneous active hazards. Sample warning centers far enough inside the polygon that the full damage circle fits. Keep an escape route and avoid covering both spawns at round start. Decorative debris can be visually intense without increasing gameplay damage.

### 4. Integrate lighting, framing, and map copy

- Add a dedicated lava environment in `environment.js`: dark smoke overhead, warm orange light from below, restrained ash fog, and enough neutral fill to distinguish both fighters and warning markers. Avoid full-screen flashes.
- Adjust `render.js` so the generic ground plane is hidden or fully below the lava scene while lava is active, restoring normal behavior on map switches.
- Frame the whole playable island and normal jumps. Keep crater walls out of the foreground and retain clear warning visibility at narrow aspect ratios. Background size must not force fighters to appear tiny.
- Update the map name/blurb in `maps.js`; keep the ID and controller protocol unchanged.
- Recheck bot navigation against the custom floor boundary. Only change bot behavior if inspection/testing exposes an actual lava-specific problem.

## Scope and validation

Expected implementation files: new `shared/lava-layout.js`, `host/src/lava-map.js`, `host/src/lava-view.js`, and `test/lava.test.js`; updates to `maps.js`, `arena-view.js`, `environment.js`, `render.js`, `test/maps.test.js`, and existing environment/visual validation where assumptions change. No server, controller, dependency, or asset-pipeline changes expected.

Tests must cover:

1. Both spawns and central combat area have support; points beyond jagged edges do not. Height queries reject support above the requested height. Platform height and outline remain fixed over a long round.
2. Identical seeds and inputs produce identical hazards. Warnings precede impacts; each impact hits once; safe and sufficiently airborne fighters avoid ground bursts. Active hazards and debris stay bounded.
3. View uses the shared outline, activates only on lava, and clears round-specific objects on reset/map switches.
4. Existing map tests replace square-tile lava expectations with the new behavior. Environment tests and visual validation account for one additional environment family instead of retaining the hard-coded cache count of eight.

Run focused lava/map/environment tests, then `npm test`. Use the existing visual review/validation tooling to capture the initial scene, active vent, falling bomb, impact, wide framing, narrow viewport, and repeated map switches. Verify no WebGL/console errors or steadily growing resources. Compare frame time and draw calls against the existing lava baseline; adjust particle counts before adding complexity.

## Acceptance

- First glance reads as the interior of a volcano, with lava flowing down distant crater walls.
- Fighting platform is one jagged magma island with visible molten cracks, not a rectangular tile board.
- Falling debris is continuously visible; dangerous rocks have clear, fixed landing warnings.
- Platform never repeatedly sinks, vanishes, or changes into square hazard tiles.
- Both fighters, platform edge, and hazard warnings remain readable during the busiest moment.
- Existing ring-outs, round resets, bots, and other maps continue to work.

## Deliberately excluded

No fluid simulation, deformable terrain, permanent impact craters, new weather framework, or new dependencies. Use scrolling/procedural lava and pooled debris. Exact hazard damage, particle counts, and camera distance require playtesting; warning timings above are starting values.

Implemented in this worktree. See `volcano-lava-validation.md` for checks and preview. Created on branch `Glioh/volcano-lava-redesign`, based on Orca's default `origin/main` at `cad296d7f6318ee81407edec6a492e825dac26ca`. The original main worktree remains untouched.
