import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createHitFlash } from '../host/src/hit-effects.js';

test('hit flash restores shared, textured and multi-material rig appearance exactly', () => {
  const group = new T.Group();
  const skin = new T.MeshStandardMaterial({ color: '#2a718b', emissive: '#123456', emissiveIntensity: .35 });
  const trim = new T.MeshBasicMaterial({ color: '#182936' });
  const map = new T.Texture(); skin.map = map;
  group.add(new T.Mesh(new T.BoxGeometry(), skin), new T.Mesh(new T.BoxGeometry(), [skin, trim]));
  const color = skin.color.clone(), emissive = skin.emissive.clone(), trimColor = trim.color.clone();
  const flash = createHitFlash(group);
  flash(1); assert.equal(skin.color.getHexString(), 'ffffff');
  assert.ok(skin.emissiveIntensity > 2); assert.equal(skin.map, map);
  flash(.5); flash(0);
  assert.ok(skin.color.equals(color)); assert.ok(skin.emissive.equals(emissive));
  assert.equal(skin.emissiveIntensity, .35); assert.ok(trim.color.equals(trimColor));
  flash(1); flash(0); assert.ok(skin.color.equals(color));
});
