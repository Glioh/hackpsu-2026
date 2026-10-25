import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createArena} from '../host/src/maps.js';
import {Simulation,fighter} from '../host/src/simulation.js';
import {createBotController} from '../host/src/bot.js';
import {createLavaView} from '../host/src/lava-view.js';
import {insideLava,LAVA_OUTLINE,LAVA_HAZARDS,LAVA_CHUNKS,LAVA_COLLAPSE} from '../shared/lava-layout.js';

function firstHazard(arena) {
  for(let i=0;i<200&&!arena.volcanicHazards.length;i++)arena.step(.02,[],[]);
  return arena.volcanicHazards[0];
}

test('magma island has jagged support and safe spawns before the crust breaks',()=>{
  const a=createArena('lava'),floor=a.floorAt(0,0);
  for(const [x,z] of a.spawn)assert.ok(insideLava(x,z,1));
  for(const [x,z] of LAVA_OUTLINE)assert.ok(a.floorAt(x,z));
  for(let x=-9;x<=9;x+=.25)for(let z=-6.5;z<=6.5;z+=.25)assert.equal(!!a.floorAt(x,z),insideLava(x,z));
  assert.equal(a.floorAt(8.5,5.5),null);assert.equal(a.floorAt(0,0,-.01),null);
  assert.equal(a.floorAt(0,0,0),floor);assert.equal(insideLava(0,0,20),false);
  const s=new Simulation('lava');Object.assign(s.fighters[0],{x:8.5,z:5.5});
  for(let i=0;i<180&&!s.winner;i++)s.step({});
  assert.equal(s.winner,'blue','diagonal edge is a ring-out, not a hidden square');
});

test('crust warns, loses support and sinks permanently, preserving the core until reset',()=>{
  const a=createArena('lava'),p=a.pieces[1],other=a.pieces[2];
  assert.equal(a.floorAt(p.x,p.z),p);
  a.step(LAVA_COLLAPSE.start-LAVA_COLLAPSE.warning+.01,[],[]);
  assert.equal(p.state,'warn');assert.equal(p.solid,true);assert.equal(p.y,0);assert.ok(a.warning);
  a.step(LAVA_COLLAPSE.warning,[],[]);
  assert.equal(p.state,'falling');assert.equal(p.solid,false);assert.ok(p.y<0);
  assert.equal(a.floorAt(p.x,p.z),null);assert.ok(other.solid);
  a.step(.9,[],[]);assert.ok(p.y<-4,'chunk drops below the lava surface');
  a.step(120,[],[]);
  assert.ok(a.pieces.slice(1).every(p=>p.state==='gone'&&!p.solid));
  assert.equal(a.floorAt(0,0),a.pieces[0]);
  const s=new Simulation('lava');
  s.arena.time=LAVA_COLLAPSE.start-.01;s.arena.volcanicHazards=[];
  Object.assign(s.fighters[0],{x:p.x,z:p.z});
  for(let i=0;i<180&&!s.winner;i++)s.step({});
  assert.equal(s.winner,'blue','fighter falls through the opening');
  s.reset();assert.ok(s.arena.pieces.every(p=>p.solid&&p.y===0&&p.state==='solid'));
  assert.ok(s.arena.floorAt(p.x,p.z));
});

test('volcanic hazards are seeded, warned, separated and bounded',()=>{
  const sample=seed=>{
    const a=createArena('lava',seed),seen=new Map();
    for(let i=0;i<9000;i++) {
      a.step(.02,[],[]);assert.ok(a.volcanicHazards.length<=3);
      for(const h of a.volcanicHazards) {
        if(!seen.has(h.id))seen.set(h.id,{...h});
        const settings=LAVA_HAZARDS[h.kind];
        assert.ok(insideLava(h.x,h.z,settings.radius+.29));
        assert.ok(Math.abs(h.impactAt-h.bornAt-settings.warning)<1e-8);
        for(const other of a.volcanicHazards)if(other!==h)assert.ok(Math.hypot(h.x-other.x,h.z-other.z)>=settings.radius+LAVA_HAZARDS[other.kind].radius+.49);
      }
    }
    return [...seen.values()];
  };
  const hazards=sample(7);assert.deepEqual(hazards,sample(7));assert.notDeepEqual(hazards,sample(8));
  assert.deepEqual(new Set(hazards.map(h=>h.kind)),new Set(['vent','bomb']));
  assert.ok(hazards[0].bornAt>=3);assert.ok(hazards.length>50);
});

for(const kind of ['vent','bomb'])test(`${kind} impacts once; escape, jumps and already fallen fighters avoid damage`,()=>{
  const a=createArena('lava'),h=firstHazard(a),settings=LAVA_HAZARDS[kind];
  Object.assign(h,{kind,impactAt:a.time+settings.warning});
  const make=(team,x,y=0)=>Object.assign(fighter(team,x,0),{z:h.z,y});
  const hit=make('red',h.x),escape=make('blue',h.x+settings.radius+.01),jump=make('jump',h.x,2),fallen=make('fallen',h.x,-1),events=[];
  a.step(settings.warning-.01,[hit,escape,jump,fallen],events);assert.equal(events.length,0);
  a.step(.02,[hit,escape,jump,fallen],events);
  assert.equal(hit.damage,settings.damage);assert.ok(hit.vy>5&&hit.stun>0&&!hit.grounded);
  assert.ok(Number.isFinite(hit.vx)&&Number.isFinite(hit.vz));
  for(const f of [escape,jump,fallen])assert.equal(f.damage,0);
  assert.equal(events[0].source,'hazard');assert.equal(events[0].hazard,'lava');
  assert.equal(events[0].before.grounded,true);assert.equal(events[0].after.grounded,false);
  a.step(.1,[hit],events);assert.equal(events.length,1);
  a.step(settings.linger,[],events);assert.ok(!a.volcanicHazards.includes(h));
});

test('simulation feedback and round resets keep lava state isolated',()=>{
  const s=new Simulation('lava'),h=firstHazard(s.arena),f=s.fighters[0];
  Object.assign(f,{x:h.x,z:h.z});s.arena.time=h.impactAt-.001;
  assert.deepEqual(s.step({}),['red']);assert.ok(s.motionEvents.some(e=>e.hazard==='lava'));
  s.reset();assert.deepEqual(s.arena.volcanicHazards,[]);assert.equal(s.arena.warning,false);
  assert.ok(s.fighters.every(f=>f.damage===0));
  s.setMap('classic');assert.equal(s.arena.volcanicHazards,undefined);
});

test('volcano view shares outline, omits background meteors, and reuses bounded objects across map switches',()=>{
  const scene=new T.Scene(),draw=createLavaView(scene),a=createArena('lava'),root=scene.getObjectByName('Volcano Crucible');
  assert.equal(root.visible,false);draw(a,0);assert.equal(root.visible,true);
  const chunks=root.getObjectsByProperty('name','Magma chunk');
  assert.equal(chunks.length,LAVA_CHUNKS.length);
  chunks.forEach((chunk,i)=>{
    const outline=chunk.getObjectByName('Magma island').geometry.parameters.shapes.getPoints(),p=a.pieces[i];
    for(const [x,z] of LAVA_CHUNKS[i])assert.ok(outline.some(v=>Math.abs(v.x+p.x-x)<1e-8&&Math.abs(-v.y+p.z-z)<1e-8));
  });
  assert.equal(root.getObjectByName('Falling volcanic debris'),undefined);
  const embers=root.getObjectByName('Rising embers'),before=embers.instanceMatrix.array.slice();
  draw(a,1);assert.notDeepEqual(embers.instanceMatrix.array,before);
  let count=0;root.traverse(()=>count++);
  const h=firstHazard(a);draw(a,2);
  assert.equal(root.children.filter(o=>o.name==='Volcanic hazard'&&o.visible).length,1);
  h.kind='bomb';a.time=h.impactAt-.4;draw(a,3);
  assert.ok(root.getObjectsByProperty('name','Volcanic bomb').some(o=>o.visible));
  a.step(.41,[],[]);draw(a,4);
  a.time=LAVA_COLLAPSE.start+.6;a.step(0,[],[]);draw(a,5);
  assert.ok(chunks[1].position.y<0);assert.notEqual(chunks[1].rotation.x,0);
  a.step(120,[],[]);draw(a,6);
  assert.ok(chunks.slice(1).every(c=>!c.visible));assert.ok(chunks[0].visible);
  for(let i=0;i<30;i++){draw(createArena('classic'),5);assert.equal(root.visible,false);draw(createArena('lava'),6);}
  let after=0;root.traverse(()=>after++);assert.equal(after,count);
  assert.equal(root.children.filter(o=>o.name==='Volcanic hazard'&&o.visible).length,0);
  assert.ok(chunks.every(c=>c.visible&&c.position.y===0&&c.rotation.x===0&&c.rotation.z===0));
});

test('existing bot pursues across the magma island without falling through its support',()=>{
  const s=new Simulation('lava'),bot=createBotController();
  Object.assign(s.fighters[0],{x:-2,z:3});
  const start=Math.hypot(s.fighters[1].x+2,s.fighters[1].z-3);
  for(let i=0;i<150;i++) {
    s.step({blue:bot(s,1)});
    assert.ok(s.arena.floorAt(s.fighters[1].x,s.fighters[1].z));
  }
  assert.equal(s.winner,null);
  assert.ok(Math.hypot(s.fighters[1].x+2,s.fighters[1].z-3)<start-2);
});
