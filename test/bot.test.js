import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../host/src/simulation.js';
import {createBotController} from '../host/src/bot.js';
import {ROOFTOP_SCALE as S} from '../shared/rooftop-config.js';

function chase(from,to,{radius,seconds=20}={}) {
  const sim=new Simulation('skyline'),bot=createBotController();
  if(radius)sim.rigs[1].radius=radius;
  for(const [index,p]of [[0,to],[1,from]])Object.assign(sim.fighters[index],{x:p[0]*S,z:p[1]*S,y:p[2],heading:0});
  const positions=[];
  for(let i=0;i<seconds*60;i++) {
    const input=bot(sim);input.arm.punch=false;sim.step({blue:input});
    const f=sim.fighters[1];positions.push({x:f.x,z:f.z,y:f.y});
  }
  const [target,f]=sim.fighters;
  assert.equal(sim.winner,null,'bot stays on the roof');
  assert.ok(Math.hypot(target.x-f.x,target.z-f.z)<1.65,'bot reaches striking distance');
  assert.ok(Math.abs(target.y-f.y)<.4,'bot reaches the opponent elevation');
  return {sim,positions,bot};
}

test('rooftop bot detours around a skylight instead of walking into its side',()=>{
  const {positions}=chase([-1.4,4,0],[2.2,4,0]);
  assert.ok(positions.some(p=>Math.abs(p.z-4*S)>1.5),'takes a route around the skylight');
});

test('rooftop bot finds a route across the arena when a raised terrace blocks the direct chase',()=>{
  const {positions}=chase([-10,0,0],[-1,0,0]);
  assert.ok(positions.some(p=>Math.abs(p.z)>2*S),'leaves the blocked straight line');
});

test('rooftop bot uses the west ramp and east stairs to pursue elevated fighters',()=>{
  const west=chase([1,6,0],[-5.3,.8,1.585]);
  assert.ok(west.positions.some(p=>p.y>1.5));
  const east=chase([3.6,5.8,0],[3.6,-.1,2.585]);
  assert.ok(east.positions.some(p=>p.y>2.45));
});

test('rooftop bot uses its selected character radius for obstacle clearance',()=>{
  chase([-1.4,4,0],[2.2,4,0],{radius:.8});
});

test('bot resets navigation after map changes and rematches, and outputs finite arena-relative controls',()=>{
  const sim=new Simulation('classic'),bot=createBotController();
  for(const map of ['classic','skyline','ice','skyline']) {
    sim.setMap(map);
    for(let i=0;i<40;i++) {
      const input=bot(sim);
      for(const v of [input.legs.moveX,input.legs.moveZ,input.arm.turn])assert.ok(Number.isFinite(v)&&Math.abs(v)<=1);
      sim.step({blue:input});
    }
    sim.reset();assert.equal(sim.winner,null);assert.ok(bot(sim));
  }
});
