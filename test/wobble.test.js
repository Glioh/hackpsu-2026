import test from 'node:test';
import assert from 'node:assert/strict';
import { spring, step, createWobble } from '../host/src/wobble.js';
import { fighter } from '../host/src/simulation.js';

test('springs overshoot, then settle on target, and stay stable at low frame rates', () => {
  const s = spring(3, .2); let peak = 0;
  for (let i = 0; i < 60; i++) peak = Math.max(peak, step(s, 1, 1 / 60));
  assert.ok(peak > 1.1, 'underdamped spring should overshoot');
  for (let i = 0; i < 300; i++) step(s, 1, 1 / 60);
  assert.ok(Math.abs(s.x - 1) < 1e-3);
  const slow = spring(6, .3);
  for (let i = 0; i < 50; i++) step(slow, 1, .1);
  assert.ok(Math.abs(slow.x - 1) < 1e-3, 'large frame steps must not blow up');
});

const rig = () => {
  const pose = createWobble(), f = fighter('red', 0, 0), dt = 1 / 60; let t = 0;
  const run = (n, each = () => {}) => { let out; for (let i = 0; i < n; i++) { each(); out = pose(f, dt, t += dt); } return out; };
  return { f, run, dt };
};

test('fighters squash on landing, stretch on take-off, get knocked by hits, and come to rest', () => {
  const { f, run } = rig();
  run(30);
  Object.assign(f, { grounded: false, vy: 8 });
  assert.ok(run(6).scale.y > 1.05, 'stretch after take-off');
  Object.assign(f, { vy: -9 }); run(1);
  Object.assign(f, { grounded: true, vy: 0 });
  assert.ok(run(5).scale.y < .95, 'squash after landing');
  assert.ok(run(1).scale.xz > 1, 'squash widens to keep volume');
  f.hit = .3; const hit = run(4);
  assert.ok(Math.hypot(hit.jelly.x, hit.jelly.z) > .05 && hit.scale.y < 1, 'hit bends the jelly body and squashes it');
  f.hit = 0; const rest = run(600);
  assert.ok(Math.abs(rest.scale.y - 1) < 1e-3 && Math.hypot(rest.jelly.x, rest.jelly.z) < 1e-3 && Math.abs(rest.head.x) < .01);
});

test('walking bobs the head side to side, squishes on footfalls and sways the jelly body; it keeps bobbling after stopping', () => {
  const { f, run, dt } = rig();
  run(30);
  let headRoll = [], scales = [], sway = [];
  run(180, () => { f.vz = 4; f.z += f.vz * dt; });
  for (let i = 0; i < 120; i++) { f.vz = 4; f.z += f.vz * dt; const o = run(1); headRoll.push(o.head.z); scales.push(o.scale.y); sway.push(o.jelly.x); }
  assert.ok(Math.max(...headRoll) > .1 && Math.min(...headRoll) < -.1, 'bobblehead swings both ways while walking');
  assert.ok(Math.min(...scales) < .97, 'footfalls squish the body');
  assert.ok(Math.max(...sway) - Math.min(...sway) > .05, 'body sways over the stance leg');
  f.vz = 0; const stopped = run(20);
  assert.ok(Math.abs(stopped.head.x) > .02 || Math.abs(stopped.head.z) > .02, 'head keeps bobbling just after stopping');
});

test('renderer inputs stay compatible: motion.js poses have every channel render.js reads, wobble gets raw fighters', async () => {
  const { createMotion } = await import('../host/src/motion.js');
  const pose = createMotion(fighter('red', 0, 0)).output.pose;
  for (const key of ['torsoPitch', 'torsoRoll', 'bodyOffset', 'headPitch', 'headYaw', 'headRoll', 'leg0Pitch', 'leg1Pitch',
    'arm0Action', 'arm0Pitch', 'arm0Roll', 'arm1Action', 'arm1Pitch', 'arm1Roll']) assert.ok(Number.isFinite(pose[key]), key);
  const out = createWobble()(fighter('red', 0, 0), 1 / 60, 1);
  const values = [out.scale.y, out.scale.xz, out.gear.x, out.gear.z, out.head.x, out.head.y, out.head.z, out.jelly.x, out.jelly.y, out.jelly.z];
  assert.ok(values.every(Number.isFinite), 'a NaN scale or offset makes the fighter vanish');
});
