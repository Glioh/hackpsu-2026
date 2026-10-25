import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { Simulation } from '../host/src/simulation.js';
import { MAPS } from '../shared/maps.js';
import { CHARACTERS, makeMatch, matchRules, rollFrame } from '../shared/party.js';
import { CONFIG as C } from '../shared/config.js';
import * as motion from '../host/src/motion.js';

function hostHarness() {
  const elements=new Map();
  function element(){
    const classes=new Set();let id='';
    return {value:'',checked:true,dataset:{},children:[],textContent:'',style:{setProperty(){}},
      get id(){return id;},set id(value){id=value;elements.set(value,this);},
      classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c),contains:c=>classes.has(c)},
      setAttribute(k,v){this[k]=v;},focus(){},append(...items){this.children.push(...items);},
      replaceChildren(...items){this.children=items;if(items[0]?.value)this.value=items[0].value;},querySelector(){return null;},querySelectorAll(){return [];}};
  }
  const html=readFileSync(new URL('../host/index.html',import.meta.url),'utf8');
  for(const m of html.matchAll(/id="([^"]+)"/g))elements.set(m[1],element());
  const $=id=>elements.get(id)||null;
  const handlers={},emitted=[],frames=[],beams=[];let frame,clock=0,lastInputs,sim;
  class TrackedSimulation extends Simulation{constructor(){super();sim=this;}step(inputs,dt){lastInputs=inputs;return super.step(inputs,dt);}}
  const draw=(...args)=>frames.push(args[4]);draw.configure=draw.clearKO=draw.resetMotion=()=>{};draw.startKO=events=>beams.push(...events);
  const socket={connected:true,on:(name,fn)=>handlers[name]=fn,emit:(event,payload,ack)=>{emitted.push({event,payload});ack?.({});}};
  const context={...motion,Simulation:TrackedSimulation,MAPS,C,CHARACTERS,matchRules,rollFrame,
    document:{getElementById:$,querySelector:()=>null,createElement:element,addEventListener(){},hidden:false},
    createCommentary:()=>({unlock(){},phase(){},step(){},tick(){},fight(){}}),
    createCombatAudio:()=>({unlock(){},event(){},countdown(){}}),connectSocket:()=>socket,createRenderer:()=>draw,
    createPresentation:()=>({request(){},setPhase(){}}),createBotController:()=>()=>({}),choiceCard:element,updateChoices(){},
    FINISH_DURATION:2,FINISH_TIME_SCALE:.2,stepFinish(){},URL,location:{origin:'http://localhost:3000'},
    localStorage:{getItem(){return null;},setItem(){}},addEventListener(){},setInterval(){},performance:{now:()=>clock},requestAnimationFrame:fn=>frame=fn};
  const source=readFileSync(new URL('../host/src/main.js',import.meta.url),'utf8').replace(/^\uFEFF?import .*;\r?\n/gm,'');
  vm.runInNewContext(source,context);
  return {$,handlers,emitted,sim,frames,beams,get lastInputs(){return lastInputs;},advance(to){clock=to;frame(clock);}};
}
test('lobby needs even count; dev map preview bypasses phone voting and uses idle fighters',()=>{
  const h=hostHarness(),{$,handlers}=h;
  const slots=Array.from({length:5},(_,i)=>({id:String(i),name:'Player '+i,connected:true,ready:false}));
  handlers['room:roster']({slots});assert.equal($('start').disabled,true);assert.match($('lobbyHint').textContent,/Odd player/);
  slots.push({id:'5',name:'Sixth',connected:true,ready:false});handlers['room:roster']({slots});
  assert.equal($('start').disabled,false);assert.match($('lobbyHint').textContent,/Free-for-all/);
  $('devMap').value='ice';$('devMode').onclick();assert.equal(h.emitted.at(-1).payload.debug,true);
  handlers['game:state']({phase:'playing',debug:true});h.advance(40);
  assert.equal(JSON.stringify(h.lastInputs),'{}');assert.equal(h.sim.mapId,'ice');
  $('leaveGame').onclick();assert.equal(h.emitted.at(-1).payload.phase,'lobby');
});
test('dynamic shared-life HUD follows team pool, hides entirely in FFA',()=>{
  const h=hostHarness(),{$,handlers,sim}=h;
  const match={...makeMatch(Array.from({length:8},(_,i)=>String(i))),mapId:'classic'};
  handlers['game:state']({phase:'playing',debug:false,match});h.advance(3500);
  assert.match($('redLives').textContent,/RED  \u25cf\u25cf/);
  sim.fighters.find(f=>f.side==='red').y=-7;h.advance(3540);
  assert.match($('redLives').textContent,/RED  \u25cf\u25cb/);assert.equal(h.beams.length,1);assert.equal(h.frames.at(-1).finishAge,null);
  handlers['game:state']({phase:'lobby'});
  const ffa={...makeMatch(Array.from({length:6},(_,i)=>String(i))),mapId:'classic'};
  handlers['game:state']({phase:'playing',debug:false,match:ffa});h.advance(3600);
  assert.equal($('livesHud').classList.contains('hidden'),true);assert.equal(sim.fighters.length,3);
});
test('two-life party setup never reads the previous three-life developer fighters',()=>{
  const h=hostHarness(),match={...makeMatch(['0','1','2','3']),mapId:'classic'};
  h.handlers['game:state']({phase:'character-select',debug:false,match,selection:{votes:{},rolls:{},deadline:Date.now()+25000}});
  assert.doesNotThrow(()=>h.advance(40));
});
test('intro holds combat, begins after countdown, and cancels on pause or disconnect',()=>{
  const h=hostHarness(),{$,handlers}=h;
  handlers['game:state']({phase:'playing',debug:true});h.advance(500);
  assert.equal(h.lastInputs,undefined);assert.equal($('faceoffCountdown').textContent,'3');
  h.advance(1600);assert.equal($('faceoffCountdown').textContent,'2');h.advance(2600);assert.equal($('faceoffCountdown').textContent,'1');
  h.advance(3500);assert.ok(h.lastInputs);assert.equal($('faceoff').classList.contains('hidden'),true);
  handlers['game:state']({phase:'paused',debug:true});assert.equal($('faceoff').classList.contains('hidden'),true);
  handlers['game:state']({phase:'playing',debug:true,resumed:true});handlers.disconnect();assert.equal($('setup').classList.contains('hidden'),false);
});
