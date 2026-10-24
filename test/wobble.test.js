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

test('fighters squash on landing, stretch on take-off, get knocked by hits, and come to rest', () => {
  const pose = createWobble(), f = fighter('red', 0, 0), dt = 1 / 60;
  let t = 0; const run = (n, fn = () => {}) => { let out; for (let i = 0; i < n; i++) { fn(); out = pose(f, dt, t += dt); } return out; };
  run(30);
  Object.assign(f, { grounded: false, vy: 8 });
  assert.ok(run(6).scale.y > 1.05, 'stretch after take-off');
  Object.assign(f, { vy: -9 }); run(1);
  Object.assign(f, { grounded: true, vy: 0 });
  assert.ok(run(5).scale.y < .95, 'squash after landing');
  const squashed = run(1).scale; assert.ok(squashed.xz > 1, 'squash widens to keep volume');
  f.hit = .3; const hit = run(4);
  assert.ok(Math.abs(hit.lean.z) > .05 && hit.scale.y < 1, 'hit knocks the body sideways and squashes it');
  f.hit = 0; const rest = run(400);
  assert.ok(Math.abs(rest.scale.y - 1) < 1e-3 && Math.abs(rest.lean.x) < 1e-3 && Math.abs(rest.head.x) < .01);
});
