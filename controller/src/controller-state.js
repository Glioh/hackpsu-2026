export const roleTips = role => role === 'legs'
  ? 'Tilt to walk. Tilt farther to move faster. Give a small, controlled jolt to jump.'
  : 'Tilt left or right to steer. Tilt farther to turn faster. Give a small, controlled jolt for an uppercut.';

export function actionLabel(role, x, z, jolting = false) {
  if (jolting) return role === 'legs' ? 'JUMP' : 'UPPERCUT';
  const horizontal = Math.abs(x) >= .1 ? (x > 0 ? 'RIGHT' : 'LEFT') : '';
  if (role === 'arm') return horizontal ? `TURN ${horizontal}` : 'IDLE';
  const vertical = Math.abs(z) >= .1 ? (z > 0 ? 'FORWARD' : 'BACKWARD') : '';
  return horizontal || vertical ? `WALK ${[vertical,horizontal].filter(Boolean).join(' ')}` : 'IDLE';
}

export function controllerScreen({assignment,phase,ready,slots=[],interruption,winner,action='IDLE'}) {
  const tips=roleTips(assignment.role);
  if (!ready) return {title:'Your phone is out of calibration.',message:'Recalibrate to continue.',tips,recovery:true};
  const affected=slots.filter(s=>!s.ready||!s.connected);
  if (affected.length && (phase==='paused'||phase==='lobby')) {
    const names=affected.map(s=>s.key.split(':').map(v=>v[0].toUpperCase()+v.slice(1)).join(' '));
    return {title:phase==='paused'?'PAUSED':'WAITING',message:`${names.join(', ')} ${names.length===1?'is':'are'} out of calibration. Tell them to recalibrate.`,tips,recovery:false};
  }
  if (phase==='paused') return {title:'PAUSED',message:interruption?.status==='host-paused'?'The host paused the match. Waiting for the host to resume.':'Calibrated. Waiting for the other phones.',tips,recovery:false};
  if (phase==='lobby') return {title:'READY',message:'Calibrated. Waiting for the host to start.',tips,recovery:false};
  if (phase==='results') return {title:winner==='draw'?'DRAW':`${(winner||'').toUpperCase()} WINS`,message:'Waiting for the next round.',tips,recovery:false};
  return {title:action,message:'',tips:'',recovery:false};
}
