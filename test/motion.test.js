import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createCharacter } from '../host/src/characters.js';
import { createMotion, resetMotion, stepMotion, interpolateMotion, stepSpring, punchAngle, MOTION_CONFIG } from '../host/src/motion.js';
import { Simulation, fighter } from '../host/src/simulation.js';
import { CONFIG as C } from '../shared/config.js';

test('spring retains overshoot and decays in all damping regimes',()=>{
  for (const damping of [.55,1,1.5]) {
    const spring={angle:0,velocity:5}, tuning={frequency:2.5,damping,limit:1};
    let minimum=0, maximum=0;
    for(let tick=0;tick<360;tick++) {
      stepSpring(spring,0,C.tick,tuning);
      minimum=Math.min(minimum,spring.angle); maximum=Math.max(maximum,spring.angle);
    }
    assert.ok(maximum>.03);
    if(damping<1) assert.ok(minimum<0,'underdamped spring should overshoot');
    assert.ok(Math.abs(spring.angle)<1e-8); assert.ok(Math.abs(spring.velocity)<1e-7);
  }
});

test('exact spring update is independent of constant-target timestep subdivision',()=>{
  for(const damping of [.55,1,1.5]) {
    const a={angle:.1,velocity:1}, b={...a}, tuning={frequency:3,damping,limit:10};
    stepSpring(a,.2,.2,tuning);
    for(let i=0;i<12;i++) stepSpring(b,.2,1/60,tuning);
    assert.ok(Math.abs(a.angle-b.angle)<1e-12); assert.ok(Math.abs(a.velocity-b.velocity)<1e-12);
  }
});

test('repeated impulses stay bounded and invalid timesteps are no-ops',()=>{
  const spring={angle:0,velocity:0}, tuning=MOTION_CONFIG.head;
  for(let i=0;i<600;i++) {
    spring.velocity += (i%30<15?1:-1)*50;
    stepSpring(spring,0,C.tick,tuning);
    assert.ok(Math.abs(spring.angle)<=tuning.limit);
    assert.ok(Number.isFinite(spring.velocity));
    if(Math.abs(spring.angle)===tuning.limit) assert.ok(spring.angle*spring.velocity<=0);
  }
  const before={...spring};
  for(const dt of [0,-1,NaN,Infinity]) { stepSpring(spring,0,dt,tuning); assert.deepEqual(spring,before); }
});

test('neutral joint hierarchy preserves original silhouette and head attachments',()=>{
  const mesh=(geometry,color,parent)=>{const value=new T.Mesh(geometry,new T.MeshBasicMaterial({color}));parent.add(value);return value;};
  const model=createCharacter('#ff665b',mesh); model.group.updateMatrixWorld(true);
  const world=object=>object.getWorldPosition(new T.Vector3());
  assert.ok(Math.abs(world(model.torso.children[0]).y-1.15)<1e-12);
  assert.ok(Math.abs(world(model.head.children[0]).y-2)<1e-12);
  assert.ok(Math.abs(world(model.head.children[1]).y-2.06)<1e-12);
  assert.ok(Math.abs(world(model.arms[0]).y-1.52)<1e-12);
  assert.ok(Math.abs(world(model.legs[0].children[0]).y-.39)<1e-12);
  model.head.rotation.y=.3; model.group.updateMatrixWorld(true);
  assert.notEqual(world(model.head.children[1]).x,-.16);
});

test('movement inertia is directional, head lags, and stopped gait settles',()=>{
  const f=fighter('red',0,0), motion=createMotion(f);
  f.vz=2; stepMotion(motion,f,[],C.tick);
  assert.ok(motion.current.pose.torsoPitch<0);
  assert.ok(Math.abs(motion.current.pose.headPitch)<Math.abs(motion.current.pose.torsoPitch));
  const forward=motion.current.pose.torsoPitch;
  resetMotion(motion,fighter('red',0,0)); f.vz=-2; stepMotion(motion,f,[],C.tick);
  assert.ok(motion.current.pose.torsoPitch>0); assert.ok(Math.abs(forward+motion.current.pose.torsoPitch)<1e-12);
  f.vz=0;
  for(let i=0;i<240;i++) stepMotion(motion,f,[],C.tick);
  assert.ok(Math.abs(motion.current.pose.leg0Pitch)<1e-7);
  assert.ok(Math.abs(motion.current.pose.arm0Pitch)<1e-7);
});

test('heading interpolation and turn lag cross the angle wrap by the short path',()=>{
  const f=fighter('red',0,Math.PI-.01), motion=createMotion(f);
  f.heading=-Math.PI+.01; stepMotion(motion,f,[],C.tick);
  const output=interpolateMotion(motion,.5);
  assert.ok(Math.abs(output.heading-Math.PI)<1e-10);
  assert.ok(motion.current.pose.headYaw<0);
  assert.ok(Math.abs(motion.current.pose.headYaw)<.01);
});

test('gait follows grounded distance and pauses while stationary or airborne',()=>{
  const f=fighter('red',0,0), motion=createMotion(f);
  stepMotion(motion,f,[],C.tick); assert.equal(motion.gaitPhase,0);
  f.vz=3; f.z=.05; stepMotion(motion,f,[],C.tick);
  const phase=motion.gaitPhase; assert.ok(phase>0);
  stepMotion(motion,f,[],C.tick); assert.equal(motion.gaitPhase,phase);
  f.grounded=false;f.z=.1; stepMotion(motion,f,[],C.tick); assert.equal(motion.gaitPhase,phase);
});

test('baseline disables secondary motion while keeping the two-arm uppercut visible',()=>{
  const f=fighter('red',0,0), motion=createMotion(f);
  Object.assign(f,{vx:3,attack:.15,punchArm:0});
  stepMotion(motion,f,[{type:'hit',team:'red',x:1,z:0,strength:14}],C.tick,'floppy',false);
  assert.equal(motion.current.pose.torsoRoll,0); assert.equal(motion.current.pose.headYaw,0);
  assert.equal(motion.current.pose.arm0Action,punchAngle(f.attack)); assert.equal(motion.current.pose.arm1Action,punchAngle(f.attack));
  for(const spring of Object.values(motion.springs)) assert.equal(spring.velocity,0);
});

test('punch extension covers the existing hit window and recovers smoothly',()=>{
  assert.equal(punchAngle(.28),0);
  assert.ok(punchAngle(.24)>0,'windup');
  assert.ok(punchAngle(.18)>punchAngle(.15)); assert.ok(punchAngle(.15)>punchAngle(.1));
  assert.ok(Math.abs(punchAngle(.09)+2.4)<1e-10);
  assert.ok(punchAngle(.04)>-2.3); assert.equal(punchAngle(0),0);
});

test('landing strength affects compression, and cosmetic motion never mutates gameplay',()=>{
  const f=fighter('red',0,0), gentle=createMotion(f), heavy=createMotion(f), before=structuredClone(f);
  stepMotion(gentle,f,[{type:'landing',team:'red',speed:2}],C.tick);
  stepMotion(heavy,f,[{type:'landing',team:'red',speed:10}],C.tick);
  assert.ok(heavy.current.pose.bodyOffset<gentle.current.pose.bodyOffset);
  assert.deepEqual(f,before);
  for(let i=0;i<1000;i++) {
    stepMotion(heavy,f,[{type:'hit',team:'red',x:1,z:0,strength:14}],C.tick,'lively');
    assert.ok(Math.abs(heavy.current.pose.torsoRoll)<=MOTION_CONFIG.torso.limit);
    assert.ok(Math.abs(heavy.current.pose.headRoll)<=MOTION_CONFIG.head.limit);
  }
});

test('full reset clears springs, events, gait, and both interpolation snapshots',()=>{
  const s=new Simulation(), motion=createMotion(s.fighters[0]);
  s.step({red:{legs:{jump:true},arm:{punch:true}}}); stepMotion(motion,s.fighters[0],s.motionEvents,C.tick);
  s.reset(); resetMotion(motion,s.fighters[0]);
  assert.deepEqual(motion,createMotion(s.fighters[0])); assert.deepEqual(s.motionEvents,[]);
  for(const dt of [0,-1,NaN,Infinity]) {const before=structuredClone(motion);stepMotion(motion,s.fighters[0],[],dt);assert.deepEqual(motion,before);}
});

test('simulation emits discrete events only on their tick and retains phone hit feedback',()=>{
  const s=new Simulation();
  s.step({red:{legs:{jump:true},arm:{punch:true}}});
  assert.deepEqual(s.motionEvents.map(e=>e.type),['takeoff','punch']);
  s.step({}); assert.equal(s.motionEvents.length,0);
  let landings=0;
  for(let i=0;i<80;i++){s.step({});landings+=s.motionEvents.filter(e=>e.type==='landing').length;}
  assert.equal(landings,1);
  s.reset();s.fighters[0].x=-.65;s.fighters[1].x=.65;
  let hits=0, events=0;
  for(let i=0;i<40;i++) {hits+=s.step(i===0?{red:{arm:{punch:true,power:1}}}:{}).length;events+=s.motionEvents.filter(e=>e.type==='hit').length;}
  assert.equal(hits,1);assert.equal(events,1);
});

test('identical fixed-step replay yields identical motion at 30, 60, 120, and 144 Hz',()=>{
  function replay(hz) {
    const sim=new Simulation(), motions=sim.fighters.map(createMotion);
    let accumulator=0,tick=0,eventCount=0;
    while(tick<180) {
      accumulator+=1/hz;
      while(accumulator+1e-10>=C.tick&&tick<180) {
        sim.step({red:{legs:{moveZ:Math.sin(tick*.04)*.4,jump:tick===20},arm:{turn:.2,punch:tick===50}}});
        eventCount+=sim.motionEvents.length;
        motions.forEach((motion,i)=>stepMotion(motion,sim.fighters[i],sim.motionEvents,C.tick));
        tick++;accumulator-=C.tick;
      }
      motions.forEach(motion=>interpolateMotion(motion,accumulator/C.tick));
    }
    return {pose:motions.map(m=>m.current),eventCount};
  }
  const baseline=replay(60);
  for(const hz of [30,120,144]) assert.deepEqual(replay(hz),baseline);
});
