import { requestVibration } from './vibration.js';

export function createHitFeedback(overlay, {now=()=>performance.now(),vibrate=requestVibration,reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches}={}) {
  let starts=[],until=0;
  function clear(){until=0;starts=[];overlay.style.opacity='0';}
  return {
    hit(active){
      if(!active)return;
      const time=now();
      starts=starts.filter(t=>time-t<1000);
      // Rate-limit the whole feedback pulse, avoiding rapid red flashes.
      if(starts.length>=3)return;
      starts.push(time);until=time+250;
      overlay.style.opacity=reduced()?'.25':'.65';
      try{vibrate([50,30,70]);}catch{/* Visual feedback remains available. */}
    },
    update(){
      const remaining=until-now();
      overlay.style.opacity=remaining>0?String(reduced()?.25:.65*remaining/250):'0';
    },
    clear,
  };
}
