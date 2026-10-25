import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createHitFlash, createHitEffects, hitColor } from '../host/src/hit-effects.js';
import { CONFIG as C } from '../shared/config.js';

test('hit flash restores shared, textured and multi-material rig appearance exactly', () => {
  const group = new T.Group();
  const skin = new T.MeshStandardMaterial({ color: '#2a718b', emissive: '#123456', emissiveIntensity: .35 });
  const trim = new T.MeshBasicMaterial({ color: '#182936' });
  const map = new T.Texture(); skin.map = map;
  group.add(new T.Mesh(new T.BoxGeometry(), skin), new T.Mesh(new T.BoxGeometry(), [skin, trim]));
  const color = skin.color.clone(), emissive = skin.emissive.clone(), trimColor = trim.color.clone();
  const flash = createHitFlash(group);
  flash(1); assert.ok(skin.color.equals(hitColor(0)));
  assert.ok(skin.emissiveIntensity > 1); assert.equal(skin.map, map);
  flash(.5); flash(0);
  assert.ok(skin.color.equals(color)); assert.ok(skin.emissive.equals(emissive));
  assert.equal(skin.emissiveIntensity, .35); assert.ok(trim.color.equals(trimColor));
  flash(1); flash(0); assert.ok(skin.color.equals(color));
});

test('hit flashes become redder as recoil damage grows and reset after the hit', () => {
  const group = new T.Group(), material = new T.MeshStandardMaterial({color:'#63c7ec'});
  group.add(new T.Mesh(new T.BoxGeometry(), material));
  const base = material.color.clone(), flash = createHitFlash(group);
  let previousGreen = Infinity;
  for (const damage of [0,45,90,135,C.knockbackSoftCap]) {
    flash(1,damage);
    assert.ok(material.color.g < previousGreen); previousGreen = material.color.g;
  }
  assert.equal(material.color.getHexString(),'ff2020');
  assert.ok(hitColor(1000).equals(hitColor(C.knockbackSoftCap)));
  flash(0,180); assert.ok(material.color.equals(base));
});

test('hit particles exit behind the victim along the impact, including when velocity disagrees', () => {
  for (const direction of [{x:1,z:0},{x:0,z:-1},{x:-.6,z:.8}]) {
    const scene = new T.Scene(), effects = createHitEffects(scene,new T.Texture());
    const body = {team:'blue',x:2,y:0,z:3,vx:-direction.x*5,vz:-direction.z*5,heading:0,damage:150};
    const snapshot = structuredClone(body);
    effects.hit(body,direction);
    const sprites = scene.children.filter(p=>p.visible);
    assert.equal(sprites.length,12);
    for (const p of sprites) {
      const dx=p.position.x-body.x,dz=p.position.z-body.z;
      assert.ok(dx*direction.x+dz*direction.z>.69,'spawn on the side away from the attacker');
      assert.ok(Math.abs(-dx*direction.z+dz*direction.x)<.18,'narrow spawn cone');
      assert.ok(p.material.color.equals(hitColor(150)));
    }
    const positions=sprites.map(p=>p.position.clone());
    effects.update([body],.016);
    sprites.forEach((p,i)=>{
      const delta=p.position.clone().sub(positions[i]);
      assert.ok(delta.x*direction.x+delta.z*direction.z>0,'moves away from the attacker');
    });
    effects.update([body],.04);
    assert.ok(scene.children.filter(p=>p.visible).every(p=>(p.position.x-body.x)*direction.x+(p.position.z-body.z)*direction.z>0));
    assert.deepEqual(body,snapshot);
    effects.clear(); assert.ok(scene.children.every(p=>!p.visible));
  }
});
