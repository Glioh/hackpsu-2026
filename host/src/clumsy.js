// Clumsy secondary animation layered on top of motion.js (render-only; never touches the simulation).
// Fighters don't wobble; they lurch and limp when walking, stumble when they stop hard, land heavily or get hit,
// overcommit their punches, trip now and then, flail in the air and windmill their arms when teetering at an edge.
// Every move is a one-shot curve or a critically damped follow, so nothing bounces or rings.
// Needs raw simulation fighters (x, z, vx, vz, vy, heading, grounded, hit, attack, punchArm), not motion.js poses.
import { MOTION_CONFIG } from './motion.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Moves x toward target with time constant tau seconds; never overshoots.
const follow = (x, target, tau, dt) => x + (target - x) * (1 - Math.exp(-dt / tau));
export const restPose = () => ({ torso: { x: 0, z: 0 }, drop: 0, head: { x: 0, z: 0 }, arms: [{ x: 0, z: 0 }, { x: 0, z: 0 }], legs: [0, 0], gear: { x: 0, z: 0 } });

export function createClumsy(phase = 0) {
  let prev = null, gait = 0, steps = 0, walking = 0, nextTrip = 4 + phase * 1.7, stumble = null;
  let torsoX = 0, torsoZ = 0, laggedX = 0, laggedZ = 0, teeter = 0, air = 0;
  // A stumble is a one-shot move: dir +1 lurches forward, -1 staggers back; side leans it left/right.
  const start = (dir, size, dur, side = 0) => { if (!stumble || stumble.size < size) stumble = { dir, size, dur, side, t: 0 }; };

  // Returns pose offsets (radians, drop in metres) to add to motion.js. edge: 1 when the floor ends right next to f.
  return (f, dt, time, { enabled = true, edge = 0 } = {}) => {
    if (!enabled) { prev = null; stumble = null; torsoX = torsoZ = laggedX = laggedZ = teeter = air = 0; return restPose(); }
    const s = Math.sin(f.heading), c = Math.cos(f.heading), speed = Math.hypot(f.vx, f.vz);
    const stride = f.grounded ? Math.min(1, speed / 5) : 0;
    let forward = 0, side = 0;
    if (prev && dt > 0) {
      const ax = (f.vx - prev.vx) / dt, az = (f.vz - prev.vz) / dt;
      forward = clamp(ax * s + az * c, -60, 60); side = clamp(ax * c - az * s, -60, 60);
      if (f.grounded) {                                                    // same stride maths as motion.js
        const before = Math.floor(gait / Math.PI);
        gait += Math.min(.5, Math.hypot(f.x - prev.x, f.z - prev.z)) * MOTION_CONFIG.gaitPerUnit;
        if (Math.floor(gait / Math.PI) !== before) steps++;
      }
      if (f.hit > prev.hit) start(-1, 1, .9, phase ? 1 : -1);                                      // staggered back
      else if (!prev.grounded && f.grounded && prev.vy < -7) start(1, .8, .7);                      // knees buckle
      else if (f.grounded && prev.speed > 3.5 && forward < -14) start(1, .6, .6);                   // stopped too hard
      if (f.attack > prev.attack) start(1, .45, .55, f.punchArm ? 1 : -1);                          // punch overcommits
      if (stride > .5 && (walking += dt) > nextTrip) {                                             // the odd trip
        walking = 0; nextTrip = 3.5 + (steps * 7 + phase * 3) % 5; start(1, .55, .6, steps % 2 ? 1 : -1);
      }
    }
    prev = { x: f.x, z: f.z, vx: f.vx, vz: f.vz, vy: f.vy, speed, grounded: f.grounded, hit: f.hit, attack: f.attack };

    // One-shot stumble envelope e rises and falls once; scissor = a few hurried steps inside it.
    let e = 0, scissor = 0, dir = 0, lean = 0;
    if (stumble) {
      stumble.t += dt;
      const u = stumble.t / stumble.dur;
      if (u >= 1) stumble = null;
      else { e = Math.sin(Math.PI * u) * stumble.size; scissor = Math.sin(u * Math.PI * 4) * e; dir = stumble.dir; lean = stumble.side; }
    }
    teeter = follow(teeter, f.grounded && speed < 1.5 && edge ? 1 : 0, .15, dt);
    air = follow(air, f.grounded ? 0 : 1, .08, dt);

    // Limp: every other step lands heavier, dipping and lurching the body further over that leg.
    const heavy = Math.floor(gait / Math.PI) % 2 === 0 ? 1.3 : .6, rock = Math.sin(time * 5.5);
    const dip = Math.abs(Math.sin(gait)) * .07 * heavy * stride;
    const targetX = dir * .5 * e - forward * .012 + stride * .06 + teeter * .22 * rock;
    const targetZ = Math.sin(gait) * .14 * heavy * stride + lean * .25 * e + side * .01;
    torsoX = follow(torsoX, clamp(targetX, -.7, .7), .06, dt);
    torsoZ = follow(torsoZ, clamp(targetZ, -.6, .6), .06, dt);
    laggedX = follow(laggedX, torsoX, .2, dt); laggedZ = follow(laggedZ, torsoZ, .2, dt);       // head and gear trail behind

    const pose = restPose();
    pose.torso = { x: torsoX, z: torsoZ };
    pose.drop = -dip - .12 * e;
    pose.head = { x: clamp((laggedX - torsoX) * .9 + Math.sin(gait * .5) * .08 * stride, -.6, .6), z: clamp((laggedZ - torsoZ) * .9 + lean * .2 * e, -.6, .6) };
    pose.gear = { x: (laggedX - torsoX) * 1.2, z: (laggedZ - torsoZ) * 1.2 };
    pose.arms = [0, 1].map(j => {
      const sideSign = j ? 1 : -1, swing = -Math.sin(gait + Math.PI / 2 + j * Math.PI) * (j ? .55 : .25) * stride; // late, lopsided
      const windmill = Math.sin(time * 9 + j * Math.PI) * 2.2 * teeter, flail = Math.sin(time * 11 + j * Math.PI) * .9 * air;
      return { x: clamp(swing - 1.2 * e + windmill + flail, -2.6, 2.6), z: sideSign * (.5 * e + .5 * teeter + .4 * air) };
    });
    pose.legs = [0, 1].map(j => {
      const stomp = Math.sin(gait + j * Math.PI) * .25 * stride, scramble = scissor * .7 * (j ? 1 : -1);
      return stomp + scramble + Math.sin(time * 10 + j * Math.PI) * .45 * air + (j ? 0 : .5 * teeter);
    });
    return pose;
  };
}
