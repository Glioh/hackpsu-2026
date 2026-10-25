import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIGHTERS } from '../host/src/fighter-model.js';

const gltfJson = url => {
  const glb = readFileSync(new URL('..' + url, import.meta.url));
  return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
};

test('Conehead is registered with team-coloured gloves', () => {
  assert.deepEqual({ ...FIGHTERS.conehead }, { name: 'Conehead', url: '/host/assets/characters/conehead.glb', prefix: 'CH_', teamMaterial: 'CH_Gloves' });
});

test('the cone is its own bouncing part riding on the head', () => {
  const { nodes, materials } = gltfJson(FIGHTERS.conehead.url), byName = new Map(nodes.map(n => [n.name, n]));
  const head = byName.get('CH_Head'), cone = byName.get('CH_Cone');
  assert.equal(cone.extras.ragdoll_part, 'cone');
  assert.ok(head.children.map(i => nodes[i]).includes(cone), 'cone rides on the head');
  assert.ok(materials.some(m => m.name === 'CH_Gloves'));
});
