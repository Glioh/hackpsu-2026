import test from 'node:test';
import assert from 'node:assert/strict';
import {actionLabel,controllerScreen} from '../controller/src/controller-state.js';
import {createHitFeedback} from '../controller/src/hit-feedback.js';

test('action text follows transmitted axes, dead zone, diagonal movement and jolts',()=>{
  assert.equal(actionLabel('legs',.09,-.09),'IDLE');
  assert.equal(actionLabel('legs',1,1),'WALK FORWARD RIGHT');
  assert.equal(actionLabel('legs',-1,-1),'WALK BACKWARD LEFT');
  assert.equal(actionLabel('legs',0,1),'WALK FORWARD');
  assert.equal(actionLabel('arm',-1,1),'TURN LEFT');
  assert.equal(actionLabel('arm',1,0),'TURN RIGHT');
  assert.equal(actionLabel('arm',0,1),'IDLE');
  assert.equal(actionLabel('legs',1,1,true),'JUMP');
  assert.equal(actionLabel('arm',1,0,true),'UPPERCUT');
});
test('recovery prioritizes local failure, identifies every peer and uses viewer role tips',()=>{
  const state={assignment:{team:'blue',role:'arm'},phase:'paused',ready:true,slots:[
    {key:'red:legs',ready:false,connected:true},{key:'blue:legs',ready:false,connected:false},
  ]};
  const peer=controllerScreen(state);
  assert.equal(peer.recovery,false);assert.match(peer.message,/Red Legs, Blue Legs/);assert.match(peer.tips,/uppercut/);
  const own=controllerScreen({...state,ready:false});
  assert.equal(own.recovery,true);assert.match(own.title,/Your phone/);
  const host=controllerScreen({...state,slots:[],interruption:{status:'host-paused'}});
  assert.match(host.message,/host to resume/);
  assert.equal(controllerScreen({...state,phase:'playing',action:'TURN LEFT',slots:[]}).title,'TURN LEFT');
});
test('hit feedback fades, limits repeated flashes, clears, and works without vibration',()=>{
  let clock=0,vibrations=0;const overlay={style:{}};
  const feedback=createHitFeedback(overlay,{now:()=>clock,vibrate:()=>{vibrations++;},reduced:()=>false});
  feedback.hit(false);assert.equal(vibrations,0);
  feedback.hit(true);assert.equal(overlay.style.opacity,'.65');
  clock=125;feedback.update();assert.equal(Number(overlay.style.opacity),.325);
  feedback.hit(true);clock=200;feedback.hit(true);clock=220;feedback.hit(true);assert.equal(vibrations,3);
  clock=500;feedback.update();assert.equal(overlay.style.opacity,'0');
  feedback.clear();assert.equal(overlay.style.opacity,'0');
  const reduced=createHitFeedback(overlay,{now:()=>clock,vibrate:()=>{throw Error('Unsupported');},reduced:()=>true});
  reduced.hit(true);reduced.update();assert.equal(Number(overlay.style.opacity),.25);
});
