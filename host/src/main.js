import { Simulation } from './simulation.js';
import { createRenderer } from './render.js';
import { CONFIG as C, SLOTS } from '../../shared/config.js';
import { connectSocket } from '../../shared/connection.js';
const $ = id => document.getElementById(id), socket = connectSocket(), sim = new Simulation();
let draw;
try { draw = createRenderer($('arena')); } catch { $('arena').textContent = 'WebGL is unavailable. Open the host in a browser with hardware acceleration.'; }
let roomCode = '', phase = 'lobby', debug = false, snapshots = new Map(), ready = false;
const keys = new Set(), edges = new Set();
addEventListener('keydown', e => { if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return; if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); if (!keys.has(e.code)) edges.add(e.code); keys.add(e.code); });
addEventListener('keyup', e => keys.delete(e.code)); addEventListener('blur',()=>{keys.clear();edges.clear();});
function createRoom() { socket.emit('room:create', {}, p => { if (p.error) return $('error').textContent = p.error; roomCode = p.roomCode; $('code').textContent = roomCode; updateURL(); }); }
socket.on('connect', createRoom);
socket.on('disconnect',()=>{phase='lobby';snapshots.clear();$('phase').textContent='HOST DISCONNECTED · RECONNECTING';$('start').disabled=true;$('error').textContent='Connection lost. Reconnecting creates a new room; phones must rejoin.';});
function updateURL() {
  let origin = $('origin').value.trim() || location.origin;
  try { const url=new URL(origin); if (!['http:','https:'].includes(url.protocol)) throw Error(); origin=url.origin; } catch { $('error').textContent='Enter a valid HTTP(S) origin.';return; }
  const url = origin + '/controller?room=' + roomCode;
  $('qr').src = '/qr?url=' + encodeURIComponent(url); $('joinlink').href=url;
  $('httpsNote').textContent=origin.startsWith('https://')?'HTTPS join URL · verify it opens on all phones.':'Use your deployed HTTPS origin or secure tunnel for phone motion access.';
}
$('origin').value = localStorage.getItem('brawl-origin') || location.origin;
$('setOrigin').onclick=()=>{localStorage.setItem('brawl-origin',$('origin').value);updateURL();};
socket.on('room:roster', p => {
  ready = p.slots.every(s=>s.connected&&s.ready);
  $('roster').replaceChildren(...p.slots.map(s=>{const row=document.createElement('div');row.className='slot';const [team,role]=s.key.split(':');const name=document.createElement('span');name.className=team;name.textContent=team.toUpperCase()+' / '+role.toUpperCase();const status=document.createElement('span');status.textContent=s.ready&&s.connected?'● READY':s.connected?'Calibrating…':'Waiting for phone';row.append(name,status);return row;}));
  $('start').disabled=!ready; $('start').textContent=ready?'Start the brawl ↗':'Waiting for four ready phones';
  if(!p.slots.every(s=>s.connected))snapshots.clear();
});
for(const role of ['legs','arm'])socket.on('input:'+role,p=>{
  let s=snapshots.get(p.key);
  if(!s)s={seq:-1,lastAction:0,actions:[],p:{},at:0};
  if(p.seq<=s.seq)return;
  const action=p[role==='legs'?'jumpId':'actId'];
  if(action>s.lastAction){s.lastAction=action;s.actions.push(p.power??1);if(s.actions.length>4)s.actions.shift();}
  Object.assign(s,{seq:p.seq,p,at:performance.now()});snapshots.set(p.key,s);
});
socket.on('game:state',p=>{
  phase=p.phase; debug=p.debug;
  $('result').classList.toggle('hidden',phase!=='results');
  if(phase==='playing'){sim.reset();for(const s of snapshots.values())s.actions=[];edges.clear();$('error').textContent='';}
  if(phase==='results'){$('winner').textContent=p.winner==='draw'?'DOUBLE RING-OUT':p.winner.toUpperCase()+' WINS!';$('winner').className=p.winner;}
  if(phase==='lobby')snapshots.clear();
  $('phase').textContent=phase==='playing'?(debug?'DEBUG MATCH / KEYBOARD + BOTS':'LIVE / FOUR PHONES, TWO BODIES'):phase==='results'?'ROUND COMPLETE':'LOBBY / ASSEMBLE YOUR CREW';
});
function start(isDebug){socket.emit('game:start',{debug:isDebug},p=>{if(p.error)$('error').textContent=p.error;});}
$('start').onclick=()=>start(false);$('debugStart').onclick=()=>start(true);$('rematch').onclick=()=>start(debug);
$('showStats').onchange=()=> $('stats').classList.toggle('hidden',!$('showStats').checked);
function keyboard(team){const red=team==='red', has=k=>keys.has(k)?1:0, edge=k=>{const hit=edges.has(k);edges.delete(k);return hit;};return{legs:{moveX:red?has('KeyD')-has('KeyA'):has('ArrowRight')-has('ArrowLeft'),moveZ:red?has('KeyW')-has('KeyS'):has('ArrowUp')-has('ArrowDown'),jump:edge(red?'Space':'KeyI')},arm:{turn:red?has('KeyE')-has('KeyQ'):has('KeyL')-has('KeyJ'),punch:edge(red?'KeyF':'KeyK'),power:1}};}
function bot(){const [target,f]=sim.fighters,dx=target.x-f.x,dz=target.z-f.z,desired=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(desired-f.heading),Math.cos(desired-f.heading));return{legs:{moveX:0,moveZ:Math.hypot(dx,dz)>1.5?.75:0,jump:!f.grounded?false:Math.abs(f.x)>6||Math.abs(f.z)>4},arm:{turn:Math.max(-1,Math.min(1,diff*2)),punch:Math.hypot(dx,dz)<2.1&&Math.abs(diff)<.5,power:.8}};}
function phone(team,now){const result={};for(const role of ['legs','arm']){const s=snapshots.get(team+':'+role);if(!s||now-s.at>C.staleMs){if(s)s.actions=[];result[role]={};continue;}const action=s.actions.shift();result[role]={...s.p,jump:role==='legs'&&action!==undefined,punch:role==='arm'&&action!==undefined};if(action!==undefined)result[role].power=action;}return result;}
let previous=performance.now(),accumulator=0;
function frame(now){accumulator+=Math.min((now-previous)/1000,.1);previous=now;while(accumulator>=C.tick){if(phase==='playing'){const inputs=debug?{red:keyboard('red'),blue:$('bot').checked?bot():keyboard('blue')}:{red:phone('red',now),blue:phone('blue',now)};for(const team of sim.step(inputs))socket.emit('player:hit',{team});if(sim.winner){phase='results';socket.emit('game:state',{phase:'results',winner:sim.winner});}}accumulator-=C.tick;}draw?.(sim.fighters,now/1000);if($('showStats').checked)$('stats').textContent=sim.fighters.map(f=>`${f.team}: X ${f.x.toFixed(2)} Z ${f.z.toFixed(2)} Y ${f.y.toFixed(2)}\nheading ${f.heading.toFixed(2)} grounded ${f.grounded}\nspeed ${Math.hypot(f.vx,f.vz).toFixed(2)} cooldown ${f.cooldown.toFixed(2)}`).join('\n\n');requestAnimationFrame(frame);}requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='playing'){socket.emit('game:state',{phase:'lobby'});snapshots.clear();}});
