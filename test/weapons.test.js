import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../host/src/simulation.js';
import { WEAPONS, createWeapons, springExtension } from '../host/src/weapons.js';

const dt = 1 / 60;
// Classic ring: red at x=-3 facing +x, blue at x=3 facing -x.
const ring = (gap = 3) => {
  const sim = new Simulation('classic');
  const [red, blue] = sim.fighters;
  Object.assign(red, { x: -gap / 2, z: 0 }); Object.assign(blue, { x: gap / 2, z: 0 });
  return { sim, red, blue };
};
const run = (sim, seconds, inputs = () => ({})) => { for (let t = 0; t < seconds; t += dt) sim.step(inputs()); };
const punchOnce = () => { let done = false; return () => { const p = !done; done = true; return { red: { arm: { punch: p, power: 1 } } }; }; };

test('weapons drop two or three times a round, spread out, never two at once', () => {
  const counts = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const { drops } = createWeapons(seed).state;
    counts.add(drops.length);
    assert.ok(drops[0] >= 8 && drops[0] <= 15, 'first drop 8-15 s');
    assert.ok(drops[1] >= 28 && drops[1] <= 38, 'second drop 28-38 s');
    if (drops[2] !== undefined) assert.ok(drops[2] >= 52 && drops[2] <= 67, 'third drop 52-67 s');
  }
  assert.deepEqual([...counts].sort(), [2, 3]);
  const { sim } = ring(); sim.fighters.forEach(f => f.z = 6);       // keep everyone off the drop
  run(sim, 16);
  assert.equal(sim.weapons.state.pickups.length, 1, 'first weapon is on the floor');
  const p = sim.weapons.state.pickups[0];
  assert.ok(sim.arena.floorAt(p.x, p.z) && Math.abs(p.y - sim.arena.floorAt(p.x, p.z).y) < 1e-6, 'resting on solid floor');
});

test('walking over a weapon picks it up; the other fighter cannot take it too', () => {
  const { sim, red, blue } = ring(1);
  sim.weapons.spawn(sim.arena, 'sword', 0, 0);
  run(sim, .1);
  assert.equal(sim.weapons.state.pickups.length, 0);
  assert.equal([red, blue].filter(f => f.weapon).length, 1);
  assert.equal((red.weapon ?? blue.weapon).uses, WEAPONS.sword.uses);
});

test('the sword hits hard up close but has less reach than the spring glove', () => {
  for (const [type, gap, lands] of [['sword', 1.9, true], ['sword', 2.9, false], ['spring', 2.9, true], ['spring', 4.4, false]]) {
    const { sim, red, blue } = ring(gap);
    red.weapon = { type, uses: WEAPONS[type].uses };
    run(sim, .5, punchOnce());
    assert.equal(blue.damage > 0, lands, `${type} at ${gap} m`);
    if (lands) assert.equal(blue.damage, WEAPONS[type].damage);
  }
  assert.ok(WEAPONS.sword.damage > WEAPONS.spring.damage && WEAPONS.sword.reach < WEAPONS.spring.reach);
  const { sim, red, blue } = ring(2.9);                             // a bare fist can't reach that far
  run(sim, .5, punchOnce());
  assert.equal(blue.damage, 0);
  assert.equal(red.weapon, undefined);
});

test('a weapon is used up after its uses, then punches are fists again', () => {
  const { sim, red } = ring(6);
  red.weapon = { type: 'sword', uses: 2 };
  let n = 0; run(sim, 3, () => ({ red: { arm: { punch: (n++ % 50) === 0, power: 1 } } }));
  assert.equal(red.weapon, null);
});

test('the spring glove shoots out and snaps back', () => {
  assert.equal(springExtension(0), 0);
  assert.equal(springExtension(.15), 1);
  assert.equal(springExtension(.5), 0);
});

test('a thrown grenade lobs ahead, bounces, then blows up everyone nearby', () => {
  const { sim, red, blue } = ring(4.5);
  red.weapon = { type: 'grenade', uses: 1 };
  const events = []; let f = punchOnce();
  for (let t = 0; t < 2.5; t += dt) { sim.step(f()); events.push(...sim.motionEvents); }
  assert.equal(red.weapon, null, 'thrown');
  const boom = events.find(e => e.type === 'explosion');
  assert.ok(boom && boom.x > red.x + 2, 'landed a few metres ahead');
  assert.ok(blue.damage > 0 && blue.damage <= WEAPONS.grenade.damage, 'blue caught in the blast');
  assert.ok(events.some(e => e.type === 'hit' && e.weapon === 'grenade' && e.attacker === 'red' && e.team === 'blue'));
  assert.equal(sim.weapons.state.grenades.length, 0);
});

test('grenades hurt their thrower too if they stand on it', () => {
  const { sim, red } = ring(8);
  sim.weapons.state.grenades.push({ id: 99, owner: 'red', x: red.x, y: red.y + .3, z: red.z, vx: 0, vy: 0, vz: 0, fuse: .05, spin: 0 });
  run(sim, .2);
  assert.ok(red.damage >= WEAPONS.grenade.damage * .9);
});

test('the spring glove knocks people back harder than the sword or a fist', () => {
  const launch = type => {
    const { sim, red, blue } = ring(type === 'spring' ? 2.9 : 1.9);
    if (type) red.weapon = { type, uses: 3 };
    for (let t = 0; t < .5 && !blue.hit; t += dt) sim.step(t === 0 ? { red: { arm: { punch: true, power: 1 } } } : {});
    return Math.hypot(blue.vx, blue.vz);
  };
  const spring = launch('spring'), sword = launch('sword');
  assert.ok(spring > sword * 1.4, `spring ${spring.toFixed(1)} vs sword ${sword.toFixed(1)}`);
});
