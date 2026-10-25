import { SLOTS, CONFIG as C } from '../../shared/config.js';
import { tiltAxis } from './sensors.js';

// Uses production screen state and feedback without connecting to a live room.
export function setupControllerPreview({applyAssignment,applyGameState,applyRoster,setCalibration,hit,jolt}) {
  document.body.classList.add('controller-preview');
  document.title='Controller preview - Limb-Possible';
  document.getElementById('connection').textContent='LOCAL PREVIEW';
  const panel=document.createElement('details');panel.className='preview-tools';panel.open=true;
  panel.innerHTML=`<summary>Controller preview</summary><p>No room or other phones required.</p>
    <div class="preview-selects">
      <label>Role<select id="previewRole"><option value="legs">Legs</option><option value="arm">Arm</option></select></label>
      <label>Team<select id="previewTeam"><option value="red">Red</option><option value="blue">Blue</option></select></label>
      <label>Screen<select id="previewPhase"><option value="playing">Playing</option><option value="lobby">Lobby</option><option value="paused">Host paused</option><option value="results">Results</option></select></label>
      <label>Motion<select id="previewMotion"><option value="simulated">Simulated tilt</option><option value="live">Phone sensors</option></select></label>
      <label>Calibration<select id="previewCalibration"><option value="healthy">All ready</option><option value="local">This phone</option><option value="peer">Other body part</option><option value="multiple">Multiple phones</option></select></label>
    </div>
    <div id="previewTilt">
      <label for="previewHorizontal">Left / right tilt</label><input id="previewHorizontal" type="range" min="-55" max="55" value="0">
      <label for="previewVertical">Forward / back tilt</label><input id="previewVertical" type="range" min="-55" max="55" value="0">
      <button id="previewCenter" class="secondary" type="button">Idle</button>
      <button id="previewJolt" class="secondary" type="button">Simulate jolt</button>
    </div>
    <button id="previewHit" class="secondary" type="button">Simulate hit</button>
    <button id="previewRecover" class="secondary" type="button">Recalibrate all phones</button>
    <p id="previewHelp" role="status">Close this panel for a clear view.</p><a href="/controller">Exit preview</a>`;
  document.body.append(panel);
  const $=id=>document.getElementById(id);
  let localReady=true,failed=new Set(),calibrationPause=false;
  const ownKey=()=>`${$('previewTeam').value}:${$('previewRole').value}`;
  function roster(){
    applyRoster({slots:SLOTS.map(key=>({key,ready:!failed.has(key),connected:true,status:failed.has(key)?'calibration-required':'calibrated'}))});
  }
  function game(){
    const phase=$('previewPhase').value;
    applyGameState({phase:calibrationPause?'paused':phase,winner:'red',interruption:calibrationPause?{key:[...failed][0],status:'calibration-required'}:phase==='paused'?{status:'host-paused'}:null});
  }
  function calibration(){
    failed=new Set();const mode=$('previewCalibration').value;
    if(mode==='local')failed.add(ownKey());
    if(mode==='peer'||mode==='multiple')failed.add(`${$('previewTeam').value}:${$('previewRole').value==='legs'?'arm':'legs'}`);
    if(mode==='multiple')failed.add(`${$('previewTeam').value==='red'?'blue':'red'}:legs`);
    localReady=!failed.has(ownKey());setCalibration(localReady);
    calibrationPause=failed.size>0&&$('previewPhase').value==='playing';
    roster();game();
  }
  function assign(){applyAssignment({team:$('previewTeam').value,role:$('previewRole').value,roomCode:'PREVIEW',clientToken:'preview'});calibration();}
  $('previewRole').onchange=$('previewTeam').onchange=assign;
  $('previewCalibration').onchange=$('previewPhase').onchange=calibration;
  $('previewMotion').onchange=()=>{
    const live=$('previewMotion').value==='live';$('previewTilt').hidden=live;
    $('previewHelp').textContent=live?'Enable motion and recalibrate on this phone.':'Close this panel for a clear view.';
    if(live){localReady=false;setCalibration(false);}else calibration();
  };
  $('previewCenter').onclick=()=>{$('previewHorizontal').value=0;$('previewVertical').value=0;};
  $('previewJolt').onclick=jolt;$('previewHit').onclick=hit;
  $('previewRecover').onclick=()=>{$('previewCalibration').value='healthy';calibration();};
  assign();
  return {
    sample(){return $('previewMotion').value==='live'?null:{valid:localReady,x:tiltAxis(Number($('previewHorizontal').value)),z:tiltAxis(-Number($('previewVertical').value),C.forwardSaturation)};},
    recalibrate(){
      if($('previewMotion').value==='live')return false;
      localReady=true;failed.delete(ownKey());setCalibration(true);roster();
      if(!failed.size){calibrationPause=false;$('previewCalibration').value='healthy';}
      game();return true;
    },
    invalidateLocal(){
      localReady=false;failed.add(ownKey());setCalibration(false);
      calibrationPause=$('previewPhase').value==='playing';roster();game();
    },
  };
}
