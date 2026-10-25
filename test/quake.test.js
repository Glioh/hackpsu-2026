import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createArena} from '../host/src/maps.js';
import {createQuakeView} from '../host/src/quake-view.js';
import {Simulation} from '../host/src/simulation.js';

const tick=1/60;
test('earthquake warns before opening real faults, carries shelves and closes again',()=>{
  const arena=createArena('quake',1);let warned=false,opened=false,closed=false;
  for(let i=0;i<900;i++){
    arena.step(tick,[],[]);warned ||= arena.warning;
    if(arena.fracture>.5){
      assert.ok(warned);opened=true;
      assert.equal(arena.floorAt(0,3),null);
      assert.equal(arena.floorAt(4,0),null);
      assert.ok(arena.floorAt(5,4));
    }
    if(opened&&arena.fracture===0){closed=true;break;}
  }
  assert.ok(opened&&closed);
  assert.ok(arena.floorAt(0,0));
  assert.ok(arena.pieces.every(p=>Math.abs(p.vx)<1&&Math.abs(p.vz)<1));
});

test('earthquake open fault drops a fighter and rematch restores intact terrain',()=>{
  const s=new Simulation('quake');
  while((s.arena.fracture??0)<.7)s.arena.step(tick,[],[]);
  Object.assign(s.fighters[0],{x:0,z:3,y:0,vx:0,vz:0,vy:0,grounded:false});
  for(let i=0;i<90;i++)s.step({});
  assert.equal(s.winner,null);assert.equal(s.fighters[0].lives,2);
  s.setMap('quake');assert.ok(s.arena.floorAt(0,3));assert.equal(s.arena.fracture,undefined);
});

test('earthquake rock visuals follow physical shelves and rebuild for rematches',()=>{
  const scene=new T.Scene(),draw=createQuakeView(scene),arena=createArena('quake');
  draw(arena,0);const root=scene.getObjectByName('Earthquake / fractured mountain');
  assert.ok(root.visible);assert.equal(root.getObjectsByProperty('name','Summit stone shelf').length,4);
  for(let i=0;i<330;i++)arena.step(tick,[],[]);
  draw(arena,arena.time);scene.updateMatrixWorld(true);
  const tops=root.getObjectsByProperty('name','Summit stone shelf');
  tops.forEach((m,i)=>{
    const p=arena.pieces[i],bounds=new T.Box3().setFromObject(m);
    assert.ok(Math.abs(bounds.max.y-p.y)<1e-5);
    assert.ok(Math.abs(bounds.min.x-(p.x-p.hw))<1e-5);
  });
  draw(createArena('quake'),0);assert.equal(root.getObjectsByProperty('name','Summit stone shelf').length,4);
  draw(createArena('classic'),0);assert.equal(root.visible,false);
});
