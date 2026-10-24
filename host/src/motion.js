const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
export const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

export const MOTION_CONFIG = Object.freeze({
  torso: { frequency: 3.6, damping: .76, limit: .34 },
  head: { frequency: 2.5, damping: .55, limit: .4 },
  yaw: { frequency: 3, damping: .7, limit: .35 },
  arm: { frequency: 2.7, damping: .6, limit: .44 },
  leg: { frequency: 5, damping: .8, limit: .8 },
  body: { frequency: 4.5, damping: .76, limit: .12 },
  stride: { frequency: 4, damping: 1, limit: 1 },
  accelerationLimit: 30, turnLimit: 6, gaitPerUnit: 3,
  presets: Object.freeze({ subtle: .55, floppy: 1, lively: 1.35 }),
});

// Exact solution of x'' + 2*zeta*w*x' + w*w*(x-target) = 0 for a
// constant target. Retaining angular velocity gives secondary overshoot.
export function stepSpring(spring, target, dt, tuning) {
  if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(target)) return spring;
  const w = tuning.frequency * 2 * Math.PI, zeta = tuning.damping;
  const x = spring.angle - target, v = spring.velocity;
  let position, velocity;
  if (zeta < 1 - 1e-5) {
    const a = zeta * w, b = w * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-a * dt), c = Math.cos(b * dt), s = Math.sin(b * dt);
    position = decay * (x * c + (v + a * x) * s / b);
    velocity = decay * (v * c - (a * v + w * w * x) * s / b);
  } else if (zeta > 1 + 1e-5) {
    const root = Math.sqrt(zeta * zeta - 1);
    const r1 = -w / (zeta + root), r2 = -w * (zeta + root);
    const a = (v - r2 * x) / (r1 - r2), b = x - a;
    position = a * Math.exp(r1 * dt) + b * Math.exp(r2 * dt);
    velocity = r1 * a * Math.exp(r1 * dt) + r2 * b * Math.exp(r2 * dt);
  } else {
    const a = v + w * x, decay = Math.exp(-w * dt);
    position = (x + a * dt) * decay;
    velocity = (v - w * a * dt) * decay;
  }
  spring.angle = clamp(target + position, tuning.limit);
  spring.velocity = velocity;
  if (Math.abs(spring.angle) >= tuning.limit && spring.angle * spring.velocity > 0) spring.velocity = 0;
  return spring;
}

const channels = {
  torsoPitch: 'torso', torsoRoll: 'torso', headPitch: 'head', headRoll: 'head', headYaw: 'yaw',
  arm0Pitch: 'arm', arm0Roll: 'arm', arm1Pitch: 'arm', arm1Roll: 'arm',
  leg0Pitch: 'leg', leg1Pitch: 'leg', bodyOffset: 'body', stride: 'stride',
};
const poseKeys = [...Object.keys(channels), 'arm0Action', 'arm1Action'];
const channelEntries = Object.entries(channels);
const rootKeys = ['x','y','z','heading'];
const makePose = () => Object.fromEntries(poseKeys.map(key => [key, 0]));
const makeSnapshot = () => ({ x: 0, y: 0, z: 0, heading: 0, pose: makePose() });
function copySnapshot(out, input) {
  out.x = input.x; out.y = input.y; out.z = input.z; out.heading = input.heading;
  for (const key of poseKeys) out.pose[key] = input.pose[key];
}
export function createMotion(fighter) {
  const state = {
    springs: Object.fromEntries(Object.keys(channels).map(key => [key, { angle: 0, velocity: 0 }])),
    previous: makeSnapshot(), current: makeSnapshot(), output: makeSnapshot(), targets: makePose(),
  };
  return resetMotion(state, fighter);
}
export function resetMotion(state, fighter) {
  state.gaitPhase = 0; state.elapsed = 0;
  state.lastVx = fighter.vx; state.lastVz = fighter.vz; state.lastHeading = fighter.heading;
  for (const [key] of channelEntries) Object.assign(state.springs[key], { angle: 0, velocity: 0 });
  for (const key of poseKeys) { state.current.pose[key] = 0; state.targets[key] = 0; }
  for (const key of rootKeys) state.current[key] = fighter[key];
  copySnapshot(state.previous, state.current); copySnapshot(state.output, state.current);
  return state;
}

const smooth = value => value * value * (3 - 2 * value);
export function punchAngle(remaining) {
  if (remaining <= 0) return 0;
  const elapsed = .28 - remaining;
  if (elapsed < .05) return .35 * smooth(Math.max(0, elapsed / .05));
  if (elapsed < .09) return .35 - 2.65 * smooth((elapsed - .05) / .04);
  if (elapsed < .19) return -2.3;
  return -2.3 * (1 - smooth(Math.min(1, (elapsed - .19) / .09)));
}

export function stepMotion(state, fighter, events, dt, preset = 'floppy', enabled = true) {
  if (!Number.isFinite(dt) || dt <= 0) return state;
  copySnapshot(state.previous, state.current);
  const gain = MOTION_CONFIG.presets[preset] ?? 1;
  const sin = Math.sin(fighter.heading), cos = Math.cos(fighter.heading);
  const localX = fighter.vx * cos - fighter.vz * sin, localZ = fighter.vx * sin + fighter.vz * cos;
  const ax = clamp((fighter.vx - state.lastVx) / dt, MOTION_CONFIG.accelerationLimit);
  const az = clamp((fighter.vz - state.lastVz) / dt, MOTION_CONFIG.accelerationLimit);
  const localAx = ax * cos - az * sin, localAz = ax * sin + az * cos;
  const turn = clamp(wrapAngle(fighter.heading - state.lastHeading) / dt, MOTION_CONFIG.turnLimit);
  state.lastVx = fighter.vx; state.lastVz = fighter.vz; state.lastHeading = fighter.heading;
  const speed = Math.hypot(fighter.vx, fighter.vz);
  state.elapsed += dt;
  const distance = Math.hypot(fighter.x - state.current.x, fighter.z - state.current.z);
  if (fighter.grounded) state.gaitPhase = (state.gaitPhase + distance * MOTION_CONFIG.gaitPerUnit) % (2 * Math.PI);
  const t = state.targets, springs = state.springs;
  t.stride = fighter.grounded ? Math.min(1, speed / 5) : 0;
  const stride = enabled ? springs.stride.angle : t.stride;
  const gait = Math.sin(state.gaitPhase) * stride;
  t.torsoPitch = enabled ? gain * (localZ * .025 - localAz * .006) : 0;
  t.torsoRoll = enabled ? gain * (-localX * .02 + localAx * .006 + gait * .035) : 0;
  // Head offsets partially counter the inherited torso transform, so the head
  // trails the torso rather than doubling its lean.
  t.headPitch = enabled ? -.55 * springs.torsoPitch.angle - gain * localAz * .002 : 0;
  t.headRoll = enabled ? -.55 * springs.torsoRoll.angle + gain * localAx * .002 : 0;
  t.headYaw = enabled ? -turn * .07 * gain : 0;
  t.bodyOffset = enabled ? .008 * Math.sin(state.elapsed * 1.8) + Math.abs(gait) * .035 : 0;
  for (let j = 0; j < 2; j++) {
    const side = j ? 1 : -1;
    t[`leg${j}Pitch`] = fighter.grounded ? gait * side * .6 * localZ / Math.max(.1, speed) : .2;
    t[`arm${j}Pitch`] = enabled ? gain * (localAz * .005 - gait * side * .3) : -gait * side * .3;
    t[`arm${j}Roll`] = enabled ? side * (fighter.grounded ? .03 : .38) + gain * localAx * .003 : 0;
    t[`arm${j}Action`] = fighter.punchArm === j ? punchAngle(fighter.attack) : 0;
  }
  if (enabled) for (const event of events) {
    if (event.team !== fighter.team) continue;
    if (event.type === 'punch') {
      springs.torsoPitch.velocity -= .9 * gain;
      springs.torsoRoll.velocity += (event.arm ? 1 : -1) * .6 * gain;
      springs[`arm${event.arm}Pitch`].velocity -= 1.2 * gain;
    } else if (event.type === 'hit') {
      const x = event.x * cos - event.z * sin, z = event.x * sin + event.z * cos;
      const strength = Math.min(1.5, event.strength / 11) * gain;
      springs.torsoPitch.velocity += z * 3 * strength;
      springs.torsoRoll.velocity -= x * 3 * strength;
      springs.headPitch.velocity += z * 1.8 * strength;
      springs.headRoll.velocity -= x * 1.8 * strength;
      springs.arm0Pitch.velocity += z * strength; springs.arm1Pitch.velocity += z * strength;
    } else if (event.type === 'takeoff') {
      springs.bodyOffset.velocity += .5 * gain;
      springs.torsoPitch.velocity -= .65 * gain;
    } else if (event.type === 'landing') {
      springs.bodyOffset.velocity -= Math.min(1.8, event.speed * .14) * gain;
      springs.torsoPitch.velocity += Math.min(1.4, event.speed * .12) * gain;
      springs.headPitch.velocity -= Math.min(1, event.speed * .1) * gain;
    }
  }
  for (const [key, type] of channelEntries) {
    if (enabled) stepSpring(springs[key], clamp(t[key], MOTION_CONFIG[type].limit), dt, MOTION_CONFIG[type]);
    else { springs[key].angle = t[key]; springs[key].velocity = 0; }
    state.current.pose[key] = springs[key].angle;
  }
  state.current.pose.arm0Action = t.arm0Action; state.current.pose.arm1Action = t.arm1Action;
  for (const key of rootKeys) state.current[key] = fighter[key];
  return state;
}

export function interpolateMotion(state, alpha, out = state.output) {
  const t = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  for (const key of ['x','y','z']) out[key] = state.previous[key] + (state.current[key] - state.previous[key]) * t;
  out.heading = state.previous.heading + wrapAngle(state.current.heading - state.previous.heading) * t;
  for (const key of poseKeys) out.pose[key] = state.previous.pose[key] + (state.current.pose[key] - state.previous.pose[key]) * t;
  return out;
}
