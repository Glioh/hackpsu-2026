import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch, matchRules, shuffled, voteLeaders, makeRoll, rollFrame } from '../shared/party.js';
import { Simulation } from '../host/src/simulation.js';
import { fallbackCombatRig } from '../host/src/combat-rig.js';
import { MAPS } from '../shared/maps.js';
import { CHARACTERS } from '../shared/party.js';
import { access } from 'node:fs/promises';

const match = count => ({ ...makeMatch(Array.from({ length: count }, (_, i) => String(i)), () => .5), mapId: 'classic' });
const fall = (sim, fighters) => { fighters.forEach(f => { f.y = -7; f.grounded = false; }); sim.step({}); };
test('4/6/8/10/12 phones produce balanced pairs and expected mode and stock pool', () => {
  for (const [phones, mode, lives] of [[4,'teams',2],[6,'ffa',1],[8,'teams',2],[10,'ffa',1],[12,'teams',3],[16,'teams',3]]) {
    const m = match(phones); assert.equal(m.count, phones / 2); assert.equal(m.mode, mode); assert.equal(m.lives, lives);
    assert.equal(new Set(m.fighters.flatMap(f => f.players)).size, phones);
    if (mode === 'teams') assert.equal(m.fighters.filter(f => f.side === 'red').length, phones / 4);
  }
  for (const count of [0, 2, 3, 5, 7, 9]) assert.throws(() => matchRules(count));
});
test('votes choose only leaders; roulette slows and ends on the authoritative winner', () => {
  assert.deepEqual(voteLeaders({ a:'ice', b:'ice', c:'classic' }, ['ice','classic','lava']), ['ice']);
  assert.deepEqual(voteLeaders({ a:'ice', b:'classic', c:'ignored' }, ['ice','classic','lava']), ['ice','classic']);
  const roll = makeRoll(['ice','classic'], { now: 100, random: () => .9 });
  assert.equal(roll.winner, 'classic'); assert.equal(rollFrame(roll, 100 + roll.duration), roll.winner);
  const delays = roll.frames.slice(1, -1).map((f, i) => f.at - roll.frames[i].at);
  assert.ok(delays.at(-1) > delays[0] * 2);
  const agree = makeRoll(['squish'], { unanimous: true, now: 0 }); assert.equal(agree.frames.length, 1); assert.equal(agree.winner, 'squish');
  const input = [1,2,3,4]; assert.notDeepEqual(shuffled(input, () => 0), input); assert.deepEqual(input, [1,2,3,4]);
});
test('team lives are shared; either teammate can consume the pool and team loses together', () => {
  const sim = new Simulation(); sim.configureMatch(match(12));
  const red = sim.fighters.filter(f => f.side === 'red');
  fall(sim, [red[0]]); assert.equal(sim.teamLives.red, 2); assert.ok(red.every(f => f.lives === 2)); assert.equal(sim.winner, null);
  fall(sim, [red[1]]); assert.equal(sim.teamLives.red, 1);
  fall(sim, [red[2]]); assert.equal(sim.teamLives.red, 0); assert.ok(red.every(f => f.lives === 0)); assert.equal(sim.winner, 'blue');
  sim.reset(); assert.equal(sim.teamLives.red, 3);
});
test('FFA eliminates only fallen duo, then last standing wins; simultaneous final falls draw', () => {
  const sim = new Simulation(); sim.configureMatch(match(6));
  fall(sim, [sim.fighters[0]]); assert.equal(sim.winner, null); assert.equal(sim.fighters[0].lives, 0);
  for (let i = 0; i < 120; i++) sim.step({}); assert.equal(sim.fighters[0].respawnRemaining, 0);
  fall(sim, [sim.fighters[1]]); assert.equal(sim.winner, sim.fighters[2].team);
  sim.reset(); fall(sim, sim.fighters); assert.equal(sim.winner, 'draw');
});
test('every arena spawns six characters on solid, distinct footing', () => {
  for (const map of MAPS) {
    const sim = new Simulation(map.id), m = match(12); m.mapId = map.id; sim.configureMatch(m);
    assert.equal(sim.fighters.length, 6); assert.equal(sim.rigs.length, 6);
    for (const f of sim.fighters) assert.ok(sim.arena.floorAt(f.x, f.z), map.id);
    assert.equal(new Set(sim.fighters.map(f => `${f.x}:${f.z}`)).size, 6, map.id);
    sim.step({});
  }
});
test('third and later characters can hit opponents, never their own side', () => {
  const sim = new Simulation(); sim.configureMatch(match(8)); sim.rigs = sim.fighters.map(() => fallbackCombatRig());
  const [red1, red2, blue1, blue2] = sim.fighters;
  Object.assign(red1, { x:-8, z:-6 }); Object.assign(blue1, { x:8, z:6 });
  Object.assign(blue2, { x:0, z:0, heading:Math.PI/2 }); Object.assign(red2, { x:1.3, z:0 });
  for (let i=0;i<20;i++) sim.step({[blue2.team]:{arm:{punch:true,power:1}}});
  assert.ok(red2.damage > 0); assert.equal(blue1.damage, 0);
  sim.reset(); const a=sim.fighters[0], b=sim.fighters[1];
  Object.assign(a,{x:0,z:0,heading:Math.PI/2});Object.assign(b,{x:1.3,z:0});
  sim.fighters.slice(2).forEach(f=>{f.x=8;f.z=6;});
  for(let i=0;i<20;i++)sim.step({[a.team]:{arm:{punch:true,power:1}}});assert.equal(b.damage,0);
});
test('every character has a real portrait asset', async () => {
  for (const character of CHARACTERS) await access(new URL('..' + character.portrait, import.meta.url));
});
test('weapons on later fighters find opponents instead of assuming the other array index',()=>{
  for(const type of ['spring','sword']){
    const sim=new Simulation();sim.configureMatch(match(8));
    const [red1,red2,blue1,blue2]=sim.fighters;
    Object.assign(red1,{x:-8,z:-6});Object.assign(red2,{x:1.4,z:0});
    Object.assign(blue1,{x:8,z:6});Object.assign(blue2,{x:0,z:0,heading:Math.PI/2,weapon:{type,uses:2}});
    for(let i=0;i<24;i++)sim.step({[blue2.team]:{arm:{punch:true,power:1}}});
    assert.ok(red2.damage>0,type);assert.equal(blue1.damage,0,type);
    const hits=sim.fighters.filter(f=>f.damage>0);assert.equal(hits.length,1);
  }
});
