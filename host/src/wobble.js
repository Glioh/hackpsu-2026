// Floppy secondary motion for the fighters (render-only; the simulation is untouched).
// render.js uses it for squash & stretch and loose gear; motion.js drives the joints. Needs raw simulation
// fighters (vx, vy, grounded, hit), not motion.js poses.
// Every joint chases its target through a damped spring, so bodies lag, overshoot and settle,
// and the whole fighter squashes on landings/hits and stretches on take-off.

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
  const lean = { x: spring(2.6, .3), z: spring(2.6, .28) };
  const head = { x: spring(2.1, .18), z: spring(2.1, .18) };
  const gear = { x: spring(1.6, .15), z: spring(1.6, .15) };
  const squash = spring(3.2, .22);
  const arms = [0, 1].map(() => ({ x: spring(6, .28), z: spring(3, .25) }));
  const legs = [0, 1].map(() => spring(5, .45));
  let prev = null;

  // Returns the pose for fighter f after dt seconds. Angles in radians; squash is the y-scale offset.
  return (f, dt, time) => {
    let forward = 0, side = 0, turn = 0;
    if (prev && dt > 0) {
      const ax = (f.vx - prev.vx) / dt, az = (f.vz - prev.vz) / dt, s = Math.sin(f.heading), c = Math.cos(f.heading);
      forward = clamp(ax * s + az * c, -60, 60); side = clamp(ax * c - az * s, -60, 60);
      turn = clamp(wrap(f.heading - prev.heading) / dt, -8, 8);
      if (!prev.grounded && f.grounded) squash.v += Math.max(-4, prev.vy * .35);          // land: squash by fall speed
      if (prev.grounded && !f.grounded && f.vy > 0) squash.v += 2.4;                       // take-off: stretch
      if (f.hit > prev.hit) { squash.v -= 2.2; lean.x.v -= 5; lean.z.v += phase ? 7 : -7; head.x.v += 6; }
    }
    const walk = Math.min(1, Math.hypot(f.vx, f.vz) / 4), air = f.grounded ? 0 : 1;

    // Body lags behind acceleration and leans out of turns; heads and gear lag behind the body.
    step(lean.x, clamp(walk * .1 - forward * .02, -.5, .5), dt);
    step(lean.z, clamp(Math.sin(time * 9 + phase) * .05 + side * .02 + turn * .05, -.5, .5), dt);
    step(head.x, clamp(-lean.x.v * .07, -.5, .5), dt);
    step(head.z, clamp(-lean.z.v * .07 + Math.sin(time * 4 + phase) * .04, -.5, .5), dt);
    step(gear.x, clamp(-lean.x.v * .09 - head.x.v * .05, -.6, .6), dt);
    step(gear.z, clamp(-lean.z.v * .09 - head.z.v * .05, -.6, .6), dt);
    step(squash, air ? clamp(f.vy * .015, -.08, .1) : 0, dt);

    // Arms trail the body; the punching arm snaps out, overshoots and flops back.
    const punch = Math.sin(Math.PI * (1 - f.attack / .28));
    const armPose = arms.map((a, j) => ({
      x: step(a.x, f.attack > 0 && j === f.punchArm ? -2.3 * punch : Math.sin(time * 9 + j) * (.1 + walk * .4) - forward * .015, dt),
      z: step(a.z, (j ? 1 : -1) * (.12 + air * .65) + side * .01, dt),
    }));
    const legPose = legs.map((l, j) => step(l, air ? (j ? .35 : -.2) : Math.sin(time * 13 + j * Math.PI) * .6 * walk, dt));

    prev = { vx: f.vx, vz: f.vz, vy: f.vy, heading: f.heading, grounded: f.grounded, hit: f.hit };
    const sy = 1 + clamp(squash.x, -.35, .35);
    return {
      lean: { x: lean.x.x, z: lean.z.x }, head: { x: head.x.x, z: head.z.x }, gear: { x: gear.x.x, z: gear.z.x },
      scale: { y: sy, xz: 1 / Math.sqrt(sy) }, arms: armPose, legs: legPose, bob: Math.sin(time * 13) * .05 * walk,
    };
  };
}
