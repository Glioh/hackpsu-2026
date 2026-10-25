import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const tabs=await(await fetch('http://localhost:9346/json')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,m=>m.error?reject(m.error):resolve(m.result));ws.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
try{
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.pianoVoiceCount=0;const original=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(...args){window.pianoVoiceCount++;return original.apply(this,args);};`});
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://localhost:4186/host/'});
 await evaluate(`new Promise((resolve,reject)=>{const end=Date.now()+20000;const check=()=>document.querySelector('#mapPicks button')?resolve():Date.now()>end?reject(Error('timeout')):setTimeout(check,100);check();})`);
 await evaluate(`[...document.querySelectorAll('#mapPicks button')].find(b=>b.textContent==='Forte Grand Piano').click();document.querySelector('#bot').checked=false;document.querySelector('#showStats').checked=true;`);
 await send('Runtime.evaluate',{expression:`document.querySelector('#debugStart').click()`,userGesture:true});
 await evaluate(`new Promise(r=>setTimeout(r,1800))`);
 assert.equal(await evaluate(`localStorage.getItem('brawl-map')`),'piano');
 for(const type of ['keyDown','keyUp']){await send('Input.dispatchKeyEvent',{type,code:'KeyW',key:'w'});if(type==='keyDown')await evaluate(`new Promise(r=>setTimeout(r,2200))`);}
 assert.deepEqual(errors,[]);
 assert.ok(await evaluate('window.pianoVoiceCount')>0,'Stepping creates piano audio voices');
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('art/prototypes/piano/gameplay.png',Buffer.from(shot.data,'base64'));
 console.log('Piano selected, keyboard match started, movement exercised, no browser exceptions.');
}catch(error){console.error(errors);console.error(await evaluate('document.body.innerText'));throw error;}finally{ws.close();}

