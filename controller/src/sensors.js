import { CONFIG as C } from '../../shared/config.js';
export function tiltAxis(degrees) { return Math.sign(degrees) * Math.min(1,Math.max(0,Math.abs(degrees)-C.deadZone)/(C.saturation-C.deadZone)); }
export class Sensors {
  constructor(onImpulse) {
    this.onImpulse=onImpulse;this.raw=null;this.neutral=null;this.x=0;this.z=0;this.magnitude=0;this.lastJolt=-Infinity;this.lastOrientation=0;this.lastMotion=0;this.fallbackGravity=null;this.enabled=false;
    this.orientation=e=>{if(!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;this.raw={beta:e.beta,gamma:e.gamma};this.lastOrientation=performance.now();if(this.neutral){this.x+=.2*(tiltAxis(e.gamma-this.neutral.gamma)-this.x);this.z+=.2*(tiltAxis(this.neutral.beta-e.beta)-this.z);}};
    this.motion=e=>{let a=e.acceleration;const now=performance.now();if(!a||![a.x,a.y,a.z].every(Number.isFinite)){const g=e.accelerationIncludingGravity;if(!g||![g.x,g.y,g.z].every(Number.isFinite))return;const current=[g.x,g.y,g.z];if(!this.fallbackGravity)this.fallbackGravity=[...current];a={};['x','y','z'].forEach((key,i)=>{this.fallbackGravity[i]+=.08*(current[i]-this.fallbackGravity[i]);a[key]=current[i]-this.fallbackGravity[i];});}this.lastMotion=now;this.magnitude=Math.hypot(a.x,a.y,a.z);if(this.neutral&&this.magnitude>C.joltThreshold&&now-this.lastJolt>C.joltCooldown){this.lastJolt=now;this.onImpulse(Math.min(1,this.magnitude/35));}};
  }
  async enable() {
    if(!window.isSecureContext)throw Error('Motion requires HTTPS. Ask the host for the secure demo URL.');
    if(!window.DeviceOrientationEvent||!window.DeviceMotionEvent)throw Error('Motion sensors are unavailable in this browser. Try Safari on iPhone or Chrome on Android.');
    // Invoke both permission requests directly within the button activation.
    const permissions=[DeviceOrientationEvent,DeviceMotionEvent].map(api=>typeof api.requestPermission==='function'?api.requestPermission():Promise.resolve('granted'));
    if((await Promise.all(permissions)).some(p=>p!=='granted'))throw Error('Motion permission denied. Allow motion in browser settings, then reload.');
    if(!this.enabled){addEventListener('deviceorientation',this.orientation);addEventListener('devicemotion',this.motion);this.enabled=true;}
  }
  calibrate() {
    if(!this.raw||performance.now()-this.lastOrientation>1000)throw Error('No orientation readings. Check browser motion permissions.');
    if(performance.now()-this.lastMotion>1000)throw Error('No accelerometer readings. Motion access is required for jolts.');
    if(Math.abs(screen.orientation?.angle ?? window.orientation ?? 0)%180!==0)throw Error('Hold your phone upright in portrait, then calibrate.');
    this.neutral={...this.raw};this.x=0;this.z=0;
  }
  invalidate(){this.neutral=null;this.x=0;this.z=0;}
  sample(now=performance.now()) {
    const valid=!!this.neutral&&now-this.lastOrientation<1000&&now-this.lastMotion<1000&&!document.hidden;
    const hold=now-this.lastJolt<100;
    return{x:valid&&!hold?this.x:0,z:valid&&!hold?this.z:0,valid};
  }
}
