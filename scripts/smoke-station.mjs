// Browser QA against a running host and a headless Chrome CDP endpoint.
// node scripts/smoke-station.mjs http://localhost:3000 http://localhost:9359
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const origin=process.argv[2]||'http://localhost:3000',cdp=process.argv[3]||'http://localhost:9359';
const withBot=process.argv.includes('--bot');
const mapName='Crossline Station',mapId='station';
const screenshotPath='../art/prototypes/station/gameplay.png';
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
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:origin});
  await evaluate(`new Promise(resolve=>{const check=()=>document.querySelector('#mapPicks button')?resolve():setTimeout(check,100);check();})`);
  assert.equal(await evaluate(`!![...document.querySelectorAll('#mapPicks button')].find(b=>b.textContent===${JSON.stringify(mapName)})`),true);
  await evaluate(`[...document.querySelectorAll('#mapPicks button')].find(b=>b.textContent===${JSON.stringify(mapName)}).click()`);
  await evaluate(`new Promise(resolve=>{const check=()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/host/assets/maps/station.glb')&&r.responseEnd>0)?resolve():setTimeout(check,100);check();})`);
  await evaluate(`new Promise(r=>setTimeout(r,600))`);
  assert.equal(await evaluate(`localStorage.getItem('brawl-map')`),mapId);
  const trainCheck=await evaluate(`(async()=>{
    const T=await import('three');
    const {createStationView}=await import('/host/src/station-view.js');
    const {createArena}=await import('/host/src/maps.js');
    const scene=new T.Scene(),view=createStationView(scene),arena=createArena('station',1);
    view(arena,[]);
    await new Promise((resolve,reject)=>{const end=Date.now()+15000;const check=()=>scene.children[0].children.length?resolve():Date.now()>end?reject(Error('Station model timeout')):setTimeout(check,50);check();});
    const trains=[],signals=[];scene.traverse(node=>{if(Number.isInteger(node.userData.stationTrain))trains[node.userData.stationTrain]=node;if(Number.isInteger(node.userData.stationSignal))signals[node.userData.stationSignal]=node;});
    const seen=[false,false];let matched=true;
    for(let i=0;i<2400;i++){
      arena.step(1/60,[],[]);view(arena,[]);
      arena.trains.forEach((state,j)=>{seen[j] ||= state.passing;matched &&= trains[j].visible===state.passing&&Math.abs(trains[j].position.x-state.x)<.00001;});
    }
    const fresh=createArena('station',2);view(fresh,[]);const reset=trains.every(t=>!t.visible);
    view(createArena('classic'),[]);return {seen,matched,reset,hidden:!scene.children[0].visible,signals:signals.length};
  })()`);
  assert.deepEqual(trainCheck,{seen:[true,true],matched:true,reset:true,hidden:true,signals:2});
  await evaluate(`document.querySelector('#bot').checked=${withBot};document.querySelector('#showStats').checked=true;document.querySelector('#showStats').dispatchEvent(new Event('change'));document.querySelector('#debugStart').click()`);
  await evaluate(`new Promise(resolve=>{const check=()=>document.querySelector('#phase').textContent.includes('DEBUG MATCH')?resolve():setTimeout(check,100);check();})`);
  const initialBlueX=await evaluate(`document.querySelector('#stats').textContent.match(/blue: X ([0-9.-]+)/)?.[1]`);
  const keys=[['KeyS','s'],['KeyD','d'],['Space',' ']];
  // Exercise actual keyboard input, jump, and the live animation/render loop.
  for(const [code,key] of keys){await send('Input.dispatchKeyEvent',{type:'keyDown',code,key});await evaluate(`new Promise(r=>setTimeout(r,200))`);await send('Input.dispatchKeyEvent',{type:'keyUp',code,key});}
  await evaluate(`new Promise(r=>setTimeout(r,${withBot?3000:800}))`);
  const status=await evaluate(`({map:document.querySelector('#mapName').textContent,phase:document.querySelector('#phase').textContent,stats:document.querySelector('#stats').textContent,canvas:!!document.querySelector('#arena canvas')})`);
  assert.ok(status.canvas);assert.ok(status.map.includes(mapName.toUpperCase()));assert.match(status.stats,/grounded/);
  if(withBot)assert.notEqual(status.stats.match(/blue: X ([0-9.-]+)/)?.[1],initialBlueX,'live bot navigates toward the opponent');
  assert.deepEqual(errors,[]);
  const screenshot=await send('Page.captureScreenshot',{format:'png'});
  await mkdir(new URL(screenshotPath.replace('gameplay.png',''),import.meta.url),{recursive:true});
  await writeFile(new URL(screenshotPath,import.meta.url),Buffer.from(screenshot.data,'base64'));
  console.log(JSON.stringify({status,errors,screenshot:screenshotPath.slice(3)},null,2));
} finally {ws.close();}
