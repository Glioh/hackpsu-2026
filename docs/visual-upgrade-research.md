# Visual upgrade research

Audited 2026-10-25. Research and implementation proposal; rendering code has not been changed. Recommendations follow code inspection, not a captured visual or GPU benchmark.

## Findings in this project

- `host/src/render.js`: flat background colors, linear fog, a large plain ground plane, one shared hemisphere light (2.5) and directional light (3). No explicit tone mapping; installed Three.js 0.180.0 defaults to NoToneMapping and sRGB output. Rendering goes directly to the screen without a postprocessing chain.
- Sun shadows use PCFSoftShadowMap, a 2048 square map, and fixed orthographic bounds of +/-20 across all maps. Map height, silhouette and camera range differ considerably. No explicit bias tuning.
- `fighter-model.js` deliberately reduces materials with metalness above 0.5 to metalness 0.3 / roughness 0.4 because there is no environment map. This removes authored material distinction.
- Many procedural surfaces share roughness around 0.72–0.88. Additional geometry alone will not resolve the similar surface response.
- `rooftop-city.js` already batches towers and windows into two instanced meshes. Its windows are placed only on the positive-Z building facade. Keep batching while improving silhouettes and facade coverage.
- `mountain-view.js` has useful authored detail, but distant mountains are cones and mist banks are opaque flattened icosahedra. Its helper enables shadows on distant mountains and small decorative objects as well as gameplay geometry.
- Piano already has clearcoat and metallic materials, but shares the outdoor lighting setup. Station signals change base color; there is room for actual emissive treatment.

## Recommended visual direction

Keep a readable, stylized miniature-world look: strong silhouettes, warm key light, cool ambient fill, broad soft shading and restrained surface wear. Give every map a deliberate palette and atmosphere. Preserve clear team colors, hazard warnings and visible platform edges.

## Implementation order

### 1. Lighting, sky and reflections — highest priority

Create an environment preset per map containing sun direction/color/intensity, ambient fill, exposure, fog, sky and environment intensity. Apply on map transitions rather than rewriting global atmosphere values each frame.

Add a procedural daylight sky using the existing WebGL Sky addon, or a simple art-directed gradient skydome where an analytic sky is unnecessary. Synchronize the visible sun and directional light. Add restrained drifting cloud layers and horizon haze. Keep the sky within the camera's current far plane (500), or use a separate background render; copying a 10,000-unit sky example directly will clip it here.

Generate a PMREM environment from a dedicated sky/lighting scene once per preset and cache it. Avoid capturing fighters, ground and clouds into the reflection source. Moving clouds do not justify regenerating PMREM each frame. Add environment lighting first, then remove the global fighter metalness workaround and retune individual materials.

Try ACES filmic tone mapping and tune exposure together with lights; the existing light intensities should not be assumed correct under the new pipeline. Review red/blue team colors and hazard contrast after the change. A visible sky alone does not supply material reflections.

Sources: [Sky](https://threejs.org/docs/pages/Sky.html), [PMREM](https://threejs.org/docs/pages/PMREMGenerator.html), [PBR materials](https://threejs.org/docs/pages/MeshStandardMaterial.html).

### 2. Grounding and shadows

Fit the directional shadow camera to each playable map's bounds, including moving platforms, vertical play space and nearby shadow casters. Update its projection matrix after changing bounds. Inspect with a camera helper before increasing resolution. Tight fitting improves effective shadow detail without a blanket 4096 upgrade.

Tune small bias/normalBias adjustments against acne and detached shadows. Stabilize any moving shadow camera to reduce shimmer. Keep distant scenery and tiny decoration out of the shadow caster list. Retain a single primary shadow-casting light initially.

Add subtle baked ambient occlusion for static props and character creases. On higher quality settings, evaluate GTAO for contact under feet, stairs, utilities and props. AO supplements directional shadows; it should not turn creases black or draw halos around fighters. An inexpensive foot shadow fallback must track actual support height and fade during jumps, avoiding shadows projected across gaps.

Sources: [Shadow tradeoffs](https://threejs.org/manual/pages/shadows.html), [bias and resolution](https://threejs.org/docs/pages/LightShadow.html), [GTAO cost](https://threejs.org/docs/pages/GTAOPass.html).

### 3. Characters and surface materials

Preserve authored metalness and use distinct material families: matte painted shells, satin gloves, rough fabric, reflective metal and emissive eyes. Add broad roughness variation, subtle normal detail and restrained edge wear at a scale visible from the gameplay camera. Improve bevels and vertex normals where highlights currently cannot describe edges. Do not subdivide every character indiscriminately.

Use shared tiling material sets for concrete, stone, painted steel, wood and ice. Add dirt where surfaces meet, water streaks below vents, wear near steps and trim at exposed edges. Favor normal/roughness maps over geometry for fine detail. Maintain correct texture color spaces: color/emissive in sRGB, normal/roughness/AO as data.

### 4. Map identity and environment depth

| Map family | Proposed improvements |
| --- | --- |
| Skyline / Twinspire | Warm low sun, cool skyline haze, near/mid/far building layers, varied roofs and setbacks, windows on visible facades, roof gravel, vents, ducts and restrained antenna motion. |
| Cloudpeak | Layered mountain silhouettes, soft valley mist below the court, drifting cloud wisps, worn stone, moss in joints, wind in bamboo and banners. Avoid opaque cloud chunks and dense fog over fighters. |
| Station | Canopy materials, strip lights and emissive signals, track ballast, grime, posters, warning paint and richer train surfaces. Keep approaching trains and warnings readable. |
| Piano | Warm stage key light, cool fill and a dark auditorium backdrop; reflection detail for lacquer, brass and ivory, subtle wood grain and sparse dust. Give it its own lighting preset. |
| Classic / hazard arenas | A coherent surrounding yard or industrial setting, richer platform sides, restrained floor wear, distinct ice and conveyor materials, emissive lava with small localized effects. Preserve warning animation visibility. |

Keep decorative detail outside gameplay collision unless collision is deliberately updated from the shared layout. Existing sightline fading must continue to work with transparent materials, AO and shadows.

### 5. Restrained postprocessing

Build a small EffectComposer chain only after lighting is calibrated: scene render, optional AO, selective/thresholded bloom for emissive features, then OutputPass. Add appropriate antialiasing because canvas antialiasing alone does not guarantee antialiasing of offscreen targets. Confirm resize and pixel ratio handling for every pass.

Use bloom sparingly on lava, signals and eyes. Leave depth of field and motion blur disabled during gameplay to preserve fast action and edge visibility. Review the existing CSS knockout grayscale/contrast effect with the new tone-mapped output.

Source: [OutputPass ordering](https://threejs.org/docs/pages/OutputPass.html).

## Performance and acceptance

Target a stable 60 fps on the actual host laptop; 16.7 ms is the total frame budget, not a measured result. Record frame-time distributions, renderer draw calls, triangles and texture memory before and after each phase. Test fullscreen, browser resizing and every map with both fighters, hits, jumps and hazards active.

Provide low/medium/high presets. Keep sky and environment lighting across presets; scale render pixel ratio, shadow resolution, AO and bloom. Use instancing for repeated scenery, shared materials and atlases, and KTX2 compression when adding substantial textures. Cache environment resources, dispose replaced render targets and avoid unnecessary shader variants.

Use fixed-camera before/after images at close and wide framing. Accept changes only when fighters, ledges, train warnings and hazard states remain legible; shadows do not shimmer or detach; metals retain readable highlights; and map switching does not leak GPU resources. No performance claim is established until measured.

Sources: [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html), [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html).

Version caution: current online documentation is newer than the installed r180 in places. For example, the current Sky docs mention a showSunDisc uniform absent from this checkout. Implement against installed addon source, or plan a separately validated version upgrade.

Recommended first deliverable: upgrade Skyline as the reference scene with sky, cached environment lighting, calibrated tone mapping, fitted shadows and restored fighter materials. Measure and review that scene before propagating the pipeline to other maps.
