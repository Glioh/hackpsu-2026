import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCombatRig,uppercutHits} from '../host/src/combat-rig.js';
import {FIGHTERS} from '../host/src/fighter-model.js';
import {Simulation} from '../host/src/simulation.js';

const assets=await Promise.all(Object.values(FIGHTERS).map(async spec=>{
  const bytes=readFileSync(new URL('..'+spec.url,import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  return ()=>{const root=gltf.scene.clone(true),n=s=>root.getObjectByName(spec.prefix+s);
    return createCombatRig(root,[n('Arm_R'),n('Arm_L')],[n('Hand_R')||n('Glove_R'),n('Hand_L')||n('Glove_L')],1.4,n('Torso'));
  };
}));
test('every model matchup can land an uppercut at body contact',()=>{
  for(const make of assets)for(const other of assets){
    const sim=new Simulation();sim.rigs=[make(),other()];sim.fighters[0].x=0;sim.fighters[1].x=.1;
    let hits=0;for(let i=0;i<20;i++)hits+=sim.step(i===0?{red:{arm:{punch:true}}}:{}).length;
    assert.equal(hits,1,'both hands together deal one hit per opponent');
    const rigs=sim.rigs;sim.reset();assert.equal(sim.rigs,rigs,'rematches retain model geometry');
  }
});
test('model-based uppercuts miss behind, beyond reach, and above the character',()=>{
  for(const make of assets)for(const other of assets)for(const placement of [{x:5,y:0},{x:1.4,y:4},{x:-1.4,y:0}]){
    const sim=new Simulation();sim.rigs=[make(),other()];sim.fighters[0].x=0;Object.assign(sim.fighters[1],placement);
    assert.equal(uppercutHits(sim.rigs[0],sim.rigs[1],{...sim.fighters[0],attack:.09},sim.fighters[1],.23,0),false,JSON.stringify({placement,a:sim.rigs[0].radius,b:sim.rigs[1].radius}));
  }
});
test('collision geometry follows world heading and character selection',()=>{
  const radii=assets.map(make=>make().radius);assert.ok(new Set(radii.map(r=>r.toFixed(3))).size>1);
  for(const make of assets)for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const sim=new Simulation();sim.rigs=[make(),make()];Object.assign(sim.fighters[0],{x:0,z:0,heading});
    Object.assign(sim.fighters[1],{x:Math.sin(heading)*.1,z:Math.cos(heading)*.1,heading:heading+Math.PI});
    let hits=0;for(let i=0;i<20;i++)hits+=sim.step(i===0?{red:{arm:{punch:true}}}:{}).length;
    assert.equal(hits,1);
  }
});
