// Browser QA against a running host and a headless Chrome CDP endpoint.
// node scripts/smoke-rooftop.mjs http://localhost:4175 http://localhost:9337
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const origin=process.argv[2]||'http://localhost:4175',cdp=process.argv[3]||'http://localhost:9337';
const tabs=await(await fetch(cdp+'/json')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let serial=0;const pending=new Map(),errors=[];
ws.onmessage=event=>{
  const message=JSON.parse(event.data);
  if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
  if(message.id){const p=pending.get(message.id);pending.delete(message.id);message.error?p.reject(message.error):p.resolve(message.result);}
};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{
  const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result.value;
};
try {
  await send('Runtime.enable');await send('Page.enable');
  await send('Page.navigate',{url:origin});
  await evaluate(`new Promise(resolve=>{const check=()=>document.querySelector('#mapPicks button')?resolve():setTimeout(check,100);check();})`);
  assert.equal(await evaluate(`!![...document.querySelectorAll('#mapPicks button')].find(b=>b.textContent==='Skyline Rooftop')`),true);
  await evaluate(`[...document.querySelectorAll('#mapPicks button')].find(b=>b.textContent==='Skyline Rooftop').click()`);
  await evaluate(`new Promise(resolve=>{const check=()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/host/assets/maps/skyline.glb')&&r.responseEnd>0)?resolve():setTimeout(check,100);check();})`);
  await evaluate(`new Promise(r=>setTimeout(r,600))`);
  assert.equal(await evaluate(`localStorage.getItem('brawl-map')`),'skyline');
  await evaluate(`document.querySelector('#bot').checked=false;document.querySelector('#showStats').checked=true;document.querySelector('#showStats').dispatchEvent(new Event('change'));document.querySelector('#debugStart').click()`);
  await evaluate(`new Promise(resolve=>{const check=()=>document.querySelector('#phase').textContent.includes('DEBUG MATCH')?resolve():setTimeout(check,100);check();})`);
  const keys=[['KeyS','s'],['KeyD','d'],['Space',' ']];
  // Exercise actual keyboard input, jump, and the live animation/render loop.
  for(const [code,key] of keys){await send('Input.dispatchKeyEvent',{type:'keyDown',code,key});await evaluate(`new Promise(r=>setTimeout(r,200))`);await send('Input.dispatchKeyEvent',{type:'keyUp',code,key});}
  await evaluate(`new Promise(r=>setTimeout(r,800))`);
  const status=await evaluate(`({map:document.querySelector('#mapName').textContent,phase:document.querySelector('#phase').textContent,stats:document.querySelector('#stats').textContent,canvas:!!document.querySelector('#arena canvas')})`);
  assert.ok(status.canvas);assert.match(status.map,/SKYLINE/);assert.match(status.stats,/grounded/);
  assert.deepEqual(errors,[]);
  const screenshot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(new URL('../art/prototypes/rooftop/gameplay.png',import.meta.url),Buffer.from(screenshot.data,'base64'));
  console.log(JSON.stringify({status,errors,screenshot:'art/prototypes/rooftop/gameplay.png'},null,2));
} finally {ws.close();}
