import test from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { createApp } from '../server/index.js';

function event(socket,name,predicate=()=>true) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.off(name,listener);reject(Error('Timed out: '+name));},3000);
    function listener(value){if(predicate(value)){clearTimeout(timer);socket.off(name,listener);resolve(value);}}
    socket.on(name,listener);
  });
}
const emit=(socket,name,payload={})=>new Promise((resolve,reject)=>socket.timeout(2000).emit(name,payload,(error,result)=>error?reject(error):resolve(result)));
async function setup(t, options) {
  const app=createApp(options); await new Promise(resolve=>app.http.listen(0,'127.0.0.1',resolve));
  const clients=[], url='http://127.0.0.1:'+app.http.address().port;
  t.after(async()=>{clients.forEach(client=>client.disconnect());await new Promise(resolve=>app.io.close(resolve));});
  async function client(){const socket=connect(url,{transports:['websocket'],reconnection:false,forceNew:true});clients.push(socket);await event(socket,'connect');return socket;}
  const host=await client(), {roomCode}=await emit(host,'room:create'), phones=[];
  for(let i=0;i<4;i++){const phone=await client();await emit(phone,'room:join',{roomCode});phones.push(phone);}
  const ready=event(host,'room:roster',p=>p.slots.every(slot=>slot.ready));
  phones.forEach(phone=>phone.emit('player:calibration',{status:'calibrated'}));await ready;
  assert.equal((await emit(host,'game:start')).ok,true);
  return {...app,host,phones,roomCode};
}

test('calibration errors pause the same room and resume only after recalibration',async t=>{
  const {host,phones,roomCode,rooms}=await setup(t);
  const room=rooms.get(roomCode), tokens=[...room.players.values()].map(player=>player.token);
  for(const status of ['orientation-error','permission-denied','sensor-stale','backgrounded','calibration-required']) {
    const paused=event(host,'game:state',p=>p.phase==='paused');
    phones[1].emit('player:calibration',{status});
    const state=await paused;
    assert.equal(state.interruption.key,'red:arm');assert.equal(state.interruption.status,status);
    assert.equal(room.phase,'paused');
    assert.ok((await emit(host,'game:resume')).error);
    assert.ok((await emit(host,'game:start')).error);
    assert.ok((await emit(phones[0],'game:resume')).error);
    const ready=event(host,'room:roster',p=>p.slots.every(slot=>slot.ready));
    phones[1].emit('player:calibration',{status:'calibrated'});await ready;
    const resumed=event(host,'game:state',p=>p.phase==='playing');
    assert.equal((await emit(host,'game:resume')).ok,true);
    assert.equal((await resumed).resumed,true);
    assert.equal(rooms.get(roomCode),room);assert.deepEqual([...room.players.values()].map(player=>player.token),tokens);
  }
  const roster=event(host,'room:roster');
  phones[0].emit('player:calibration',{status:'<script>bad status</script>'});
  phones[0].emit('player:calibration',{status:'calibrated'});
  assert.ok((await roster).slots.every(slot=>slot.status==='calibrated'));
});

test('silent controller watchdog pauses and clears readiness',async t=>{
  const {host,rooms,roomCode}=await setup(t,{controllerTimeoutMs:150,watchdogIntervalMs:20});
  const state=await event(host,'game:state',p=>p.phase==='paused');
  assert.equal(state.interruption.status,'sensor-stale');
  assert.ok([...rooms.get(roomCode).players.values()].some(player=>!player.ready));
  assert.ok((await emit(host,'game:resume')).error);
});

test('host pause supports debug matches and cannot be triggered by controllers',async t=>{
  const {host,phones}=await setup(t);
  assert.ok((await emit(phones[0],'game:pause')).error);
  assert.equal((await emit(host,'game:start',{debug:true})).ok,true);
  const paused=event(host,'game:state',p=>p.phase==='paused');
  assert.equal((await emit(host,'game:pause')).ok,true);assert.equal((await paused).interruption.status,'host-paused');
  phones[0].emit('player:calibration',{status:'backgrounded'});
  const resumed=event(host,'game:state',p=>p.phase==='playing');
  assert.equal((await emit(host,'game:resume')).ok,true);assert.equal((await resumed).debug,true);
});
