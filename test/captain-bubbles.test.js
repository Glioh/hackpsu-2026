import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFishbowl } from '../host/src/fishbowl.js';
import { fighter } from '../host/src/simulation.js';
import { FIGHTERS } from '../host/src/fighter-model.js';

const dt = 1 / 60;
const gltfJson = url => {
  const glb = readFileSync(new URL('..' + url, import.meta.url));
  return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
};

test('Captain Bubbles is registered with team-coloured gloves', () => {
  assert.deepEqual({ ...FIGHTERS.bubbles }, { name: 'Captain Bubbles', url: '/host/assets/characters/captain_bubbles.glb', prefix: 'CB_', teamMaterial: 'CB_Gloves' });
});

test('the fishbowl head is see-through glass holding separate water, fish and tail parts', () => {
  const { nodes, materials } = gltfJson(FIGHTERS.bubbles.url), byName = new Map(nodes.map(n => [n.name, n]));
  for (const name of ['CB_Glass', 'CB_Water']) assert.equal(materials.find(m => m.name === name)?.alphaMode, 'BLEND', name);
  const head = byName.get('CB_Head'), kids = head.children.map(i => nodes[i].name);
  assert.ok(kids.includes('CB_Water') && kids.includes('CB_Fish'), 'water and fish ride inside the head');
  assert.equal(byName.get('CB_Fish').extras.ragdoll_part, 'fish');
  assert.equal(nodes[byName.get('CB_Fish').children[0]].extras.ragdoll_part, 'fishtail');
});

test('the fish swims calm laps and settles water when standing still', () => {
  const bowl = createFishbowl(), f = fighter('red', 0, 0);
  let s; for (let i = 0; i < 300; i++) s = bowl(f, dt);
  assert.ok(s.fish.yaw > 5 && s.fish.yaw < 8, 'about 1.3 rad/s');
  assert.ok(s.panic < .01 && Math.abs(s.water.x) < 1e-3 && Math.abs(s.water.z) < 1e-3);
});

test('water sloshes back and forth when the fighter starts and stops running', () => {
  const bowl = createFishbowl(), f = fighter('red', 0, 0);   // heading 0 faces +z
  bowl(f, dt); f.vz = 6;
  const xs = Array.from({ length: 60 }, () => bowl(f, dt).water.x);
  assert.ok(Math.max(...xs) > .1 && Math.min(...xs) < 0, 'tips forward, then rocks back');
  f.vz = 0; let last; for (let i = 0; i < 400; i++) last = bowl(f, dt);
  assert.ok(Math.abs(last.water.x) < 1e-3, 'settles');
});

test('the fish panics while falling, then calms down, and everything rests when motion is off', () => {
  const bowl = createFishbowl(), f = fighter('red', 0, 0);
  for (let i = 0; i < 30; i++) bowl(f, dt);
  const calm = bowl(f, dt);
  Object.assign(f, { grounded: false, vy: -8 });
  let s; const yaw0 = calm.fish.yaw; for (let i = 0; i < 30; i++) s = bowl(f, dt);
  assert.ok(s.panic > .95, 'panics');
  assert.ok(Math.abs(s.fish.yaw - yaw0) > 1, 'darts around');
  Object.assign(f, { grounded: true, vy: 0 });
  for (let i = 0; i < 400; i++) s = bowl(f, dt);
  assert.ok(s.panic < .05, 'calms down');
  const off = createFishbowl(); f.hit = .5;
  assert.deepEqual(off(f, dt, false), { water: { x: 0, z: 0 }, fish: { yaw: 0, y: 0, pitch: 0, roll: 0 }, tail: 0, panic: 0 });
});
