import test from 'node:test';
import assert from 'node:assert/strict';
import {CommentaryDetector,CommentaryDirector} from '../host/src/commentary.js';
import {SCRIPTS} from '../shared/commentary-scripts.js';
import {configuration,cacheKey,synthesize,installCommentary} from '../server/commentary.js';
import express from 'express';
import {EventEmitter} from 'node:events';
import {MAPS} from '../host/src/maps.js';
const hit=(attacker,damage=16)=>({type:'hit',source:'fighter',attacker,team:attacker==='red'?'blue':'red',damage});

test('losing a life triggers a roast event before the final knockout',()=>{
 const detector=new CommentaryDetector();
 const events=detector.step([{type:'ringout',team:'red',lives:1}],null,.1);
 assert.equal(events.length,1);assert.equal(events[0].type,'life_lost');assert.equal(events[0].team,'red');assert.equal(events[0].priority,90);
 const final=detector.step([{type:'ringout',team:'red',lives:0}],'blue',.1);
 assert.equal(final.length,1);assert.equal(final[0].type,'ring_out');assert.equal(final[0].team,'blue');
});
test('Gemini configuration keeps one announcer, separate provider keys, and an explicit off switch',()=>{
 const config=configuration({ELEVENLABS_VOICE_A:'zGedNEybz7PeBgPNR4L7',ELEVENLABS_MODEL_ID:'selected-model',ELEVENLABS_VOICE_B:'retired-voice',GEMINI_API_KEY:'gemini-secret',ELEVENLABS_API_KEY:'speech-secret',COMMENTARY_LIVE:'1'});
 assert.equal(config.a,'zGedNEybz7PeBgPNR4L7');assert.equal(Object.hasOwn(config,'b'),false);assert.equal(config.model,'selected-model');assert.equal(config.live,true);assert.equal(config.dialogue,true);
 assert.equal(config.geminiKey,'gemini-secret');assert.equal(config.key,'speech-secret');assert.equal(config.geminiModel,'gemini-3.5-flash-lite');
 assert.equal(configuration({COMMENTARY_DIALOGUE:'0'}).dialogue,false);
});
test('script bank covers every arena and character without duplicate IDs',()=>{
 assert.equal(new Set(SCRIPTS.map(s=>s.id)).size,SCRIPTS.length);
 for(const map of MAPS)for(const type of ['round_start','quiet_brawl','ring_out'])
  assert.ok(SCRIPTS.some(s=>s.map===map.id&&s.event===type),`${map.id}/${type}`);
 for(const fighter of ['squish','crank','bonk','nik','tung','toast','conehead','bubbles'])
  for(const type of ['round_start','heavy_hit','pressure_run','counter_swing','ring_out'])
   assert.ok(SCRIPTS.some(s=>s.fighter===fighter&&s.event===type),`${fighter}/${type}`);
});
test('director uses selected arena and attacking fighter, excludes other identities, remembers rematches',async()=>{
 let now=0;const spoken=[];
 const d=new CommentaryDirector({clock:()=>now,play:async s=>spoken.push(s)});
 const context={map:'piano',fighters:{red:'tung',blue:'bubbles'}};
 const say=async(type,team,evidence={})=>{d.offer({round:d.round,type,team,evidence,priority:40,expires:now+2});await d.tick(SCRIPTS);now+=3;};
 d.reset(1,context);await say('round_start',null);assert.equal(spoken.at(-1).map,'piano');
 d.reset(2,context);await say('round_start',null);assert.equal(spoken.at(-1).map,'piano');assert.notEqual(spoken[0].id,spoken[1].id);
 await say('heavy_hit','red');assert.equal(spoken.at(-1).fighter,'tung');
 await say('heavy_hit','blue');assert.equal(spoken.at(-1).fighter,'bubbles');
 await say('hazard_impact','red',{hazard:'laser'});assert.equal(spoken.at(-1).hazard,'laser');assert.doesNotMatch(spoken.at(-1).text,/train/i);
 d.reset(3,{map:'unknown',fighters:{}});await say('heavy_hit','red');assert.equal(spoken.at(-1).fighter,undefined);
});
test('detector reports non-train hazards with actual identity',()=>{
 for(const hazard of ['arrow','laser','lava','quake']){
  const d=new CommentaryDetector(),events=d.step([{type:'hit',source:'hazard',hazard,hazardId:'instance',team:'red'}],null,.1);
  assert.equal(events[0].type,'hazard_impact');assert.equal(events[0].evidence.hazard,hazard);
 }
});
test('detector collapses trades, counts unanswered pressure and reversal',()=>{
 const d=new CommentaryDetector();d.reset(1);
 assert.deepEqual(d.step([hit('red'),hit('blue')],null,.01).map(e=>e.type),['trade']);
 for(let i=0;i<2;i++)d.step([hit('red')],null,.5);
 assert.equal(d.step([hit('red')],null,.5)[0].type,'pressure_run');
 d.step([hit('blue')],null,.5);
 assert.equal(d.step([hit('blue')],null,.5)[0].type,'counter_swing');
});
test('hazards never become fighter hits; finish supersedes action and preserves conservative attribution',()=>{
 const d=new CommentaryDetector();const train={type:'hit',source:'hazard',hazard:'train',hazardId:'train-1',team:'blue'};
 assert.equal(d.step([train],null,.1)[0].type,'hazard_impact');
 assert.equal(d.step([], 'red',.1)[0].type,'train_finish');assert.deepEqual(d.step([], 'red',.1),[]);
 d.reset(2);assert.equal(d.step([hit('red')],'draw',.1)[0].type,'double_fall');
 d.reset(3);assert.equal(d.step([],'blue',.1)[0].type,'ring_out');
 d.reset(4);assert.deepEqual(d.step([{type:'hit',team:'red',damage:18}],null,.1),[]);
});
test('quiet intervals use simulation time and reset all history',()=>{
 const d=new CommentaryDetector();assert.deepEqual(d.step([],null,9),[]);assert.equal(d.step([],null,1)[0].type,'quiet_brawl');assert.deepEqual(d.step([],null,10),[]);d.reset(4);assert.equal(d.time,0);assert.equal(d.history.length,0);
});
test('director bounds pending stories, expires stale lines, interrupts for results and invalidates old callbacks',async()=>{
 let now=0,resolve,stops=0;const spoken=[];
 const d=new CommentaryDirector({clock:()=>now,stop:()=>stops++,play:s=>{spoken.push(s.id);return new Promise(r=>resolve=r);}});d.reset(1);
 const event=(type,priority=40,expires=3)=>({round:1,type,team:'red',priority,expires});
 d.offer(event('heavy_hit'));const old=d.tick(SCRIPTS);const oldResolve=resolve;d.offer(event('heavy_hit'));d.offer(event('pressure_run',50));assert.equal(d.pending.type,'pressure_run');
 d.offer(event('ring_out',100,8));assert.equal(d.busy,false);const finish=d.tick(SCRIPTS);const finishResolve=resolve;d.reset(2);finishResolve();await finish;assert.equal(d.round,2);assert.equal(d.busy,false);assert.ok(stops>=3);
 // Resolve original generation; it must not update the new round's cooldown.
 d.nextAt=99; // older completion cannot overwrite this
 oldResolve();await old;assert.equal(d.nextAt,99);
 const e={...event('heavy_hit'),round:2,expires:1};now=2;d.offer(e);await d.tick(SCRIPTS);assert.equal(d.pending,null);assert.equal(spoken.length,2);
});
test('provider sends finite script and supported format; cache excludes secrets but versions voices and models',async()=>{
 const config=configuration({ELEVENLABS_API_KEY:'secret',ELEVENLABS_VOICE_A:'original-a',ELEVENLABS_MODEL_ID:'selected-model',ELEVENLABS_VOICE_B:'ignored-b'});let request;
 await synthesize(SCRIPTS[0],config,{format:'pcm_24000',fetcher:async(url,options)=>{request={url,options};return {ok:true};}});
 assert.match(request.url,/output_format=pcm_24000/);assert.equal(JSON.parse(request.options.body).text,SCRIPTS[0].text);assert.equal(request.options.headers['xi-api-key'],'secret');
 assert.equal(cacheKey(SCRIPTS[0],config),cacheKey(SCRIPTS[0],{...config,key:'rotated'}));assert.notEqual(cacheKey(SCRIPTS[0],config),cacheKey(SCRIPTS[0],{...config,a:'new'}));
 await assert.rejects(synthesize(SCRIPTS[0],{}),/credentials/);
 const second=SCRIPTS.find(script=>script.speaker==='b');
 await synthesize(second,{...config,b:'ignored-voice'},{fetcher:async(url,options)=>{
  assert.match(url,/text-to-speech\/original-a\/stream/);assert.equal(JSON.parse(options.body).model_id,'selected-model');return {ok:true};
 }});
 assert.equal(cacheKey(second,config),cacheKey(second,{...config,b:'ignored-voice'}));
 for(const missing of ['key','a','model'])await assert.rejects(synthesize(SCRIPTS[0],{...config,[missing]:undefined},{fetcher:()=>assert.fail('incomplete configuration must not call ElevenLabs')}),/credentials/);
 assert.equal(configuration({}).a,undefined);assert.equal(configuration({}).model,undefined);
});

test('speech failures preserve safe provider codes and hints without returning provider messages or credentials',async()=>{
 const script=SCRIPTS.find(s=>s.speaker==='a'),config={key:'private-key',a:'configured-voice',model:'configured-model'};
 for(const field of ['code','status']){
  await assert.rejects(synthesize(script,config,{fetcher:async()=>({ok:false,status:400,json:async()=>({detail:{[field]:'invalid_output_format',message:'private-key private account information'}})})}),error=>{
   assert.equal(error.providerStatus,400);assert.equal(error.providerCode,'invalid_output_format');assert.match(error.providerHint,/PCM/);
   assert.ok(!JSON.stringify(error).includes('private-key'));return true;
  });
 }
 await assert.rejects(synthesize(script,config,{fetcher:async()=>({ok:false,status:400,json:async()=>({detail:{code:'private-key',message:'private-key'}})})}),error=>{
  assert.equal(error.providerCode,'unknown_provider_error');assert.ok(!JSON.stringify(error).includes('private-key'));return true;
 });
});

test('caption callbacks follow speech readiness and cannot display a canceled round',async()=>{
 const captions=[];let start,finish;
 const director=new CommentaryDirector({caption:text=>captions.push(text),play:(turn,event,signal,onStart)=>{
  start=onStart;return new Promise(resolve=>{finish=resolve;});
 }});
 director.reset(1);captions.length=0;
 director.offer({round:1,type:'round_start',team:null,time:0,priority:30,expires:5});
 const playing=director.tick(SCRIPTS);assert.deepEqual(captions,[]);
 start();assert.ok(captions[0]);finish(true);await playing;assert.equal(captions.at(-1),'');
 director.reset(2);director.offer({round:2,type:'round_start',team:null,time:0,priority:30,expires:5});
 const old=director.tick(SCRIPTS),oldStart=start;
 director.reset(3);const count=captions.length;oldStart();finish(false);await old;
 assert.equal(captions.length,count);assert.equal(director.history.length,0);
});
test('backend denies non-host, unknown scripts and missing live config without provider calls',async()=>{
 const app=express(),io=new EventEmitter();installCommentary(app,io,{config:{},fetcher:()=>{throw Error('must not call');}});
 const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{assert.equal((await fetch(base+'/api/commentary/live/x')).status,403);
 const socket=new EventEmitter();socket.id='host';socket.data={host:false};io.emit('connection',socket);let auth;socket.emit('commentary:authorize',{},r=>auth=r);assert.ok(auth.error);socket.data.host=true;socket.emit('commentary:authorize',{},r=>auth=r);
 const headers={Authorization:`Bearer ${auth.token}`};assert.equal((await fetch(base+'/api/commentary/live/x',{headers})).status,400);assert.equal((await fetch(base+'/api/commentary/live/'+SCRIPTS[0].id,{headers})).status,503);
 const catalog=await fetch(base+'/api/commentary/catalog').then(r=>r.json());assert.equal(catalog.live,false);assert.ok(!JSON.stringify(catalog).includes(auth.token));socket.emit('disconnect');assert.equal((await fetch(base+'/api/commentary/live/x',{headers})).status,403);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('live relay streams PCM bytes and limits repeat requests',async()=>{
 const app=express(),io=new EventEmitter();let calls=0;const requestedVoices=[];
 installCommentary(app,io,{config:{key:'private',a:'only-voice-a',model:'selected-model',live:true},fetcher:async(url,options)=>{calls++;requestedVoices.push(url);assert.equal(JSON.parse(options.body).model_id,'selected-model');return {ok:true,body:(async function*(){yield Uint8Array.of(1,2,3);yield Uint8Array.of(4);})()};}});
 const socket=new EventEmitter();socket.id='h';socket.data={host:true};io.emit('connection',socket);let token;socket.emit('commentary:authorize',{},r=>token=r.token);
 const server=app.listen(0);await new Promise(r=>server.once('listening',r));
 try{const url=`http://127.0.0.1:${server.address().port}/api/commentary/live/${SCRIPTS[0].id}`,headers={Authorization:`Bearer ${token}`};const result=await fetch(url,{headers});assert.equal(result.status,200);assert.equal(result.headers.get('x-audio-sample-rate'),'24000');assert.deepEqual([...new Uint8Array(await result.arrayBuffer())],[1,2,3,4]);assert.equal((await fetch(url,{headers})).status,429);assert.equal(calls,1);
 const second=SCRIPTS.find(script=>script.speaker==='b');
 const reply=await fetch(new URL(second.id,url),{headers});assert.equal(reply.status,400,'retired second-speaker IDs cannot request speech');
 assert.equal(calls,1);assert.match(requestedVoices[0],/text-to-speech\/only-voice-a\/stream/);
 const catalog=await fetch(new URL('/api/commentary/catalog',url)).then(r=>r.json());assert.equal(catalog.live,true,'live speech needs only one voice');
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('real simulation telemetry identifies attacker and preserves both pre-contact states in a trade',async()=>{
 const {Simulation}=await import('../host/src/simulation.js');const sim=new Simulation();sim.fighters[0].x=-.65;sim.fighters[1].x=.65;
 sim.step({red:{arm:{punch:true,power:1}},blue:{arm:{punch:true,power:1}}});let contacts=[];
 for(let i=0;i<12;i++){sim.step({});const hits=sim.motionEvents.filter(e=>e.type==='hit');if(hits.length){contacts=hits;break;}}
 assert.equal(contacts.length,2);assert.deepEqual(new Set(contacts.map(e=>e.attacker)),new Set(['red','blue']));
 for(const event of contacts){assert.equal(event.source,'fighter');assert.notEqual(event.attacker,event.team);assert.ok(event.attackId>0);assert.equal(event.before.grounded,true);assert.equal(event.attackerBefore.grounded,true);assert.equal(event.after.grounded,false);assert.ok(event.after.vy>0);}
});

test('pressure uses a rolling four-second window and announces only once per unanswered exchange',()=>{
 const d=new CommentaryDetector();d.step([hit('red',10)],null,.1);d.step([hit('red',10)],null,3);
 assert.equal(d.step([hit('red',10)],null,1.1).some(e=>e.type==='pressure_run'),false);
 assert.equal(d.step([hit('red',10)],null,.5).some(e=>e.type==='pressure_run'),true);
 assert.equal(d.step([hit('red',10)],null,.5).some(e=>e.type==='pressure_run'),false);
});
test('reversal requires two unanswered replies within five seconds of the pressure ending',()=>{
 const pressure=d=>{for(let i=0;i<3;i++)d.step([hit('red',10)],null,.5);};
 const d=new CommentaryDetector();pressure(d);d.step([hit('blue',10)],null,.1);d.step([hit('red',10)],null,.1);
 assert.equal(d.step([hit('blue',10)],null,.1).some(e=>e.type==='counter_swing'),false);
 d.reset(2);pressure(d);d.step([hit('blue',10)],null,4.8);
 assert.equal(d.step([hit('blue',10)],null,.3).some(e=>e.type==='counter_swing'),false);
 d.reset(3);pressure(d);d.step([hit('blue',10)],null,.2);
 assert.equal(d.step([hit('blue',10)],null,.2).some(e=>e.type==='counter_swing'),true);
});
test('quiet jokes wait until both fighters are grounded and unstunned; hazards cannot build pressure',()=>{
 const d=new CommentaryDetector();assert.deepEqual(d.step([],null,11,[{grounded:false,stun:0}]),[]);
 assert.deepEqual(d.step([],null,.1,[{grounded:true,stun:.2}]),[]);
 assert.equal(d.step([],null,.1,[{grounded:true,stun:0},{grounded:true,stun:0}])[0].type,'quiet_brawl');
 d.reset(2);d.step([hit('red',10)],null,.1);d.step([hit('red',10)],null,.1);
 d.step([{type:'hit',source:'hazard',team:'red',hazard:'lava'}],null,.1);
 assert.equal(d.step([hit('red',10)],null,.1).some(e=>e.type==='pressure_run'),false);
});
test('director keeps both hosts in repeated-event rotation beyond the recent-line memory length',async()=>{
 let now=0;const speakers=[];const d=new CommentaryDirector({clock:()=>now,play:async script=>speakers.push(script.speaker)});d.reset(1);
 for(let i=0;i<24;i++){d.offer({round:1,type:'heavy_hit',team:'red',priority:40,expires:now+1.5});await d.tick(SCRIPTS);now+=3;}
 assert.equal(speakers.length,24);for(let i=1;i<speakers.length;i++)assert.notEqual(speakers[i],speakers[i-1]);
});

test('context-specific A lines cannot starve the custom B announcer across different events',async()=>{
 let now=0;const spoken=[];const d=new CommentaryDirector({clock:()=>now,play:async script=>spoken.push(script)});
 d.reset(1,{map:'piano',fighters:{red:'squish',blue:'bonk'}});
 for(const type of ['round_start','pressure_run','counter_swing','hazard_impact','quiet_brawl','ring_out']){
  d.offer({round:1,type,team:type==='round_start'||type==='quiet_brawl'?null:'red',priority:40,expires:now+3});await d.tick(SCRIPTS);now+=3;
 }
 assert.deepEqual(spoken.map(script=>script.speaker),['a','b','a','b','a','b']);
});
test('every supported event and team maps to an approved playable script, with no early winner call',async()=>{
 const events=[];const detector=new CommentaryDetector();detector.reset(1);
 events.push(detector.event('round_start',null));
 for(const team of ['red','blue']){
  detector.reset(1);events.push(...detector.step([hit(team)],null,.1));
  for(let i=0;i<2;i++)events.push(...detector.step([hit(team,10)],null,.1));
  const opponent=team==='red'?'blue':'red';detector.step([hit(opponent,10)],null,.1);events.push(...detector.step([hit(opponent,10)],null,.1));
  detector.reset(1);events.push(...detector.step([{type:'hit',source:'hazard',hazard:'train',team:opponent}],null,.1));events.push(...detector.step([],team,.1));
  detector.reset(1);events.push(...detector.step([],team,.1));
 }
 detector.reset(1);events.push(...detector.step([hit('red'),hit('blue')],null,.1));events.push(...detector.step([],null,11,[{grounded:true}]));events.push(...detector.step([],'draw',.1));
 assert.deepEqual(new Set(events.map(e=>e.type)),new Set(['round_start','heavy_hit','pressure_run','counter_swing','hazard_impact','train_finish','ring_out','trade','quiet_brawl','double_fall']));
 for(const event of events){let spoken;const d=new CommentaryDirector({clock:()=>event.time,play:async script=>{spoken=script;}});d.reset(event.round);d.offer(event);await d.tick(SCRIPTS);assert.ok(spoken,`${event.type}/${event.team}`);assert.ok(spoken.text.length>0);}
 detector.reset(1);assert.deepEqual(detector.step([],null,.1,[{grounded:false}]),[]);
});

test('heavy-hit boundary and train finish evidence are conservative',()=>{
 const d=new CommentaryDetector();assert.equal(d.step([hit('red',14)],null,.1).some(e=>e.type==='heavy_hit'),false);
 assert.equal(d.step([hit('red',15)],null,.1).some(e=>e.type==='heavy_hit'),true);
 const train={type:'hit',source:'hazard',hazard:'train',team:'blue'};
 d.reset(2);d.step([train],null,.1);assert.equal(d.step([],'red',1.6)[0].type,'ring_out');
 d.reset(3);d.step([train],null,.1);d.step([hit('red',10)],null,.1);assert.equal(d.step([],'red',.1)[0].type,'ring_out');
});
