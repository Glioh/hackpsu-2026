import test from 'node:test';
import assert from 'node:assert/strict';
import {configureSolidTerrain} from '../host/src/solid-terrain.js';
import {createArena} from '../host/src/maps.js';
import {Simulation} from '../host/src/simulation.js';

const move=(arena,from,dx,dz,radius=.62)=>{
  const f={...from,x:from.x+dx,z:from.z+dz,grounded:true,vy:0,vx:dx,vz:dz};
  arena.resolveMotion(f,{...from,grounded:true},radius);return f;
};
function wallArena() {
  const arena={};configureSolidTerrain(arena,[
    {name:'Floor',x:0,z:0,hw:8,hd:8,y:0,bottom:-1},
    {name:'Obstacle',x:2,z:0,hw:.5,hd:2,y:3,bottom:0},
  ],[]);return arena;
}

test('a fighter overlapping a terrain side can walk away or slide along it',()=>{
  const arena=wallArena(),from={x:1.4,z:0,y:0};
  assert.ok(move(arena,from,-.2,0).x<1.25);
  assert.ok(move(arena,from,0,.2).z>.15);
});

test('overlap recovery does not allow walking deeper into an obstacle or through a wall',()=>{
  const arena=wallArena();
  assert.equal(move(arena,{x:1.4,z:0,y:0},.2,0).x,1.4);
  assert.ok(move(arena,{x:0,z:0,y:0},5,0).x<.9);
});

test('Skyline rear corners and terrace edges allow escape after a landing overlap',()=>{
  const arena=createArena('skyline');
  for(const [x,z,dx,dz]of [[-12,-4.75,-.25,0],[-11.75,-7,0,.25],[-8.7,0,-.25,0]]) {
    const from={x,z,y:arena.floorAt(x,z).y};
    const f=move(arena,from,dx,dz);
    assert.ok(Math.hypot(f.x-x,f.z-z)>.1,`escape at ${x},${z}`);
  }
});

test('Skyline former bridge/pipe and skylight pinch points have an exit at roof height',()=>{
  const arena=createArena('skyline');
  for(const [x,z]of [[-2,-3],[-1,-3],[0,-3],[1.5,-3],[-2,3],[-2,3.5]]) {
    const from={x,z,y:arena.floorAt(x,z).y};
    assert.ok(Array.from({length:8},(_,i)=>i*Math.PI/4).some(angle=>{
      const f=move(arena,from,Math.cos(angle)*.2,Math.sin(angle)*.2);
      return Math.hypot(f.x-x,f.z-z)>.1;
    }),`exit at ${x},${z}`);
  }
});

test('Skyline bridge risers work in both directions and stairs/ramp allow descent',()=>{
  for(const [x,z,y,moveX,moveZ,expectedY]of [
    [-3,-1.62,1.585,1,0,2.585],[2.1,-1.62,2.585,-1,0,1.585],
    [-5.4,2.5,1.585,0,1,0],[4.5,0,2.585,0,1,0],
  ]) {
    const s=new Simulation('skyline');Object.assign(s.fighters[0],{x,z,y,heading:0});
    for(let i=0;i<70;i++)s.step({red:{legs:{moveX,moveZ}}});
    assert.ok(Math.abs(s.fighters[0].y-expectedY)<.001);
    assert.ok(Math.hypot(s.fighters[0].x-x,s.fighters[0].z-z)>3);
  }
});
