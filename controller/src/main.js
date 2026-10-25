import { Sensors } from './sensors.js';
import { createNeutralGuide } from './neutral-guide.js';
import { connectSocket } from '../../shared/connection.js';
const $=id=>document.getElementById(id),socket=connectSocket();
const updateNeutralGuide=createNeutralGuide($('neutralGuide'));
let assignment=null,seq=0,action=0,power=0,ready=false,phase='lobby',wasReady=false;
const sensors=new Sensors(p=>{if(phase!=='playing'||!ready)return;action++;power=p;navigator.vibrate?.(30);send();});
$('room').value=new URLSearchParams(location.search).get('room')||'';
function join(){const roomCode=$('room').value.trim().toUpperCase();if(!roomCode)return;socket.emit('room:join',{roomCode,clientToken:localStorage.getItem('brawl-token-'+roomCode)},p=>{if(p.error)$('error').textContent=p.error;});}
socket.on('connect',()=>{$('connection').textContent='CONNECTED';$('error').textContent='';if(assignment||$('room').value)join();});
socket.on('disconnect',()=>{$('connection').textContent='RECONNECTING';ready=false;wasReady=false;sensors.invalidate();$('sensorStatus').textContent='Connection lost. Reconnect, then calibrate again.';});
$('joinform').onsubmit=e=>{e.preventDefault();if(!socket.connected){$('error').textContent='Server disconnected. Waiting to reconnect.';return;}join();};
socket.on('player:assign',p=>{assignment=p;seq=0;action=0;ready=false;wasReady=false;sensors.invalidate();localStorage.setItem('brawl-token-'+p.roomCode,p.clientToken);$('join').classList.add('hidden');$('controller').classList.remove('hidden');document.body.dataset.team=p.team;$('team').textContent=p.team.toUpperCase()+' TEAM / ROOM '+p.roomCode;$('role').textContent=p.role.toUpperCase();$('instructions').textContent=p.role==='legs'?'Tilt in two directions to walk relative to your fighter’s facing. Tilt farther to move faster. Give a small jolt to jump.':'Tilt left or right to steer your fighter’s facing. Tilt farther to turn faster. Give a small jolt for a two-arm uppercut.';$('axisLabel').textContent=p.role==='legs'?'BODY-RELATIVE MOVEMENT':'STEERING';$('z').classList.toggle('hidden',p.role==='arm');});
$('enable').onclick=async()=>{try{await sensors.enable();invalidate('Sensors enabled. Hold your phone comfortably in portrait, then calibrate.');$('calibrate').disabled=false;$('error').textContent='';setTimeout(()=>{if(!sensors.raw)invalidate('No sensor readings yet. Check motion permissions and use a supported phone browser.','sensor-stale');},2500);}catch(e){invalidate(e.message,/permission denied/i.test(e.message)?'permission-denied':'sensors-disabled');$('error').textContent=e.message;}};
$('calibrate').onclick=()=>{try{sensors.calibrate();ready=true;$('sensorStatus').textContent='Calibrated. Keep this grip as your neutral position.';$('calibrate').textContent='Recalibrate neutral';$('error').textContent='';reportCalibration('calibrated');wasReady=true;}catch(e){invalidate(e.message,/portrait/i.test(e.message)?'orientation-error':'sensor-stale');$('error').textContent=e.message;}};
function reportCalibration(status){if(assignment&&socket.connected)socket.emit('player:calibration',{status});}
function invalidate(message,status='calibration-required'){sensors.invalidate();ready=false;wasReady=false;reportCalibration(status);$('sensorStatus').textContent=message;}
addEventListener('orientationchange',()=>invalidate('Orientation changed. Return to portrait and recalibrate.','orientation-error'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)invalidate('Controller was backgrounded. Recalibrate to rejoin.','backgrounded');});
socket.on('game:state',p=>{phase=p.phase;$('gameStatus').textContent=p.phase==='paused'?'MATCH PAUSED. Check calibration on this phone. The host will resume when everyone is ready.':p.phase==='playing'?(p.debug?'DEBUG MATCH — host keyboard/bot controls active.':'BRAWL! Watch the host screen.'):p.phase==='results'?(p.winner==='draw'?'Draw!':p.winner.toUpperCase()+' team wins!')+' Waiting for rematch.':'Lobby — waiting for four calibrated phones and the host.';});
socket.on('player:hit',()=>navigator.vibrate?.([50,30,70]));
socket.on('room:closed',()=>{phase='lobby';invalidate('Host closed the room.');assignment=null;$('controller').classList.add('hidden');$('join').classList.remove('hidden');$('error').textContent='Room closed. Join the new room shown on the host.';});
function send(){if(!assignment||!socket.connected)return;const s=sensors.sample();const usable=ready&&s.valid;if(wasReady&&!usable)invalidate('Sensor stream paused. Recalibrate to continue.','sensor-stale');const x=usable?s.x*($('flip').checked?-1:1):0,z=usable?s.z:0;
  const data=assignment.role==='legs'?{seq:seq++,moveX:x,moveZ:z,jumpId:action}:{seq:seq++,turn:x,power,actId:action};
  socket.volatile.emit('input:'+assignment.role,data);
  $('x').value=x;$('z').value=z;$('jolt').textContent=sensors.magnitude.toFixed(1);$('diagnostics').textContent=JSON.stringify({secure:isSecureContext,portrait:screen.orientation?.angle??window.orientation??0,orientation:sensors.raw,calibrated:!!sensors.neutral,streamHealthy:s.valid,sequence:seq,joltId:action,acceleration:sensors.magnitude.toFixed(2)},null,2);
}
setInterval(send,1000/30);
function animateGuide(){
  const valid=ready&&sensors.sample().valid;
  updateNeutralGuide(sensors.raw,sensors.neutral,valid);
  document.body.classList.toggle('motion-playing',!!assignment&&phase==='playing'&&valid);
  requestAnimationFrame(animateGuide);
}
requestAnimationFrame(animateGuide);
