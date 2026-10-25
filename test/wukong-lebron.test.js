import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Simulation } from '../host/src/simulation.js';
import { FIGHTERS } from '../host/src/fighter-model.js';
import { STAFF_LUNGE, STAFF_OVERCOMMIT, TOPPLE, createWukongGags } from '../host/src/wukong-gags.js';

const dt = 1 / 60;
const gltfJson = url => {
  const glb = readFileSync(new URL('..' + url, import.meta.url));
  return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
};
const child = (nodes, parent, name) => nodes[nodes.find(n => n.name === parent).children.find(i => nodes[i].name === name)];

test('Wukong and LeBron are registered; only Wukong has a gameplay quirk', () => {
  assert.deepEqual({ ...FIGHTERS.wukong }, { name: 'Wukong', url: '/host/assets/characters/wukong.glb', prefix: 'WK_', teamMaterial: 'WK_Sash', traits: { staffMomentum: true } });
  assert.deepEqual({ ...FIGHTERS.lebron }, { name: 'LeBron James', url: '/host/assets/characters/lebron.glb', prefix: 'LB_', teamMaterial: 'LB_Wristband' });
});

test('props ride the arm, not the hand, so fist hitboxes stay standard; the headband can slip', () => {
  const wk = gltfJson(FIGHTERS.wukong.url).nodes, lb = gltfJson(FIGHTERS.lebron.url).nodes;
  assert.equal(child(wk, 'WK_Arm_R', 'WK_Staff').extras.ragdoll_part, 'staff');
  assert.equal(child(wk, 'WK_Head', 'WK_Crown').extras.ragdoll_part, 'crown');
  assert.equal(child(lb, 'LB_Arm_R', 'LB_Rock').extras.ragdoll_part, 'ball');
  for (const [nodes, hand] of [[wk, 'WK_Hand_R'], [lb, 'LB_Hand_R']]) assert.equal(nodes.find(n => n.name === hand).children, undefined);
});

test("Wukong's staff drags him forward on every swing, and every third swing over-commits", () => {
  const sim = new Simulation('classic'), [red, blue] = sim.fighters;
  sim.rigs[0].traits = { staffMomentum: true };
  Object.assign(blue, { x: 9 });                                           // nobody to hit
  const swing = () => { red.vx = red.vz = 0; red.cooldown = 0; red.stun = 0; sim.step({ red: { arm: { punch: true, power: 1 } } }); return { speed: red.vx, stun: red.stun }; };
  const [a, b, c] = [swing(), swing(), swing()];                          // red faces +x
  assert.ok(a.speed > STAFF_LUNGE * .8 && b.speed > STAFF_LUNGE * .8 && a.stun === 0, 'dragged forward');
  assert.ok(c.speed > STAFF_OVERCOMMIT * .8 && c.stun > 0, 'third swing lurches him and takes control away');
  const plain = new Simulation('classic'), f = plain.fighters[0];      // other fighters are unaffected
  plain.step({ red: { arm: { punch: true, power: 1 } } });
  assert.ok(Math.abs(f.vx) < .5);
});

test('the staff trails the arm and overshoots, then settles', () => {
  const g = createWukongGags();
  g.staff(0, dt);
  const lags = Array.from({ length: 60 }, () => g.staff(-1.5, dt));     // arm snaps up for a punch
  assert.ok(lags[0] > 1, 'staff lags behind'); assert.ok(Math.min(...lags) < -.05, 'and overshoots');
  let last; for (let i = 0; i < 400; i++) last = g.staff(-1.5, dt);
  assert.ok(Math.abs(last) < 1e-3);
  assert.equal(createWukongGags().staff(-1.5, dt, false), 0, 'still when motion is off');
});

test('victory: the twirl speeds up, then he topples over and stays down', () => {
  const g = createWukongGags(), at = t => g.victory(t);
  assert.ok(at(1).spin - at(.9).spin > at(.3).spin - at(.2).spin, 'twirl accelerates');
  assert.ok(Math.abs(at(.5).tilt) < .15, 'still upright while twirling');
  assert.ok(Math.abs(at(1.8).tilt - TOPPLE) < .02 && Math.abs(at(5).tilt - TOPPLE) < .02, 'falls over and stays down');
});

test('defeat: the headband slips over his eyes while he goes down', () => {
  const g = createWukongGags();
  let slip; for (let i = 0; i < 30; i++) slip = g.crown(true, dt);
  assert.ok(slip > .95);
  for (let i = 0; i < 120; i++) slip = g.crown(false, dt);
  assert.ok(slip < .05, 'back in place for the next round');
});
