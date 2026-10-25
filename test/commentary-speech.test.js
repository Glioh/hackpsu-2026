import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommentary} from '../host/src/commentary-audio.js';

test('unrendered contextual lines use speech fallback and cancel on fight or commentary disable',async t=>{
 const elements=new Map(),spoken=[];let cancelled=0;
 const element=id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);};
 const globals={
  document:{getElementById:element},
  fetch:async()=>({json:async()=>({clips:{},live:false})}),
  AudioContext:class {constructor(){this.state='running';this.destination={};}resume(){return Promise.resolve();}createGain(){return {gain:{},connect(){}};}},
  SpeechSynthesisUtterance:class {constructor(text){this.text=text;}},
  speechSynthesis:{getVoices:()=>[],speak:u=>spoken.push(u),cancel(){cancelled++;}},
 };
 for(const [key,value] of Object.entries(globals)){const previous=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else delete globalThis[key];});}
 const commentary=createCommentary({on(){},emit(event,data,ack){ack({token:'test'});}});
 try{
 commentary.unlock();await new Promise(resolve=>setImmediate(resolve));
 commentary.phase('playing',false,{map:'piano',fighters:{red:'tung',blue:'bubbles'}});commentary.tick();await new Promise(resolve=>setImmediate(resolve));
 assert.match(spoken[0].text,/piano|keys/i);assert.match(element('commentaryCaption').textContent,/Rex|Vera/);
 commentary.fight();assert.ok(cancelled>0);assert.equal(element('commentaryCaption').textContent,'');
 await new Promise(resolve=>setImmediate(resolve));
 commentary.phase('playing',false,{map:'station',fighters:{red:'tung',blue:'bubbles'}});commentary.tick();await new Promise(resolve=>setImmediate(resolve));
 assert.match(spoken.at(-1).text,/Station|trains|tracks/i);
 element('commentaryEnabled').onchange({target:{checked:false}});assert.equal(element('commentaryCaption').textContent,'');
 }finally{commentary.phase('paused');}
});
