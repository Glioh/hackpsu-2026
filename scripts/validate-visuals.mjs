// Optional browser acceptance run. See docs/visual-upgrade-validation.md for setup.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const baseline=process.argv[2];
const baseURL=process.env.VISUAL_URL??'http://localhost:3210';
const output=baseline?'.visual-validation/before':'.visual-validation/after';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/__visual-review',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/vendor/three/three.module.js","three/addons/":"/vendor/three/addons/"}}</script></head><body></body></html>'}));
if(baseline)await page.route('**/host/src/*.js',async route=>{const path=new URL(route.request().url()).pathname.slice(1);try{await route.fulfill({contentType:'text/javascript',body:execFileSync('git',['show',`${baseline}:${path}`],{encoding:'utf8'}).replace('  return draw;', '  draw.diagnostics = () => ({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures});\n  return draw;')});}catch{await route.continue();}});
await page.goto(`${baseURL}/__visual-review`);
await page.evaluate(async()=>{
 document.body.innerHTML='<div id="test-arena" style="width:100vw;height:100vh"></div>';document.body.style.cssText='margin:0;overflow:hidden';
 const [{createRenderer},{Simulation},{createMotion,interpolateMotion}]=await Promise.all([import('/host/src/render.js'),import('/host/src/simulation.js'),import('/host/src/motion.js')]);
 const draw=createRenderer(document.querySelector('#test-arena'));draw.setFighter(0,'crank');draw.setFighter(1,'squish');
 window.review={draw,setMap(id,wide=false){this.sim=new Simulation(id);if(wide){this.sim.fighters[0].x=-10;this.sim.fighters[1].x=10;this.sim.fighters.forEach(f=>f.y=this.sim.arena.floorAt(f.x,f.z)?.y??0);}this.poses=this.sim.fighters.map(f=>interpolateMotion(createMotion(f),1));},frames:[],running:true};
 review.setMap('skyline');let previous=performance.now();
 function frame(now){if(!review.running)return;review.draw(review.poses,now/1000,review.sim.fighters,review.sim.arena,{active:false});review.frames.push(now-previous);previous=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
});
await page.waitForTimeout(4000);
await mkdir(output,{recursive:true});
const report={};
for(const id of ['skyline','mountain','piano','station','twinspire','classic','ice','lava','conveyor','tiles','split','platforms','falling','quake']) {
 await page.evaluate(id=>{review.setMap(id);review.frames=[];},id);await page.waitForTimeout(1600);
 report[id]=await page.evaluate(()=>{const a=review.frames.slice(10).sort((a,b)=>a-b);return {...(review.draw.diagnostics?.()??{}),frameMedian:a[Math.floor(a.length*.5)],frameP95:a[Math.floor(a.length*.95)]};});
 await page.screenshot({path:`${output}/${id}.png`});
}
await page.evaluate(()=>review.setMap('skyline',true));await page.waitForTimeout(1200);await page.screenshot({path:`${output}/skyline-wide.png`});
for(let round=0;round<2;round++)for(const id of ['skyline','mountain','piano','classic','ice','station','twinspire','lava']){await page.evaluate(id=>review.setMap(id),id);await page.waitForTimeout(80);}
report.afterCycles=await page.evaluate(()=>(review.draw.diagnostics?.()??{}));
await page.setViewportSize({width:800,height:600});await page.waitForTimeout(300);await page.screenshot({path:`${output}/resized.png`});
// Exercise warnings, jumps, punches and KO using the real simulation and renderer.
for(const id of ['lava','tiles','conveyor','station','skyline']) {
 await page.evaluate(id=>{review.setMap(id);for(let i=0;i<900;i++)review.sim.step({red:{legs:{jump:i===10},arm:{punch:i===30}},blue:{}},1/60);review.poses=review.sim.fighters.map(f=>({...f,pose:review.poses[0].pose}));review.draw.hit(review.sim.fighters[0]);},id);
 await page.waitForTimeout(100);
}
await page.evaluate(()=>{review.draw.resetMotion();review.setMap('lava');review.sim.arena.pieces.forEach((p,i)=>{p.state=i%3===0?'warn':i%3===1?'lava':'solid';});});
await page.waitForTimeout(300);await page.screenshot({path:`${output}/hazards.png`});
await page.evaluate(()=>{review.draw.resetMotion();review.setMap('station',true);review.sim.arena.trains.forEach(t=>{t.warning=true;});});
await page.waitForTimeout(300);await page.screenshot({path:`${output}/station-warning.png`});
await page.evaluate(()=>{review.draw.startKO(review.sim.fighters);review.draw.clearKO();});
// Verify the actual host startup, debug match, resize and keyboard flow too.
const host=await browser.newPage({viewport:{width:1280,height:720}});
host.on('pageerror',e=>errors.push(String(e)));
await host.goto(baseURL);await host.locator('details.debug summary').click();await host.locator('#debugStart').click();await host.waitForTimeout(1500);
await host.keyboard.press('Space');await host.keyboard.press('f');await host.setViewportSize({width:900,height:600});await host.waitForTimeout(500);
report.hostCanvas=await host.locator('#arena canvas').count();await host.close();
if(!baseline&&(report.afterCycles.environments!==8||report.afterCycles.textures!==report.lava.textures))errors.push('Environment cache or texture count grew after map cycles');
report.errors=errors;await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(errors.length||report.hostCanvas!==1)process.exitCode=1;
