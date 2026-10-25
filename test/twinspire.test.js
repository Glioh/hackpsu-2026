import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Simulation} from '../host/src/simulation.js';
import {createArena} from '../host/src/maps.js';
import {createBotController} from '../host/src/bot.js';
import {createTwinspire} from '../host/src/twinspire-model.js';
import {createTwinspireView} from '../host/src/twinspire-view.js';
import {TWINSPIRE_LAYOUT} from '../shared/twinspire-layout.js';

const run=(s,n,input={})=>{for(let i=0;i<n;i++)s.step(input);};
const at=(x,z)=>{const s=new Simulation('twinspire');Object.assign(s.fighters[0],{x,z,y:0,heading:0});return s;};

test('Twinspire spawns opposing players on stable separate roofs and resets',()=>{
  const s=new Simulation('twinspire');run(s,180);
  assert.deepEqual(s.fighters.map(f=>[f.x,f.z,f.y]),[[-13,0,0],[13,0,0]]);
  assert.equal(s.winner,null);
  assert.ok(s.fighters.every(f=>f.grounded));
  assert.equal(s.fighters[0].heading,Math.PI/2);assert.equal(s.fighters[1].heading,-Math.PI/2);
  s.setMap('classic');s.setMap('twinspire');assert.equal(s.fighters[0].x,-13);
});

test('Twinspire bridges support crossing while central gap and outer edges ring out',()=>{
  for(const z of [-3,4]) {
    const s=at(-5,z);run(s,140,{red:{legs:{moveX:1}}});
    assert.ok(s.fighters[0].x>4);assert.equal(s.fighters[0].grounded,true);assert.equal(s.winner,null);
  }
  for(const [x,z,moveX,moveZ]of [[-4,.5,1,0],[-18,2,-1,0],[-11,9,0,1],[18,2,1,0]]) {
    const s=at(x,z);run(s,180,{red:{legs:{moveX,moveZ:-moveZ}}});assert.equal(s.winner,null);assert.equal(s.fighters[0].lives,2);
  }
  assert.equal(createArena('twinspire').floorAt(0,0),null);
});

test('Twinspire wide lanes allow two-way crossings near both fences',()=>{
  for(const center of [-3,4])for(const offset of [-1.5,1.5])for(const direction of [-1,1]) {
    const s=at(-5*direction,center+offset);
    run(s,140,{red:{legs:{moveX:direction}}});
    assert.ok(s.fighters[0].x*direction>4);
    assert.equal(s.fighters[0].grounded,true);
    assert.equal(s.winner,null);
  }
});

test('Twinspire fences stop walking off either side without blocking the entrances',()=>{
  for(const center of [-3,4])for(const direction of [-1,1]) {
    const s=at(0,center);
    run(s,120,{red:{legs:{moveZ:-direction}}});
    assert.ok((s.fighters[0].z-center)*direction<2.3);
    assert.equal(s.fighters[0].y,0);
    assert.equal(s.fighters[0].grounded,true);
    assert.equal(s.winner,null);
    run(s,90,{red:{legs:{moveX:1}}});
    assert.ok(s.fighters[0].x>4,'can move along the fence and exit onto the roof');
  }
});

test('Twinspire equipment blocks movement and service stairs climb onto the deck',()=>{
  const wall=at(-13,-3);run(wall,90,{red:{legs:{moveZ:1}}});
  assert.ok(wall.fighters[0].z>-5);assert.equal(wall.fighters[0].y,0);
  const stairs=at(-7,-3);run(stairs,42,{red:{legs:{moveZ:1}}});
  assert.equal(stairs.fighters[0].grounded,true);assert.ok(stairs.fighters[0].y>=.675);
});

test('Twinspire bot routes from the opposite tower across a bridge',()=>{
  const s=new Simulation('twinspire'),bot=createBotController();let crossed=false;
  for(let i=0;i<1400;i++){const input=bot(s);input.arm.punch=false;s.step({blue:input});crossed ||= s.fighters[1].x<-3;}
  assert.equal(s.winner,null);assert.ok(crossed);
  assert.ok(Math.hypot(s.fighters[0].x-s.fighters[1].x,s.fighters[0].z-s.fighters[1].z)<1.7);
});

test('Twinspire visible solids match physics, omit mannequins in game, and toggle',()=>{
  const {root}=createTwinspire({includePlayers:false});
  assert.ok(!root.children.some(m=>/Fighter|player \/ facing/.test(m.name)));
  for(const p of TWINSPIRE_LAYOUT){
    const m=root.children.find(m=>m.name===p.name&&m.position.x===p.x&&m.position.z===p.z);
    assert.ok(m,p.name);const bounds=new T.Box3().setFromObject(m);
    assert.ok(Math.abs(bounds.max.y-p.y)<1e-5);assert.ok(Math.abs(bounds.min.y-p.bottom)<1e-5);
    assert.ok(Math.abs(bounds.max.x-(p.x+p.hw))<1e-5);
  }
  const scene=new T.Scene(),draw=createTwinspireView(scene);assert.equal(scene.children[0].visible,false);
  draw(true);assert.equal(scene.children[0].visible,true);draw(false);assert.equal(scene.children[0].visible,false);
});
