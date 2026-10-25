import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {MAPS,createArena} from '../host/src/maps.js';
import {Simulation,fighter} from '../host/src/simulation.js';
import {createArcheryView} from '../host/src/archery-view.js';
import {TARGET_RADIUS as R,ARROW_RADIUS,ARROW_WARNING,ARROW_FALL,ARROW_LINGER} from '../shared/archery-layout.js';

function warning(a){for(let i=0;i<400&&!a.arrows.length;i++)a.step(.02,[],[]);return a.arrows[0];}
test('target is selectable with circular support and safe separated spawns',()=>{
  assert.ok(MAPS.some(m=>m.id==='archery'));
  const a=createArena('archery');
  for(let i=0;i<72;i++){
    const angle=i*Math.PI/36;
    assert.ok(a.floorAt(Math.cos(angle)*(R-.001),Math.sin(angle)*(R-.001)));
    assert.equal(a.floorAt(Math.cos(angle)*(R+.001),Math.sin(angle)*(R+.001)),null);
  }
  assert.equal(a.floorAt(7,7),null);assert.equal(a.floorAt(0,0,-.1),null);
  for(const [x,z] of a.spawn)assert.ok(Math.hypot(x,z)+.62<R);
  const s=new Simulation('archery');for(let i=0;i<150;i++)s.step({});
  assert.ok(s.fighters.every(f=>f.grounded&&f.damage===0));assert.equal(s.winner,null);
});
test('open circular edges allow diagonal ring-outs',()=>{
  const s=new Simulation('archery');Object.assign(s.fighters[0],{x:6.5,z:6.5});
  for(let i=0;i<180&&!s.winner;i++)s.step({});assert.equal(s.winner,'blue');
});
test('seeded random arrows give full fixed-position warnings, varied gaps, and stay on board',()=>{
  const sample=seed=>{const a=createArena('archery',seed),seen=[];for(let i=0;i<3000;i++){
    a.step(.02,[],[]);for(const arrow of a.arrows)if(!seen.some(s=>s.id===arrow.id))seen.push({...arrow});
  }return seen;};
  const a=sample(12);assert.deepEqual(a,sample(12));assert.notDeepEqual(a,sample(13));assert.ok(a.length>9);
  assert.ok(a.slice(1).every((v,i)=>v.bornAt-a[i].bornAt>=4));
  for(const arrow of a){assert.ok(Math.abs(arrow.impactAt-arrow.bornAt-ARROW_WARNING)<1e-8);assert.ok(Math.hypot(arrow.x,arrow.z)+ARROW_RADIUS<R);}
  assert.ok(new Set(a.slice(1).map((v,i)=>(v.bornAt-a[i].bornAt).toFixed(1))).size>4);
});
test('impact hits once, launches away, and lets fighters escape or jump the mark',()=>{
  const a=createArena('archery'),arrow=warning(a),events=[];
  const make=(team,x,y=0)=>Object.assign(fighter(team,x,0),{z:arrow.z,y});
  const hit=make('red',arrow.x+.3),escape=make('blue',arrow.x+ARROW_RADIUS+.01),jump=make('jump',arrow.x,2);
  a.step(ARROW_WARNING-.01,[hit,escape,jump],events);assert.equal(events.length,0);assert.equal(a.warning,true);
  assert.equal(arrow.x,hit.x-.3);
  a.step(.02,[hit,escape,jump],events);
  assert.equal(hit.damage,45);assert.ok(hit.vx>0&&hit.vy>0&&hit.stun>0&&!hit.grounded);
  assert.equal(escape.damage,0);assert.equal(jump.damage,0);assert.equal(events[0].hazard,'arrow');
  a.step(.1,[hit],events);assert.equal(events.length,1);
  a.step(2,[],events);assert.ok(a.arrows.includes(arrow),'wreckage remains readable after impact');
  a.step(ARROW_LINGER,[],events);assert.ok(!a.arrows.includes(arrow));
});
test('center impacts are finite and symmetric; normal feedback and reset clear all hazard state',()=>{
  const s=new Simulation('archery'),a=s.arena,arrow=warning(a);
  for(const f of s.fighters)Object.assign(f,{x:arrow.x,z:arrow.z});
  a.time=arrow.impactAt-.001;
  assert.deepEqual(s.step({}).sort(),['blue','red']);
  for(const f of s.fighters)assert.ok(Number.isFinite(f.vx)&&f.damage===45);
  assert.equal(s.motionEvents.filter(e=>e.hazard==='arrow').length,2);
  s.reset();assert.equal(s.arena.time,0);assert.deepEqual(s.arena.arrows,[]);assert.equal(s.arena.warning,false);
  assert.ok(s.fighters.every(f=>f.damage===0));
  const next=warning(s.arena);assert.notDeepEqual([next.x,next.z],[arrow.x,arrow.z]);
  s.setMap('classic');assert.equal(s.arena.arrows,undefined);
});
test('rendered target matches collision radius; warnings precede falling arrows and views reset',()=>{
  const scene=new T.Scene(),draw=createArcheryView(scene),a=createArena('archery');draw(a);
  const root=scene.children[0],board=root.getObjectByName('Target board'),base=board.children.find(o=>o.geometry?.type==='CylinderGeometry');
  assert.equal(base.geometry.parameters.radiusTop,R);assert.equal(base.position.y+.325,0);
  const arrow=warning(a);draw(a);const hazards=root.children[0],group=hazards.children[0],falling=group.children[0];
  assert.equal(falling.visible,false);assert.equal(group.children[1].geometry.parameters.radius,ARROW_RADIUS);
  a.time=arrow.impactAt-ARROW_FALL/2;draw(a);assert.equal(falling.visible,true);const y=falling.position.y;
  assert.ok(Math.hypot(falling.position.x,falling.position.z)>1,'diagonal approach');
  assert.ok(falling.quaternion.x!==0||falling.quaternion.z!==0,'shaft follows trajectory');
  assert.equal(falling.getObjectByName('Arrow contrail').children.length,9);
  a.step(ARROW_FALL/2+.001,[],[]);draw(a);assert.ok(falling.position.y<y);assert.equal(group.children[1].visible,false);
  assert.equal(falling.visible,false,'whole arrow breaks on impact');
  const debris=group.getObjectByName('Arrow splinters');assert.equal(debris.visible,true);
  assert.equal(debris.children.length,16);
  a.step(.15,[],[]);draw(a);assert.ok(debris.children.some(s=>Math.hypot(s.position.x,s.position.z)>.1));
  assert.ok(a.shake>0,'impact camera shake');
  assert.ok(board.position.length()>0,'target platform visibly shakes');
  a.step(2,[],[]);draw(a);
  assert.ok(debris.children.every(s=>s.position.y>=.12&&s.scale.x===1),'broken pieces settle and stay visible');
  assert.equal(board.position.length(),0,'platform recoil settles');
  draw(createArena('archery'));assert.equal(hazards.children.length,0);
  draw(createArena('classic'));assert.equal(root.visible,false);
});
