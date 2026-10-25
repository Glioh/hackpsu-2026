import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createArena,MAPS} from '../host/src/maps.js';
import {Simulation} from '../host/src/simulation.js';
import {createTrainSchedule} from '../shared/station-trains.js';
import {createTerrainNavigator} from '../host/src/bot-navigation.js';
import {createBotController} from '../host/src/bot.js';

const run=(s,n,input={})=>{for(let i=0;i<n;i++)s.step(input);};
test('Crossline navigation keeps ground and bridge surfaces separate at the same position',()=>{
  const a=createArena('station'),nav=createTerrainNavigator(a,.62);
  assert.ok(a.navigationFloors(2.8,1).includes(.58));
  assert.ok(a.navigationFloors(2.8,1).includes(4.86));
  for(const y of [.58,4.86]) {
    const target={x:4,z:1,y},path=nav.route({x:1.5,z:1,y},target);
    assert.deepEqual(path.at(-1),target);
    assert.ok(path.every(p=>Math.abs(p.y-y)<.01));
  }
  assert.equal(nav.canTravel({x:2.5,z:1,y:.58},{x:3,z:1,y:4.86}),false);
});

test('Crossline default bot pursues across the ground corridor beneath the bridge',()=>{
  const s=new Simulation('station'),bot=createBotController();let crossed=false;
  for(let i=0;i<600;i++) {
    const input=bot(s);input.arm.punch=false;s.step({blue:input});
    crossed ||= s.fighters[1].x<0;
  }
  assert.equal(s.winner,null);assert.ok(crossed);
  assert.equal(s.fighters[1].y,.58);
  assert.ok(Math.hypot(s.fighters[0].x-s.fighters[1].x,s.fighters[0].z-s.fighters[1].z)<1.7);
});
test('Crossline is selectable, spawns safely, and uses the enlarged solid layout',()=>{
  assert.ok(MAPS.some(m=>m.id==='station'));
  const s=new Simulation('station');run(s,180);
  assert.equal(s.winner,null);assert.ok(s.fighters.every(f=>f.grounded&&f.y===.58));
  assert.equal(s.arena.floorAt(20,0).y,.58);assert.equal(s.arena.floorAt(22,0),null);
  assert.equal(s.arena.floorAt(0,-11.2).y,-.37);
  assert.equal(s.arena.floorAt(2.8,1,.6).y,.58,'ground-level support beneath bridge');
});
test('Crossline terrace stairs and bridge stairs are traversable at their actual elevations',()=>{
  for(const [x,z,y,n,legs,height] of [
    [-12.6,6.6,.58,110,{moveZ:1},1.89],
    [-9.5,-4.9,1.89,145,{moveX:1},4.86],
    [6.5,2.52,.58,70,{moveX:1},1.4],
  ]){
    const s=new Simulation('station');Object.assign(s.fighters[0],{x,z,y,heading:0});
    run(s,n,{red:{legs}});assert.equal(s.fighters[0].y,height);assert.ok(s.fighters[0].grounded);
  }
  const s=new Simulation('station');Object.assign(s.fighters[0],{x:2.8,z:1,y:.58});run(s,40);
  assert.equal(s.fighters[0].y,.58,'walking underneath does not snap onto bridge');
});

test('Crossline track beds support players at both platform seams',()=>{
  for(const side of [-1,1])for(const z of [7.71,8,8.18,11.2,14.25]){
    const s=new Simulation('station');
    Object.assign(s.fighters[0],{x:0,z:side*z,y:.58,grounded:false});
    run(s,90);
    assert.equal(s.winner,null,`no fall-through at z=${side*z}`);
    assert.equal(s.fighters[0].y,-.37);
    assert.ok(s.fighters[0].grounded);
  }
});

test('Crossline players can walk off either platform edge and land on the tracks',()=>{
  for(const side of [-1,1]){
    const s=new Simulation('station');
    Object.assign(s.fighters[0],{x:0,z:side*7.4,y:.58,heading:0});
    run(s,35,{red:{legs:{moveZ:-side}}});
    run(s,60);
    assert.equal(s.winner,null);
    assert.ok(Math.abs(s.fighters[0].z)>7.7);
    assert.equal(s.fighters[0].y,-.37);
    assert.ok(s.fighters[0].grounded);
    assert.equal(s.arena.floorAt(27.01,side*11.2),null,'track ends remain open');
  }
});
test('Crossline trains have independent random gaps, three-second warnings, and reproducible seeds',()=>{
  const a=createArena('station',91),b=createArena('station',91),c=createArena('station',92);
  assert.deepEqual(a.trains,b.trains);assert.notDeepEqual(a.trains,c.trains);
  let seed=41;const sample=createTrainSchedule(()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296));
  const starts=[[],[]],ends=[[],[]],previous=[false,false];
  for(let time=0;time<240;time+=.05)sample(time).forEach((state,i)=>{
    if(state.passing&&!previous[i])starts[i].push(time);
    if(!state.passing&&previous[i])ends[i].push(time);
    if(state.warning)assert.ok(state.next<=3&&!state.passing);
    previous[i]=state.passing;
  });
  for(let i=0;i<2;i++){
    const gaps=starts[i].slice(1).map((t,j)=>t-ends[i][j]);
    assert.ok(gaps.length>5&&gaps.every(g=>g>=4.95&&g<=18.05));
    assert.ok(new Set(gaps.map(g=>g.toFixed(1))).size>2);
  }
  assert.notEqual(starts[0][0],starts[1][0]);
});
test('Crossline train hits sweep the track, launch with travel direction, and hit once per pass',()=>{
  for(const line of [0,1]){
    const a=createArena('station',1),events=[];
    const f={team:'red',x:0,z:line?11.2:-11.2,y:-.37,damage:0};
    for(let i=0;i<1200&&!events.length;i++)a.step(1/60,[f],events);
    assert.equal(events[0]?.hazard,'train');assert.equal(f.damage,25);
    assert.equal(Math.sign(f.vx),line?-1:1);assert.ok(f.vy>0&&!f.grounded);
    for(let i=0;i<120;i++)a.step(1/60,[f],events);
    assert.equal(f.damage,25,'no repeated damage while the same train overlaps');
  }
});
test('Crossline platform and overhead bridge are safe from track impacts; open ends allow ring-outs',()=>{
  const a=createArena('station'),events=[];
  const fighters=[{team:'red',x:0,z:5,y:.58,damage:0},{team:'blue',x:2.8,z:11.2,y:4.86,damage:0}];
  for(let i=0;i<3600;i++)a.step(1/60,fighters,events);
  assert.equal(events.length,0);
  const s=new Simulation('station');Object.assign(s.fighters[0],{x:20,z:0,y:.58,heading:0});
  run(s,180,{red:{legs:{moveX:1}}});assert.equal(s.winner,'blue');
});
test('Crossline train impacts reach the normal hit-feedback channel and reset with a fresh round',()=>{
  const s=new Simulation('station');const before=s.arena.trains.map(t=>t.next);
  Object.assign(s.fighters[0],{x:0,z:-11.2,y:-.37});
  let hit=false;
  for(let i=0;i<1200&&!hit;i++)hit=s.step({}).includes('red');
  assert.ok(hit);assert.equal(s.fighters[0].damage,25);
  s.reset();assert.equal(s.arena.time,0);assert.equal(s.fighters[0].damage,0);
  assert.notDeepEqual(s.arena.trains.map(t=>t.next),before);
});
test('Crossline playable asset has train/signal identifiers and no scale mannequins',async()=>{
  const bytes=await readFile(new URL('../host/assets/maps/station.glb',import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.equal(gltf.nodes.filter(n=>Number.isInteger(n.extras?.stationTrain)).length,2);
  assert.equal(gltf.nodes.filter(n=>Number.isInteger(n.extras?.stationSignal)).length,2);
  assert.ok(!gltf.nodes.some(n=>/Fighter/.test(n.name)));
});
test('Crossline bot crosses beneath the bridge and climbs to an opponent upstairs',()=>{
  const s=new Simulation('station'),bot=createBotController();
  Object.assign(s.fighters[0],{x:2.8,z:-4.9,y:4.86});
  for(let i=0;i<2400;i++){const input=bot(s);input.arm.punch=false;s.step({blue:input});}
  assert.equal(s.winner,null);
  assert.ok(Math.hypot(s.fighters[0].x-s.fighters[1].x,s.fighters[0].z-s.fighters[1].z)<1.65);
  assert.equal(s.fighters[1].y,4.86);
});
