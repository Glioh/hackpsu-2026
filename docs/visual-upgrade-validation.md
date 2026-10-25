# Visual environment upgrade

Implemented on `Glioh/visual-environment-upgrade`, in the separate worktree. The original checkout and its dirty files were not changed. The supplied research brief is copied alongside this document.

## Rendering changes

- Eight coherent atmosphere families cover all fourteen maps. Skyline establishes warm directional light against cool fill and layered city haze; Twinspire and Station have related but distinct lighting. Cloudpeak has cool alpine atmosphere and low valley mist. Piano uses a dark auditorium, warm stage key, cool fill and indoor reflection softboxes. Ice and industrial arenas have their own palettes.
- A camera-centered, 220m dome uses the installed r180 Sky addon's Rayleigh/Mie atmospheric scattering shader outdoors, with thin procedural high clouds and a physical sun halo aligned to the primary light. Horizon haze and distant ground use blue-gray tones rather than olive green. The dome stays inside the existing 500m far plane. Piano retains its separate dark indoor gradient.
- A dedicated lighting scene supplies one lazy, cached 128px PMREM capture per family. It contains no fighters, gameplay geometry or animated mist. Piano gets warm/cool emissive reflection cards, without extra runtime lights. Cached targets and generator have an explicit disposal path through `draw.dispose()`.
- Explicit ACES filmic tone mapping and sRGB output, with exposure calibrated alongside reduced hemisphere illumination. One PCFSoft shadow light remains. Its orthographic camera fits layout corners in light space, allowing jump clearance, moving platform travel, Piano's full case and both Twinspire roofs. Projection stays fixed during play, avoiding camera-follow shimmer; bias and normal bias are tuned conservatively.
- Fighter metalness and roughness retain their authored values. A shared 64px linear data texture adds restrained roughness variation to suitable matte surfaces; authored textures, lacquer, alpha and sightline materials remain intact. Ice, conveyor steel and bronze gong materials have distinct responses. Station signals now emit their existing warning colors.
- Skyline retains two instanced scenery draws, with four facade orientations, layered building colors, roof setbacks and sparse antennas. Cloudpeak has stepped karst profiles and translucent radial mist cards below the court; distant peaks and tiny court overlays do not cast shadows.
- Generic arena rebuilds now release replaced geometry, materials and belt texture clones. Material enrichment runs when content is created or switched, rather than traversing the scene every frame.

## Quality controls

Use `?quality=low`, `?quality=medium` (default), or `?quality=high` on the host URL. Pixel ratio caps are 1 / 1.5 / 2; shadow maps are 1024 / 2048 / 2048. All levels retain sky and environment illumination. No AO, bloom, volumetrics or additional shadow lights are introduced.

## Validation

`npm test`: **119 passed, 0 failed**. New tests check every playable layout corner and 6m jump clearance against the fitted shadow projection, deterministic skyline batching and four facade orientations. Existing physics, hazards, team hit effects, camera framing and sightline fading tests pass.

Headless installed Chrome, 1280 x 720, DPR 1, default quality:

| Scene | Baseline draws | Upgraded draws | Baseline triangles | Upgraded triangles |
| --- | ---: | ---: | ---: | ---: |
| Skyline | 663 | 664 | 62,518 | 80,926 |
| Cloudpeak | 225 | 242 | 50,268 | 51,504 |
| Piano | 238 | 243 | 54,245 | 55,253 |
| Station | 389 | 392 | 51,114 | 52,098 |
| Twinspire | 831 | 832 | 56,586 | 57,546 |

These are `renderer.info.render` counts for the sampled screen render, not GPU timings or totals including all shadow passes. Counts can vary slightly as the smoothed camera settles and sightline materials fade. The visible sky adds one draw; Cloudpeak's soft mist replaces cheaper opaque banks. Skyline's additional triangles are batched windows and roof detail, not additional scenery draws.

The browser harness renders all fourteen maps with both loaded fighters, captures close and wider Skyline framing, resizes to 800 x 600, exercises simulation jumps/punches/hazards, hit flashes and KO setup/clear, and starts a real host keyboard/bot match with keyboard input and resize. It also captures forced lava warning/hot states and station warnings. The clean runs report zero JavaScript/shader errors and one active host canvas.

Eight PMREM entries remain after visiting all maps and cycling representative maps twice. Texture count is 12 on the first fully warmed lava visit and 12 after cycling back to lava; conveyor temporarily adds one belt clone. This establishes bounded texture allocation for this sequence, not a general heap-leak proof.

Sampled requestAnimationFrame median is about 16.7ms. Final warmed samples are mostly 16.8–16.9ms at p95; an earlier Twinspire run reached 33.5ms p95 (baseline Twinspire also reached 33.4ms). Samples are short and display-paced, exclude initial shader/capture warmup, and are **not a sustained host-laptop 60fps guarantee**. Native fullscreen at high DPR, long active four-phone matches, browser/GPU variants and thermal throttling still require hands-on validation. Quality low provides an inexpensive fallback. There are no offscreen postprocessing targets to resize.

## Captures and raw reports

All comparison images use the same harness, fighter picks, viewport and framing. Baseline source is read from commit `4ee5c5c` through browser request interception, without editing either checkout.

| View | Baseline | Upgraded |
| --- | --- | --- |
| Skyline close | [Before](visual-upgrade/skyline-before.png) | [After](visual-upgrade/skyline-after.png) |
| Skyline wider | [Before](visual-upgrade/skyline-wide-before.png) | [After](visual-upgrade/skyline-wide-after.png) |

Additional captures: [Cloudpeak](visual-upgrade/mountain.png), [Piano](visual-upgrade/piano.png), [lava states](visual-upgrade/hazards.png).

Raw results: [baseline](visual-upgrade/before-report.json), [upgrade](visual-upgrade/after-report.json).

## Reproduce

From this worktree, install the optional browser harness dependency without changing the lockfile:

```powershell
npm ci
npm install --no-save --package-lock=false playwright
$env:PORT='3210'
node server/index.js
```

In another terminal:

```powershell
$env:VISUAL_URL='http://localhost:3210'
$env:CHROME_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
node scripts/validate-visuals.mjs 4ee5c5c
node scripts/validate-visuals.mjs
npm test
```

Captures and reports are written to ignored `.visual-validation/before` and `.visual-validation/after`. The harness fails on browser errors, missing host canvas, or growth in warmed environment/texture counts. The baseline source interception applies to the isolated rendering harness; the separate real-host startup smoke uses current code.

Implementation uses installed Three.js **0.180.0**. `Sky.js` and `PMREMGenerator.js` were inspected locally; the outdoor shader extends the installed Sky shader and uses its actual r180 uniforms, and PMREM uses r180's `fromScene(scene, sigma, near, far, { size })` API. No Three.js upgrade or new production dependency is required.

## Sky revision

Replaced the original green/olive gradient outdoors with analytic atmospheric scattering, blue-gray horizon fog and neutral distant ground. Thin clouds use three noise octaves in the same sky draw. PMREM uses the same sky, with separately calibrated radiance to preserve warm direct-light contrast. Piano remains indoors. `npm test` still passes all 119 tests; the all-map browser harness was rerun with refreshed captures and bounded cache checks.
