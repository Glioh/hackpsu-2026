import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatAudio } from '../host/src/combat-audio.js';

function audioHarness() {
  const sources=[],gains=[];
  const param=()=>({value:0,events:[],setValueAtTime(value,time){this.events.push({kind:'set',value,time});},exponentialRampToValueAtTime(value,time){this.events.push({kind:'ramp',value,time});}});
  const node=()=>({connect(){},disconnect(){}});
  const source=()=>{const s={...node(),frequency:param(),start(time){s.started=true;s.startAt=time;},stop(time){s.stopped=true;s.stopAt=time;}};sources.push(s);return s;};
  const context={state:'running',currentTime:1,sampleRate:24000,destination:{},
    resume:async()=>{},createGain(){const n={...node(),gain:param()};gains.push(n);return n;},
    createDynamicsCompressor:node,createBuffer:(_,length)=>{const data=new Float32Array(length);return {getChannelData:()=>data};},
    createBufferSource:source,createOscillator:source,createBiquadFilter:()=>({...node(),frequency:param(),Q:param()}),
  };
  const crowd={duration:25.557};
  context.decodeAudioData=async()=>crowd;
  return {context,sources,gains,crowd};
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

test('crowd plays recorded buffer, shares cancellation and mute with countdown',async()=>{
 const {context,sources,crowd}=audioHarness();let requests=0;
 const audio=createCombatAudio({createContext:()=>context,fetcher:async url=>{requests++;assert.equal(url,'/host/audio/crowd-cheer.mp3');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};}});
 await audio.cheer();audio.countdown();assert.equal(sources.length,0);
 await audio.unlock();await audio.cheer(2);audio.countdown();audio.countdown(true);
 assert.equal(sources.length,5);assert.ok(sources.every(s=>s.started&&s.stopped));
 assert.equal(sources[0].buffer,crowd,'cheering must use the recording, never synthesized noise');
 await audio.unlock();assert.equal(requests,1,'recording loads once across rematches');
 audio.setEnabled(false);await audio.cheer();audio.countdown();assert.equal(sources.length,5);
 audio.stop();sources.forEach(s=>s.onended());
});

test('slow crowd loads cannot play after pause, and missing recording stays silent',async()=>{
 const {context,sources}=audioHarness();let finishLoad;
 const audio=createCombatAudio({createContext:()=>context,fetcher:()=>new Promise(resolve=>{finishLoad=resolve;})});
 const loaded=audio.unlock(),cheering=audio.cheer();await Promise.resolve();
 audio.stop();finishLoad({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)});await loaded;await cheering;
 assert.equal(sources.length,0,'cancelled entrance must not start late audio');
 await audio.cheer();assert.equal(sources.length,1,'cached recording works next entrance');
 audio.stop();
 const unavailable=createCombatAudio({createContext:()=>context,fetcher:async()=>({ok:false})});
 await unavailable.unlock();await unavailable.cheer();assert.equal(sources.length,1,'missing asset must not fall back to static');
});

test('crowd settles during countdown and start horn sounds immediately on FIGHT',async()=>{
 const {context,sources,gains}=audioHarness();
 const audio=createCombatAudio({createContext:()=>context,fetcher:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)})});
 await audio.unlock();await audio.cheer(10.35);
 const envelope=gains[1].gain.events;
 assert.ok(envelope.some(e=>e.kind==='set'&&e.value===.5&&e.time>7),'crowd holds through introduction');
 const settled=envelope.find(e=>e.kind==='ramp'&&e.value===.2);
 assert.ok(settled.time>9.6&&settled.time<=10.8,'crowd drops to 40% before FIGHT at 10.8 audio-clock seconds');
 assert.equal(envelope.at(-1).value,.0001,'remaining crowd fades away');
 context.currentTime=10.8;audio.countdown(true);
 assert.deepEqual(sources.slice(1).map(s=>s.frequency.value),[220,330]);
 assert.ok(sources.slice(1).every(s=>s.type==='sawtooth'&&s.startAt===10.8&&s.stopAt<11.7),'short horn starts on match beat');
 audio.setEnabled(false);audio.countdown(true);assert.equal(sources.length,3);
});
