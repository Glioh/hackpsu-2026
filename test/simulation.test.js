import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../host/src/simulation.js';
import { CONFIG as C, validInput } from '../shared/config.js';
import { tiltAxis } from '../controller/src/sensors.js';

test('movement spans X and Z and diagonal movement is normalized',()=>{
  function move(x,z){const s=new Simulation();s.fighters[0].heading=0;for(let i=0;i<30;i++)s.step({red:{legs:{moveX:x,moveZ:z}}});return s.fighters[0];}
  const x=move(1,0),z=move(0,1),diagonal=move(1,1);
  assert.ok(x.x>-3&&Math.abs(x.z)<.001);assert.ok(z.z>0&&Math.abs(z.x+3)<.001);
  assert.ok(Math.abs(Math.hypot(diagonal.vx,diagonal.vz)-Math.hypot(x.vx,x.vz))<.001);
});
test('body-relative forward follows the facing angle',()=>{const s=new Simulation();s.step({red:{legs:{moveZ:1}}});assert.ok(s.fighters[0].vx>0);assert.ok(Math.abs(s.fighters[0].vz)<.001);});
test('punch has a windup, directional range, hit reaction, and cooldown',()=>{
  const s=new Simulation();s.fighters[0].x=-.8;s.fighters[1].x=.8;
  let hits=s.step({red:{arm:{punch:true,power:1}}});assert.equal(hits.length,0);
  for(let i=0;i<10;i++)hits.push(...s.step({}));
  assert.deepEqual(hits,['blue']);assert.ok(s.fighters[1].vx>0);assert.ok(s.fighters[1].hit>0);
  const remaining=s.fighters[0].cooldown;s.step({red:{arm:{punch:true}}});assert.ok(s.fighters[0].cooldown<remaining);
});
test('fighters separate at contact',()=>{const s=new Simulation();s.fighters[0].x=0;s.fighters[1].x=0;s.step({});assert.ok(Math.abs(s.fighters[0].x-s.fighters[1].x)>=C.radius*2-.001);});
test('all four platform edges produce a fall, winner, and clean rematch',()=>{
  for(const [x,z] of [[8,0],[-8,0],[0,6],[0,-6]]){const s=new Simulation();Object.assign(s.fighters[0],{x,z});s.step({});assert.equal(s.winner,null);for(let i=0;i<120;i++)s.step({});assert.equal(s.winner,'blue');s.reset();assert.equal(s.winner,null);assert.equal(s.fighters[0].cooldown,0);assert.equal(s.fighters[0].y,0);}
});
test('airborne fighter can cross edge and return before falling',()=>{const s=new Simulation();Object.assign(s.fighters[0],{x:7.1,y:1,vy:1});s.step({});assert.equal(s.winner,null);s.fighters[0].x=6;for(let i=0;i<60;i++)s.step({});assert.equal(s.winner,null);assert.equal(s.fighters[0].grounded,true);});
test('input validator rejects malformed and non-finite values',()=>{assert.equal(validInput('legs',{seq:0,moveX:NaN,moveZ:0}),false);assert.equal(validInput('arm',{seq:1,turn:0,power:-1}),false);assert.equal(validInput('legs',{seq:0,moveX:1,moveZ:-1,jumpId:1}),true);});
test('tilt has dead zone, saturation, and symmetric signs',()=>{assert.equal(tiltAxis(7),0);assert.equal(tiltAxis(35),1);assert.equal(tiltAxis(-35),-1);assert.equal(tiltAxis(100),1);});
