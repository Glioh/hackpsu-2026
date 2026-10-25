import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { CommentaryDetector, CommentaryDirector } from '../host/src/commentary.js';
import { SCRIPTS } from '../shared/commentary-scripts.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
function harness({ live = false, stream, dialogue, now, commentaryMode } = {}) {
  const nodes = [], elements = new Map(), callbacks = {}, spoken=[];
  const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, { textContent: '' }); return elements.get(id); } };
  let context;
  class AudioContext {
    constructor() { context = this; this.state = 'running'; this.currentTime = 0; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createGain() { return { gain: {}, connect() {} }; }
    decodeAudioData() { return Promise.resolve({ duration: .001 }); }
    createBuffer(channels, count, rate) { return { duration: count / rate, getChannelData: () => new Float32Array(count) }; }
    createBufferSource() {
      const node = { connect() {}, disconnect() {}, start() { nodes.push(this); }, stop() { this.stopped = true; this.end(); }, end() { this.onended?.(); } };
      return node;
    }
  }
  const catalog = { live, dialogue: !!dialogue, commentaryMode, clips: live ? {} : Object.fromEntries(SCRIPTS.map(script => [script.id, { url: '/clip/' + script.id }])) };
  const sandbox = { document, AudioContext, CommentaryDetector, CommentaryDirector, SCRIPTS, AbortController, setTimeout, clearTimeout, performance:now?{now}:performance,
    SpeechSynthesisUtterance:class {constructor(text){this.text=text;}},speechSynthesis:{getVoices:()=>[],speak:utterance=>spoken.push(utterance),cancel(){}},
    fetch: async (url, options) => url === '/api/commentary/catalog' ? { json: async () => catalog } : url === '/api/commentary/dialogue' ? dialogue(JSON.parse(options.body),options) : url.startsWith('/clip/') ? { ok: true, arrayBuffer: async () => new ArrayBuffer(0) } : stream(url),
  };
  const source = readFileSync(new URL('../host/src/commentary-audio.js', import.meta.url), 'utf8').replace(/^import .*\r?\n/gm, '').replace('export function', 'function');
  vm.runInNewContext(source, sandbox);
  const api = sandbox.createCommentary({ on: (name, callback) => { callbacks[name] = callback; }, emit: (_, data, callback) => callback({ token: 'host' }) });
  const advance = (dt, events = [], winner = null) => api.step({ arena: { id: 'classic' }, winner, motionEvents: events, fighters: ['red', 'blue'].map(team => ({ team, damage: 0, grounded: true })) }, dt);
  api.unlock();
  return { api, nodes, advance, elements, callbacks, spoken, get context() { return context; } };
}

test('failed live speech skips the caption instead of showing an unspoken line',async t=>{
  let calls=0;
  const h=harness({live:true,stream:async()=>{
    if(++calls===2)return {ok:false,status:502,json:async()=>({error:'Announcer A custom voice unavailable.'})};
    let read=false;return {ok:true,body:{getReader:()=>({read:async()=>read?{done:true}:(read=true,{done:false,value:Uint8Array.of(0,0)})})}};
  }});
  t.after(()=>h.api.phase('paused'));
  await flush();h.api.phase('playing');h.api.tick();await flush();
  h.nodes[0].end();await flush();
  h.advance(3,[{type:'hit',source:'fighter',attacker:'red',team:'blue',damage:16}]);h.api.tick();await flush();
  assert.equal(calls,2);assert.equal(h.elements.get('commentaryCaption').textContent,'');
  assert.ok(!h.elements.get('commentaryCaption').textContent.includes('Vera:'));
  assert.equal(h.spoken.length,0);assert.match(h.elements.get('commentaryStatus').textContent,/Announcer A custom voice unavailable/);
});

test('local voices wait for actual audio ending, even when audio clock stalls past clip duration', async t => {
  const h = harness(); t.after(() => h.api.phase('paused'));
  await flush(); h.api.phase('playing'); h.api.tick(); await flush();
  assert.equal(h.nodes.length, 1);
  assert.equal(h.elements.get('commentaryCaption').textContent,SCRIPTS.find(s=>s.id===h.api.metrics.at(-1).script).text);
  h.context.state = 'suspended';
  await new Promise(resolve => setTimeout(resolve, 20));
  h.context.state = 'running';
  h.advance(3, [{ type: 'hit', source: 'fighter', attacker: 'red', team: 'blue', damage: 16 }]);
  h.api.tick(); await flush();
  assert.equal(h.nodes.length, 1, 'second voice cannot start while first node remains unfinished');
  h.nodes[0].end(); await flush();
  h.advance(3, [{ type: 'hit', source: 'fighter', attacker: 'blue', team: 'red', damage: 16 }]);
  h.api.tick(); await flush();
  assert.equal(h.nodes.length, 2);
  h.api.phase('paused');
  assert.equal(h.nodes[1].stopped, true);
});

test('a live caption waits for playable PCM and clears when the matching audio ends',async t=>{
 let release;const h=harness({live:true,stream:async()=>{
  let read=0;return {ok:true,body:{getReader:()=>({read:async()=>read++===0?new Promise(resolve=>{release=resolve;}):{done:true}})}};
 }});t.after(()=>h.api.phase('paused'));
 await flush();h.api.phase('playing');h.api.tick();await flush();
 assert.equal(h.elements.get('commentaryCaption').textContent,'');assert.equal(h.nodes.length,0);
 release({done:false,value:Uint8Array.of(0,0)});await flush();
 assert.equal(h.nodes.length,1);assert.equal(h.elements.get('commentaryCaption').textContent,SCRIPTS.find(s=>s.id===h.api.metrics.at(-1).script).text);
 h.nodes[0].end();await flush();assert.equal(h.elements.get('commentaryCaption').textContent,'');
});

test('empty speech never displays an unspoken caption',async t=>{
 const h=harness({live:true,stream:async()=>({ok:true,body:{getReader:()=>({read:async()=>({done:true})})}})});
 t.after(()=>h.api.phase('paused'));
 await flush();h.api.phase('playing');h.api.tick();await flush();
 assert.equal(h.nodes.length,0);assert.equal(h.elements.get('commentaryCaption').textContent,'');
 assert.match(h.elements.get('commentaryStatus').textContent,/Empty speech/);
});

test('announcer countdown uses ready voice clips on each beat, interrupts dialogue, and stops on pause or mute', async t => {
  const h=harness();t.after(()=>h.api.phase('paused'));
  await flush();h.api.phase('playing');h.api.tick();await flush();
  assert.equal(h.nodes.length,1);
  for(let i=0;i<4;i++){
    const previous=h.nodes.at(-1);
    h.api.countdown(i);
    assert.equal(previous.stopped,true,'each beat replaces previous speech');
    assert.equal(h.nodes.length,i+2,'beat plays immediately from a loaded clip');
    h.api.tick();await flush();
    assert.equal(h.nodes.length,i+2,'commentary cannot overlap countdown');
  }
  h.api.phase('paused');assert.equal(h.nodes.at(-1).stopped,true);
  const count=h.nodes.length;
  h.elements.get('commentaryMute').onchange({target:{checked:true}});
  h.api.countdown(0);assert.equal(h.nodes.length,count);
});

test('the same announcer gives the opening line after the countdown',async t=>{
 const h=harness();t.after(()=>h.api.phase('paused'));
 await flush();h.api.phase('playing',false,{map:'piano'});
 for(let i=0;i<4;i++)h.api.countdown(i);
 const count=h.nodes.length;h.api.tick();await flush();assert.equal(h.nodes.length,count,'opening waits for Start');
 h.nodes.at(-1).end();h.advance(1.3);h.api.tick();await flush();
 assert.equal(h.nodes.length,count+1);
 const opening=SCRIPTS.find(script=>script.id===h.api.metrics.at(-1).script);
 assert.equal(opening.speaker,'a');assert.equal(opening.event,'round_start');assert.equal(opening.map,'piano');
});

test('late canceled stream cannot stop newer ElevenLabs speech', async t => {
  let calls = 0, rejectOld;
  const h = harness({ live: true, stream: async () => {
    const first = ++calls === 1; let read = 0;
    return { ok: true, body: { getReader: () => ({ read: () => {
      if (read++ === 0) return Promise.resolve({ done: false, value: Uint8Array.of(0, 0) });
      return first ? new Promise((resolve, reject) => { rejectOld = reject; }) : Promise.resolve({ done: true });
    } }) } };
  } });
  t.after(() => h.api.phase('paused'));
  await flush(); h.api.phase('playing'); h.api.tick(); await flush();
  assert.equal(h.nodes.length, 1);
  h.api.phase('playing'); h.api.tick(); await flush();
  assert.equal(h.nodes.length, 2); assert.equal(h.nodes[0].stopped, true);
  rejectOld(Error('Old request aborted')); await flush();
  assert.equal(h.nodes[1].stopped, undefined);
});

test('scripted fallback uses A for every event',async t=>{
 const h=harness();
 t.after(()=>h.api.phase('paused'));
 await flush();h.api.phase('playing',false,{map:'piano'});h.api.tick();await flush();
 assert.equal(h.nodes.length,1);h.nodes[0].end();await flush();
 assert.equal(h.nodes.length,1,'no second announcer reply');
 for(let i=0;i<3;i++){
  h.advance(3,[{type:'hit',source:'fighter',attacker:i%2?'blue':'red',team:i%2?'red':'blue',damage:16}]);
  h.api.tick();await flush();h.nodes.at(-1).end();await flush();
 }
 assert.equal(h.api.metrics.length,4);
 for(const metric of h.api.metrics)assert.equal(SCRIPTS.find(s=>s.id===metric.script).speaker,'a');
});

test('Gemini line becomes both the caption and generated speech, with one announcer and bounded generation',async t=>{
 let now=0;const requests=[],streams=[],line='The grand piano just received a strongly worded uppercut.';
 const h=harness({now:()=>now,live:true,dialogue:async payload=>{
  requests.push(payload);return {ok:true,json:async()=>({provider:'gemini',turns:[{id:'gemini-line-'+requests.length,speaker:'a',text:requests.length===1?line:'Blue, those gloves are apparently decorative.'}]})};
 },stream:async url=>{streams.push(url);let read=false;return {ok:true,body:{getReader:()=>({read:async()=>read?{done:true}:(read=true,{done:false,value:Uint8Array.of(0,0)})})}};}});
 t.after(()=>h.api.phase('paused'));
 await flush();h.api.phase('playing',false,{map:'piano',fighters:{red:'wukong',blue:'squish'}});h.api.tick();await flush();
 assert.equal(requests.length,1);assert.equal(requests[0].game.map,'piano');assert.equal(requests[0].game.fighters[0].character,'wukong');
 assert.equal(requests[0].firstSpeaker,'a');assert.deepEqual(streams,['/api/commentary/live/gemini-line-1']);
 assert.equal(h.elements.get('commentaryCaption').textContent,line);assert.equal(h.nodes.length,1);assert.equal(h.spoken.length,0);
 h.nodes[0].end();await flush();now=1000;h.advance(3,[{type:'hit',source:'fighter',attacker:'red',team:'blue',damage:16}]);h.api.tick();await flush();
 assert.equal(requests.length,1);assert.equal(h.nodes.length,1,'cooldown never falls back to canned lines');
 now=3000;h.advance(3,[{type:'hit',source:'fighter',attacker:'blue',team:'red',damage:16}]);h.api.tick();await flush();
 assert.equal(requests.length,2);assert.equal(h.nodes.length,2);
 assert.deepEqual(streams,['/api/commentary/live/gemini-line-1','/api/commentary/live/gemini-line-2']);
 assert.equal(h.elements.get('commentaryCaption').textContent,'Blue, those gloves are apparently decorative.');
});

test('Gemini failure never replays canned commentary and pause cancels pending generation',async t=>{
 const h=harness({dialogue:async()=>({ok:false,status:503})});t.after(()=>h.api.phase('paused'));
 await flush();h.api.phase('playing');h.api.tick();await flush();
 assert.equal(h.nodes.length,0);assert.match(h.elements.get('commentaryStatus').textContent,/waiting for fresh commentary/);
 assert.equal(h.elements.get('commentaryCaption').textContent,'');
 let aborted=false;
 const pending=harness({dialogue:async(payload,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('Aborted'));},{once:true}))});
 t.after(()=>pending.api.phase('paused'));
 await flush();pending.api.phase('playing');pending.api.tick();await flush();pending.api.phase('paused');await flush();
 assert.equal(aborted,true);assert.equal(pending.nodes.length,0);assert.equal(pending.elements.get('commentaryCaption').textContent,'');
});

test('generated mode with a missing Gemini key never substitutes cached commentary',async t=>{
 const h=harness({commentaryMode:'generated'});t.after(()=>h.api.phase('paused'));
 await flush();h.api.phase('playing');h.api.tick();await flush();
 assert.equal(h.nodes.length,0);assert.equal(h.elements.get('commentaryCaption').textContent,'');
 assert.match(h.elements.get('commentaryStatus').textContent,/Waiting for fresh commentary/);
});

test('a lost life can get a fresh Gemini reaction before the ordinary event cooldown',async t=>{
 let now=0;const requests=[];
 const h=harness({now:()=>now,live:true,dialogue:async payload=>{
  requests.push(payload);return {ok:true,json:async()=>({turns:[{id:'fresh-'+requests.length,speaker:'a',text:'Red, your legs just clocked out early!'}]})};
 },stream:async()=>{let read=false;return {ok:true,body:{getReader:()=>({read:async()=>read?{done:true}:(read=true,{done:false,value:Uint8Array.of(0,0)})})}};}});
 t.after(()=>h.api.phase('paused'));
 await flush();h.api.phase('playing');h.api.tick();await flush();h.nodes[0].end();await flush();
 now=1500;h.advance(1.5,[{type:'ringout',team:'red',lives:1}]);h.api.tick();await flush();
 assert.equal(requests.length,2);assert.equal(requests[1].event.type,'life_lost');assert.equal(requests[1].event.team,'red');assert.equal(h.nodes.length,2);
});

test('streamed voices wait for every scheduled PCM chunk to end and pause stops them', async t => {
  const h = harness({ live: true, stream: async () => {
    let index = 0;
    const chunks = [Uint8Array.of(0, 0, 1), Uint8Array.of(0, 2, 0)];
    return { ok: true, body: { getReader: () => ({ read: async () => index < chunks.length ? { value: chunks[index++], done: false } : { done: true } }) } };
  } });
  t.after(() => h.api.phase('paused'));
  await flush(); h.api.phase('playing'); h.api.tick(); await flush();
  assert.equal(h.nodes.length, 2);
  await new Promise(resolve => setTimeout(resolve, 120));
  h.advance(3, [{ type: 'hit', source: 'fighter', attacker: 'red', team: 'blue', damage: 16 }]);
  h.api.tick(); await flush();
  assert.equal(h.nodes.length, 2, 'network EOF does not release the next voice');
  h.nodes[1].end(); await flush(); h.api.tick(); await flush();
  assert.equal(h.nodes.length, 2, 'last chunk ending alone does not release unfinished chunks');
  h.api.phase('paused');
  assert.equal(h.nodes[0].stopped, true);
  assert.equal(h.elements.get('commentaryCaption').textContent, '');
});
