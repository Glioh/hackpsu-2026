import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_DIRECTION, CAMERA_FOV, frameFighters } from '../host/src/camera.js';
import { CONFIG as C } from '../shared/config.js';

const fighter = (x,z,y=0) => ({x,y,z});
test('camera pans with the fight and keeps a wide view when fighters regroup',()=>{
  const close = frameFighters([fighter(-.7,0),fighter(.7,0)], 16/9);
  const moved = frameFighters([fighter(7.3,5),fighter(8.7,5)], 16/9);
  assert.deepEqual(moved.target, [8,1.1,5]);
  assert.equal(moved.distance, close.distance);
  assert.equal(close.distance, 12);
  const far = frameFighters([fighter(-C.arenaX,0),fighter(C.arenaX,0)], 16/9);
  assert.ok(far.distance > close.distance);
});

test('camera keeps fighter bounds in frame at opposite edges, in portrait, and while panning',()=>{
  const [dx,dy,dz] = CAMERA_DIRECTION, h = Math.hypot(dx,dz);
  const right = [dz/h,0,-dx/h], up = [-dy*dx/h,h,-dy*dz/h];
  const dot = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);
  for(const aspect of [.55,1,16/9,2.4]) {
    const fighters = [fighter(-C.arenaX,-C.arenaZ),fighter(C.arenaX,C.arenaZ,3)];
    for(const focus of [undefined,[3,1.1,-2]]) {
      const {target,distance} = frameFighters(fighters,aspect,focus), center=focus||target;
      for(const f of fighters) for(const x of [-1.15,1.15]) for(const y of [0,2.6]) for(const z of [-1.15,1.15]) {
        const delta=[f.x+x-center[0],f.y+y-center[1],f.z+z-center[2]];
        const depth=distance-dot(delta,CAMERA_DIRECTION), halfHeight=depth*Math.tan(CAMERA_FOV*Math.PI/360);
        assert.ok(depth>0);
        assert.ok(Math.abs(dot(delta,right)) <= halfHeight*aspect/1.18+1e-8);
        assert.ok(Math.abs(dot(delta,up)) <= halfHeight/1.18+1e-8);
      }
    }
  }
});

test('camera does not chase an eliminated fighter into the void',()=>{
  const normal=frameFighters([fighter(0,0,-1.5),fighter(1,0)],16/9);
  const fallen=frameFighters([fighter(0,0,-100),fighter(1,0)],16/9);
  assert.deepEqual(fallen,normal);
});
