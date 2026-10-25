import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createArena} from '../host/src/maps.js';
import {Simulation} from '../host/src/simulation.js';
import {SUMMIT_RIM} from '../shared/quake-layout.js';
import {createQuakeView} from '../host/src/quake-view.js';

test('summit collision follows each rocky rim edge, with safe spawns and open cliffs',()=>{
  const a=createArena('quake');
  for(let i=0;i<SUMMIT_RIM.length;i++){
    const [x,z]=SUMMIT_RIM[i],[bx,bz]=SUMMIT_RIM[(i+1)%SUMMIT_RIM.length];
    const mx=(x+bx)/2,mz=(z+bz)/2;
    assert.ok(a.floorAt(mx*.999,mz*.999));assert.equal(a.floorAt(mx*1.001,mz*1.001),null);
  }
  assert.equal(a.floorAt(8,6),null);assert.equal(a.floorAt(0,0,-1),null);
  const s=new Simulation('quake');for(let i=0;i<120;i++)s.step({});
  assert.ok(s.fighters.every(f=>f.grounded&&f.y===0));
  for(const [x,z] of [[10,0],[-10,0],[0,8],[0,-8]]){
    const s=new Simulation('quake');Object.assign(s.fighters[0],{x,z});
    for(let i=0;i<150&&!s.winner;i++)s.step({});assert.equal(s.winner,'blue');
  }
});
test('summit warns before earthquakes, shakes, and resets fresh',()=>{
  const s=new Simulation('quake');let warned=false,shook=false;
  for(let i=0;i<600;i++){
    s.step({});warned ||= s.arena.warning;
    if(s.arena.shake===1){assert.ok(warned);shook=true;break;}
  }
  assert.ok(shook);s.reset();assert.equal(s.arena.shake,0);assert.equal(s.arena.warning,false);assert.equal(s.arena.time,0);
});
test('summit mesh uses the collision rim, descends into a mountain and visibly trembles',()=>{
  const scene=new T.Scene(),draw=createQuakeView(scene),a=createArena('quake');draw(a);
  const root=scene.children[0],mountain=root.getObjectByName('Shaking mountain'),top=root.getObjectByName('Summit floor');
  const vertices=top.geometry.getAttribute('position');
  for(let i=0;i<vertices.count;i++)assert.ok(SUMMIT_RIM.some(([x,z])=>Math.abs(vertices.getX(i)-x)<1e-5&&Math.abs(-vertices.getY(i)-z)<1e-5));
  const cliffs=root.getObjectByName('Summit cliffs').geometry;cliffs.computeBoundingBox();assert.equal(cliffs.boundingBox.min.y,-42);
  a.time=1;a.shake=1;draw(a);assert.ok(mountain.position.length()>.01);
  a.shake=0;draw(a);assert.equal(mountain.position.length(),0);
  draw(createArena('classic'));assert.equal(root.visible,false);draw(createArena('quake'));assert.equal(root.visible,true);
});
