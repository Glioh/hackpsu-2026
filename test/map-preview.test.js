import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Simulation} from '../host/src/simulation.js';
import {MAPS} from '../host/src/maps.js';
import {CONFIG as C} from '../shared/config.js';
import * as motion from '../host/src/motion.js';
import {createCombatAudio} from '../host/src/combat-audio.js';

function hostHarness(timed=false){
  const html=readFileSync(new URL('../host/index.html',import.meta.url),'utf8'),elements=new Map();
  function element(){const classes=new Set();return {value:'',checked:true,dataset:{},children:[],textContent:'',
    get className(){return [...classes].join(' ');},set className(value){classes.clear();value.split(' ').forEach(c=>classes.add(c));},
    classList:{add:c=>classes.add(c),remove:(...names)=>names.forEach(c=>classes.delete(c)),toggle:(c,on)=>on?classes.add(c):classes.delete(c),contains:c=>classes.has(c)},
    setAttribute(k,v){this[k]=v;},focus(){},append(...items){this.children.push(...items);},
    replaceChildren(...items){this.children=items;},querySelector(){return {focus(){}};}};}
  for(const m of html.matchAll(/id="([^"]+)"/g))elements.set(m[1],element());
  const $=id=>{assert.ok(elements.has(id),'Missing DOM element '+id);return elements.get(id);};
  const handlers={},emitted=[],steps=[element(),element(),element()];let frame,clock=0,lastInputs,activeSim,winnerShown,winnerHidden=0;const randomChoices=['ice','conveyor','classic'];let randomCalls=0;const timers=new Map();let timerId=0;
  const socket={on:(event,fn)=>handlers[event]=fn,emit:(event,payload,ack)=>{
    emitted.push({event,payload});ack?.({});
  }};
  const beams=[],frames=[],announcements=[];
  class TrackedSimulation extends Simulation {
    constructor(...args){super(...args);activeSim=this;}
    step(inputs,dt){lastInputs=inputs;return super.step(inputs,dt);}
  }
  const draw=(...args)=>frames.push(args[4]);draw.startKO=events=>beams.push(...events);draw.setFighter=draw.clearKO=draw.resetMotion=()=>{};
  const context={...motion,createCombatAudio,Simulation:TrackedSimulation,MAPS,C,SLOTS:[],chooseRandomMap:()=>randomChoices[randomCalls++],
    createWinnerView:()=>({show(winner,picks){winnerShown={winner,picks};},hide(){winnerHidden++;}}),
    document:{getElementById:$,querySelectorAll:()=>steps,createElement:element,addEventListener(){},hidden:false},
    createCommentary:()=>({unlock(){},phase(){},tick(){},step(){},fight(){},countdown(index){announcements.push(index);}}),
    connectSocket:()=>socket,createRenderer:()=>draw,createPresentation:()=>({request(){},setPhase(){}}),
    FIGHTERS:{dummy:{name:'Dummy'}},TEAM_FIGHTERS:['dummy','dummy'],createBotController:()=>()=>({}),
    FINISH_DURATION:2,FINISH_TIME_SCALE:.2,stepFinish(){},URL,location:{origin:'http://localhost:3001'},
    localStorage:{getItem(){return null;},setItem(){}},addEventListener(){},setInterval(){},
    performance:{now:()=>clock},requestAnimationFrame:fn=>{frame=fn;}};
  const source=readFileSync(new URL('../host/src/main.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  if(timed)Object.assign(context,{setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,at:clock+delay});return id;},clearTimeout:id=>timers.delete(id)});
  vm.runInNewContext(source,context);
  return {$,handlers,emitted,context,html,beams,frames,announcements,get sim(){return activeSim;},get activeSim(){return activeSim;},get randomCalls(){return randomCalls;},get winnerShown(){return winnerShown;},get winnerHidden(){return winnerHidden;},get lastInputs(){return lastInputs;},get timerCount(){return timers.size;},
    advance(to){for(const [id,timer] of [...timers].sort((a,b)=>a[1].at-b[1].at))if(timer.at<=to&&timers.has(id)){clock=timer.at;timers.delete(id);timer.fn();}clock=to;frame(clock);}};
}

test('dev button skips crew, survives roster updates, previews idle teams and returns to map selection',()=>{
  const h=hostHarness(),{$,handlers,emitted,context,html}=h;
  $('devMode').onclick();assert.equal($('mapStep').classList.contains('hidden'),false);
  assert.equal($('joinStep').classList.contains('hidden'),true);assert.equal($('start').disabled,false);
  const slots=['red:legs','red:arm','blue:legs','blue:arm'].map(key=>({key,connected:false,ready:false}));
  handlers['room:roster']({slots});assert.equal($('start').disabled,false);
  $('start').onclick();assert.equal(emitted.at(-1).event,'game:start');assert.equal(emitted.at(-1).payload.debug,true);
  handlers['game:state']({phase:'playing',debug:true});h.advance(40);
  assert.equal(JSON.stringify(h.lastInputs),'{}');assert.match($('phase').textContent,/MAP PREVIEW/);
  $('leaveGame').onclick();assert.equal(emitted.at(-1).payload.phase,'lobby');
  handlers['game:state']({phase:'lobby',debug:true});assert.equal($('mapStep').classList.contains('hidden'),false);
  $('devMode').onclick();assert.equal($('start').disabled,true);assert.equal($('joinStep').classList.contains('hidden'),false);
  $('start').onclick();assert.equal(emitted.at(-1).payload.debug,false);
  context.pickMap('random');
  assert.equal(h.activeSim.mapId,'ice');assert.equal(h.randomCalls,1);
  handlers['game:state']({phase:'playing',debug:true});
  const arena=h.activeSim.arena;assert.equal(arena.id,'conveyor');
  assert.match($('mapName').textContent,/RANDOM \/ FACTORY/);
  handlers['game:state']({phase:'paused',debug:true});
  handlers['game:state']({phase:'playing',debug:true,resumed:true});
  assert.equal(h.activeSim.arena,arena,'resume keeps the same chosen arena');assert.equal(h.randomCalls,2);
  handlers['game:state']({phase:'playing',debug:true});
  assert.equal(h.activeSim.arena.id,'classic');assert.equal(h.randomCalls,3,'rematch chooses another existing arena');
  context.pickMap('classic');
  handlers['game:state']({phase:'results',debug:true,winner:'red'});
  assert.equal($('winner').textContent,'Dummy wins!');assert.equal(h.winnerShown.winner,'red');
  assert.equal(JSON.stringify(h.winnerShown.picks),'["dummy","dummy"]');
  assert.equal($('gameScreen').classList.contains('showing-results'),true);
  const resultHtml=html.slice(html.indexOf('<div id="result"'),html.indexOf('</section>',html.indexOf('<div id="result"')));
  assert.equal((resultHtml.match(/<button/g)||[]).length,2);
  assert.match(resultHtml,/>Play again</);assert.match(resultHtml,/>Return to Lobby</);
  $('rematch').onclick();assert.equal(emitted.at(-1).event,'game:start');
  const hiddenBefore=h.winnerHidden;handlers['game:state']({phase:'playing',debug:true});
  assert.ok(h.winnerHidden>hiddenBefore);assert.equal($('gameScreen').classList.contains('showing-results'),false);
  handlers['game:state']({phase:'results',debug:true,winner:'draw'});assert.equal($('winner').textContent,'Draw!');
  assert.equal(h.winnerShown.winner,'draw');
  $('resultLobby').onclick();assert.equal(emitted.at(-1).payload.phase,'lobby');
});

test('random map starts immediately on the game screen with a countdown',()=>{
  const h=hostHarness(true),{$,handlers,context}=h;
  context.pickMap('random');
  handlers['game:state']({phase:'playing',debug:false});
  assert.equal($('setup').classList.contains('hidden'),true);
  assert.equal($('gameScreen').classList.contains('hidden'),false);
  assert.equal($('faceoff').classList.contains('hidden'),false);
  assert.equal(h.sim.mapId,'conveyor');
  assert.equal($('faceoffCountdown').textContent,'3');
  assert.match($('mapName').textContent,/FACTORY/);
  assert.equal(h.randomCalls,2,'choose once for selection and once for the new round');
  h.advance(3600);h.advance(3640);assert.ok(h.lastInputs);
  h.advance(4150);assert.ok($('faceoff').classList.contains('hidden'));
  handlers['game:state']({phase:'playing',debug:false});
  assert.equal(h.sim.mapId,'classic');
  assert.equal($('faceoffCountdown').textContent,'3','rematch restarts the countdown immediately');
});

test('host shows life circles and every beam, with finish effects only after final life',()=>{
  const h=hostHarness(),{$,handlers,sim}=h;
  $('devMode').onclick(); handlers['game:state']({phase:'playing',debug:true});
  h.advance(40); assert.equal($('redLives').textContent,'●●');
  sim.fighters[0].y=-6; h.advance(80);
  assert.equal($('redLives').textContent,'●○'); assert.equal(h.beams.length,1);
  assert.equal(h.frames.at(-1).finishAge,null);
  handlers['game:state']({phase:'paused',debug:true});
  const remaining=sim.fighters[0].respawnRemaining;
  h.advance(120);assert.equal(sim.fighters[0].respawnRemaining,remaining);
  handlers['game:state']({phase:'playing',debug:true,resumed:true});
  for(let time=160;time<=1760;time+=40)h.advance(time);
  assert.equal(sim.fighters[0].respawnRemaining,0);
  sim.fighters[0].y=-6; h.advance(1800);
  assert.equal($('redLives').textContent,'○○');assert.equal(h.beams.length,2);
  assert.equal(h.frames.at(-1).finishAge,0);assert.equal(sim.winner,'blue');
  handlers['game:state']({phase:'playing',debug:true});h.advance(3520);
  assert.equal($('redLives').textContent,'●●');assert.equal(h.frames.at(-1).finishAge,null);
});

test('faceoff freezes combat until START, keeps countdown styling and cancels on pause/disconnect',()=>{
 const h=hostHarness(true),{$,handlers}=h;
 $('debugStart').onclick();assert.equal(h.timerCount,0,'rejected or unacknowledged start cannot show intro');
 handlers['game:state']({phase:'playing',debug:true});
 assert.equal($('faceoffCountdown').textContent,'3','countdown starts without an intro delay');
 h.advance(1100);assert.equal(h.lastInputs,undefined);
 assert.ok(!h.html.includes('faceoffStage'),'no character scene is created');
 assert.ok(!h.html.includes('faceoffRedPortrait'),'no portrait scene is created');
 assert.equal($('faceoffCountdown').textContent,'3');assert.ok($('faceoffCountdown').classList.contains('faceoff-countdown'));
 h.advance(1200);assert.equal($('faceoffCountdown').textContent,'2');
 h.advance(2400);assert.equal($('faceoffCountdown').textContent,'1');assert.equal(h.lastInputs,undefined);
 h.advance(3600);assert.equal($('faceoffCountdown').textContent,'START!');h.advance(3640);assert.ok(h.lastInputs);
 assert.deepEqual(h.announcements,[0,1,2,3]);
 h.advance(4150);assert.ok($('faceoff').classList.contains('hidden'));assert.equal(h.timerCount,0);
 handlers['game:state']({phase:'playing',debug:true});assert.equal(h.timerCount,4);
 handlers['game:state']({phase:'paused',debug:true});assert.equal(h.timerCount,0);assert.ok($('faceoff').classList.contains('hidden'));
 handlers['game:state']({phase:'playing',debug:true,resumed:true});assert.equal(h.timerCount,0);
 handlers['game:state']({phase:'playing',debug:true});handlers.disconnect();assert.equal(h.timerCount,0);
});
