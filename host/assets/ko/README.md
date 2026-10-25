# KO blast pack

Original transparent SVG masks: beam.svg, flare.svg, ring.svg. No Smash Bros. footage or textures are used. White masks accept team colors in Three.js with additive blending.

The renderer layers a tall colored beam and narrow white core over the eliminated fighter's world position, then expands a shock ring and throws out 18 sparks. The effect uses real elapsed time so its initial flash stays punchy during slow motion.

On a ring-out, combat locks immediately. The surviving body's momentum and character animation continue at 12% speed for 1.8 seconds, while the arena fades to greyscale in 220 ms. Results appear after that finish. Rematches and lobby transitions clear the effect. Simultaneous eliminations produce two beams and retain the draw.

Timing: host/src/ko-finish.js. Particle choreography: host/src/ko-effects.js.
