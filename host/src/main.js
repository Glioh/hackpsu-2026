import { createCombatAudio } from './combat-audio.js';
import { createCommentary } from './commentary-audio.js';
import { Simulation } from './simulation.js';
import { createRenderer } from './render.js';
import { CONFIG as C, SLOTS } from '../../shared/config.js';
import { connectSocket } from '../../shared/connection.js';
import { createMotion, resetMotion, stepMotion, interpolateMotion } from './motion.js';
import { createPresentation } from './presentation.js';
import { FIGHTERS, TEAM_FIGHTERS } from './fighter-model.js';
import { MAPS } from './maps.js';
import { createBotController } from './bot.js';
import { FINISH_DURATION, FINISH_TIME_SCALE, stepFinish } from './ko-finish.js';
const $ = id => document.getElementById(id), socket = connectSocket(), sim = new Simulation();
const commentary = createCommentary(socket), combatAudio = createCombatAudio();
$('combatSoundEnabled').onchange = e => combatAudio.setEnabled(e.target.checked);
$('combatSoundVolume').oninput = e => combatAudio.setVolume(Number(e.target.value));
const motions = sim.fighters.map(createMotion), renderFighters = motions.map(m => m.output);
const presentation = createPresentation($('gameScreen'));
function resetPoses() { motions.forEach((motion, i) => resetMotion(motion, sim.fighters[i])); draw?.resetMotion(); }
let draw, finishAge = null, visualTime = 0;
function clearFinish() { finishAge = null; draw?.clearKO(); }
try { draw = createRenderer($('arena'), (index, rig) => sim.setCombatRig(index, rig)); } catch { $('arena').textContent = 'WebGL is unavailable. Open the host in a browser with hardware acceleration.'; }
let roomCode = '', phase = 'lobby', debug = false, snapshots = new Map(), ready = false;
let setupStep = 0, connectedCount = 0, mapPreview = false;
function syncPreviewControls() {
  $('start').disabled = !mapPreview && !ready;
  $('start').textContent = mapPreview ? 'Preview selected map' : ready ? 'Start the brawl' : 'Waiting for four ready phones';
  $('mapHelp').textContent = mapPreview ? 'No phones needed. Both teams use idle dummy bots. Arena hazards remain active.' : 'Pick an arena. All four phones must be calibrated before the brawl.';
  $('devMode').setAttribute('aria-pressed', String(mapPreview));
  $('devMode').textContent = mapPreview ? 'Exit dev mode' : 'Dev mode: preview maps with idle bots';
  $('leaveGame').textContent = mapPreview ? 'Choose another map' : 'Return to lobby';
  if (mapPreview) $('calibrationRows').replaceChildren(...['red','blue'].map(team => {
    const row = document.createElement('div'); row.className = 'calibration-row'; row.dataset.ready = 'true';
    row.textContent = team.toUpperCase() + ' / IDLE DUMMY BOT'; return row;
  }));
}
$('devMode').onclick = () => {
  mapPreview = !mapPreview;
  keys.clear(); edges.clear(); snapshots.clear();
  syncPreviewControls();
  showSetupStep(mapPreview ? 2 : 0);
};
const setupPanels = ['joinStep','fighterStep','mapStep'];
function showSetupStep(step, focus = true) {
  setupStep = step;
  setupPanels.forEach((id, i) => $(id).classList.toggle('hidden', i !== step));
  document.querySelectorAll('[data-setup-step]').forEach((button, i) => {
    button.setAttribute('aria-current', i === step ? 'step' : 'false');
    button.disabled = i > step;
  });
  if (focus) $(setupPanels[step]).querySelector('h2').focus();
}
document.querySelectorAll('[data-setup-step]').forEach((button, i) => button.onclick = () => showSetupStep(i));
$('chooseSprites').onclick = () => { if (connectedCount === 4) showSetupStep(1); };
$('chooseMap').onclick = () => showSetupStep(2);
$('backToPlayers').onclick = () => showSetupStep(0);
$('backToSprites').onclick = () => showSetupStep(1);
let faceoffActive = false;
const faceoffTimers=[];
function clearFaceoff(){
  faceoffTimers.splice(0).forEach(id=>clearTimeout(id));
  faceoffActive=false;$('faceoff').classList.add('hidden');combatAudio.stop();
}
function syncScreen() {
  const inSetup = phase === 'lobby' && !faceoffActive;
  $('setup').classList.toggle('hidden', !inSetup);
  $('gameScreen').classList.toggle('hidden', inSetup);
  if (inSetup) showSetupStep(mapPreview ? 2 : 0, false);
}
function kickButton(slot) {
  const button = document.createElement('button');
  button.className = 'secondary kick-player';button.textContent = 'Kick';
  button.setAttribute('aria-label', 'Kick ' + slot.key.replace(':', ' '));
  button.onclick = () => {
    button.disabled = true;
    socket.emit('player:kick', {key: slot.key}, result => {
      if (result.error) { $('error').textContent = result.error; button.disabled = false; }
    });
  };
  return button;
}
const keys = new Set(), edges = new Set();
addEventListener('keydown', e => { if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return; if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); if (!keys.has(e.code)) edges.add(e.code); keys.add(e.code); });
addEventListener('keyup', e => keys.delete(e.code)); addEventListener('blur',()=>{keys.clear();edges.clear();});
function createRoom() { socket.emit('room:create', {}, p => { if (p.error) return $('error').textContent = p.error; roomCode = p.roomCode; $('code').textContent = roomCode; updateURL(); }); }
socket.on('connect', createRoom);
socket.on('disconnect',()=>{phase='lobby';clearFaceoff();clearFinish();ready=false;connectedCount=0;syncScreen();$('chooseSprites').disabled=true;snapshots.clear();presentation.setPhase(phase);$('pauseOverlay').classList.add('hidden');$('phase').textContent='HOST DISCONNECTED · RECONNECTING';$('start').disabled=true;$('error').textContent='Connection lost. Reconnecting creates a new room; phones must rejoin.';});
function updateURL() {
  let origin = $('origin').value.trim() || location.origin;
  try { const url=new URL(origin); if (!['http:','https:'].includes(url.protocol)) throw Error(); origin=url.origin; } catch { $('error').textContent='Enter a valid HTTP(S) origin.';return; }
  const url = origin + '/controller?room=' + roomCode;
  $('qr').src = '/qr?url=' + encodeURIComponent(url); $('joinlink').href=url;
  $('httpsNote').textContent=origin.startsWith('https://')?'HTTPS join URL · verify it opens on all phones.':'Use your deployed HTTPS origin or secure tunnel for phone motion access.';
}
$('origin').value = localStorage.getItem('brawl-origin') || location.origin;
$('setOrigin').onclick=()=>{localStorage.setItem('brawl-origin',$('origin').value);updateURL();};
// Character select: one pick per team, remembered per browser, locked while a round is live.
const TEAMS=['red','blue'], picks=TEAMS.map((team,i)=>{const saved=localStorage.getItem('brawl-fighter-'+team);return FIGHTERS[saved]?saved:TEAM_FIGHTERS[i];});
const UI_ASSETS='/host/assets/ui/';
// Short tags for the champ-select grid; no portrait yet for 'tung' so its card falls back to a lettermark.
const FIGHTER_TAGS={squish:'SOFT BODY. HARD FEELINGS.',crank:'A LITTLE SHELL. A LOT OF ATTITUDE.',bonk:'BUILT DIFFERENT. MOSTLY BOLTS.',nik:'ALL GLOVES. NO PLAN.',tung:'KNOCKS ONCE. KNOCKS HARD.',toast:'WELL DONE UNDER PRESSURE.',conehead:'POINTY. UNBOTHERED. UNSTOPPABLE.',bubbles:'FOAMS AT THE MOUTH. ON PURPOSE.'};
const HAS_PORTRAIT=new Set(['squish','crank','bonk','nik','toast','conehead','bubbles']);
let pickingTeam=0;
function portraitUrl(id,kind){return HAS_PORTRAIT.has(id)?UI_ASSETS+'portraits/'+id+'_'+kind+'.png':'';}
function renderPicks(){
  const locked=phase==='playing'||phase==='paused';
  TEAMS.forEach((team,i)=>{
    const f=FIGHTERS[picks[i]], slot=$(team+'Slot'), img=$(team+'Portrait'), fallback=$(team+'Fallback'), name=$(team+'Name');
    const url=portraitUrl(picks[i],'portrait');
    img.src=url;img.alt=url?f.name:'';img.classList.toggle('hidden',!url);
    fallback.textContent=url?'':f.name[0];fallback.classList.toggle('hidden',!!url);
    name.textContent=f.name;
    slot.classList.toggle('active-pick',pickingTeam===i);
  });
  document.querySelectorAll('[data-pick-team]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.pickTeam===pickingTeam)));
  $('fighterGrid').replaceChildren(...Object.entries(FIGHTERS).map(([id,f])=>{
    const selected=picks[pickingTeam]===id, b=document.createElement('button');
    b.className='champ-card';b.setAttribute('role','listitem');b.setAttribute('aria-pressed',selected);
    b.disabled=locked;b.onclick=()=>pickFighter(pickingTeam,id);
    const frame=document.createElement('img');frame.className='card-frame';frame.alt='';
    frame.src=UI_ASSETS+'frames/character_frame_'+(selected?'selected':'normal')+'.svg';
    const headUrl=portraitUrl(id,'head');
    const strong=document.createElement('strong');strong.textContent=f.name;
    const small=document.createElement('small');small.textContent=FIGHTER_TAGS[id]||'';
    b.append(frame);
    if(headUrl){const head=document.createElement('img');head.className='card-head';head.alt='';head.src=headUrl;b.append(head);}
    else{const head=document.createElement('div');head.className='card-head-fallback';head.setAttribute('aria-hidden','true');head.textContent=f.name[0];b.append(head);}
    b.append(strong,small);
    return b;
  }));
}
document.querySelectorAll('[data-pick-team]').forEach(b=>b.onclick=()=>{pickingTeam=+b.dataset.pickTeam;renderPicks();});
function pickFighter(i,id){picks[i]=id;localStorage.setItem('brawl-fighter-'+TEAMS[i],id);draw?.setFighter(i,id);renderPicks();}
picks.forEach((id,i)=>draw?.setFighter(i,id));renderPicks();
// Arena select: grouped Early / Mid / Late, remembered per browser, locked while a round is live.
let mapId=MAPS.some(m=>m.id===localStorage.getItem('brawl-map'))?localStorage.getItem('brawl-map'):MAPS[0].id;
const nextMapId=()=>MAPS[(MAPS.findIndex(m=>m.id===mapId)+1)%MAPS.length].id;
function renderMaps(){const locked=phase==='playing'||phase==='paused',map=MAPS.find(m=>m.id===mapId);$('mapPicks').replaceChildren(...['Early','Mid','Late'].map(tier=>{const group=document.createElement('div');group.className='tier';const label=document.createElement('small');label.textContent=tier;const choices=document.createElement('div');choices.append(...MAPS.filter(m=>m.tier===tier).map(m=>{const b=document.createElement('button');b.className='secondary';b.textContent=m.name;b.title=m.blurb;b.setAttribute('aria-pressed',m.id===mapId);b.disabled=locked;b.onclick=()=>pickMap(m.id);return b;}));group.append(label,choices);return group;}));$('mapBlurb').textContent=map.blurb;$('mapName').textContent=map.name.toUpperCase();$('nextMap').textContent='Next: '+MAPS.find(m=>m.id===nextMapId()).name+' ↗';}
function pickMap(id){mapId=id;localStorage.setItem('brawl-map',id);sim.setMap(id);clearFinish();resetPoses();renderMaps();}
pickMap(mapId);
socket.on('room:roster', p => {
  ready = p.slots.every(s=>s.connected&&s.ready);
  connectedCount = p.slots.filter(s=>s.connected).length;
  $('playerCount').textContent = connectedCount + ' / 4 PLAYERS';
  $('chooseSprites').disabled = connectedCount !== 4;
  $('chooseSprites').textContent = connectedCount === 4 ? 'Choose player sprites →' : 'Waiting for ' + (4-connectedCount) + ' more phone' + (connectedCount===3?'':'s');
  $('roster').replaceChildren(...p.slots.map(s=>{const row=document.createElement('div');row.className='slot';const [team,role]=s.key.split(':');const name=document.createElement('span');name.className=team;name.textContent=team.toUpperCase()+' / '+role.toUpperCase();const status=document.createElement('span');status.className='slot-status';status.textContent=s.ready&&s.connected?'● READY':s.connected?'Calibrating…':s.occupied?'Disconnected · reserved':'Waiting for phone';row.append(name,status);if(s.occupied)row.append(kickButton(s));return row;}));
  $('resumeGame').disabled = !debug && !ready;
  $('calibrationRows').replaceChildren(...p.slots.map(slot => {
    const row = document.createElement('div'); row.className = 'calibration-row'; row.dataset.ready = String(slot.connected && slot.ready);
    const name = document.createElement('b'); name.textContent = slot.key.replace(':',' / ').toUpperCase();
    const status = document.createElement('span'); status.textContent = slot.message || (slot.ready ? 'Ready' : 'Calibration required');
    row.append(name, status); if(slot.occupied)row.append(kickButton(slot)); return row;
  }));
  if(!p.slots.every(s=>s.connected))snapshots.clear();
  syncPreviewControls();
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
  commentary.phase(phase,p.resumed,{map:mapId,fighters:Object.fromEntries(TEAMS.map((team,i)=>[team,picks[i]]))});
  if (phase !== 'playing') clearFaceoff();
  else if (!p.resumed) showFaceoff();
  syncScreen();
  if (phase === 'lobby') clearFinish();
  presentation.setPhase(phase);
  $('pauseOverlay').classList.toggle('hidden', phase !== 'paused');
  $('calibrationMode').textContent = mapPreview ? 'MAP PREVIEW / IDLE BOTS' : debug ? 'KEYBOARD / BOT MODE' : 'PHONE CALIBRATION';
  syncPreviewControls();
  $('resumeGame').disabled = !debug && !ready;
  if(phase==='paused') {
    snapshots.clear();keys.clear();edges.clear();
    const who = p.interruption?.key ? p.interruption.key.replace(':',' / ').toUpperCase() + ': ' : '';
    $('pauseReason').textContent = who + (p.interruption?.message || 'Recalibrate the affected phone to continue.');
    $('resumeGame').focus();
  }
  $('result').classList.toggle('hidden',phase!=='results');
  if(phase==='playing'){if(!p.resumed){sim.reset();clearFinish();resetPoses();}snapshots.clear();accumulator=0;previous=performance.now();keys.clear();edges.clear();$('error').textContent='';$('gameScreen').focus();}
  if(phase==='results'){$('winner').textContent=p.winner==='draw'?'DRAW':p.winner.toUpperCase()+' WINS!';$('winner').className=p.winner;$('resultType').textContent='RING-OUT';}
  if(phase==='lobby')snapshots.clear();
  renderPicks();renderMaps();
  $('phase').textContent=phase==='playing'?(mapPreview?'MAP PREVIEW / IDLE BOTS':debug?'DEBUG MATCH / KEYBOARD + BOTS':'LIVE / FOUR PHONES, TWO BODIES'):phase==='paused'?'PAUSED / CHECK CALIBRATION':phase==='results'?'ROUND COMPLETE':'LOBBY / ASSEMBLE YOUR CREW';
});
function start(isDebug){commentary.unlock();combatAudio.unlock();presentation.request();socket.emit('game:start',{debug:isDebug},p=>{if(p.error){$('error').textContent=p.error;presentation.setPhase(phase);}});}
// Hold simulation during the introduction so no fighter loses behind the overlay.
const FACEOFF_BEATS=[{at:6200,text:'3'},{at:7400,text:'2'},{at:8600,text:'1'},{at:9800,text:'FIGHT',fight:true}];
const FACEOFF_DURATION=10350;
function showFaceoff(){
  clearFaceoff();
  if(mapPreview||typeof setTimeout!=='function')return;
  TEAMS.forEach(team=>{
    const f=FIGHTERS[picks[TEAMS.indexOf(team)]], url=portraitUrl(picks[TEAMS.indexOf(team)],'portrait');
    const img=$('faceoff'+cap(team)+'Portrait'), fallback=$('faceoff'+cap(team)+'Fallback');
    img.src=url;img.alt=url?f.name:'';img.classList.toggle('hidden',!url);
    fallback.textContent=url?'':f.name[0];fallback.classList.toggle('hidden',!!url);
    $('faceoff'+cap(team)+'Name').textContent=f.name;
  });
  $('faceoffMap').textContent=MAPS.find(m=>m.id===mapId).name.toUpperCase();
  const countdown=$('faceoffCountdown');
  countdown.textContent='';countdown.className='faceoff-countdown hidden';
  faceoffActive=true;syncScreen();
  $('faceoff').className='faceoff';
  combatAudio.cheer(FACEOFF_DURATION/1000);
  for(const beat of FACEOFF_BEATS)faceoffTimers.push(setTimeout(()=>{
    countdown.textContent=beat.text;
    countdown.classList.remove('hidden','pop','fight');
    void countdown.offsetWidth; // restart the pop animation even though the class is reapplied
    countdown.classList.add(beat.fight?'fight':'pop');
    combatAudio.countdown(beat.fight);
    if(beat.fight){
      faceoffActive=false;commentary.fight();$('faceoff').classList.add('reveal');
      snapshots.clear();keys.clear();edges.clear();accumulator=0;previous=performance.now();syncScreen();
    }
  },beat.at));
  faceoffTimers.push(setTimeout(()=>{$('faceoff').classList.add('hidden');faceoffTimers.length=0;},FACEOFF_DURATION));
}
function cap(s){return s[0].toUpperCase()+s.slice(1);}
$('start').onclick=()=>start(mapPreview);$('debugStart').onclick=()=>{mapPreview=false;syncPreviewControls();start(true);};$('rematch').onclick=()=>start(debug);$('nextMap').onclick=()=>{pickMap(nextMapId());start(debug);};
$('resumeGame').onclick=()=>{commentary.unlock();combatAudio.unlock();presentation.request();socket.emit('game:resume',{},p=>{if(p.error)$('pauseReason').textContent=p.error;});};

$('leaveGame').onclick=()=>socket.emit('game:state',{phase:'lobby'});
$('pauseLobby').onclick=$('leaveGame').onclick;
$('resultLobby').onclick=$('leaveGame').onclick;
$('showStats').onchange=()=> $('stats').classList.toggle('hidden',!$('showStats').checked);
$('motionEnabled').onchange = resetPoses;
$('motionPreset').onchange = resetPoses;
function keyboard(team){const red=team==='red', has=k=>keys.has(k)?1:0, edge=k=>{const hit=edges.has(k);edges.delete(k);return hit;};return{legs:{moveX:red?has('KeyD')-has('KeyA'):has('ArrowRight')-has('ArrowLeft'),moveZ:red?has('KeyW')-has('KeyS'):has('ArrowUp')-has('ArrowDown'),jump:edge(red?'Space':'KeyI')},arm:{turn:red?has('KeyE')-has('KeyQ'):has('KeyL')-has('KeyJ'),punch:edge(red?'KeyF':'KeyK'),power:1}};}
const bot = createBotController();
function phone(team,now){const result={};for(const role of ['legs','arm']){const s=snapshots.get(team+':'+role);if(!s||now-s.at>C.staleMs){if(s)s.actions=[];result[role]={};continue;}const action=s.actions.shift();result[role]={...s.p,jump:role==='legs'&&action!==undefined,punch:role==='arm'&&action!==undefined};if(action!==undefined)result[role].power=action;}return result;}
let previous=performance.now(),accumulator=0;
function frame(now) {
  const frameDt = Math.max(0, Math.min((now - previous) / 1000, .1)); previous = now;
  const finishing = finishAge !== null;
  const timeScale = finishing ? FINISH_TIME_SCALE : 1;
  if (phase === 'playing' && !faceoffActive) visualTime += frameDt * timeScale;
  if (phase === 'playing' && finishing && !document.hidden) {
    finishAge += frameDt;
    stepFinish(sim, frameDt * timeScale);
    motions.forEach((motion, i) => stepMotion(motion, sim.fighters[i], [], frameDt * timeScale, $('motionPreset').value, $('motionEnabled').checked));
    if (finishAge >= FINISH_DURATION) { phase = 'results'; socket.emit('game:state', {phase:'results',winner:sim.winner}); }
  }
  accumulator += frameDt;
  while (accumulator >= C.tick) {
    if (phase === 'playing' && !faceoffActive && finishAge === null && !document.hidden) {
      const inputs = mapPreview ? {} : debug ? {red:keyboard('red'),blue:$('bot').checked?bot(sim):keyboard('blue')} : {red:phone('red',now),blue:phone('blue',now)};
      for (const team of sim.step(inputs)) {
        socket.emit('player:hit', {team});
        draw?.hit(sim.fighters.find(f => f.team === team), sim.motionEvents.find(e => e.type === 'hit' && e.team === team));
      }
      for (const event of sim.motionEvents) combatAudio.event(event);
      commentary.step(sim,C.tick);
      motions.forEach((motion, i) => stepMotion(motion, sim.fighters[i], sim.motionEvents, C.tick, $('motionPreset').value, $('motionEnabled').checked));
      if (sim.winner) { finishAge = 0; draw?.startKO(sim.fighters.filter(f => f.y < C.eliminationY)); }
    }
    accumulator -= C.tick;
  }
  motions.forEach(motion => interpolateMotion(motion, phase === 'playing' && finishAge === null ? accumulator / C.tick : 1));
  if (phase !== 'lobby') draw?.(renderFighters, visualTime, sim.fighters, sim.arena, { active: phase === 'playing', motionEnabled: $('motionEnabled').checked, finishAge, weapons: sim.weapons.state });
  if ($('showStats').checked) $('stats').textContent = sim.fighters.map(f => `${f.team}: X ${f.x.toFixed(2)} Z ${f.z.toFixed(2)} Y ${f.y.toFixed(2)}\nheading ${f.heading.toFixed(2)} grounded ${f.grounded}\nspeed ${Math.hypot(f.vx,f.vz).toFixed(2)} cooldown ${f.cooldown.toFixed(2)}`).join('\n\n');
  commentary.tick();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// HTTP activity also keeps the cloud container awake during long matches.
setInterval(() => { if (['playing','paused'].includes(phase) && !document.hidden) fetch('/health', {cache:'no-store'}).catch(() => {}); }, 60000);
document.addEventListener('visibilitychange',()=>{previous=performance.now();accumulator=0;if(document.hidden&&['playing','paused'].includes(phase)){commentary.phase('paused');clearFaceoff();phase='paused';socket.emit('game:pause',{});snapshots.clear();keys.clear();edges.clear();}});
