import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createKOEffects } from '../host/src/ko-effects.js';
import { createContactShadows } from '../host/src/contact-shadows.js';
import { Simulation } from '../host/src/simulation.js';
import { MAPS, createArena } from '../host/src/maps.js';
import { enrichMaterials, surfaceGrain } from '../host/src/surface-materials.js';

// Supply textures without browser image loading for the original sprite effect.
function knockout(scene) {
  const load=T.TextureLoader.prototype.load;
  T.TextureLoader.prototype.load=()=>new T.Texture();
  try{return createKOEffects(scene);}finally{T.TextureLoader.prototype.load=load;}
}

test('original knockout uses billboard beams for both deaths and clears on reset',()=>{
  const scene=new T.Scene(),fx=knockout(scene);
  const bodies=[{team:'red',x:-12,y:-5.1,z:8},{team:'blue',x:12,y:-5.1,z:-8}];
  fx.trigger(bodies);assert.equal(scene.children.length,2);
  const materials=new Set();
  scene.children.forEach((group,i)=>{
    assert.deepEqual(group.position.toArray(),[bodies[i].x,-4.5,bodies[i].z]);
    assert.equal(group.children.length,22);
    group.children.forEach(sprite=>{assert.ok(sprite.isSprite);assert.equal(sprite.material.depthTest,false);materials.add(sprite.material);});
  });
  fx.update(.15);assert.ok(scene.children.every(g=>g.children[0].scale.y>20));
  let disposed=0;materials.forEach(m=>m.addEventListener('dispose',()=>disposed++));
  fx.update(1.8);assert.equal(scene.children.length,0);assert.equal(disposed,materials.size);
  fx.trigger(bodies);assert.equal(scene.children.length,2);
  fx.clear();assert.equal(scene.children.length,0);assert.equal(disposed,materials.size);
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
