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

test('jump and hit reactions stay subtle, bounded, and settle to rest', () => {
  const { f, run } = rig();
  run(30);
  Object.assign(f, { grounded: false, vy: 8 });
  const takeoff = run(6);
  assert.ok(takeoff.scale.y > 1 && takeoff.scale.y <= 1.04, 'small stretch after take-off');
  Object.assign(f, { vy: -9 }); run(1);
  Object.assign(f, { grounded: true, vy: 0 });
  const landing = run(5);
  assert.ok(landing.scale.y < 1 && landing.scale.y >= .96, 'small squash after landing');
  assert.ok(run(1).scale.xz > 1, 'squash widens to keep volume');
  f.hit = .3; const hit = run(4);
  assert.ok(Math.hypot(hit.jelly.x, hit.jelly.z) > .005 && hit.scale.y < 1, 'hit bends the jelly body and squashes it');
  f.hit = 0; const rest = run(600);
  assert.ok(Math.abs(rest.scale.y - 1) < 1e-3 && Math.hypot(rest.jelly.x, rest.jelly.z) < 1e-3 && Math.abs(rest.head.x) < .01);
});

test('walking keeps body proportions steady and secondary head sway is small', () => {
  const { f, run, dt } = rig();
  run(30);
  let headRoll = [], scales = [], sway = [];
  run(180, () => { f.vz = 4; f.z += f.vz * dt; });
  for (let i = 0; i < 120; i++) { f.vz = 4; f.z += f.vz * dt; const o = run(1); headRoll.push(o.head.z); scales.push(o.scale.y); sway.push(o.jelly.x); }
  assert.ok(Math.max(...headRoll) > .01 && Math.min(...headRoll) < -.01, 'subtle head sway stays visible');
  assert.ok(headRoll.every(v => Math.abs(v) < .12), 'head sway stays under seven degrees');
  assert.ok(scales.every(v => Math.abs(v - 1) < .001), 'footsteps must not squash or stretch the body');
  assert.ok(sway.every(v => Math.abs(v) < .04), 'walking sway stays under four centimetres');
  f.vz = 0; const stopped = run(20);
  assert.ok(Math.abs(stopped.head.x) < .04 && Math.abs(stopped.head.z) < .04, 'head settles quickly after stopping');
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

test('turning secondary motion off restores rigid proportions and zero wobble', () => {
  const f = fighter('red', 0, 0), animate = createWobble();
  animate(f, 1 / 60, 0);
  Object.assign(f, { grounded: false, vy: 8, hit: .3 });
  for (let i = 0; i < 120; i++) {
    const pose = animate(f, 1 / 60, i / 60, false);
    assert.equal(pose.scale.y, 1); assert.equal(pose.scale.xz, 1);
    for (const channel of [pose.head, pose.gear, pose.jelly]) {
      assert.ok(Object.values(channel).every(value => Math.abs(value) === 0));
    }
  }
});
