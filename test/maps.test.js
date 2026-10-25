import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, createArena, chooseRandomMap } from '../host/src/maps.js';
import { Simulation } from '../host/src/simulation.js';
import { CONFIG as C } from '../shared/config.js';

const run = (sim, seconds, inputs = () => ({})) => { for (let i = 0; i < Math.round(seconds / C.tick); i++) sim.step(inputs()); };
// Keep blue parked far away so it does not interfere.
const solo = (map, seed = 1) => { const s = new Simulation(map, seed); return s; };

test('random selection covers every existing map without generating a new map type',()=>{
  assert.equal(chooseRandomMap(()=>0),MAPS[0].id);
  assert.equal(chooseRandomMap(()=>.999999),MAPS.at(-1).id);
  assert.deepEqual(MAPS.map((_,i)=>chooseRandomMap(()=>(i+.5)/MAPS.length)),MAPS.map(m=>m.id));
  assert.ok(!MAPS.some(m=>m.id==='random'));
});

test('maps stay in early / mid / late order, each building a floor the fighters spawn on', () => {
  const tiers=MAPS.map(m=>['Early','Mid','Late'].indexOf(m.tier));
  assert.ok(tiers.every(t=>t>=0));assert.deepEqual(tiers,[...tiers].sort((a,b)=>a-b));
  for (const { id } of MAPS) {
    const a = createArena(id, 1);
    assert.equal(a.id, id);
    for (const [x, z] of a.spawn) assert.ok(a.floorAt(x, z), `${id} spawn has floor`);
    const outside=Math.max(...a.pieces.map(p=>p.x+p.hw))+3;
    assert.equal(a.floorAt(outside, 0), null, `${id} has a void outside`);
  }
});

test('ice rink: momentum carries much further once you let go', () => {
  const slide = map => { const s = solo(map); const red = s.fighters[0]; run(s, 3, () => ({ red: { legs: { moveX: 1 } } })); const x0 = red.x; run(s, 1); return red.x - x0; };
  assert.ok(slide('ice') > slide('classic') * 3);
});

test('earthquake: tremors bounce grounded fighters around', () => {
  const s = solo('quake'); let moved = 0, airborne = false;
  for (let i = 0; i < 12 / C.tick; i++) { const x = s.fighters[0].x; s.step({}); moved += Math.abs(s.fighters[0].x - x); airborne ||= !s.fighters[0].grounded; }
  assert.ok(moved > 1 && airborne);
  assert.ok(s.arena.shake >= 0);
});

test('disappearing tiles: blinking tiles drop out under you, then come back', () => {
  const s = solo('tiles'), tiles = s.arena.pieces;
  run(s, 6);
  assert.ok(tiles.some(t => t.state === 'gone') && tiles.some(t => t.state === 'warn'));
  const gone = tiles.find(t => t.state === 'gone');
  Object.assign(s.fighters[0], { x: gone.x, z: gone.z });
  run(s, 2);
  assert.equal(s.fighters[0].lives, 2, 'standing on a missing tile costs one life');
  const t = createArena('tiles', 2); t.pieces[0].state = 'warn'; t.pieces[0].t = .1;
  for (let i = 0; i < 400; i++) t.step(C.tick, [], []);
  assert.ok(t.pieces.filter(p => p.state === 'gone').length < t.pieces.length / 2, 'tiles return');
});

test('splitting floor: a gap opens down the middle and the halves carry you apart', () => {
  const s = solo('split'); const red = s.fighters[0];
  run(s, 6); // fully open, splitting left/right
  assert.equal(s.arena.floorAt(0, 0), null);
  assert.ok(red.x < -3.5, 'red rode the left half outward');
  run(s, 3.5); assert.ok(s.arena.floorAt(0, 0), 'slams shut');
  run(s, 5.5); assert.equal(s.arena.floorAt(0, 0), null); assert.ok(s.arena.floorAt(5, 5) && !s.arena.floorAt(5, 0), 'next split is front/back');
});

test('moving platforms: small island, platforms carry you, the void in between', () => {
  const s = solo('platforms'), a = s.arena;
  assert.ok(a.floorAt(0, 0) && !a.floorAt(6, 0) || a.floorAt(6, 0)?.kind === 'platform');
  const plat = a.pieces.find(p => p.kind === 'platform');
  Object.assign(s.fighters[0], { x: plat.x, z: plat.z });
  const x0 = s.fighters[0].x; run(s, 1.5);
  assert.ok(Math.abs(s.fighters[0].x - x0) > 1 && s.fighters[0].grounded && s.winner === null, 'carried by the platform');
});

test('falling platforms: tiles crumble under you and never return', () => {
  const s = solo('falling'), red = s.fighters[0]; red.z = 1; // middle of a tile, not on a seam
  const tile = s.arena.floorAt(red.x, red.z);
  run(s, 1); assert.equal(tile.state, 'warn');
  run(s, 3); assert.notEqual(tile.state, 'solid');
  assert.equal(s.fighters[0].lives, 2, 'rode the tile down');
  const a = createArena('falling', 4);
  for (let i = 0; i < 60 / C.tick; i++) a.step(C.tick, [], []);
  assert.ok(a.pieces.filter(p => p.state === 'gone').length > 10);
});

test('conveyor chaos: belts drag you along, then reverse', () => {
  const s = solo('conveyor'), red = s.fighters[0], belt = s.arena.floorAt(red.x, red.z), dir = Math.sign(belt.vx);
  const x0 = red.x; run(s, 1);
  assert.ok((red.x - x0) * dir > 1.5);
  run(s, 8); assert.ok(belt.vx * dir < 0 || s.winner, 'belt reversed');
});
