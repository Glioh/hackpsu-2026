import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Sensors} from '../controller/src/sensors.js';
import {setupControllerPreview} from '../controller/src/preview.js';
import {actionLabel,controllerScreen} from '../controller/src/controller-state.js';
import {createHitFeedback} from '../controller/src/hit-feedback.js';

test('isolated preview runs the actual controller through actions, recovery, hits and resume',()=>{
  const elements=new Map();
  function element(id){
    if(!elements.has(id)){
      const classes=new Set();
      elements.set(id,{value:'',textContent:'',style:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,v)=>v?classes.add(c):classes.delete(c),contains:c=>classes.has(c)},focus(){},dataset:{},append(){},
        set innerHTML(html){
          for(const m of html.matchAll(/id="([^"]+)"/g))element(m[1]);
          for(const m of html.matchAll(/<select id="([^"]+)"><option value="([^"]+)"/g))element(m[1]).value=m[2];
          for(const m of html.matchAll(/<input id="([^"]+)"[^>]*value="([^"]+)"/g))element(m[1]).value=m[2];
        },
      });
    }return elements.get(id);
  }
  // Fail if production code references an element missing from the real page.
  const html=readFileSync(new URL('../controller/index.html',import.meta.url),'utf8');
  for(const m of html.matchAll(/id="([^"]+)"/g))element(m[1]);
  const lookup=id=>{assert.ok(elements.has(id),'Missing DOM id '+id);return element(id);};
  const document={getElementById:lookup,body:element('body'),createElement:()=>element('tools'),addEventListener(){}};
  const previousDocument=globalThis.document;
  globalThis.document=document;
  try{
    let frame,clock=0,emits=0;
    const feedback=createHitFeedback(element('hitOverlay'),{now:()=>clock,reduced:()=>false,vibrate(){}});
    const socket={connected:false,on(){},emit(){emits++;}};
    const context={document,Sensors,setupControllerPreview,actionLabel,controllerScreen,
      createHitFeedback:()=>feedback,location:{search:'?preview=1'},URLSearchParams,
      localStorage:{getItem(){assert.fail('Read real identity');},setItem(){assert.fail('Wrote real identity');}},
      connectSocket(){assert.fail('Connected preview');},io:options=>{assert.equal(options.autoConnect,false);return socket;},
      addEventListener(){},setInterval(){},requestAnimationFrame:fn=>{frame=fn;},performance:{now:()=>clock},
    };
    const main=readFileSync(new URL('../controller/src/main.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
    vm.runInNewContext(main,context);frame();assert.equal(lookup('currentAction').textContent,'IDLE');
    lookup('previewHorizontal').value=40;frame();assert.equal(lookup('currentAction').textContent,'WALK LEFT');
    lookup('flip').checked=true;frame();assert.equal(lookup('currentAction').textContent,'WALK RIGHT');
    lookup('previewJolt').onclick();frame();assert.equal(lookup('currentAction').textContent,'JUMP');
    clock=601;frame();assert.equal(lookup('currentAction').textContent,'WALK RIGHT');
    lookup('previewHit').onclick();assert.equal(element('hitOverlay').style.opacity,'.65');
    lookup('previewCalibration').value='peer';lookup('previewCalibration').onchange();frame();
    assert.equal(element('hitOverlay').style.opacity,'0');
    assert.match(lookup('screenMessage').textContent,/Red Arm/);assert.equal(lookup('recovery').classList.contains('hidden'),true);
    lookup('previewCalibration').value='local';lookup('previewCalibration').onchange();frame();
    assert.match(lookup('currentAction').textContent,/Your phone/);assert.equal(lookup('recovery').classList.contains('hidden'),false);
    lookup('calibrate').onclick();frame();assert.equal(lookup('currentAction').textContent,'WALK RIGHT');
    lookup('previewPhase').value='paused';lookup('previewPhase').onchange();frame();assert.match(lookup('screenMessage').textContent,/host to resume/);
    lookup('previewRecover').onclick();frame();assert.equal(lookup('currentAction').textContent,'PAUSED');
    assert.equal(emits,0);
  }finally{globalThis.document=previousDocument;}
});
