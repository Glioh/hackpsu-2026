import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createFactoryView} from '../host/src/factory-view.js';
import {createArena} from '../host/src/maps.js';

test('factory scenery animates, resets and hides without modifying arena physics', () => {
  const previous=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
  try {
    const scene=new T.Scene(),view=createFactoryView(scene),arena=createArena('conveyor',7);
    const snapshot=JSON.stringify(arena),root=scene.getObjectByName('factory-interior');
    const transforms=()=>{const result=[];root.traverse(n=>result.push([...n.position.toArray(),...n.rotation.toArray()]));return result;};
    view(arena,0);const start=transforms();
    arena.time=2;view(arena,2);assert.notDeepEqual(transforms(),start,'machinery and cargo move');
    arena.time=0;view(arena,0);assert.deepEqual(transforms(),start,'new rounds reset scenery');
    assert.equal(JSON.stringify(arena),snapshot,'rendering leaves all arena data untouched');
    assert.equal(arena.pieces.length,4);
    assert.equal(arena.floorAt(11.1,0),null,'decorative machinery creates no floor');
    view(createArena('classic'),3);assert.equal(root.visible,false);
    view(arena,0);assert.equal(root.visible,true);
  } finally {globalThis.document=previous;}
});
