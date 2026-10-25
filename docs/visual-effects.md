# Arena lighting and world KOs

Run `npm start` and open http://localhost:3000. There is no build step.
The host accepts `?quality=low`, `medium` (default), or `high`; these retain
the existing pixel ratio and shadow-resolution limits.

The shared renderer adds a cool, non-shadow-casting rim to the existing warm
key, hemisphere fill, map-specific atmosphere and cached environment reflections.
Fighters have soft contact decals sampled from the live supporting floor;
they fade on jumps and disappear over holes. Matte surfaces share a small
roughness/bump texture, while authored normals, glass and polished metal keep
their original finishes. Generic platforms use shared beveled geometry and
slate-colored sides. Random map selection and procedurally seeded layouts use
the same renderer. There are no new post-processing passes or dependencies.

The original knockout presentation is restored: team-colored billboard beams,
white flare, expanding ring and sparks at the elimination plane. The arena's
original grayscale/contrast filter ramps in during the finish. The original
1.8-second finish and slow-motion timing are unchanged. `clearKO` removes the
sprites on rematch or return to lobby.

Run `npm test` for the original knockout, finish timing, contact shadows and
material regression checks. For a manual check, disable the blue bot and walk
red off an edge. Verify the beam and grayscale, then rematch and confirm normal
colors return. The minimal winner screen and dim translucent background remain.
