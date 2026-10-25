// Wukong's gags (render-only, for fighters with "staff" / "crown" parts): the staff swings with momentum (it lags
// behind the arm and overshoots), the victory twirl that gets out of hand and topples him over, and the golden
// headband slipping down over his eyes when he goes down. The gameplay half of the staff momentum (swings dragging
// him forward) is staffMomentum() below, called by the simulation.
const FREQ = 2.2, ZETA = .22, K = (2 * Math.PI * FREQ) ** 2, D = 2 * ZETA * 2 * Math.PI * FREQ;
const follow = (x, target, tau, dt) => x + (target - x) * (1 - Math.exp(-dt / tau));
const bounce = u => { const n = 7.5625, d = 2.75; if (u < 1 / d) return n * u * u; if (u < 2 / d) return n * (u -= 1.5 / d) * u + .75; if (u < 2.5 / d) return n * (u -= 2.25 / d) * u + .9375; return n * (u -= 2.625 / d) * u + .984375; };
export const TOPPLE = 1.45;                                                    // radians: lying on his side

export function createWukongGags() {
  let lag = null, lagV = 0, slip = 0;
  return {
    reset() { lag = null; lagV = 0; slip = 0; },
    // Extra staff pitch so it trails the arm's swing and overshoots (radians, added to the staff's rest pose).
    staff(armX, dt, enabled = true) {
      if (!enabled || lag === null) { lag = armX; lagV = 0; return 0; }
      for (let left = dt; left > 1e-6; left -= 1 / 240) {
        const h = Math.min(left, 1 / 240);
        lagV += (-K * (lag - armX) - D * lagV) * h; lag += lagV * h;
      }
      return Math.max(-1.6, Math.min(1.6, lag - armX));
    },
    // Victory, t seconds into the finish: an accelerating twirl, a wobble as it gets away from him, then he
    // topples over with a bounce and stays down. spin: extra staff pitch; tilt: sideways lean of the whole body.
    victory(t) {
      const s = Math.min(t, 1.1);
      const spin = 2 * Math.PI * (1.2 * s + 1.8 * s * s) + (t > 1.1 ? 3 * (1 - Math.exp(-(t - 1.1) * 4)) : 0);
      const tilt = t < 1.15 ? Math.sin(t * 14) * .1 * (t / 1.15) : TOPPLE * bounce(Math.min(1, (t - 1.15) / .4));
      return { spin, tilt };
    },
    // 0..1: how far the headband has slipped down over his eyes. down: he is falling out or knocked out.
    crown(down, dt) { slip = follow(slip, down ? 1 : 0, down ? .12 : .4, dt); return slip; },
  };
}

// Gameplay: his staff's momentum drags him forward on every swing, and every third swing over-commits, lurching
// him much further and briefly taking control away (stun) while it carries him. Called on each fist swing.
export const STAFF_LUNGE = 2.2, STAFF_OVERCOMMIT = 4.2, STAFF_STUMBLE = .35;
export function staffMomentum(f) {
  f.staffSwings = (f.staffSwings ?? 0) + 1;
  const big = f.staffSwings % 3 === 0, push = big ? STAFF_OVERCOMMIT : STAFF_LUNGE;
  f.vx += Math.sin(f.heading) * push; f.vz += Math.cos(f.heading) * push;
  if (big) f.stun = Math.max(f.stun, STAFF_STUMBLE);
  return big;
}
