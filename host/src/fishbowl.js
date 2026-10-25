// Fishbowl head for fighters with "water" / "fish" / "fishtail" parts (Captain Bubbles): the water sloshes against
// the fighter's acceleration, landings and hits, and the goldfish swims calm laps around the bowl, panicking
// (darting, flipping direction, wiggling) while the fighter falls or gets hit. Deliberately springy, unlike
// clumsy.js, and only applied to tagged parts. Render-only; needs raw simulation fighters.
const FREQ = 2.4, ZETA = .12, K = (2 * Math.PI * FREQ) ** 2, D = 2 * ZETA * 2 * Math.PI * FREQ;
const GAIN = K * .025, MAX_TILT = .45;                                         // 10 m/s^2 settles at ~.25 rad
const follow = (x, target, tau, dt) => x + (target - x) * (1 - Math.exp(-dt / tau));
const REST = () => ({ water: { x: 0, z: 0 }, fish: { yaw: 0, y: 0, pitch: 0, roll: 0 }, tail: 0, panic: 0 });

export function createFishbowl() {
  let prev = null, wx = 0, wvx = 0, wz = 0, wvz = 0, t = 0, yaw = 0, dir = 1, panic = 0, scared = 0, flip = 0;
  return (f, dt, enabled = true) => {
    if (!enabled) { prev = null; wx = wvx = wz = wvz = yaw = panic = scared = 0; dir = 1; return REST(); }
    let forward = 0, side = 0;
    if (prev && dt > 0) {
      const ax = (f.vx - prev.vx) / dt, az = (f.vz - prev.vz) / dt, s = Math.sin(f.heading), c = Math.cos(f.heading);
      forward = Math.max(-40, Math.min(40, ax * s + az * c)); side = Math.max(-40, Math.min(40, ax * c - az * s));
      if (f.hit > prev.hit) { wvx += 3; wvz += 2 * Math.sign(Math.sin(t * 7.3) || 1); scared = .9; }   // smacked
      if (!prev.grounded && f.grounded) { const k = Math.min(4, Math.max(0, -prev.vy) * .4); wvx -= k; wvz += k * .6; } // splash
    }
    prev = { vx: f.vx, vz: f.vz, vy: f.vy, grounded: f.grounded, hit: f.hit };
    for (let left = dt; left > 1e-6; left -= 1 / 240) {                        // fixed substeps stay stable
      const h = Math.min(left, 1 / 240);
      wvx += (-K * wx - D * wvx + forward * GAIN) * h; wx += wvx * h;            // water lags behind: front dips
      wvz += (-K * wz - D * wvz - side * GAIN) * h; wz += wvz * h;
    }
    wx = Math.max(-MAX_TILT, Math.min(MAX_TILT, wx)); wz = Math.max(-MAX_TILT, Math.min(MAX_TILT, wz));

    // Panic: falling, just hit, or stunned. Snaps on, calms down slowly.
    t += dt; scared = Math.max(0, scared - dt);
    const afraid = (!f.grounded && f.vy < -3) || scared > 0 || f.stun > 0 ? 1 : 0;
    panic = follow(panic, afraid, afraid ? .05 : .8, dt);
    if (panic > .5 && (flip -= dt) < 0) { dir = -dir; flip = .25 + (t * 3.7 % 1) * .4; }     // darts back and forth
    if (panic < .2) dir = 1;
    yaw += dir * (1.3 + 9 * panic) * dt;
    return {
      water: { x: wx, z: wz },
      fish: {
        yaw, y: Math.sin(t * 2) * .015 + Math.sin(t * 13) * .03 * panic,
        pitch: Math.sin(t * 11) * .4 * panic, roll: Math.sin(t * 17) * .5 * panic,
      },
      tail: Math.sin(t * (7 + 18 * panic)) * (.35 + .25 * panic),
      panic,
    };
  };
}
