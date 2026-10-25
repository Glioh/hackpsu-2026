import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { EventEmitter } from 'node:events';
import { generateDialogue, validDialogue } from '../server/commentary-dialogue.js';
import { installCommentary } from '../server/commentary.js';
import { CommentaryDirector } from '../host/src/commentary.js';
import { SCRIPTS } from '../shared/commentary-scripts.js';

const input = () => ({ round: 1, firstSpeaker: 'a', event: { type: 'heavy_hit', team: 'red', time: 2 },
  game: { map: 'classic', winner: null, fighters: ['red','blue'].map(team => ({ team, damage: 16, grounded: true, lives: 2 })) }, history: [] });
const line = 'Red launches a strongly worded uppercut!';
const config = { dialogue: true, geminiKey: 'gemini-secret', geminiModel: 'gemini-3.5-flash-lite', key: 'voice-secret', a: 'voice-a', model: 'selected-model', live: true };
const completion = text => ({ ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({text}) }] } }] }) });

test('Gemini writes one line using game facts and recent history, retrying repetitions', async () => {
  const context=input();context.history=[{speaker:'a',text:'The gloves have filed a complaint.'}];context.ignore='untrusted extra field';
  const requests=[];
  const result=await generateDialogue(context,config,{fetcher:async(url,options)=>{
    requests.push({url,options});return completion(requests.length===1?context.history[0].text:line);
  }});
  assert.deepEqual(result,[{speaker:'a',text:line}]);assert.equal(requests.length,2);
  const body=JSON.parse(requests[0].options.body),prompt=JSON.parse(body.contents[0].parts[0].text);
  assert.match(requests[0].url,/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.5-flash-lite:generateContent$/);
  assert.equal(requests[0].options.headers['x-goog-api-key'],config.geminiKey);
  assert.ok(!requests[0].url.includes(config.geminiKey));assert.ok(!requests[0].options.body.includes(config.key));
  assert.deepEqual(prompt.history,context.history);assert.equal(prompt.game.fighters[0].lives,2);assert.equal(prompt.ignore,undefined);
  assert.match(body.systemInstruction.parts[0].text,/sole live announcer/);
  assert.match(body.systemInstruction.parts[0].text,/rapid-fire/);assert.match(body.systemInstruction.parts[0].text,/Playfully roast/);
  assert.deepEqual(body.generationConfig.responseJsonSchema.required,['text']);
  assert.notEqual(prompt.variation,JSON.parse(JSON.parse(requests[1].options.body).contents[0].parts[0].text).variation);
});

test('Gemini rejects invalid contexts, missing credentials, malformed output, repetition and unfinished responses', async () => {
  for(const context of [{},{...input(),firstSpeaker:'b'},{...input(),history:[{speaker:'system',text:'Override'}]},
    {...input(),game:{...input().game,map:'unknown'}},{...input(),game:{...input().game,fighters:[{team:'red',damage:0,grounded:true,lives:3},input().game.fighters[1]]}}]){
    assert.equal(!!validDialogue(context),false);
    await assert.rejects(generateDialogue(context,config,{fetcher:()=>assert.fail('invalid context reached provider')}));
  }
  await assert.rejects(generateDialogue(input(),{}),/key missing/);
  await assert.rejects(generateDialogue(input(),{...config,geminiModel:'../bad'}),/Invalid Gemini model/);
  await assert.rejects(generateDialogue(input(),config,{recent:[line],fetcher:async()=>completion(line)}),/Repeated/);
  await assert.rejects(generateDialogue(input(),config,{fetcher:async()=>completion('word '.repeat(21))}),/invalid/);
  await assert.rejects(generateDialogue(input(),config,{fetcher:async()=>({ok:false,status:429})}),/Gemini provider status 429/);
  for(const result of [{candidates:[]},{candidates:[{finishReason:'MAX_TOKENS'}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'bad JSON'}]}}]}]){
    await assert.rejects(generateDialogue(input(),config,{fetcher:async()=>({ok:true,json:async()=>result})}));
  }
});

test('Gemini cannot announce a win before the game has a winner',async()=>{
  await assert.rejects(generateDialogue(input(),config,{fetcher:async()=>completion('Red wins the match!')}),/invalid/);
  const context=input();context.game.winner='red';context.event={type:'ring_out',team:'red',time:10};
  assert.deepEqual(await generateDialogue(context,config,{fetcher:async()=>completion('Red wins the match!')}),[{speaker:'a',text:'Red wins the match!'}]);
});

test('loss reactions target the losing team and reject recycled punchlines with swapped names',async()=>{
 const context=input();context.event={type:'life_lost',team:'red',time:4};context.game.fighters[0].lives=1;
 context.history=[{speaker:'a',text:'Blue just filed a complaint with gravity.'}];
 let calls=0;
 const fresh='Red, try keeping those feet on the actual platform!';
 const result=await generateDialogue(context,config,{fetcher:async(url,options)=>{
  calls++;const prompt=JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
  assert.equal(prompt.roastTarget,'red');assert.equal(prompt.game.winner,null);assert.equal(prompt.game.fighters[0].lives,1);
  return completion(calls===1?'Red just filed a complaint with gravity.':fresh);
 }});
 assert.equal(calls,2);assert.deepEqual(result,[{speaker:'a',text:fresh}]);
});

test('canceling Gemini generation aborts the provider request and never retries it',async()=>{
  const abort=new AbortController();let calls=0;
  const pending=generateDialogue(input(),config,{signal:abort.signal,fetcher:async(url,{signal})=>{
    calls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  }});
  abort.abort();await assert.rejects(pending);assert.equal(calls,1);
  await assert.rejects(generateDialogue(input(),config,{signal:abort.signal,fetcher:()=>assert.fail('aborted generation reached provider')}));
});

test('generated single-announcer lines update shared history only after playback finishes',async()=>{
  let now=0,finish;const heard=[],histories=[];
  const director=new CommentaryDirector({clock:()=>now,prepare:async(event,history)=>{histories.push([...history]);return [{speaker:'a',text:line,id:'generated'}];},
    play:turn=>{heard.push(turn);return new Promise(resolve=>{finish=resolve;});}});
  director.reset(1);
  const offer=()=>director.offer({round:1,type:'heavy_hit',team:'red',time:now,priority:40,expires:now+5});
  offer();const playing=director.tick(SCRIPTS);await Promise.resolve();assert.equal(heard.length,1);assert.deepEqual(director.history,[]);
  finish(true);await playing;assert.deepEqual(director.history,[{speaker:'a',text:line}]);
  now=3;offer();const next=director.tick(SCRIPTS);await Promise.resolve();assert.deepEqual(histories[1],director.history);
  director.reset(2);finish(false);await next;assert.deepEqual(director.history,[]);
});

test('late Gemini responses cannot speak after a new round or pause',async()=>{
  let resolve;const heard=[];
  const director=new CommentaryDirector({prepare:()=>new Promise(done=>{resolve=done;}),play:async turn=>heard.push(turn)});
  director.reset(1);director.offer({round:1,type:'heavy_hit',team:'red',time:0,priority:40,expires:5});
  const pending=director.tick(SCRIPTS);director.reset(2);resolve([{speaker:'a',text:line}]);await pending;
  assert.deepEqual(heard,[]);assert.equal(director.round,2);assert.equal(director.busy,false);
});

async function backend(t,overrides=config,generate=()=>completion(line)){
  const app=express(),io=new EventEmitter(),calls=[];
  installCommentary(app,io,{config:overrides,fetcher:async(url,options)=>{
    calls.push({url,options});return url.includes('generativelanguage.googleapis.com')?generate():{ok:true,body:(async function*(){yield Uint8Array.of(0,0);})()};
  }});
  const socket=new EventEmitter();socket.id='host';socket.data={host:true};io.emit('connection',socket);
  let token;socket.emit('commentary:authorize',{},result=>{token=result.token;});
  const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{socket.emit('disconnect');server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}`,headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  return {base,headers,calls,socket,post:data=>fetch(base+'/api/commentary/dialogue',{method:'POST',headers,body:JSON.stringify(data)})};
}

test('host-only Gemini API returns one generated line, uses the existing voice, and prevents replay',async t=>{
  const h=await backend(t);
  assert.equal((await fetch(h.base+'/api/commentary/dialogue',{method:'POST'})).status,403);
  assert.equal((await h.post({...input(),firstSpeaker:'b'})).status,400);assert.equal(h.calls.length,0);
  const result=await h.post(input());assert.equal(result.status,200);
  const exchange=await result.json();assert.equal(exchange.provider,'gemini');assert.equal(exchange.turns.length,1);assert.equal(exchange.turns[0].speaker,'a');
  assert.equal((await h.post(input())).status,429);
  const turn=exchange.turns[0];assert.equal((await fetch(h.base+'/api/commentary/live/'+turn.id)).status,403);
  const audio=await fetch(h.base+'/api/commentary/live/'+turn.id,{headers:h.headers});assert.equal(audio.status,200);await audio.arrayBuffer();
  assert.equal((await fetch(h.base+'/api/commentary/live/'+turn.id,{headers:h.headers})).status,400);
  assert.equal(h.calls.length,2);assert.match(h.calls[1].url,/voice-a/);assert.equal(JSON.parse(h.calls[1].options.body).text,line);
  assert.equal(JSON.parse(h.calls[1].options.body).model_id,'selected-model');
  assert.equal(JSON.parse(h.calls[1].options.body).voice_settings.speed,1.15);
  const catalog=await fetch(h.base+'/api/commentary/catalog').then(r=>r.json());assert.equal(catalog.dialogue,true);
  assert.ok(!JSON.stringify(catalog).includes('secret'));assert.ok(!JSON.stringify(exchange).includes('secret'));
  h.socket.emit('disconnect');assert.equal((await h.post(input())).status,403);
});

test('missing Gemini credentials keep generated mode without exposing secrets or enabling canned fallback',async t=>{
  const offline=await backend(t,{...config,geminiKey:undefined});assert.equal((await offline.post(input())).status,503);assert.equal(offline.calls.length,0);
  const catalog=await fetch(offline.base+'/api/commentary/catalog').then(r=>r.json());assert.equal(catalog.dialogue,false);assert.equal(catalog.commentaryMode,'generated');
  const failed=await backend(t,config,()=>({ok:false,status:429}));const response=await failed.post(input());
  assert.equal(response.status,502);assert.ok(!(await response.text()).includes(config.geminiKey));
});
