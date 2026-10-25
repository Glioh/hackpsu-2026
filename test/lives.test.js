import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Simulation } from '../host/src/simulation.js';
import { MAPS } from '../host/src/maps.js';
import { CONFIG as C } from '../shared/config.js';
import { createKOEffects } from '../host/src/ko-effects.js';

const advance = (sim, seconds) => { for (let i = 0; i < Math.ceil(seconds / C.tick); i++) sim.step({}); };
const fall = (sim, fighters = [sim.fighters[0]]) => {
  fighters.forEach(f => Object.assign(f, { y: C.eliminationY - 1, grounded: false }));
  sim.step({});
};

test('fighters face each other at the start of every arena and rematch', () => {
  for (const {id} of MAPS) {
    const sim = new Simulation(id);
    for (let round=0;round<2;round++) {
      for (const [i,f] of sim.fighters.entries()) {
        const opponent=sim.fighters[1-i],dx=opponent.x-f.x,dz=opponent.z-f.z,distance=Math.hypot(dx,dz);
        assert.ok(Math.abs(Math.sin(f.heading)-dx/distance)<1e-9,id);
        assert.ok(Math.abs(Math.cos(f.heading)-dz/distance)<1e-9,id);
      }
      sim.reset();
    }
  }
});

test('every map grants two lives and respawns on solid central terrain after 1.5 seconds', () => {
  for (const { id } of MAPS) {
    const sim = new Simulation(id), red = sim.fighters[0];
    assert.ok(sim.fighters.every(f => f.lives === 2), id);
    red.damage = 150; red.weapon = { type: 'sword', uses: 3 };
    fall(sim);
    assert.equal(red.lives, 1, id); assert.equal(sim.winner, null);
    assert.equal(sim.motionEvents.filter(e => e.type === 'ringout').length, 1);
    const time = sim.arena.time;
    advance(sim, 1);
    assert.ok(red.respawnRemaining > 0); assert.equal(red.lives, 1);
    assert.ok(sim.arena.time > time, 'arena keeps running during respawn');
    advance(sim, .55);
    assert.equal(red.respawnRemaining, 0, id); assert.equal(red.lives, 1, id);
    assert.equal(red.damage, 0); assert.equal(red.weapon, null);
    assert.ok(sim.arena.floorAt(red.x, red.z), id);
    assert.ok(red.grounded, id);
    sim.reset(); assert.ok(sim.fighters.every(f => f.lives === 2));
  }
});

test('only second fall ends round; simultaneous falls draw only on final lives', () => {
  const sim = new Simulation();
  for (let lives = 1; lives >= 0; lives--) {
    fall(sim, sim.fighters);
    assert.deepEqual(sim.fighters.map(f => f.lives), [lives, lives]);
    assert.equal(sim.motionEvents.filter(e => e.type === 'ringout').length, 2);
    assert.equal(sim.winner, lives ? null : 'draw');
    if (lives) advance(sim, 1.55);
  }
  assert.deepEqual(sim.step({}), []);
  sim.reset(); sim.fighters[0].lives = 1;
  fall(sim, sim.fighters);
  assert.equal(sim.winner, 'blue'); assert.equal(sim.fighters[1].lives, 1);
});

test('waiting fighters cannot move, attack, pick up weapons, or take grenade damage', () => {
  const sim = new Simulation(), red = sim.fighters[0];
  fall(sim);
  const before = { ...red };
  sim.weapons.spawn(sim.arena, 'sword', red.x, red.z).y = red.y;
  sim.weapons.state.grenades.push({ id: 1, owner: 'blue', x: red.x, y: red.y, z: red.z,
    vx: 0, vy: 0, vz: 0, fuse: 0, spin: 0 });
  sim.step({ red: { legs: { moveX: 1, jump: true }, arm: { punch: true } } });
  assert.equal(red.x, before.x); assert.equal(red.y, before.y);
  assert.equal(red.attack, 0); assert.equal(red.damage, 0); assert.equal(red.weapon, null);
  assert.equal(red.lives, 1); assert.equal(sim.motionEvents.some(e => e.type === 'ringout'), false);
});

test('respawn avoids missing center tiles and retries when no solid floor remains', () => {
  const sim = new Simulation('tiles');
  sim.arena.update = () => {};
  for (const p of sim.arena.pieces) if (Math.abs(p.x) < 2 && Math.abs(p.z) < 2) p.solid = false;
  fall(sim); advance(sim, 1.55);
  const red = sim.fighters[0];
  assert.equal(red.respawnRemaining, 0); assert.ok(sim.arena.floorAt(red.x, red.z));
  assert.ok(Math.hypot(red.x, red.z) > 0);
  // Retry the first respawn in a fresh round so the fighter still has a life left.
  sim.reset();sim.arena.update = () => {};
  const waiting=sim.fighters[0];
  sim.arena.pieces.forEach(p => p.solid = false);
  fall(sim); advance(sim, 2);
  assert.equal(waiting.lives, 1); assert.ok(waiting.respawnRemaining > 0);
  sim.arena.pieces.forEach(p => p.solid = true);
  advance(sim, .1); assert.equal(waiting.respawnRemaining, 0); assert.equal(waiting.lives, 1);
});

test('ring-out beams animate independently, coexist, expire, and clear on reset', () => {
  const load = T.TextureLoader.prototype.load;
  T.TextureLoader.prototype.load = () => new T.Texture();
  try {
    const scene = new T.Scene(), ko = createKOEffects(scene);
    ko.trigger([{ team: 'red', x: 1, z: 2 }]); ko.update(.1);
    assert.ok(scene.children[0].children[0].scale.y > 0);
    ko.trigger([{ team: 'blue', x: 3, z: 4 }]);
    assert.equal(scene.children.length, 2);
    ko.update(1.41); assert.equal(scene.children.length, 1);
    ko.update(.1); assert.equal(scene.children.length, 0);
    ko.trigger([{ team: 'red', x: 0, z: 0 }]); ko.clear();
    assert.equal(scene.children.length, 0);
  } finally { T.TextureLoader.prototype.load = load; }
});

test('permanent falling map restores central footing if every tile has collapsed', () => {
  const sim = new Simulation('falling');
  sim.arena.pieces.forEach(p => Object.assign(p, { solid: false, state: 'gone', y: -20 }));
  fall(sim); advance(sim, 1.55);
  const red = sim.fighters[0];
  assert.equal(red.respawnRemaining, 0); assert.equal(red.lives, 1);
  assert.ok(red.grounded); assert.ok(sim.arena.floorAt(red.x, red.z));
});
