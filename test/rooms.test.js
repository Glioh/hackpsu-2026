import test from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { createApp } from '../server/index.js';
const waitEvent=(socket,name)=>new Promise(resolve=>socket.once(name,resolve));
const emit=(socket,name,p)=>new Promise(resolve=>socket.emit(name,p,resolve));

test('room lifecycle: four unique slots, readiness, authorization, reconnect, rematch, host close',async t=>{
  const {http,io}=createApp();await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+http.address().port,sockets=[];
  const client=async()=>{const s=connect(url,{forceNew:true,reconnection:false});sockets.push(s);await waitEvent(s,'connect');return s;};
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await new Promise(resolve=>io.close(resolve));});
  assert.equal((await fetch(url+'/health')).status,200);
  for(const route of ['/','/controller','/vendor/three/three.module.js','/vendor/three/addons/loaders/GLTFLoader.js','/host/assets/characters/sir_squish.glb','/host/assets/characters/crank.glb','/host/assets/characters/nik.glb','/host/assets/characters/toast_malone.glb','/host/assets/characters/conehead.glb','/host/assets/characters/captain_bubbles.glb','/shared/config.js'])assert.equal((await fetch(url+route)).status,200);
  const host=await client(),created=await emit(host,'room:create',{}),roomCode=created.roomCode;
  assert.match(roomCode,/^[A-F0-9]{6}$/);
  assert.ok((await emit(host,'game:start',{})).error);
  const phones=[],assignments=[];
  for(let i=0;i<4;i++){const p=await client();phones.push(p);assignments.push(await emit(p,'room:join',{roomCode}));}
  assert.equal(new Set(assignments.map(p=>p.team+':'+p.role)).size,4);
  const fifth=await client();assert.ok((await emit(fifth,'room:join',{roomCode})).error);
  let relayed=[];host.on('input:legs',p=>relayed.push(p));host.on('input:arm',p=>relayed.push(p));
  phones[0].emit('input:arm',{seq:0,turn:1,power:1});
  phones[0].emit('input:legs',{seq:1,moveX:1,moveZ:0,team:'blue',key:'blue:legs'});
  await new Promise(resolve=>setTimeout(resolve,50));assert.equal(relayed.length,1);assert.equal(relayed[0].key,'red:legs');
  phones[0].emit('input:legs',{seq:1,moveX:1,moveZ:0});phones[0].emit('input:legs',{seq:2,moveX:99,moveZ:0});
  await new Promise(resolve=>setTimeout(resolve,50));assert.equal(relayed.length,1);
  phones.forEach(p=>p.emit('player:ready',true));await new Promise(resolve=>setTimeout(resolve,50));
  let stateEvent=waitEvent(phones[0],'game:state');assert.equal((await emit(host,'game:start',{})).ok,true);assert.equal((await stateEvent).phase,'playing');
  stateEvent=waitEvent(phones[0],'game:state');host.emit('game:state',{phase:'results',winner:'red'});assert.equal((await stateEvent).winner,'red');
  assert.equal((await emit(host,'game:start',{})).ok,true);
  stateEvent=waitEvent(host,'game:state');phones[0].disconnect();assert.equal((await stateEvent).phase,'paused');
  assert.ok((await emit(host,'game:start',{})).error);
  const replacement=await client(),reassigned=await emit(replacement,'room:join',{roomCode,clientToken:assignments[0].clientToken});assert.equal(reassigned.team,'red');assert.equal(reassigned.role,'legs');
  const closed=waitEvent(replacement,'room:closed');host.disconnect();await closed;
  await new Promise(resolve=>setTimeout(resolve,20));assert.ok((await emit(replacement,'room:join',{roomCode})).error);
});

test('debug start is explicitly available without phones',async t=>{
  const {http,io}=createApp();await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
  const host=connect('http://127.0.0.1:'+http.address().port,{reconnection:false});
  t.after(async()=>{host.disconnect();await new Promise(resolve=>io.close(resolve));});
  await waitEvent(host,'connect');await emit(host,'room:create',{});assert.equal((await emit(host,'game:start',{debug:true})).ok,true);
});

test('only the room host can kick, removed phones stop receiving and sending, and replacements resume play',async t=>{
  const {http,io,rooms}=createApp({controllerTimeoutMs:60000});
  await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
  const sockets=[],url='http://127.0.0.1:'+http.address().port;
  const client=async()=>{const s=connect(url,{forceNew:true,reconnection:false});sockets.push(s);await waitEvent(s,'connect');return s;};
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await new Promise(resolve=>io.close(resolve));});
  const host=await client(),{roomCode}=await emit(host,'room:create',{}),phones=[],assignments=[];
  for(let i=0;i<4;i++){const phone=await client();phones.push(phone);assignments.push(await emit(phone,'room:join',{roomCode}));phone.emit('player:ready',true);}
  const otherHost=await client();await emit(otherHost,'room:create',{});
  assert.ok((await emit(phones[0],'player:kick',{key:'blue:arm'})).error);
  assert.ok((await emit(otherHost,'player:kick',{key:'red:legs'})).error);
  assert.ok((await emit(host,'player:kick',{key:'invalid'})).error);
  // Acknowledgement on the same connection guarantees all preceding ready messages were processed.
  await emit(phones[3],'player:kick',{key:'invalid'});
  assert.equal((await emit(host,'game:start',{})).ok,true);
  const kicked=waitEvent(phones[0],'player:kicked'),paused=waitEvent(host,'game:state'),roster=waitEvent(host,'room:roster');
  assert.equal((await emit(host,'player:kick',{key:'red:legs'})).ok,true);
  await kicked;assert.equal((await paused).phase,'paused');
  assert.ok((await emit(phones[0],'room:join',{roomCode,clientToken:assignments[0].clientToken})).error);
  const slot=(await roster).slots.find(s=>s.key==='red:legs');assert.equal(slot.occupied,false);assert.equal(slot.connected,false);
  let relayed=0,leaked=0;host.on('input:legs',()=>relayed++);phones[0].on('room:roster',()=>leaked++);
  phones[0].emit('input:legs',{seq:1,moveX:1,moveZ:0});phones[0].emit('player:ready',true);
  const replacement=await client(),assignment=await emit(replacement,'room:join',{roomCode});
  assert.equal(assignment.team+':'+assignment.role,'red:legs');
  const resumed=waitEvent(host,'game:state');replacement.emit('player:ready',true);
  assert.equal((await resumed).resumed,true);assert.equal(relayed,0);assert.equal(leaked,0);
  assert.equal(rooms.get(roomCode).players.get('red:legs').socketId,replacement.id);
  // Disconnected roles are reserved until the host explicitly frees them.
  const disconnected=waitEvent(host,'room:roster');phones[1].disconnect();await disconnected;
  assert.equal((await emit(host,'player:kick',{key:'red:arm'})).ok,true);
  assert.equal(rooms.get(roomCode).players.has('red:arm'),false);
  const reconnect=await client();
  assert.ok((await emit(reconnect,'room:join',{roomCode,clientToken:assignments[1].clientToken})).error);
});
