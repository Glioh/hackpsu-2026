import test from 'node:test';
import assert from 'node:assert/strict';
import { lobby, event, emit, startMatch } from './helpers/party.js';

test('lobby accepts names beyond four, defers roles and rejects odd start counts', async t => {
  const c = await lobby(t, 5);
  assert.ok(c.phones.every(p => p.assignment.role === null));
  assert.equal(new Set(c.phones.map(p => p.assignment.playerId)).size, 5);
  assert.ok((await emit(c.host, 'game:start')).error);
  const sixth = await c.client(); c.phones.push(sixth);
  await emit(sixth, 'room:join', { roomCode:c.roomCode, name:'Sixth' });
  const final = await startMatch(c);
  assert.equal(final.match.mode, 'ffa'); assert.equal(final.match.count, 3); assert.equal(final.phase, 'playing');
  assert.equal(new Set(final.match.fighters.map(f=>f.color)).size,3);
  assert.ok(c.phones.every(phone=>phone.assignment.fighterColor===final.match.fighters.find(f=>f.id===phone.assignment.fighterId).color));
  assert.equal(c.room.players.size, 6);
  const late = await c.client(); assert.ok((await emit(late,'room:join',{roomCode:c.roomCode})).error);
});
test('8 and 12 phones receive balanced teams; vote changes count once; only top maps can win', async t => {
  for (const count of [8,12]) {
    const c = await lobby(t, count);
    assert.equal((await emit(c.host,'game:start')).ok,true);
    assert.equal(c.room.match.mode,'teams'); assert.equal(c.room.match.lives,count===8?2:3);
    assert.equal(c.room.match.fighters.filter(f=>f.side==='red').length,count/4);
    const mapReady=event(c.host,'game:state',s=>s.phase==='map-vote');
    await emit(c.phones[0],'character:vote',{id:'squish'});
    await emit(c.phones[0],'character:vote',{id:'wukong'});
    for(let i=1;i<count;i++)await emit(c.phones[i],'character:vote',{id:'squish'});
    const state=await mapReady, [a,b]=state.selection.options;
    assert.equal(new Set(state.selection.options).size,6);
    assert.ok((await emit(c.host,'map:vote',{id:a})).error);
    assert.ok((await emit(c.phones[0],'map:vote',{id:'not-a-map'})).error);
    const rolled=event(c.host,'game:state',s=>s.phase==='map-roll');
    for(let i=0;i<count;i++)await emit(c.phones[i],'map:vote',{id:i%2?a:b});
    const result=await rolled; assert.ok([a,b].includes(result.match.mapId));
    assert.equal(result.selection.roll.frames.at(-1).id,result.match.mapId);
  }
});
test('input relay uses assigned pair/role, rejects spoofing, duplicates and oversized input', async t => {
  const c=await lobby(t);await startMatch(c);
  const phone=c.phones[0], p=c.room.players.get(phone.assignment.playerId), other=p.role==='legs'?'arm':'legs', relayed=[];
  c.host.on('input:'+p.role,data=>relayed.push(data));
  phone.emit('input:'+other,{seq:0,moveX:1,moveZ:0,turn:1,power:1});
  const next=event(c.host,'input:'+p.role);
  const data={seq:1,moveX:1,moveZ:0,turn:1,power:1,key:'spoof',team:'spoof'};
  phone.emit('input:'+p.role,data);assert.equal((await next).key,`${p.fighterId}:${p.role}`);
  phone.emit('input:'+p.role,data);phone.emit('input:'+p.role,{...data,seq:2,moveX:99,turn:99});
  await emit(c.host,'game:pause');assert.equal(relayed.length,1);
});
test('host removal revokes token, returns active room to lobby, rejects controller kicks', async t => {
  const c=await lobby(t);await startMatch(c);
  const p=c.phones[0].assignment;
  assert.ok((await emit(c.phones[0],'player:kick',{key:p.playerId})).error);
  const removed=event(c.phones[0],'player:kicked'), reset=event(c.host,'game:state',s=>s.phase==='lobby');
  assert.equal((await emit(c.host,'player:kick',{key:p.playerId})).ok,true);await removed;await reset;
  assert.equal(c.room.players.size,3);assert.equal(c.room.match,null);
  assert.ok((await emit(c.phones[0],'room:join',{roomCode:c.roomCode,clientToken:p.clientToken})).error);
  const replacement=await c.client();assert.equal((await emit(replacement,'room:join',{roomCode:c.roomCode,name:'Replacement'})).role,null);
});
test('host close expires room, debug starts without phones, setup cancellation clears timers', async t => {
  const c=await lobby(t);await emit(c.host,'game:start');
  assert.equal(c.room.phase,'character-select');c.host.emit('game:state',{phase:'lobby'});
  await event(c.host,'game:state',s=>s.phase==='lobby');assert.equal(c.room.selection,null);
  assert.equal((await emit(c.host,'game:start',{debug:true})).ok,true);
  const closed=event(c.phones[0],'room:closed');c.host.disconnect();await closed;assert.equal(c.rooms.has(c.roomCode),false);
});
test('selection deadlines resolve missing votes and calibration gates gameplay', async t => {
  const c=await lobby(t,4,{selectionMs:30});
  const final=event(c.host,'game:state',s=>s.phase==='calibrating');await emit(c.host,'game:start');await final;
  assert.ok(c.room.match.mapId);assert.ok(c.room.match.fighters.every(f=>f.character));
  const playing=event(c.host,'game:state',s=>s.phase==='playing');c.phones.forEach(p=>p.emit('player:ready',true));await playing;
});
test('keep playing retains matchup and pauses safely when a phone needs calibration', async t => {
  const c = await lobby(t); await startMatch(c);
  const match = structuredClone(c.room.match);
  const fighters=structuredClone(match.fighters);let previousMap=match.mapId;
  for (const needsCalibration of [false, true]) {
    const results = event(c.host, 'game:state', s => s.phase === 'results');
    c.host.emit('game:state', { phase: 'results', winner: 'red' }); await results;
    assert.ok((await emit(c.phones[0], 'game:start')).error);
    if (needsCalibration) {
      const roster = event(c.host, 'room:roster', s => s.slots.some(p => !p.ready));
      c.phones[0].emit('player:ready', false); await roster;
    }
    assert.equal((await emit(c.host, 'game:start')).ok, true);
    assert.deepEqual(c.room.match.fighters,fighters);assert.notEqual(c.room.match.mapId,previousMap);previousMap=c.room.match.mapId;assert.equal(c.room.winner, null);
    assert.equal(c.room.phase, needsCalibration ? 'paused' : 'playing');
    if (needsCalibration) {
      const resumed = event(c.host, 'game:state', s => s.phase === 'playing' && s.resumed);
      c.phones[0].emit('player:ready', true); await resumed;
    }
  }
});
