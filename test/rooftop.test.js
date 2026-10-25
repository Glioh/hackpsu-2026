import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Simulation} from '../host/src/simulation.js';
import {createArena} from '../host/src/maps.js';
import {CONFIG as C} from '../shared/config.js';
import {ROOFTOP_SCALE as S} from '../shared/rooftop-config.js';
import * as T from 'three';
import {createRooftopVisibility} from '../host/src/rooftop-visibility.js';
import {createCity} from '../host/src/rooftop-city.js';
import {frameFighters} from '../host/src/camera.js';

const run=(s,n,input={})=>{for(let i=0;i<n;i++)s.step(input);};
function at(x,z,y=0) {
  const s=new Simulation('skyline');Object.assign(s.fighters[0],{x:x*S,z:z*S,y,heading:0});return s;
}

test('Skyline uses the saved approved mesh, without preview mannequins',async()=>{
  for(const [file,approved] of [['art/prototypes/rooftop/approved-v1/rooftop.glb',true],['host/assets/maps/skyline.glb',false]]) {
    const b=await readFile(new URL('../'+file,import.meta.url));assert.equal(b.toString('ascii',0,4),'glTF');
    assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);
    const gltf=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
    assert.equal(gltf.nodes.some(n=>/mannequin/i.test(n.name||'')),approved);
  }
});

test('Skyline spawns clear, resets cleanly, and has no lower rear corridor',()=>{
  const s=new Simulation('skyline');run(s,120);
  assert.equal(s.winner,null);
  for(const f of s.fighters){assert.equal(f.y,0);assert.equal(f.grounded,true);}
  for(let x=-10.5;x<=10.5;x+=.5)assert.ok(s.arena.floorAt(x*S,-7.65*S)?.y>1,'back row is raised to the edge');
  assert.equal(s.arena.floorAt(0,-7.71*S),null);
  s.fighters[0].damage=100;s.reset();assert.equal(s.fighters[0].damage,0);assert.equal(s.arena.id,'skyline');
});

test('Skyline ramp and stairs climb to matching terrace heights and descend',()=>{
  for(const [x,z,height] of [[-4.32,5.7,1.585],[3.6,4.2,2.585]]) {
    const s=at(x,z);run(s,75,{red:{legs:{moveZ:1}}});
    assert.ok(Math.abs(s.fighters[0].y-height)<.001);assert.equal(s.fighters[0].grounded,true);
    run(s,75,{red:{legs:{moveZ:-1}}});run(s,30);
    assert.equal(s.fighters[0].y,0);assert.equal(s.winner,null);
  }
});

test('Skyline obstacles block walking and high-speed launches without teleporting onto the top',()=>{
  const s=at(-8,0);run(s,40,{red:{legs:{moveX:1}}});
  assert.ok(s.fighters[0].x<-7*S);assert.equal(s.fighters[0].y,0);
  const f=s.fighters[0];Object.assign(f,{vx:90,stun:1,grounded:false,vy:0});s.step({});
  assert.ok(f.x<-7*S);assert.ok(f.y<.01);
});

test('Skyline jumping over a skylight lands on its sloped surface',()=>{
  const s=at(.28,4.032,2);const f=s.fighters[0];Object.assign(f,{grounded:false,vy:-1});
  let landed=false;
  for(let i=0;i<60;i++){s.step({});landed ||= s.motionEvents.some(e=>e.type==='landing'&&e.team==='red');}
  assert.equal(f.grounded,true);assert.ok(f.y>.8&&f.y<1.1);assert.equal(landed,true);
});

test('Skyline jump input clears low obstacles and walking off a terrace falls to the roof',()=>{
  const s=at(-4.32,1.5,1.585);s.step({red:{legs:{jump:true}}});assert.ok(s.fighters[0].vy>0);assert.equal(s.fighters[0].grounded,false);
  const falling=at(-6.5,1.6,1.585);run(falling,40,{red:{legs:{moveX:-1}}});run(falling,35);
  assert.equal(falling.fighters[0].y,0);assert.equal(falling.winner,null);
});

test('Skyline all four open edges allow ring-outs, including from the raised rear',()=>{
  for(const [x,z,y,moveX,moveZ] of [[-10.9,6,0,-1,0],[10.9,6,0,1,0],[0,8.8,0,0,1],[0,-7.5,1.185,0,-1]]) {
    const s=at(x,z,y);run(s,120,{red:{legs:{moveX,moveZ:-moveZ}}});
    assert.equal(s.winner,'blue');assert.ok(s.fighters[0].y<C.eliminationY);
  }
});

test('Skyline support under a bridge remains on the roof and cannot snap up through it',()=>{
  const a=createArena('skyline');assert.equal(a.floorAt(-.3*S,-1.3*S,0).y,0);
  const s=at(-.3,-1.3);run(s,20);assert.equal(s.fighters[0].y,0);
});

test('Skyline foreground obstacles fade for a hidden fighter and restore without changing shared materials',()=>{
  const model=new T.Group(),material=new T.MeshStandardMaterial({color:'#789'});
  const wall=new T.Mesh(new T.BoxGeometry(3,3,1),material);wall.position.set(0,1.5,2);model.add(wall);
  const other=new T.Mesh(new T.BoxGeometry(1,1,1),material);other.position.set(8,1,0);model.add(other);
  const camera=new T.PerspectiveCamera();camera.position.set(0,2,8);
  const visibility=createRooftopVisibility(model);visibility([{x:0,y:0,z:0}],camera);
  assert.ok(wall.material.opacity<.3);assert.equal(other.material,material);assert.equal(material.opacity,1);
  const faded=wall.material;
  visibility([{x:7,y:0,z:0}],camera);assert.equal(wall.material,material);
  visibility([{x:0,y:0,z:0}],camera);assert.equal(wall.material,faded,'reuses the fade material');
});

test('Skyline camera follows elevated fighters and the city is batched',()=>{
  const high=frameFighters([{x:-4,y:1.585,z:1},{x:4,y:2.585,z:0}],16/9,undefined,true);
  assert.ok(high.target[1]>3.6);assert.ok(high.distance>=19);
  const city=createCity();assert.equal(city.children.length,2);assert.ok(city.children[0].count>=130, '65 towers include batched roof setbacks');
  assert.ok(city.children[1].count>1000);
});
