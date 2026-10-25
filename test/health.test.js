import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../host/src/simulation.js';
import { CONFIG as C } from '../shared/config.js';

function strike(vx = 0, vz = 0, power = 1) {
  const sim = new Simulation();
  Object.assign(sim.fighters[0], { x: -.8, vx, vz, attack: .18, power });
  sim.fighters[1].x = .8;
  sim.step({});
  return { sim, damage: C.maxHealth - sim.fighters[1].health };
}

test('forward momentum adds damage; lateral and retreating velocity do not', () => {
  const stationary = strike().damage, moving = strike(5).damage;
  assert.ok(stationary > 0);
  assert.ok(moving > stationary, 'running into a punch must deal more damage');
  assert.equal(strike(-5).damage, stationary, 'retreating cannot earn a momentum bonus');
  assert.equal(strike(0, 5).damage, stationary, 'sideways movement cannot earn a momentum bonus');
  assert.ok(strike(0, 0, 0).damage < stationary, 'phone punch strength still matters');
});

test('extreme momentum is capped and health cannot fall below zero', () => {
  const sim = new Simulation();
  Object.assign(sim.fighters[0], { x: -.8, vx: 500, attack: .18, power: 1 });
  Object.assign(sim.fighters[1], { x: .8, health: 1 });
  sim.step({}, .00001);
  assert.equal(sim.motionEvents.find(e => e.type === 'hit').damage, C.maxPunchDamage);
  assert.equal(sim.fighters[1].health, 0);
  assert.equal(sim.winner, 'red');
});

test('a real punch respects windup and damages only once during its hit window', () => {
  const sim = new Simulation();
  sim.fighters[0].x = -.8; sim.fighters[1].x = .8;
  sim.step({ red: { arm: { punch: true, power: 1 } } });
  assert.equal(sim.fighters[1].health, 100, 'windup cannot damage');
  for (let i = 0; i < 7; i++) sim.step({});
  const remaining = sim.fighters[1].health;
  assert.ok(remaining < 100);
  for (let i = 0; i < 12; i++) sim.step({});
  assert.equal(sim.fighters[1].health, remaining);
  const miss = new Simulation();
  miss.step({ red: { arm: { punch: true, power: 1 } } });
  for (let i = 0; i < 20; i++) miss.step({});
  assert.equal(miss.fighters[1].health, 100, 'out-of-range punch cannot damage');
});

test('simultaneous lethal punches draw and use momentum from before either knockback', () => {
  const sim = new Simulation();
  Object.assign(sim.fighters[0], { x: -.8, health: 1, vx: 3, attack: .18, power: 1 });
  Object.assign(sim.fighters[1], { x: .8, health: 1, vx: -3, attack: .18, power: 1 });
  assert.deepEqual(sim.step({}), ['blue', 'red']);
  assert.equal(sim.winner, 'draw');
  assert.equal(sim.fighters[0].health, 0); assert.equal(sim.fighters[1].health, 0);
  const hits = sim.motionEvents.filter(e => e.type === 'hit');
  assert.equal(hits[0].damage, hits[1].damage);
  assert.deepEqual(sim.step({}), [], 'finished rounds cannot take more damage');
  sim.reset();
  assert.equal(sim.winner, null);
  assert.ok(sim.fighters.every(f => f.health === C.maxHealth));
});

test('ring-outs still win against an opponent with full health', () => {
  const sim = new Simulation();
  sim.fighters[0].y = C.eliminationY - 1;
  sim.step({});
  assert.equal(sim.winner, 'blue');
  assert.equal(sim.fighters[0].health, C.maxHealth);
});
