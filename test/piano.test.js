import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../host/src/simulation.js';
import {createArena,MAPS} from '../host/src/maps.js';
import {PIANO_KEYS,PIANO_BACK_WALL_Z} from '../shared/piano-layout.js';
import {createPiano} from '../art/prototypes/piano/scene.mjs';
import * as T from 'three';
import {createRooftopVisibility} from '../host/src/rooftop-visibility.js';
test('piano is selectable and both spawns remain grounded',()=>{
 assert.ok(MAPS.find(m=>m.id==='piano'));
 const s=new Simulation('piano');for(let i=0;i<180;i++)s.step({});
 assert.equal(s.winner,null);for(const f of s.fighters){assert.equal(f.y,.12);assert.equal(f.grounded,true);}
});
test('all 88 keys have distinct correct pitches and matching physics surfaces',()=>{
 const arena=createArena('piano'),model=createPiano();assert.equal(model.keys.length,88);
 assert.equal(model.keys.filter(k=>k.userData.midi%12===0).length,8);
 assert.equal(PIANO_KEYS.filter(k=>!k.black).length,52);
 for(const k of PIANO_KEYS){const z=k.black?k.z:27;assert.equal(arena.floorAt(k.x,z).midi,k.midi);const visual=model.keys.find(m=>m.userData.midi===k.midi);const bounds=new T.Box3().setFromObject(visual);assert.ok(Math.abs(bounds.max.y-k.y)<1e-6);assert.ok(Math.abs(bounds.min.x-(k.x-k.hw))<1e-6);}
});
test('soundboard is scenery and open keyboard edges ring out',()=>{
 const a=createArena('piano');assert.equal(a.floorAt(40,-35),null);assert.equal(a.floorAt(0,-40),null);
 const s=new Simulation('piano');Object.assign(s.fighters[0],{x:43,z:26,y:.12});for(let i=0;i<120;i++)s.step({});assert.equal(s.winner,'blue');
});
test('fighter jumps and lands on a raised black key',()=>{
 const s=new Simulation('piano'),k=PIANO_KEYS.find(k=>k.black);Object.assign(s.fighters[0],{x:k.x,z:k.z,y:2,vy:-1,grounded:false});
 for(let i=0;i<50;i++)s.step({});assert.equal(s.fighters[0].y,k.y);assert.equal(s.fighters[0].grounded,true);
});
test('fighter can jump from a white key onto a black key',()=>{
 const s=new Simulation('piano'),k=PIANO_KEYS.find(k=>k.black&&k.x>5);
 const f=s.fighters[0];Object.assign(f,{x:k.x,z:22,y:.12,heading:0,grounded:true});
 for(let i=0;i<48;i++)s.step({red:{legs:{moveZ:i<25?1:0,jump:i===0}}});
 assert.equal(f.y,k.y);assert.equal(f.grounded,true);assert.equal(s.arena.floorAt(f.x,f.z).midi,k.midi);
});
test('piano back wall blocks walking, jumping and fast knockback',()=>{
 for(const airborne of [false,true]){
  const s=new Simulation('piano'),f=s.fighters[0];
  Object.assign(f,{x:8,z:18,y:airborne?1.4:.12,heading:0,grounded:!airborne,vz:-100,stun:1});
  for(let i=0;i<60;i++){
   s.step({red:{legs:{moveZ:1,jump:i===0}}});
   assert.ok(f.z>=PIANO_BACK_WALL_Z+s.rigs[0].radius-1e-5);
  }
 }
});
test('walking across white-key seams never drops a fighter through the keyboard',()=>{
 const s=new Simulation('piano');
 for(let i=0;i<120;i++)s.step({red:{legs:{moveX:1}}});
 assert.equal(s.winner,null);assert.equal(s.fighters[0].grounded,true);assert.equal(s.fighters[0].y,.12);
});
test('piano music desk fades when it blocks the low camera, then restores',()=>{
 const {root}=createPiano(),desk=root.getObjectByName('Music desk'),original=desk.material;
 const visibility=createRooftopVisibility(root),camera=new T.PerspectiveCamera();
 camera.position.set(0,6,20);
 visibility([{x:0,y:0,z:8}],camera);
 assert.equal(desk.material.opacity,.22);
 visibility([],camera);assert.equal(desk.material,original);
});
