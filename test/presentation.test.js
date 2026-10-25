import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresentation } from '../host/src/presentation.js';

function classList() {
  const values = new Set();
  return {
    toggle(name,on) { if(on) values.add(name); else values.delete(name); },
    contains(name) { return values.has(name); },
  };
}
test('arena stays fullscreen through wins and rematches, returning to the page only for the lobby',async()=>{
  let requested=0,exited=0;
  const doc={body:{classList:classList()},fullscreenElement:null,exitFullscreen(){exited++;doc.fullscreenElement=null;return Promise.resolve();}};
  const screen={classList:classList(),requestFullscreen(){requested++;doc.fullscreenElement=screen;return Promise.resolve();}};
  const presentation=createPresentation(screen,doc);
  presentation.request();assert.equal(requested,1);
  for(const phase of ['playing','paused','playing','results','playing','results']){
    presentation.setPhase(phase);
    assert.equal(doc.body.classList.contains('game-focus'),true);
    assert.equal(screen.classList.contains('match-active'),true);
    assert.equal(doc.fullscreenElement,screen);assert.equal(exited,0);
  }
  presentation.request();assert.equal(requested,1,'rematch keeps the existing fullscreen session');
  presentation.setPhase('lobby');assert.equal(exited,1);assert.equal(doc.body.classList.contains('game-focus'),false);
});

test('denied or unsupported fullscreen falls back to the expanded viewport',async()=>{
  for(const requestFullscreen of [undefined,()=>Promise.reject(Error('Denied')),()=>{throw Error('Unsupported');}]) {
    const doc={body:{classList:classList()},fullscreenElement:null};
    const screen={classList:classList(),requestFullscreen};
    const presentation=createPresentation(screen,doc);presentation.request();presentation.setPhase('playing');
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(doc.body.classList.contains('game-focus'),true);
    presentation.setPhase('results');assert.equal(doc.body.classList.contains('game-focus'),true);
    assert.equal(screen.classList.contains('match-active'),true);
    presentation.setPhase('lobby');assert.equal(doc.body.classList.contains('game-focus'),false);
  }
});
