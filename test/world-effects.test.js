import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createKOEffects, KO_LIFETIME } from '../host/src/ko-effects.js';
import { createContactShadows } from '../host/src/contact-shadows.js';
import { Simulation } from '../host/src/simulation.js';
import { MAPS, createArena } from '../host/src/maps.js';
import { enrichMaterials, surfaceGrain } from '../host/src/surface-materials.js';

test('world KOs snapshot simultaneous deaths, reject duplicates and clean up independently',()=>{
  const scene=new T.Scene(),fx=createKOEffects(scene),sim=new Simulation();
  sim.fighters.forEach((f,i)=>Object.assign(f,{x:i?12:-12,y:-5.1,z:i?-8:8}));
  sim.step({});assert.equal(sim.winner,'draw');
  const bodies=structuredClone(sim.fighters);
  fx.trigger(sim.fighters);fx.trigger(sim.fighters);assert.equal(fx.count,2);
  const groups=scene.children.slice(),materials=new Set(),geometries=new Set();
  groups.forEach((group,i)=>{
    assert.deepEqual(group.position.toArray(),[bodies[i].x,bodies[i].y+.9,bodies[i].z]);
    group.children.forEach(mesh=>{assert.ok(mesh.isMesh);assert.equal(mesh.material.depthTest,true);materials.add(mesh.material);geometries.add(mesh.geometry);});
  });
  assert.deepEqual(sim.fighters,bodies);
  sim.reset();fx.update(.7);
  groups.forEach((group,i)=>{
    assert.equal(group.position.x,bodies[i].x);
    assert.ok(group.children.some(m=>m.getWorldPosition(new T.Vector3()).y>0));
  });
  let disposed=0;materials.forEach(m=>m.addEventListener('dispose',()=>disposed++));
  fx.update(KO_LIFETIME);assert.equal(fx.count,0);assert.equal(scene.children.length,0);assert.equal(disposed,materials.size);
  fx.trigger(bodies);assert.equal(fx.count,0,'expired deaths cannot replay until reset');
  fx.clear();fx.trigger(bodies);assert.equal(fx.count,2);
  let geometryDisposals=0;geometries.forEach(g=>g.addEventListener('dispose',()=>geometryDisposals++));
  fx.dispose();assert.equal(geometryDisposals,3);assert.equal(scene.children.length,0);
});

test('seeded arenas support world effects on every edge over repeated rounds',()=>{
  const scene=new T.Scene(),fx=createKOEffects(scene);
  for(const {id} of MAPS)for(const seed of [1,42]) {
    const sim=new Simulation(id,seed);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      sim.reset();
      const axis=dx?'x':'z',half=dx?'hw':'hd',sign=dx||dz;
      const edge=sim.arena.pieces.reduce((best,p)=>sign*p[axis]+p[half]>sign*best[axis]+best[half]?p:best);
      const f=sim.fighters[0];Object.assign(f,{x:edge.x+dx*(edge.hw+.8),z:edge.z+dz*(edge.hd+.8),y:-5.01,grounded:false});
      sim.step({});assert.equal(sim.winner,'blue');
      fx.trigger(sim.fighters.filter(b=>b.y < -5));assert.equal(fx.count,1,id);
      assert.deepEqual(scene.children[0].position.toArray(),[f.x,f.y+.9,f.z]);
      fx.update(.3);fx.clear();assert.equal(scene.children.length,0);
    }
  }
  fx.dispose();
});

test('contact shadows follow live support, fade during jumps and vanish over voids', () => {
  const scene = new T.Scene(), shadows = createContactShadows(scene, 1);
  const arena = createArena('platforms'), f = { x: 0, y: 0, z: 0 };
  shadows.update([f], arena);
  const mesh = scene.children[0], opacity = mesh.material.opacity;
  assert.ok(mesh.visible);
  f.y = 2; shadows.update([f], arena);
  assert.ok(mesh.material.opacity < opacity);
  f.y = -5.1; shadows.update([f], arena); assert.equal(mesh.visible, false);
  f.x = 100; f.y = 0; shadows.update([f], arena); assert.equal(mesh.visible, false);
  const slope = { x: 0, z: 0, y: 1, hw: 2, hd: 2, slopeZ: .3 };
  Object.assign(f, { x: 0, z: 0, y: 1 });
  shadows.update([f], { floorAt: () => slope });
  const normal = new T.Vector3(0, 0, 1).applyEuler(mesh.rotation);
  assert.ok(normal.distanceTo(new T.Vector3(0, 1, -.3).normalize()) < 1e-6);
  shadows.dispose(); assert.equal(scene.children.length, 0);
});

test('surface polish shares resources and preserves authored finishes', () => {
  const root = new T.Group();
  const matte = new T.MeshStandardMaterial({ roughness: .8 });
  const normal = new T.Texture();
  const authored = new T.MeshStandardMaterial({ roughness: .8, normalMap: normal });
  const glass = new T.MeshPhysicalMaterial({ transparent: true, transmission: .9, roughness: .1 });
  const metal = new T.MeshStandardMaterial({ metalness: .9, roughness: .2 });
  for (const m of [matte, authored, glass, metal]) root.add(new T.Mesh(new T.BoxGeometry(), m));
  enrichMaterials(root); enrichMaterials(root);
  assert.equal(matte.bumpMap, surfaceGrain());
  assert.equal(matte.roughnessMap, authored.roughnessMap);
  assert.equal(authored.normalMap, normal); assert.equal(authored.bumpMap, null);
  assert.equal(glass.bumpMap, null); assert.equal(metal.roughnessMap, null);
});
