import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Simulation} from '../host/src/simulation.js';
import {Sensors} from '../controller/src/sensors.js';
import {legInputToWorld,worldToLegInput} from '../shared/movement.js';

const hostSource=readFileSync(new URL('../host/src/main.js',import.meta.url),'utf8');
const phoneSource=readFileSync(new URL('../controller/src/main.js',import.meta.url),'utf8');

test('phone and keyboard left/right agree for both teams at every facing angle',()=>{
  const previousDocument=globalThis.document;globalThis.document={hidden:false};
  try {
    const sensors=new Sensors(()=>{});sensors.neutral={beta:30,gamma:0};sensors.lastMotion=performance.now();
    const phone={sensors,preview:null,ready:true,$:()=>({checked:false})};
    vm.runInNewContext(phoneSource.slice(phoneSource.indexOf('function inputSample(){'),phoneSource.indexOf('function send(){')),phone);
    for(const team of ['red','blue'])for(const sign of [-1,1]) {
      sensors.x=0;
      for(let i=0;i<80;i++)sensors.orientation({beta:30,gamma:sign*20});
      const sample=phone.inputSample();assert.equal(sample.valid,true);
      const keys=new Set([team==='red'?(sign<0?'KeyA':'KeyD'):(sign<0?'ArrowLeft':'ArrowRight')]);
      const keyboard={keys,edges:new Set()};
      vm.runInNewContext(hostSource.slice(hostSource.indexOf('function keyboard(team)'), hostSource.indexOf("for (const role of ['legs', 'arm'])")),keyboard);
      const input=keyboard.keyboard(team).legs;
      assert.ok(Math.abs(input.moveX-sample.x)<1e-6);
      for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
        const sim=new Simulation(),index=team==='red'?0:1,f=sim.fighters[index],start=f.x;
        f.heading=heading;
        for(let i=0;i<20;i++)sim.step({[team]:{legs:{moveX:sample.x,moveZ:sample.z}}});
        assert.ok((f.x-start)*sign>0,'left/right must not rotate with facing');
        assert.ok(Math.abs(f.z)<1e-9);
      }
    }
  } finally {globalThis.document=previousDocument;}
});

test('opposing keys cancel, release damps motion, and device switches share one axis',()=>{
  const keys=new Set(['KeyA','KeyD','ArrowLeft','ArrowRight']),keyboard={keys,edges:new Set()};
  vm.runInNewContext(hostSource.slice(hostSource.indexOf('function keyboard(team)'), hostSource.indexOf("for (const role of ['legs', 'arm'])")),keyboard);
  for(const team of ['red','blue'])assert.equal(keyboard.keyboard(team).legs.moveX,0);
  keys.delete('KeyA');const right=keyboard.keyboard('red').legs;
  const sim=new Simulation(),f=sim.fighters[0];sim.step({red:{legs:right}});assert.ok(f.vx>0);
  const speed=f.vx;keys.clear();sim.step({red:{legs:keyboard.keyboard('red').legs}});
  assert.ok(f.vx>0&&f.vx<speed);
  for(let i=0;i<20;i++)sim.step({red:{legs:{moveX:-1,moveZ:0}}});
  assert.ok(f.vx<0,'phone left reverses keyboard right without another inversion');
  for(let i=0;i<120;i++)sim.step({});assert.ok(Math.abs(f.vx)<.001);
});

test('diagonal strength and world-to-input conversion stay consistent',()=>{
  assert.ok(Math.abs(Math.hypot(...Object.values(legInputToWorld(1,1)))-1)<1e-12);
  for(const [x,z]of [[.2,-.3],[-.8,.1],[0,0]]) {
    const input=worldToLegInput(x,z);assert.deepEqual(legInputToWorld(input.moveX,input.moveZ),{x,z});
  }
});
