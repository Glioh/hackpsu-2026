import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createJiggle } from '../host/src/jiggle.js';
import { createCrumbs } from '../host/src/crumbs.js';
import { fighter } from '../host/src/simulation.js';
import { FIGHTERS } from '../host/src/fighter-model.js';

const dt = 1 / 60;

test('Toast Malone is registered with team-coloured gloves and the crumbs impact effect', () => {
  assert.deepEqual({ ...FIGHTERS.toast }, { name: 'Toast Malone', url: '/host/assets/characters/toast_malone.glb', prefix: 'TM_', teamMaterial: 'TM_Gloves', impactFx: 'crumbs' });
});

test('butter jiggle rings both ways after a hit, settles, and stays still when motion is off', () => {
  const jiggle = createJiggle(), f = fighter('red', 0, 0);
  for (let i = 0; i < 10; i++) jiggle(f, dt);
  f.hit = .3;
  const ys = Array.from({ length: 40 }, () => jiggle(f, dt).y);
  assert.ok(Math.min(...ys) < .9 && Math.max(...ys) > 1.03, 'squashes then stretches');
  f.hit = 0; let last; for (let i = 0; i < 300; i++) last = jiggle(f, dt);
  assert.ok(Math.abs(last.y - 1) < 1e-3 && Math.abs(last.tilt) < 1e-3, 'settles');
  const off = createJiggle(); f.hit = .5;
  for (let i = 0; i < 30; i++) assert.deepEqual(off(f, dt, false), { y: 1, xz: 1, tilt: 0 });
});

test('crumbs burst, bounce on the floor, fall into the void, and fade away', () => {
  const scene = new T.Scene(), crumbs = createCrumbs(scene, 20), body = fighter('red', 0, 0);
  const live = () => scene.children.filter(m => m.visible);
  crumbs.burst(body, 12);
  assert.equal(live().length, 12);
  for (let i = 0; i < 30; i++) crumbs.update(dt, () => 0.04);
  assert.ok(live().every(m => m.position.y >= 0.04), 'nothing sinks through the floor');
  for (let i = 0; i < 30; i++) crumbs.update(dt, () => undefined);   // crumbs live 1.2-2 s, so check within that
  assert.ok(live().some(m => m.position.y < -1), 'over the void they keep falling');
  for (let i = 0; i < 180; i++) crumbs.update(dt, () => 0.04);
  assert.equal(live().length, 0, 'all fade out');
});
