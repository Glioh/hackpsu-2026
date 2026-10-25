import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { CommentaryDetector, CommentaryDirector } from '../host/src/commentary.js';
import { SCRIPTS } from '../shared/commentary-scripts.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
function harness({ live = false, stream, dialogue } = {}) {
  const nodes = [], elements = new Map(), callbacks = {};
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
  const catalog = { live, dialogue: !!dialogue, clips: live ? {} : Object.fromEntries(SCRIPTS.map(script => [script.id, { url: '/clip/' + script.id }])) };
  const sandbox = { document, AudioContext, CommentaryDetector, CommentaryDirector, SCRIPTS, AbortController, setTimeout, clearTimeout, performance,
    fetch: async (url, options) => url === '/api/commentary/catalog' ? { json: async () => catalog } : url === '/api/commentary/dialogue' ? dialogue(JSON.parse(options.body)) : url.startsWith('/clip/') ? { ok: true, arrayBuffer: async () => new ArrayBuffer(0) } : stream(url),
  };
  const source = readFileSync(new URL('../host/src/commentary-audio.js', import.meta.url), 'utf8').replace(/^import .*\r?\n/gm, '').replace('export function', 'function');
  vm.runInNewContext(source, sandbox);
  const api = sandbox.createCommentary({ on: (name, callback) => { callbacks[name] = callback; }, emit: (_, data, callback) => callback({ token: 'host' }) });
  const advance = (dt, events = [], winner = null) => api.step({ arena: { id: 'classic' }, winner, motionEvents: events, fighters: ['red', 'blue'].map(team => ({ team, damage: 0, grounded: true })) }, dt);
  api.unlock();
  return { api, nodes, advance, elements, callbacks, get context() { return context; } };
}

test('local voices wait for actual audio ending, even when audio clock stalls past clip duration', async t => {
  const h = harness(); t.after(() => h.api.phase('paused'));
  await flush(); h.api.phase('playing'); h.api.tick(); await flush();
  assert.equal(h.nodes.length, 1);
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

test('generated narrator reply waits for lead audio and both turns enter next game context', async t => {
  const requests = [];
  const h = harness({ live: true, dialogue: async payload => {
    requests.push(payload);
    return { ok: true, json: async () => ({ turns: [
      { id: 'lead', speaker: payload.firstSpeaker, text: 'Four operators enter the ring.' },
      { id: 'reply', speaker: payload.firstSpeaker === 'a' ? 'b' : 'a', text: 'Rex, hopefully their plans enter together.' },
    ] }) };
  }, stream: async () => { let read = false; return { ok: true, body: { getReader: () => ({ read: async () => read ? { done: true } : (read = true, { done: false, value: Uint8Array.of(0, 0) }) }) } }; } });
  t.after(() => h.api.phase('paused'));
  await flush(); h.api.phase('playing', false, { map: 'piano', fighters: { red: 'tung', blue: 'bubbles' } }); h.api.tick(); await flush();
  assert.equal(requests[0].game.map, 'piano'); assert.equal(requests[0].game.fighters[0].character, 'tung');
  assert.equal(h.nodes.length, 1); assert.equal(requests[0].history.length, 0);
  h.nodes[0].end(); await flush(); assert.equal(h.nodes.length, 2);
  h.nodes[1].end(); await flush();
  h.advance(3, [{ type: 'hit', source: 'fighter', attacker: 'red', team: 'blue', damage: 16 }]); h.api.tick(); await flush();
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1].history.map(turn => turn.text), ['Four operators enter the ring.', 'Rex, hopefully their plans enter together.']);
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
