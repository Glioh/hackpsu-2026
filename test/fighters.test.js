import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIGHTERS, TEAM_FIGHTERS } from '../host/src/fighter-model.js';

// Shoulder -> wrist, from art/characters/wobble_kit.py ARM; every fighter must match.
const ARM_LENGTH = Math.hypot(.20, -.02, -.25);
const gltfJson = url => {
  const glb = readFileSync(new URL('..' + url, import.meta.url));
  return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
};

test('active roster excludes retired fighters and matches phone selection choices',async()=>{
  assert.deepEqual(Object.keys(FIGHTERS),['squish','bonk','toast','conehead','bubbles','wukong','lebron']);
  assert.deepEqual(TEAM_FIGHTERS,['wukong','squish']);
  const {CHARACTERS}=await import('../shared/party.js');
  assert.deepEqual(CHARACTERS.map(character=>character.id),Object.keys(FIGHTERS));
});

test('every selectable fighter has the rig parts the renderer needs and the standard arm length', () => {
  assert.ok(TEAM_FIGHTERS.every(id => FIGHTERS[id]));
  for (const [id, f] of Object.entries(FIGHTERS)) {
    const { nodes } = gltfJson(f.url), byName = new Map(nodes.map(n => [n.name, n]));
    for (const part of ['Torso', 'Arm_L', 'Arm_R', 'Leg_L', 'Leg_R']) assert.ok(byName.has(f.prefix + part), `${id} is missing ${f.prefix + part}`);
    for (const side of ['L', 'R']) {
      const arm = byName.get(f.prefix + 'Arm_' + side);
      assert.ok(!arm.rotation && !arm.scale, `${id} arm ${side} must rest unrotated`);
      const hand = nodes[arm.children[0]];
      assert.ok(Math.abs(Math.hypot(...hand.translation) - ARM_LENGTH) < 1e-3, `${id} arm ${side} length`);
    }
  }
});
