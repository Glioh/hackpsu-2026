import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../host/src/simulation.js';
import { FINISH_TIME_SCALE, stepFinish } from '../host/src/ko-finish.js';

test('finish slows survivor momentum without changing winner, damage, or eliminated body', () => {
  const sim = new Simulation();
  sim.fighters[0].y = -6; sim.step({});
  const loser = { ...sim.fighters[0] }, survivor = sim.fighters[1];
  const x = survivor.x; survivor.vx = 4;
  stepFinish(sim, FINISH_TIME_SCALE);
  assert.equal(sim.winner, 'blue');
  assert.deepEqual(sim.fighters[0], loser);
  assert.ok(Math.abs(survivor.x - x - 4 * FINISH_TIME_SCALE) < 1e-10);
  assert.equal(survivor.damage, 0);
  assert.equal(survivor.y, 0);
  sim.reset(); assert.equal(sim.winner, null);
});

test('simultaneous void deaths stay a draw throughout the finish', () => {
  const sim = new Simulation();
  sim.fighters.forEach(f => f.y = -6); sim.step({});
  const bodies = structuredClone(sim.fighters);
  stepFinish(sim, .1);
  assert.equal(sim.winner, 'draw');
  assert.deepEqual(sim.fighters, bodies);
});
