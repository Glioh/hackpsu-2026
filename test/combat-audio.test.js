import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatAudio } from '../host/src/combat-audio.js';

function audioHarness() {
  const sources=[],gains=[];
  const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node=()=>({connect(){},disconnect(){}});
  const source=()=>{const s={...node(),frequency:param(),start(){s.started=true;},stop(){s.stopped=true;}};sources.push(s);return s;};
  const context={state:'running',currentTime:1,sampleRate:24000,destination:{},
    resume:async()=>{},createGain(){const n={...node(),gain:param()};gains.push(n);return n;},
    createDynamicsCompressor:node,createBuffer:()=>({getChannelData:()=>new Float32Array(6000)}),
    createBufferSource:source,createOscillator:source,createBiquadFilter:()=>({...node(),frequency:param(),Q:param()}),
  };
  return {context,sources,gains};
}

test('combat audio plays one swing and a layered impact, ignores hazards and obeys mute/pause',()=>{
  const {context,sources,gains}=audioHarness();
  const audio=createCombatAudio({createContext:()=>context});
  audio.event({type:'punch'});assert.equal(sources.length,0,'waits for a user gesture');
  audio.unlock();audio.event({type:'punch'});assert.equal(sources.length,1);
  audio.event({type:'hit',source:'fighter',strength:10});assert.equal(sources.length,3);
  assert.ok(sources.every(s=>s.started&&s.stopped),'sources have finite lifetimes');
  audio.event({type:'hit',hazard:'train'});audio.event({type:'landing'});assert.equal(sources.length,3);
  audio.setVolume(.2);assert.equal(gains[0].gain.value,.2);
  audio.setEnabled(false);assert.equal(gains[0].gain.value,0);
  audio.event({type:'punch'});assert.equal(sources.length,3);
  audio.setEnabled(true);assert.equal(gains[0].gain.value,.2);
  context.state='suspended';audio.event({type:'punch'});assert.equal(sources.length,3);
  audio.stop();sources.forEach(s=>s.onended());
});

test('audio unavailable is harmless to combat',()=>{
  const audio=createCombatAudio({createContext(){throw Error('No audio');}});
  assert.doesNotThrow(()=>{audio.unlock();audio.event({type:'punch'});audio.stop();});
});
