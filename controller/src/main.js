import { Sensors } from './sensors.js';
import { setupControllerPreview } from './preview.js';
import { actionLabel, controllerScreen } from './controller-state.js';
import { createHitFeedback } from './hit-feedback.js';
import { connectSocket } from '../../shared/connection.js';
import { CHARACTERS, rollFrame } from '../../shared/party.js';
import { MAPS } from '../../shared/maps.js';
import { choiceCard, updateChoices } from '../../shared/selection-view.js';
const $=id=>document.getElementById(id);
const TEAM_COLORS={red:'#ff665b',blue:'#63c7ec'};
const previewMode=new URLSearchParams(location.search).get('preview')==='1';
const socket=previewMode?io({autoConnect:false}):connectSocket();
const feedback=createHitFeedback($('hitOverlay'));
let preview=null,assignment=null,seq=0,action=0,power=0,ready=false,phase='lobby',wasReady=false;
let partyState = null, serverOffset = 0, choiceKey = '';
let slots=[],interruption=null,winner=null,joltUntil=0,recoveryMessage='Enable motion access to get started.';
const sensors=new Sensors(p=>{
  if(phase!=='playing'||!ready)return;
  action++;power=p;joltUntil=performance.now()+600;
  send();
});
$('room').value=new URLSearchParams(location.search).get('room')||'';
function join(){
  const roomCode=$('room').value.trim().toUpperCase();if(!roomCode)return;
  socket.emit('room:join',{roomCode,clientToken:localStorage.getItem('brawl-token-'+roomCode)},p=>{if(p.error)$('error').textContent=p.error;});
}
function applyAssignment(p){
  const samePlayer = assignment && p.playerId && assignment.playerId === p.playerId;
  assignment=p;seq=0;action=0;joltUntil=0;feedback.clear();
  if (!samePlayer) { ready=false;wasReady=false;slots=[];sensors.invalidate(); }
  recoveryMessage='Enable motion sensors, hold your phone comfortably in portrait, then recalibrate.';
  if(!previewMode)localStorage.setItem('brawl-token-'+p.roomCode,p.clientToken);
  $('join').classList.add('hidden');$('controller').classList.remove('hidden');
  document.body.classList.add('controller-joined');document.body.dataset.team=p.team || 'lobby';
  const fighterColor=p.fighterColor||TEAM_COLORS[p.team];
  if(fighterColor)document.body.style.setProperty?.('--team-bar',fighterColor);else document.body.style.removeProperty?.('--team-bar');
  $('team').textContent=p.role ? `${p.fighterLabel?.toUpperCase() || p.team.toUpperCase()} / ${p.role.toUpperCase()}` : 'IN THE CREW / '+(p.name || 'PLAYER');
  $('lobbyName').textContent = p.name || 'YOU ARE IN';
}
function reportCalibration(status){if(assignment&&socket.connected)socket.emit('player:calibration',{status});}
function invalidate(message,status='calibration-required'){
  sensors.invalidate();ready=false;wasReady=false;joltUntil=0;feedback.clear();
  recoveryMessage=message;reportCalibration(status);
}
function applyGameState(p){
  phase=p.phase;interruption=p.interruption;winner=p.winner;
  partyState = p; serverOffset = p.serverTime ? p.serverTime - Date.now() : 0;
  renderParty();
  if(phase!=='playing'){joltUntil=0;feedback.clear();}
}
function applyRoster(p){
  slots=p.slots;
  $('phonePlayerCount').textContent = `${slots.filter(s => s.connected).length} players in the crew`;
  const own=assignment&&slots.find(s=>s.key===(assignment.key || `${assignment.team}:${assignment.role}`));
  // The server watchdog can invalidate this phone even before a local stale check.
  if(own&&!own.ready&&ready){
    invalidate(own.message||'Sensor stream lost. Recalibrate to continue.',own.status==='disconnected'?'calibration-required':own.status);
  }
}
function showHit(){feedback.hit(!!assignment&&phase==='playing'&&ready);}
socket.on('connect',()=>{
  $('connection').textContent='CONNECTED';$('error').textContent='';
  if(assignment || $('room').value && localStorage.getItem('brawl-token-'+$('room').value.trim().toUpperCase()))join();
});
socket.on('disconnect',()=>{$('connection').textContent='RECONNECTING';invalidate('Connection lost. Reconnect, then recalibrate.');});
socket.on('player:assign',applyAssignment);
socket.on('game:state',applyGameState);
socket.on('room:roster',applyRoster);
socket.on('player:hit',showHit);
socket.on('player:kicked',()=>{
  const roomCode=assignment?.roomCode;
  assignment=null;phase='lobby';slots=[];interruption=null;winner=null;
  invalidate('The host removed you from the room.');
  if(roomCode)localStorage.removeItem('brawl-token-'+roomCode);
  $('room').value='';history.replaceState(null,'',location.pathname);
  document.body.classList.remove('controller-joined');delete document.body.dataset.team;
  $('controller').classList.add('hidden');$('join').classList.remove('hidden');
  $('error').textContent='The host removed you from the room. Ask the host before joining again.';
  $('room').focus();
});
socket.on('room:closed',()=>{
  phase='lobby';invalidate('Host closed the room.');assignment=null;
  document.body.classList.remove('controller-joined');
  $('controller').classList.add('hidden');$('join').classList.remove('hidden');$('error').textContent='Room closed. Join the new room shown on the host.';
});
$('joinform').onsubmit=e=>{e.preventDefault();if(!socket.connected){$('error').textContent='Server disconnected. Waiting to reconnect.';return;}join();};
$('enable').onclick=async()=>{
  try{
    await sensors.enable();invalidate('Sensors enabled. Hold your phone comfortably in portrait, then recalibrate.');
    $('calibrate').disabled=false;$('error').textContent='';
    setTimeout(()=>{if(!sensors.raw)invalidate('No sensor readings yet. Check motion permissions and use a supported phone browser.','sensor-stale');},2500);
  }catch(e){invalidate(e.message,/permission denied/i.test(e.message)?'permission-denied':'sensors-disabled');$('error').textContent=e.message;}
};
$('calibrate').onclick=()=>{
  if(preview?.recalibrate())return;
  try{
    sensors.calibrate();ready=true;wasReady=true;joltUntil=0;$('error').textContent='';reportCalibration('calibrated');
  }catch(e){invalidate(e.message,/portrait/i.test(e.message)?'orientation-error':'sensor-stale');$('error').textContent=e.message;}
};
$('recalibrate').onclick=()=>{
  invalidate('Hold your phone comfortably in portrait, then tap Recalibrate.');
  if(preview)preview.invalidateLocal();
  $('calibrate').focus();
};
addEventListener('orientationchange',()=>invalidate('Return to portrait, then recalibrate.','orientation-error'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)invalidate('This phone was backgrounded. Recalibrate to rejoin.','backgrounded');});
function inputSample(){
  const horizontalSign=$('flip').checked?-1:1;
  const simulated=preview?.sample();
  if(simulated)return {...simulated,x:simulated.x*horizontalSign};
  const s=sensors.sample();return {valid:ready&&s.valid,x:s.x*horizontalSign,z:s.z};
}
function send(){
  if(!assignment||!socket.connected)return;
  if (!assignment.role) { socket.emit('player:heartbeat'); return; }
  const s=inputSample();
  if(wasReady&&!s.valid)invalidate('Sensor stream paused. Recalibrate to continue.','sensor-stale');
  const x=ready&&s.valid?s.x:0,z=ready&&s.valid?s.z:0;
  const data=assignment.role==='legs'?{seq:seq++,moveX:x,moveZ:z,jumpId:action}:{seq:seq++,turn:x,power,actId:action};
  socket.volatile.emit('input:'+assignment.role,data);
  $('diagnostics').textContent=JSON.stringify({orientation:sensors.raw,calibrated:ready,streamHealthy:s.valid,sequence:seq,acceleration:sensors.magnitude.toFixed(2)},null,2);
}
setInterval(send,1000/30);
function text(id,value){if($(id).textContent!==value)$(id).textContent=value;}
function render(){
  if(assignment){
    tickParty();
    const inLobby = phase === 'lobby' && !assignment.role;
    const selecting = ['character-select','character-roll','map-vote','map-roll'].includes(phase);
    $('phoneLobby').classList.toggle('hidden', !inLobby);
    $('phoneSelection').classList.toggle('hidden', !selecting);
    $('phoneAction').classList.toggle('hidden', inLobby || selecting);
    if (inLobby || selecting) { feedback.update(); requestAnimationFrame(render); return; }
    const s=inputSample();
    if(!preview?.sample()&&wasReady&&!s.valid)invalidate('Sensor stream paused. Recalibrate to continue.','sensor-stale');
    const view=controllerScreen({assignment,phase,ready,slots,interruption,winner:partyState?.match?.fighters.find(f => f.id === winner)?.label || winner,action:actionLabel(assignment.role,s.valid?s.x:0,s.valid?s.z:0,performance.now()<joltUntil)});
    if (phase === 'calibrating' && ready) { view.title = 'READY'; view.message = 'Waiting for every phone to calibrate. Keep this screen open.'; }
    text('currentAction',view.title);text('screenMessage',view.message);text('controlTips',view.tips);
    text('sensorStatus',recoveryMessage);
    $('recovery').classList.toggle('hidden',!view.recovery);
    $('enable').classList.toggle('hidden',sensors.enabled||!!preview?.sample());
    $('calibrate').disabled=!sensors.enabled&&!preview?.sample();
  }
  feedback.update();requestAnimationFrame(render);
}
function vote(kind, id) {
  socket.emit(kind + ':vote', {id}, result => { if (result.error) $('error').textContent = result.error; });
}
function renderParty() {
  const selecting = ['character-select', 'character-roll', 'map-vote', 'map-roll'].includes(phase);
  if (!selecting || !assignment) { choiceKey = ''; return; }
  const character = phase.startsWith('character'), selection = partyState.selection;
  const ids = character ? CHARACTERS.map(c => c.id) : selection.options;
  const key = (character ? 'character' : 'map') + ':' + ids.join(',');
  if (key !== choiceKey) {
    choiceKey = key;
    $('phoneChoices').replaceChildren(...ids.map(id => choiceCard(id, character ? 'character' : 'map', id => vote(character ? 'character' : 'map', id))));
  }
  $('phoneSelectionEyebrow').textContent = character ? 'ONE BODY. TWO OPINIONS.' : 'YOUR VOTE COUNTS';
  $('phoneSelectionTitle').textContent = character ? 'PICK YOUR FIGHTER.' : 'PICK YOUR ARENA.';
  $('partnerName').textContent = character ? `Your other half: ${assignment.partner || 'your teammate'}` : `${partyState.match.mode === 'ffa' ? 'Free-for-all' : 'Red vs Blue'} / ${partyState.match.count} characters`;
  $('phoneSelectionHint').textContent = character ? 'Pick together. Matching picks lock in. Different picks get a roll.' : 'Pick one of six. Most votes wins. Ties get a roll.';
  tickParty();
}
function tickParty() {
  if (!partyState?.selection || !assignment) return;
  const character = phase.startsWith('character'), selection = partyState.selection, now = Date.now() + serverOffset;
  const fighter = partyState.match?.fighters.find(f => f.id === assignment.fighterId);
  const partnerId = fighter?.players.find(id => id !== assignment.playerId);
  const roll = character ? selection.rolls?.[assignment.fighterId] : selection.roll;
  const counts = {}; if (!character) for (const vote of Object.values(selection.votes)) counts[vote] = (counts[vote] || 0) + 1;
  updateChoices($('phoneChoices'), { vote: selection.votes[assignment.playerId], partnerVote: character && selection.votes[partnerId], counts: character ? null : counts, roll, now });
  text('phoneSelectionClock', roll ? '*' : String(Math.max(0, Math.ceil((selection.deadline - now) / 1000))));
  const current = roll && rollFrame(roll, now), name = (character ? CHARACTERS : MAPS).find(c => c.id === current)?.name;
  text('phoneSelectionStatus', roll ? `${now >= roll.startedAt + roll.duration - 450 ? 'LOCKED IN' : 'ROLLING'} / ${name}`
    : selection.votes[assignment.playerId] ? character ? 'Your pick is in. Waiting for the crew.' : 'Vote counted. Waiting for the crew.' : 'Tap a card to vote.');
}
if(previewMode)preview=setupControllerPreview({applyAssignment,applyGameState,applyRoster,
  setCalibration(value){ready=value;wasReady=false;joltUntil=0;feedback.clear();recoveryMessage='Hold your phone comfortably, then tap Recalibrate.';},
  hit:showHit,jolt(){if(phase==='playing'&&ready)joltUntil=performance.now()+600;},
});
requestAnimationFrame(render);
