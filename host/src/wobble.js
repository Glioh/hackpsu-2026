// Extra floppiness layered on top of motion.js (render-only; the simulation is untouched):
// - jelly: the body bends like jelly (feet planted, top lags/sways), applied by the vertex shader in fighter-model.js;
// - head: a bobblehead spring that swings with every step and keeps wobbling after stopping;
// - scale: squash & stretch on take-off, landing, hits and footsteps;
// - gear: loose kit (pot helmet, shell) lagging behind the body.
// Needs raw simulation fighters (x, z, vx, vz, vy, heading, grounded, hit), not motion.js poses.
import { MOTION_CONFIG } from './motion.js';

// freq in Hz, zeta < 1 overshoots (lower = wobblier).
export const spring = (freq, zeta) => ({ x: 0, v: 0, k: (2 * Math.PI * freq) ** 2, d: 2 * zeta * 2 * Math.PI * freq });

export function step(s, target, dt) {
  // Fixed substeps keep stiff springs stable at low frame rates.
  for (let left = dt; left > 1e-6; left -= 1 / 240) {
    const h = Math.min(left, 1 / 240);
    s.v += ((target - s.x) * s.k - s.v * s.d) * h;
    s.x += s.v * h;
  }
  return s.x;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export function createWobble(phase = 0) {
  const jelly = { fwd: spring(2.2, .16), side: spring(2.2, .16) };       // top-of-body offset, fighter-local, world units
  const head = { x: spring(2.1, .15), z: spring(2.1, .15), y: spring(2.6, .12) };
  const gear = { x: spring(1.6, .15), z: spring(1.6, .15) };
  const squash = spring(3.2, .22);
  let prev = null, gait = 0;

  // Returns the extra pose for fighter f after dt seconds.
  return (f, dt, time) => {
    let forward = 0, side = 0, turn = 0;
    const stride = f.grounded ? Math.min(1, Math.hypot(f.vx, f.vz) / 5) : 0;
    if (prev && dt > 0) {
      const ax = (f.vx - prev.vx) / dt, az = (f.vz - prev.vz) / dt, s = Math.sin(f.heading), c = Math.cos(f.heading);
      forward = clamp(ax * s + az * c, -60, 60); side = clamp(ax * c - az * s, -60, 60);
      turn = clamp(wrap(f.heading - prev.heading) / dt, -8, 8);
      // Same stride maths as motion.js, so footfalls line up with the leg swing.
      if (f.grounded) {
        const before = Math.floor(gait / Math.PI);
        gait += Math.min(.5, Math.hypot(f.x - prev.x, f.z - prev.z)) * MOTION_CONFIG.gaitPerUnit;
        if (Math.floor(gait / Math.PI) !== before && stride > .1) {                 // footfall
          squash.v -= 1.3 * stride; head.y.v -= .8 * stride; head.x.v += 2.2 * stride; jelly.fwd.v -= .4 * stride;
          head.z.v += (Math.floor(gait / Math.PI) % 2 ? 1 : -1) * 1.6 * stride;
        }
      }
      if (!prev.grounded && f.grounded) {                                           // landing
        squash.v += Math.max(-4, prev.vy * .35); head.y.v += Math.max(-1.5, prev.vy * .12); head.x.v += 2;
      }
      if (prev.grounded && !f.grounded && f.vy > 0) { squash.v += 2.4; head.y.v += .6; } // take-off
      if (f.hit > prev.hit) {
        squash.v -= 2.2; jelly.fwd.v -= 3; jelly.side.v += phase ? 2.5 : -2.5; head.x.v -= 5; head.z.v += phase ? 4 : -4;
      }
    }

    // Body top lags behind acceleration, leans out of turns and sways over the stance leg while walking.
    step(jelly.fwd, clamp(-forward * .012, -.4, .4), dt);
    step(jelly.side, clamp(-side * .012 - turn * .04 + Math.sin(gait) * .07 * stride, -.4, .4), dt);
    // Bobblehead: swings side to side with the stride and nods with speed changes.
    step(head.x, clamp(-forward * .018 + stride * .06, -.8, .8), dt);
    step(head.z, clamp(Math.sin(gait) * .24 * stride - side * .015 + Math.sin(time * 2.3 + phase) * .04, -.8, .8), dt);
    step(head.y, 0, dt);
    step(gear.x, clamp(-jelly.fwd.v * .25 - head.x.v * .05, -.6, .6), dt);
    step(gear.z, clamp(jelly.side.v * .25 - head.z.v * .05, -.6, .6), dt);
    step(squash, f.grounded ? 0 : clamp(f.vy * .015, -.08, .1), dt);

    prev = { x: f.x, z: f.z, vx: f.vx, vz: f.vz, vy: f.vy, heading: f.heading, grounded: f.grounded, hit: f.hit };
    const sy = 1 + clamp(squash.x, -.35, .35), s = Math.sin(f.heading), c = Math.cos(f.heading);
    return {
      // World-space offset of the top of the body (fighter-local forward/side rotated by heading); y squishes the top.
      jelly: { x: jelly.fwd.x * s + jelly.side.x * c, y: -Math.abs(jelly.fwd.x) * .3, z: jelly.fwd.x * c - jelly.side.x * s },
      head: { x: clamp(head.x.x, -.8, .8), z: clamp(head.z.x, -.8, .8), y: clamp(head.y.x, -.15, .15) },
      gear: { x: gear.x.x, z: gear.z.x },
      scale: { y: sy, xz: 1 / Math.sqrt(sy) },
    };
  };
}
