import test from 'node:test';
import assert from 'node:assert/strict';
import { createClumsy } from '../host/src/clumsy.js';
import { fighter } from '../host/src/simulation.js';

const dt = 1 / 60;
const rig = () => {
  const animate = createClumsy(), f = fighter('red', 0, 0); let t = 0;
  const run = (n, each = () => {}, opts) => { const out = []; for (let i = 0; i < n; i++) { each(); out.push(animate(f, dt, t += dt, opts)); } return out; };
  return { f, run };
};
const walk = f => () => { f.vz = 4; f.z += f.vz * dt; };

test('getting hit staggers the body back once and settles without bouncing (clumsy, not wobbly)', () => {
  const { f, run } = rig();
  run(30); f.hit = .3;
  const torso = run(180, () => { f.hit = Math.max(0, f.hit - dt); }).map(p => p.torso.x);
  const low = Math.min(...torso), lowAt = torso.indexOf(low);
  assert.ok(low < -.25, 'staggers back hard');
  assert.ok(Math.max(...torso.slice(lowAt)) < .01, 'no overshoot past upright on the way back');
  assert.ok(Math.abs(torso.at(-1)) < .01, 'settles');
});

test('stopping hard stumbles forward with flung arms and hurried scissor steps', () => {
  const { f, run } = rig();
  run(120, walk(f));
  const stumble = run(40, () => { f.vz *= .9; f.z += f.vz * dt; });
  assert.ok(Math.max(...stumble.map(p => p.torso.x)) > .2, 'pitches forward');
  assert.ok(Math.min(...stumble.map(p => p.arms[1].x)) < -.4, 'arms fling out to catch balance');
  const legs = stumble.map(p => p.legs[0] - p.legs[1]);
  assert.ok(Math.max(...legs) > .1 && Math.min(...legs) < -.1, 'legs scramble');
});

test('walking limps: alternate steps dip by different amounts, arms swing lopsided', () => {
  const { f, run } = rig();
  run(60, walk(f));
  const poses = run(120, walk(f)), drops = poses.map(p => p.drop);
  assert.ok(Math.min(...drops) < -.06, 'heavy step dips');
  assert.ok(Math.max(...poses.map(p => Math.abs(p.arms[1].x))) > 2 * Math.max(...poses.map(p => Math.abs(p.arms[0].x))) * .9, 'one arm swings, the other dangles');
});

test('teetering at an edge windmills the arms; airborne fighters flail', () => {
  const { f, run } = rig();
  const teeter = run(90, () => {}, { edge: 1 }).slice(30);
  assert.ok(Math.max(...teeter.map(p => p.arms[0].x)) > 1.5 && Math.min(...teeter.map(p => p.arms[0].x)) < -1.5);
  f.grounded = false; f.vy = 3;
  const air = run(40).slice(10);
  assert.ok(Math.max(...air.map(p => p.legs[0])) - Math.min(...air.map(p => p.legs[0])) > .5, 'legs bicycle');
});

test('motion off means no clumsy offsets at all; renderer inputs stay compatible', async () => {
  const { f, run } = rig();
  f.hit = .3; f.grounded = false;
  for (const p of run(30, () => {}, { enabled: false, edge: 1 })) {
    assert.deepEqual([p.torso.x, p.torso.z, p.drop, p.head.x, p.arms[0].x, p.arms[1].z, p.legs[0], p.gear.x].every(v => v === 0), true);
  }
  const { createMotion } = await import('../host/src/motion.js');
  const pose = createMotion(fighter('red', 0, 0)).output.pose;
  for (const key of ['torsoPitch', 'torsoRoll', 'bodyOffset', 'headPitch', 'headYaw', 'headRoll', 'leg0Pitch', 'leg1Pitch',
    'arm0Action', 'arm0Pitch', 'arm0Roll', 'arm1Action', 'arm1Pitch', 'arm1Roll']) assert.ok(Number.isFinite(pose[key]), key);
  const out = createClumsy()(fighter('red', 0, 0), dt, 1);
  assert.ok([out.torso.x, out.drop, out.head.z, out.arms[0].x, out.legs[1], out.gear.z].every(Number.isFinite));
});
