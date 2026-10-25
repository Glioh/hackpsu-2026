import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../host/src/simulation.js';
import { CONFIG as C } from '../shared/config.js';
function strike(damage=0,power=1) {
  const sim=new Simulation();sim.fighters[0].x=-.65;Object.assign(sim.fighters[1],{x:.65,damage});
  let impact;
  for(let i=0;i<20;i++){sim.step(i===0?{red:{arm:{punch:true,power}}}:{});if(sim.motionEvents.some(e=>e.type==='hit')){impact={speed:Math.hypot(sim.fighters[1].vx,sim.fighters[1].vz),lift:sim.fighters[1].vy};break;}}
  return {sim,impact};
}
test('damage starts at zero, accumulates and never causes a health knockout',()=>{
  const {sim,impact}=strike(500);assert.ok(impact);assert.ok(sim.fighters[1].damage>500);assert.equal(sim.winner,null);
  sim.reset();assert.ok(sim.fighters.every(f=>f.damage===0));
});
test('damage raises recoil gradually and caps the launch at high percentages',()=>{
  const fresh=strike(0).impact,hurt=strike(100).impact,cap=strike(180).impact,extreme=strike(10000).impact;
  assert.ok(hurt.speed>fresh.speed);assert.ok(hurt.lift>fresh.lift);assert.ok(hurt.speed<fresh.speed*1.7);
  assert.equal(cap.speed,extreme.speed);assert.ok(cap.speed<=C.maxKnockback);assert.ok(fresh.speed<7);
});
test('uppercuts respect windup, hit once, and miss outside actual hand reach',()=>{
  const sim=new Simulation();sim.fighters[0].x=-.65;sim.fighters[1].x=.65;
  sim.step({red:{arm:{punch:true,power:1}}});assert.equal(sim.fighters[1].damage,0);
  let hits=0;for(let i=0;i<25;i++)hits+=sim.step({}).length;
  assert.equal(hits,1);assert.ok(sim.fighters[1].damage>0);
  const miss=new Simulation();miss.step({red:{arm:{punch:true}}});for(let i=0;i<25;i++)miss.step({});assert.equal(miss.fighters[1].damage,0);
});
test('punch power matters and damage per hit stays modest',()=>{
  assert.ok(strike(0,1).sim.fighters[1].damage>strike(0,0).sim.fighters[1].damage);
  assert.ok(strike().sim.fighters[1].damage<=C.maxPunchDamage);
});
test('simultaneous uppercuts trade fairly and ring-outs decide rounds',()=>{
  const sim=new Simulation();sim.fighters[0].x=-.65;sim.fighters[1].x=.65;
  sim.step({red:{arm:{punch:true,power:1}},blue:{arm:{punch:true,power:1}}});
  for(let i=0;i<12;i++)sim.step({});assert.ok(sim.fighters[0].damage>0);assert.equal(sim.fighters[0].damage,sim.fighters[1].damage);assert.equal(sim.winner,null);
  sim.fighters[0].lives=1;sim.fighters[0].y=C.eliminationY-1;sim.step({});assert.equal(sim.winner,'blue');assert.deepEqual(sim.step({}),[]);
  sim.reset();sim.fighters.forEach(f=>{f.lives=1;f.y=C.eliminationY-1;});sim.step({});assert.equal(sim.winner,'draw');
});
