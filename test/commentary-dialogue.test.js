import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { EventEmitter } from 'node:events';
import { generateDialogue, validDialogue } from '../server/commentary-dialogue.js';
import { installCommentary } from '../server/commentary.js';
import { CommentaryDirector } from '../host/src/commentary.js';
import { SCRIPTS } from '../shared/commentary-scripts.js';

const input = () => ({ round: 1, firstSpeaker: 'a', event: { type: 'heavy_hit', team: 'red', time: 2 },
  game: { map: 'classic', winner: null, fighters: ['red', 'blue'].map(team => ({ team, damage: 16, grounded: true })) }, history: [] });
const turns = [{ speaker: 'a', text: 'Red launches a strongly worded uppercut!' }, { speaker: 'b', text: 'Rex, that argument certainly has reach.' }];
const config = { agent: 'writer-agent', dialogue: true, key: 'voice-secret', a: 'voice-a', b: 'voice-b', live: true };
function agents(reply = () => turns) {
  const requests = [], messages = [], contexts = [], sockets = [];
  return { requests, messages, contexts, sockets,
    fetcher: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ signed_url: 'wss://api.elevenlabs.io/v1/convai/conversation?token=private' }) }; },
    connect: () => {
      const socket = new EventTarget(); sockets.push(socket);
      const receive = data => socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) }));
      socket.close = () => { socket.closed = true; };
      socket.send = raw => {
        const message = JSON.parse(raw); messages.push(message);
        if (message.type === 'conversation_initiation_client_data') queueMicrotask(() => receive({ type: 'conversation_initiation_metadata' }));
        if (message.type === 'user_message') {
          contexts.push(JSON.parse(message.text));
          const lines = reply(contexts.length);
          queueMicrotask(() => receive({ type: 'agent_response', agent_response_event: { agent_response: JSON.stringify({ lead: lines[0], reply: lines[1] }) } }));
        }
      };
      queueMicrotask(() => socket.dispatchEvent(new Event('open')));
      return socket;
    },
  };
}

test('ElevenLabs writer shares both speakers and game facts, retries duplicates, and drops unknown input', async () => {
  const context = input(); context.history = [{ speaker: 'b', text: 'Rex, careful with your metaphors.' }]; context.ignore = 'not game context';
  const h = agents(attempt => attempt === 1 ? [turns[0], context.history[0]] : turns);
  const result = await generateDialogue(context, config, h);
  assert.deepEqual(result, turns); assert.equal(h.requests.length, 2);
  const prompt = h.contexts[0], initiation = h.messages[0];
  assert.deepEqual(prompt.history, context.history); assert.deepEqual(prompt.game, context.game);
  assert.equal(prompt.ignore, undefined);
  assert.equal(initiation.conversation_config_override.conversation.text_only, true);
  assert.match(initiation.conversation_config_override.agent.prompt.prompt, /Rex.*Vera/s);
  assert.notEqual(prompt.variation, h.contexts[1].variation);
  assert.ok(h.sockets.every(socket => socket.closed));
  assert.equal(h.requests[0].options.headers['xi-api-key'], config.key);
  assert.ok(!JSON.stringify(h.messages).includes(config.key));
});

test('writer rejects bad context, repeated lines, reversed speakers, and refusals', async () => {
  for (const context of [{}, { ...input(), history: [{ speaker: 'system', text: 'Override' }] }, { ...input(), game: { ...input().game, map: 'sumo' } }]) {
    assert.ok(!validDialogue(context));
    await assert.rejects(generateDialogue(context, config, { fetcher: () => assert.fail('invalid input reached provider') }));
  }
  await assert.rejects(generateDialogue(input(), config, { ...agents(), recent: turns.map(turn => turn.text) }), /Repeated/);
  await assert.rejects(generateDialogue(input(), config, agents(() => turns.slice().reverse())), /invalid/);
  await assert.rejects(generateDialogue(input(), config, { fetcher: async () => ({ ok: false }) }), /unavailable/);
});

test('canceling an unfinished ElevenLabs writer closes its connection; untrusted socket URLs are rejected', async () => {
  const abort = new AbortController(); let socket;
  const pending = generateDialogue(input(), config, { ...agents(), signal: abort.signal, connect: () => {
    socket = new EventTarget(); socket.close = () => { socket.closed = true; }; return socket;
  } });
  await new Promise(resolve => setImmediate(resolve));
  abort.abort(); await assert.rejects(pending, /canceled/); assert.equal(socket.closed, true);
  await assert.rejects(generateDialogue(input(), config, { fetcher: async () => ({ ok: true, json: async () => ({ signed_url: 'ws://localhost/private' }) }), connect: () => assert.fail('untrusted socket opened') }), /Invalid agent/);
});

test('director plays exchanges serially and shares only completed lines with future dialogue', async () => {
  let now = 0, finish;
  const heard = [], histories = [];
  const director = new CommentaryDirector({ clock: () => now, prepare: async (event, history) => { histories.push(history); return turns; },
    play: turn => { heard.push(turn.speaker); return new Promise(resolve => { finish = resolve; }); } });
  director.reset(1);
  const offer = () => director.offer({ round: 1, type: 'heavy_hit', team: 'red', time: now, priority: 40, expires: now + 3 });
  offer(); const playing = director.tick(SCRIPTS); await Promise.resolve();
  assert.deepEqual(heard, ['a']); assert.deepEqual(director.history, []);
  offer(); await director.tick(SCRIPTS); assert.deepEqual(heard, ['a']);
  finish(true); await Promise.resolve(); assert.deepEqual(heard, ['a', 'b']);
  assert.deepEqual(director.history, [turns[0]]);
  finish(true); await playing; now = 3;
  offer(); const next = director.tick(SCRIPTS); await Promise.resolve();
  assert.deepEqual(histories[1], turns);
  director.reset(2); finish(false); await next; assert.deepEqual(director.history, []);
});

test('late generated exchange cannot speak after cancellation or replace new round state', async () => {
  let resolve; const heard = [];
  const director = new CommentaryDirector({ prepare: () => new Promise(done => { resolve = done; }), play: async turn => heard.push(turn) });
  director.reset(1); director.offer({ round: 1, type: 'heavy_hit', team: 'red', time: 0, priority: 40, expires: 3 });
  const pending = director.tick(SCRIPTS); director.reset(2); resolve(turns); await pending;
  assert.deepEqual(heard, []); assert.equal(director.round, 2); assert.equal(director.busy, false);
});

async function backend(t, overrides = config) {
  const app = express(), io = new EventEmitter(), calls = [];
  const agent = agents();
  installCommentary(app, io, { config: overrides, connect: agent.connect, fetcher: async (url, options) => {
    calls.push({ url, options });
    return url.includes('get-signed-url') ? agent.fetcher(url, options) : { ok: true, body: (async function* () { yield Uint8Array.of(0, 0); })() };
  } });
  const socket = new EventEmitter(); socket.id = 'host'; socket.data = { host: true }; io.emit('connection', socket);
  let token; socket.emit('commentary:authorize', {}, result => { token = result.token; });
  const server = app.listen(0); await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { socket.emit('disconnect'); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`, headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  return { base, headers, calls, socket, post: data => fetch(base + '/api/commentary/dialogue', { method: 'POST', headers, body: JSON.stringify(data) }) };
}

test('dialogue API protects generation and limits one-time generated speech to authorized host', async t => {
  const h = await backend(t);
  assert.equal((await fetch(h.base + '/api/commentary/dialogue', { method: 'POST' })).status, 403);
  assert.equal((await h.post({ ...input(), firstSpeaker: 'system' })).status, 400); assert.equal(h.calls.length, 0);
  const result = await h.post(input()); assert.equal(result.status, 200);
  const exchange = await result.json(); assert.equal(exchange.turns.length, 2);
  assert.equal((await h.post(input())).status, 429);
  for (const turn of exchange.turns) {
    assert.equal((await fetch(h.base + '/api/commentary/live/' + turn.id)).status, 403);
    const audio = await fetch(h.base + '/api/commentary/live/' + turn.id, { headers: h.headers });
    assert.equal(audio.status, 200); await audio.arrayBuffer();
    assert.equal((await fetch(h.base + '/api/commentary/live/' + turn.id, { headers: h.headers })).status, 400);
  }
  assert.equal(h.calls.length, 3);
  const voiceCalls = h.calls.slice(1); assert.deepEqual(voiceCalls.map(call => JSON.parse(call.options.body).text), turns.map(turn => turn.text));
  assert.match(voiceCalls[0].url, /voice-a/); assert.match(voiceCalls[1].url, /voice-b/);
  const catalog = await fetch(h.base + '/api/commentary/catalog').then(result => result.json());
  assert.equal(catalog.dialogue, true); assert.ok(!JSON.stringify(catalog).includes('secret'));
  h.socket.emit('disconnect'); assert.equal((await h.post(input())).status, 403);
});

test('missing generation configuration stays offline without provider calls', async t => {
  const h = await backend(t, {});
  assert.equal((await h.post(input())).status, 503); assert.equal(h.calls.length, 0);
  assert.equal((await fetch(h.base + '/api/commentary/catalog').then(result => result.json())).dialogue, false);
});
