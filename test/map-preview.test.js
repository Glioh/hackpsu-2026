import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Simulation} from '../host/src/simulation.js';
import {MAPS} from '../host/src/maps.js';
import {CONFIG as C} from '../shared/config.js';
import * as motion from '../host/src/motion.js';
import {createCombatAudio} from '../host/src/combat-audio.js';

test('dev button skips crew, survives roster updates, previews idle teams and returns to map selection',()=>{
  const html=readFileSync(new URL('../host/index.html',import.meta.url),'utf8'),elements=new Map();
  function element(){const classes=new Set();return {value:'',checked:true,dataset:{},children:[],textContent:'',
    classList:{add:c=>classes.add(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c),contains:c=>classes.has(c)},
    setAttribute(k,v){this[k]=v;},focus(){},append(...items){this.children.push(...items);},
    replaceChildren(...items){this.children=items;},querySelector(){return {focus(){}};}};}
  for(const m of html.matchAll(/id="([^"]+)"/g))elements.set(m[1],element());
  const $=id=>{assert.ok(elements.has(id),'Missing DOM element '+id);return elements.get(id);};
  const handlers={},emitted=[],steps=[element(),element(),element()];let frame,clock=0,lastInputs,activeSim,winnerShown,winnerHidden=0;const randomChoices=['ice','conveyor','classic'];let randomCalls=0;
  const socket={on:(event,fn)=>handlers[event]=fn,emit:(event,payload,ack)=>{
    emitted.push({event,payload});ack?.({});
  }};
  class TrackedSimulation extends Simulation {
    constructor(...args){super(...args);activeSim=this;}
    step(inputs,dt){lastInputs=inputs;return super.step(inputs,dt);}
  }
  const draw=()=>{};draw.setFighter=draw.clearKO=draw.resetMotion=()=>{};
  const context={...motion,createCombatAudio,Simulation:TrackedSimulation,MAPS,C,SLOTS:[],chooseRandomMap:()=>randomChoices[randomCalls++],
    createWinnerView:()=>({show(winner,picks){winnerShown={winner,picks};},hide(){winnerHidden++;}}),
    document:{getElementById:$,querySelectorAll:()=>steps,createElement:element,addEventListener(){},hidden:false},
    createCommentary:()=>({unlock(){},phase(){},tick(){},step(){}}),
    connectSocket:()=>socket,createRenderer:()=>draw,createPresentation:()=>({request(){},setPhase(){}}),
    FIGHTERS:{dummy:{name:'Dummy'}},TEAM_FIGHTERS:['dummy','dummy'],createBotController:()=>()=>{assert.fail('Active bot used in preview');},
    FINISH_DURATION:2,FINISH_TIME_SCALE:.2,stepFinish(){},URL,location:{origin:'http://localhost:3001'},
    localStorage:{getItem(){return null;},setItem(){}},addEventListener(){},setInterval(){},
    performance:{now:()=>clock},requestAnimationFrame:fn=>{frame=fn;}};
  const source=readFileSync(new URL('../host/src/main.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  vm.runInNewContext(source,context);
  $('devMode').onclick();assert.equal($('mapStep').classList.contains('hidden'),false);
  assert.equal($('joinStep').classList.contains('hidden'),true);assert.equal($('start').disabled,false);
  const slots=['red:legs','red:arm','blue:legs','blue:arm'].map(key=>({key,connected:false,ready:false}));
  handlers['room:roster']({slots});assert.equal($('start').disabled,false);
  assert.equal($('calibrationRows').children.length,2);
  $('start').onclick();assert.equal(emitted.at(-1).event,'game:start');assert.equal(emitted.at(-1).payload.debug,true);
  handlers['game:state']({phase:'playing',debug:true});clock=40;frame(clock);
  assert.equal(JSON.stringify(lastInputs),'{}');assert.match($('phase').textContent,/MAP PREVIEW/);
  $('leaveGame').onclick();assert.equal(emitted.at(-1).payload.phase,'lobby');
  handlers['game:state']({phase:'lobby',debug:true});assert.equal($('mapStep').classList.contains('hidden'),false);
  $('devMode').onclick();assert.equal($('start').disabled,true);assert.equal($('joinStep').classList.contains('hidden'),false);
  $('start').onclick();assert.equal(emitted.at(-1).payload.debug,false);
  context.pickMap('random');
  assert.equal(activeSim.mapId,'ice');assert.equal(randomCalls,1);
  handlers['game:state']({phase:'playing',debug:true});
  const arena=activeSim.arena;assert.equal(arena.id,'conveyor');
  assert.match($('mapName').textContent,/RANDOM \/ FACTORY/);
  handlers['game:state']({phase:'paused',debug:true});
  handlers['game:state']({phase:'playing',debug:true,resumed:true});
  assert.equal(activeSim.arena,arena,'resume keeps the same chosen arena');assert.equal(randomCalls,2);
  handlers['game:state']({phase:'playing',debug:true});
  assert.equal(activeSim.arena.id,'classic');assert.equal(randomCalls,3,'rematch chooses another existing arena');
  context.pickMap('classic');
  handlers['game:state']({phase:'results',debug:true,winner:'red'});
  assert.equal($('winner').textContent,'Dummy wins!');assert.equal(winnerShown.winner,'red');
  assert.equal(JSON.stringify(winnerShown.picks),'["dummy","dummy"]');
  assert.equal($('gameScreen').classList.contains('showing-results'),true);
  const resultHtml=html.slice(html.indexOf('<div id="result"'),html.indexOf('</section>',html.indexOf('<div id="result"')));
  assert.equal((resultHtml.match(/<button/g)||[]).length,2);
  assert.match(resultHtml,/>Play again</);assert.match(resultHtml,/>Return to Lobby</);
  $('rematch').onclick();assert.equal(emitted.at(-1).event,'game:start');
  const hiddenBefore=winnerHidden;handlers['game:state']({phase:'playing',debug:true});
  assert.ok(winnerHidden>hiddenBefore);assert.equal($('gameScreen').classList.contains('showing-results'),false);
  handlers['game:state']({phase:'results',debug:true,winner:'draw'});assert.equal($('winner').textContent,'Draw!');
  assert.equal(winnerShown.winner,'draw');
  $('resultLobby').onclick();assert.equal(emitted.at(-1).payload.phase,'lobby');
});
