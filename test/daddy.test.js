import test from 'node:test';
import assert from 'node:assert/strict';
import { DADDY_RULES, makeMatch, matchRules, rotateDaddy } from '../shared/party.js';
import { Simulation } from '../host/src/simulation.js';
import { WEAPONS } from '../host/src/weapons.js';
import { frameFighters } from '../host/src/camera.js';

const ids = count => Array.from({ length: count }, (_, i) => String(i));
const daddyMatch = count => ({ ...makeMatch(ids(count), () => .5, 'daddy'), mapId: 'classic' });
const fall = (sim, fighters) => { for (const f of fighters) Object.assign(f, { y: -7, grounded: false }); sim.step({}); };
const run = (sim, seconds, inputs = {}) => { for (let t = 0; t < seconds; t += 1 / 60) sim.step(typeof inputs === 'function' ? inputs(t) : inputs); };

test('Daddy vs Children is available from three duos and assigns one rotating Daddy', () => {
  assert.throws(() => matchRules(4, 'daddy'), /at least 6/i);
  for (const players of [6, 8, 10, 12, 16]) {
    const match = daddyMatch(players);
    assert.deepEqual({ mode: match.mode, count: match.count, lives: match.lives }, { mode: 'daddy', count: players / 2, lives: 1 });
    assert.equal(match.fighters.filter(f => f.id === match.daddyId && f.side === 'daddy').length, 1);
    assert.equal(match.fighters.filter(f => f.side === 'children').length, players / 2 - 1);
    assert.ok(match.fighters.every(f => f.players.length === 2));
    assert.equal(match.fighters.find(f => f.id === match.daddyId).scale, DADDY_RULES.scale);
  }
  const match = daddyMatch(6), previous = match.daddyId;
  rotateDaddy(match, () => 0);
  assert.notEqual(match.daddyId, previous);
  assert.equal(match.fighters.find(f => f.id === match.daddyId).label, 'Daddy');
});

test('Daddy and every child have one stock with faction wins and no respawns', () => {
  const sim = new Simulation(); sim.configureMatch(daddyMatch(8));
  const daddy = sim.fighters.find(f => f.side === 'daddy'), children = sim.fighters.filter(f => f.side === 'children');
  assert.ok(sim.fighters.every(f => f.lives === 1));
  fall(sim, [children[0]]);
  assert.equal(children[0].lives, 0); assert.equal(children[0].respawnRemaining, 0); assert.equal(sim.winner, null);
  fall(sim, [daddy]); assert.equal(sim.winner, 'children');

  const daddyWin = new Simulation(); daddyWin.configureMatch(daddyMatch(8));
  fall(daddyWin, daddyWin.fighters.filter(f => f.side === 'children')); assert.equal(daddyWin.winner, 'daddy');
  const draw = new Simulation(); draw.configureMatch(daddyMatch(6)); fall(draw, draw.fighters); assert.equal(draw.winner, 'draw');
});

test('Daddy is larger and slower with exact incoming and outgoing combat tuning', () => {
  const sim = new Simulation(); sim.configureMatch(daddyMatch(6));
  const daddy = sim.fighters.find(f => f.side === 'daddy'), child = sim.fighters.find(f => f.side === 'children');
  const daddyIndex = sim.fighters.indexOf(daddy), childIndex = sim.fighters.indexOf(child);
  assert.equal(daddy.scale, 1.5); assert.equal(sim.rigs[daddyIndex].radius / sim.rigs[childIndex].radius, 1.5);
  Object.assign(daddy, { x: -6, z: -3, vx: 0, vz: 0, heading: 0 });
  Object.assign(child, { x: 6, z: 3, vx: 0, vz: 0, heading: 0 });
  sim.step({ [daddy.team]: { legs: { moveX: 1 }, arm: { turn: 1 } }, [child.team]: { legs: { moveX: 1 }, arm: { turn: 1 } } });
  assert.ok(Math.abs(daddy.vx / child.vx - DADDY_RULES.move) < 1e-9);
  assert.ok(Math.abs(daddy.heading / child.heading - DADDY_RULES.turn) < 1e-9);

  const hit = (attacker, target) => {
    for (const f of sim.fighters) Object.assign(f, { x: 8, z: 6, vx: 0, vy: 0, vz: 0, damage: 0, hit: 0, grounded: true });
    Object.assign(attacker, { x: -1, z: 0, heading: Math.PI / 2, weapon: { type: 'sword', uses: 2 } });
    Object.assign(target, { x: 1, z: 0 });
    let punched = false; run(sim, .5, () => ({ [attacker.team]: { arm: { punch: !punched && (punched = true), power: 1 } } }));
    return { damage: target.damage, launch: Math.hypot(target.vx, target.vz) };
  };
  const daddyHit = hit(daddy, child), childHit = hit(child, daddy);
  assert.equal(daddyHit.damage, Math.round(WEAPONS.sword.damage * DADDY_RULES.damageDealt));
  assert.equal(childHit.damage, Math.round(WEAPONS.sword.damage * DADDY_RULES.damageTaken));
  assert.ok(daddyHit.launch > childHit.launch * 2);
  const normalFrame = frameFighters([{ x: -5, y: 0, z: 0, scale: 1 }, { x: 5, y: 0, z: 0, scale: 1 }], 1, undefined);
  const daddyFrame = frameFighters([{ x: -5, y: 0, z: 0, scale: DADDY_RULES.scale }, { x: 5, y: 0, z: 0, scale: 1 }], 1, undefined);
  assert.ok(daddyFrame.distance > normalFrame.distance, 'camera includes Daddy height and width');
});

test('Children cannot hit one another with melee, weapons, or grenades', () => {
  const sim = new Simulation(); sim.configureMatch(daddyMatch(8));
  const [a, b, c] = sim.fighters.filter(f => f.side === 'children');
  const daddy = sim.fighters.find(f => f.side === 'daddy');
  Object.assign(daddy, { x: -8, z: -6 }); Object.assign(c, { x: 8, z: 6 });
  Object.assign(a, { x: 0, z: 0, heading: Math.PI / 2, weapon: { type: 'sword', uses: 2 } }); Object.assign(b, { x: 1.5, z: 0 });
  let punched = false; run(sim, .5, () => ({ [a.team]: { arm: { punch: !punched && (punched = true), power: 1 } } }));
  assert.equal(b.damage, 0);
  sim.weapons.state.grenades.push({ id: 99, owner: a.team, x: b.x, y: b.y + .3, z: b.z, vx: 0, vy: 0, vz: 0, fuse: .01, spin: 0 });
  run(sim, .2); assert.equal(b.damage, 0);
});
