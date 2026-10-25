import test from 'node:test';
import assert from 'node:assert/strict';
import { createArena, MAPS } from '../host/src/maps.js';
import { SUMO, SUMO_GIANTS } from '../host/src/sumo-map.js';
import { Simulation, fighter } from '../host/src/simulation.js';

test('sumo is selectable with three distinct existing giants and an open front', () => {
  assert.ok(MAPS.some(m => m.id === 'sumo'));
  assert.equal(new Set(SUMO_GIANTS.map(g => g.character)).size, 3);
  assert.ok(SUMO_GIANTS.every(g => g.z <= 0));
  const arena = createArena('sumo');
  assert.equal(arena.pieces.length, 1, 'only the floor is collidable');
  for (const [x,z] of arena.spawn) assert.ok(arena.floorAt(x,z));
  for (const [x,z] of [[9.01,0],[-9.01,0],[0,7.01],[0,-7.01]]) assert.equal(arena.floorAt(x,z),null);
});

test('laser locks a marked target for the full warning before applying damage', () => {
  const a = createArena('sumo'), f = fighter('red', 0, 0), events = [];
  a.step(2, [f], events);
  const laser = a.lasers[0];
  assert.equal(laser.state, 'warning'); assert.equal(f.damage,0);
  const target = [laser.x,laser.z];
  f.x = 5;
  a.step(SUMO.warning - .001,[f],events);
  assert.deepEqual([laser.x,laser.z],target); assert.equal(events.length,0);
  Object.assign(f,{x:target[0],z:target[1]});
  a.step(.0011,[f],events);
  assert.equal(laser.state,'firing'); assert.equal(f.damage,SUMO.damage);
  assert.ok(f.vx > 0 && f.vy > 0 && f.stun > 0 && !f.grounded);
  assert.deepEqual(events.map(e => [e.type,e.hazard,e.team,e.damage]),[['hit','laser','red',18]]);
});

test('beam hits each fighter once per shot, including entry after firing, and rearms next cycle', () => {
  const a=createArena('sumo'), red=fighter('red',0,0), blue=fighter('blue',6,0), events=[];
  a.step(2,[red],events); a.step(1.5,[red,blue],events);
  blue.x=0;
  for(let i=0;i<20;i++) a.step(.01,[red,blue],events);
  assert.equal(red.damage,18); assert.equal(blue.damage,18); assert.equal(events.length,2);
  a.step(.3,[],events); assert.equal(a.lasers[0].state,'idle');
  a.step(4.01,[],events); // next warning locks a new spot
  const laser=a.lasers[0]; Object.assign(red,{x:laser.x,z:laser.z,y:0});
  a.step(laser.fireAt-a.time+.001,[red],events);
  assert.equal(red.damage,36);
});

test('dodging, height and void exclude fighters; targets stay inside arena edges', () => {
  for(const pose of [{x:8.9,z:6.9},{x:-8.9,z:-6.9}]) {
    const a=createArena('sumo'), f=Object.assign(fighter('red',0,0),pose), events=[];
    a.step(2,[f],events); const l=a.lasers[0];
    assert.ok(Math.abs(l.x)+l.radius<=SUMO.halfX && Math.abs(l.z)+l.radius<=SUMO.halfZ);
    Object.assign(f,{x:l.x,z:l.z,y:3.1}); a.step(1.5,[f],events); assert.equal(f.damage,0);
    Object.assign(f,{x:10,y:0}); a.step(.05,[f],events); assert.equal(f.damage,0);
    Object.assign(f,{x:l.x+SUMO.radius+.01,z:l.z}); a.step(.05,[f],events); assert.equal(f.damage,0);
  }
});

test('simulation forwards hazard hits and resets hazard state; all four edges allow ring outs', () => {
  const s=new Simulation('sumo'); s.arena.step(2,s.fighters,[]);
  const l=s.arena.lasers[0]; Object.assign(s.fighters[0],{x:l.x,z:l.z});
  const hits=s.step({},1.5);
  assert.ok(hits.includes('red')); assert.ok(s.motionEvents.some(e=>e.hazard==='laser'));
  s.reset(); assert.ok(s.arena.lasers.every(l=>l.state==='idle')); assert.equal(s.fighters[0].damage,0);
  for(const [x,z] of [[10,0],[-10,0],[0,8],[0,-8]]) {
    const sim=new Simulation('sumo'); Object.assign(sim.fighters[0],{x,z});
    for(let i=0;i<120;i++)sim.step({});
    assert.equal(sim.winner,'blue');
  }
});

test('short beam is not skipped when a step crosses its whole active interval', () => {
  const a=createArena('sumo'), f=fighter('red',0,0), events=[];
  a.step(2,[f],events); a.step(2,[f],events);
  assert.equal(f.damage,18); assert.equal(events.length,1); assert.equal(a.lasers[0].state,'idle');
});
