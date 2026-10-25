# Skyline rooftop — standalone concept

This is a review prototype, not an implemented game environment. No game files, map definitions, collision, server routes, or dependencies are changed.

From the repository root run `python -m http.server 4174 --bind 127.0.0.1`, then open http://localhost:4174/art/prototypes/rooftop/ . The preview uses the installed Three.js dependency with no CDN. Drag to orbit, scroll to zoom, or use the three camera presets.

`rooftop.glb` is the reusable, self-contained 3D model (Y up, meters). Import into Blender or another glTF viewer. Regenerate with `node art/prototypes/rooftop/export.mjs`.

The roof measures approximately 31 × 25 m, with an 18 × 13.2 m painted court. Includes building facade, access penthouse, stairs, elevated HVAC deck, fan details, banded water tower, ladder, antenna, vents, and flush caution stripes around four open edges. Perimeter walls, benches, planters, and corner poles are removed to clear knock-off routes. The footprint is 28% smaller on each axis (48% less area), with fighter scale preserved. Two static mannequins show character scale. The surrounding procedural city is preview context and is excluded from the model.

Design decisions to review: roof proportions, readable fighting space, utility deck placement, visual density, and skyline mood. All geometry is original procedural mesh work. Lighting is baked into neither textures nor meshes. Props and stairs are visual only; collision, traversal, ring-out rules, performance optimization, and gameplay camera work remain future implementation decisions.

The rear slab now ends flush with the raised service structures. A continuous raised service spine fills the former rear corridor and end gaps; there is no lower walkway behind that row. These are still visual layout decisions; movement restrictions require collision implementation later.
