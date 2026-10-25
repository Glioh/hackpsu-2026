import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {MAPS,createArena} from '../host/src/maps.js';
import {ENVIRONMENTS,environmentKey,fitSunShadow} from '../host/src/environment.js';
import {createCity} from '../host/src/rooftop-city.js';

// Real layout dimensions, including Piano's 84m case and Twinspire's bridges,
// must fit the shadow projection rather than silently clipping at +/-20m.
test('all map shadow volumes contain their playable surfaces and jump clearance',()=>{
  for(const {id} of MAPS) {
    const arena=createArena(id),p=ENVIRONMENTS[environmentKey(id)];
    const sun=new T.DirectionalLight();sun.position.set(...p.sun);fitSunShadow(sun,arena);
    const camera=sun.shadow.camera;
    const matrix=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    for(const piece of arena.pieces)for(const x of [piece.x-piece.hw,piece.x+piece.hw])for(const z of [piece.z-piece.hd,piece.z+piece.hd])for(const y of [piece.y,piece.y+6]) {
      const v=new T.Vector3(x,y,z).applyMatrix4(matrix);
      assert.ok(Math.max(Math.abs(v.x),Math.abs(v.y),Math.abs(v.z))<=1.0001,`${id}: clipped ${x},${y},${z}`);
    }
  }
});
test('city retains two batches, deterministic silhouettes and windows on four facades',()=>{
  const city=createCity(),other=createCity();assert.equal(city.children.length,2);
  assert.deepEqual(city.children[0].instanceMatrix.array,other.children[0].instanceMatrix.array);
  const matrix=new T.Matrix4(),rotations=new Set();
  for(let i=0;i<city.children[1].count;i++) {city.children[1].getMatrixAt(i,matrix);rotations.add(Math.round(Math.atan2(matrix.elements[8],matrix.elements[0])*2/Math.PI));}
  assert.ok(rotations.size>=4);
  assert.equal(city.children[0].castShadow,false);
});

test('lava has its own warm enclosed environment',()=>{
  assert.equal(environmentKey('lava'),'lava');assert.equal(ENVIRONMENTS.lava.indoor,true);
  assert.notEqual(ENVIRONMENTS.lava.fog,ENVIRONMENTS.industrial.fog);
});
