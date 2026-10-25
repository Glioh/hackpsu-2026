import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Simulation} from '../host/src/simulation.js';
import {createBotController} from '../host/src/bot.js';
import {createMountainView} from '../host/src/mountain-view.js';
import {MOUNTAIN_LAYOUT} from '../shared/mountain-layout.js';

const run=(s,n,input={})=>{for(let i=0;i<n;i++)s.step(input);};
function at(x,z,y=0) {const s=new Simulation('mountain');Object.assign(s.fighters[0],{x,z,y,heading:0});return s;}

test('Cloudpeak spawns on stable ground and resets as a separate map',()=>{
  const s=new Simulation('mountain');run(s,120);
  assert.equal(s.arena.id,'mountain');assert.equal(s.winner,null);
  for(const f of s.fighters){assert.equal(f.y,0);assert.equal(f.grounded,true);}
  s.setMap('skyline');s.setMap('mountain');assert.equal(s.fighters[0].damage,0);assert.equal(s.arena.navigation,true);
});

test('Cloudpeak stairs and incline lead onto distinct raised terraces',()=>{
  for(const [x,z,height]of [[0,2,1.8],[-9,7.5,.9]]) {
    const s=at(x,z);run(s,70,{red:{legs:{moveZ:-1}}});
    assert.ok(Math.abs(s.fighters[0].y-height)<.001);assert.equal(s.fighters[0].grounded,true);
  }
});

test('Cloudpeak training dummies and boulders obstruct walking',()=>{
  const dummy=at(4,5.3);run(dummy,45,{red:{legs:{moveZ:-1}}});
  assert.ok(dummy.fighters[0].z>4.2);assert.ok(dummy.fighters[0].y<.4);
  const boulder=at(8.5,4);run(boulder,50,{red:{legs:{moveZ:-1}}});assert.ok(boulder.fighters[0].z>2.8);
});

test('Cloudpeak has open cliff ring-outs on all four sides',()=>{
  for(const [x,z,y,moveX,moveZ]of [[-12.7,5,0,-1,0],[12.7,5,0,1,0],[0,9.7,0,0,1],[0,-9.7,1.8,0,-1]]) {
    const s=at(x,z,y);run(s,120,{red:{legs:{moveX,moveZ}}});assert.equal(s.winner,'blue');
  }
});

test('Cloudpeak bot routes around a training dummy and climbs the upper terrace stairs',()=>{
  const sim=new Simulation('mountain'),bot=createBotController();
  Object.assign(sim.fighters[0],{x:3,z:-4,y:1.8});Object.assign(sim.fighters[1],{x:4,z:6,y:0});
  let climbed=false;
  for(let i=0;i<1200;i++){const input=bot(sim);input.arm.punch=false;sim.step({blue:input});climbed ||= sim.fighters[1].y>1.7;}
  const [a,b]=sim.fighters;assert.equal(sim.winner,null);assert.ok(climbed);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1.65);
});

test('Cloudpeak visuals share structural dimensions with collision and toggle independently',()=>{
  const scene=new T.Scene(),draw=createMountainView(scene);const root=scene.getObjectByName('Cloudpeak / mountain kung fu arena');
  assert.ok(root);assert.equal(root.visible,false);
  for(const p of MOUNTAIN_LAYOUT)assert.ok(root.getObjectByName(p.name),p.name);
  draw(true,1,[],new T.PerspectiveCamera());assert.equal(root.visible,true);
  draw(false,2,[]);assert.equal(root.visible,false);
});
