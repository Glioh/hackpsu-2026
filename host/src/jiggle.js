// Jiggle for soft gear that opts in (ragdoll_part "butter", e.g. Toast Malone's butter hat): a quick squishy wobble
// that rings briefly after footsteps, landings, punches and hits. Deliberately springy, unlike clumsy.js, and only
// applied to tagged parts, so other fighters are unaffected. Render-only; needs raw simulation fighters.
const FREQ = 7, ZETA = .12, K = (2 * Math.PI * FREQ) ** 2, D = 2 * ZETA * 2 * Math.PI * FREQ;

export function createJiggle() {
  let prev = null, x = 0, v = 0, stride = 0;            // x: squash (+ flattens, - stretches)
  // Returns scale factors and a tilt (radians) for the jiggling part.
  return (f, dt, enabled = true) => {
    if (!enabled) { prev = null; x = v = stride = 0; return { y: 1, xz: 1, tilt: 0 }; }
    if (prev && dt > 0) {
      if (f.hit > prev.hit) v += 9;                                           // smacked
      if (!prev.grounded && f.grounded) v += Math.min(10, Math.max(0, -prev.vy) * .9); // landed
      if (f.attack > prev.attack) v += 4;                                     // threw a punch
      const speed = Math.hypot(f.vx, f.vz);
      if (f.grounded && speed > .5 && (stride += speed * dt * 3) > Math.PI) { stride -= Math.PI; v += 2.5 * Math.min(1, speed / 5); } // footstep
    }
    for (let left = dt; left > 1e-6; left -= 1 / 240) {                      // fixed substeps stay stable
      const h = Math.min(left, 1 / 240);
      v += (-x * K - v * D) * h; x += v * h;
    }
    prev = { hit: f.hit, grounded: f.grounded, vy: f.vy, attack: f.attack };
    const s = Math.max(-.35, Math.min(.35, x));
    return { y: 1 - s, xz: 1 + s * .5, tilt: s * .4 };
  };
}
