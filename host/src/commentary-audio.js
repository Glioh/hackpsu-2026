import {CommentaryDetector,CommentaryDirector} from './commentary.js';
import {SCRIPTS} from '../../shared/commentary-scripts.js';
export function createCommentary(socket){
 const detector=new CommentaryDetector();let round=0,context,gain,catalog={clips:{}},token,source,enabled=true,muted=false,volume=.75,loadPromise;
 const buffers=new Map(),active=new Set(),metrics=[];
 const caption=document.getElementById('commentaryCaption'),status=document.getElementById('commentaryStatus');
 const stop=()=>{for(const node of active){try{node.stop();}catch{}}active.clear();source=null;};
 function audioContext(){if(!context){context=new AudioContext({latencyHint:'interactive'});gain=context.createGain();gain.connect(context.destination);gain.gain.value=muted?0:volume;}return context;}
 async function preload(){
  try{catalog=await fetch('/api/commentary/catalog').then(r=>r.json());
   const ctx=audioContext();const entries=Object.entries(catalog.clips);let cursor=0;
   await Promise.all(Array.from({length:Math.min(3,entries.length)},async()=>{while(cursor<entries.length){const [id,clip]=entries[cursor++];try{const response=await fetch(clip.url);if(response.ok)buffers.set(id,await ctx.decodeAudioData(await response.arrayBuffer()));}catch{}}}));
   status.textContent=`${buffers.size} voice clips ready${catalog.live?' · live available':buffers.size?'':' · captions only'}`;
  }catch{status.textContent='Captions only · voice bank unavailable';}
 }
 function track(buffer,when,offset=0){const node=context.createBufferSource();node.buffer=buffer;node.connect(gain);active.add(node);node.onended=()=>active.delete(node);node.start(when,offset);source=node;return node;}
 function wait(ms,signal){return new Promise(resolve=>{const timer=setTimeout(done,ms);function done(){clearTimeout(timer);signal.removeEventListener('abort',done);resolve();}signal.addEventListener('abort',done,{once:true});if(signal.aborted)done();});}
 async function play(script,event,signal){
  if(!enabled)return;const started=performance.now();const deadline=started+Math.max(0,event.expires-detector.time)*1000;
  const buffer=buffers.get(script.id);
  if(buffer&&context?.state==='running'&&!muted){track(buffer,context.currentTime,catalog.clips[script.id]?.offset||0);metrics.push({path:'local',script:script.id,scheduleMs:performance.now()-event.observedAt,baseLatency:context.baseLatency,outputLatency:context.outputLatency});await wait(buffer.duration*1000,signal);return;}
  if(catalog.live&&token&&!muted&&context?.state==='running'){
   const request=new AbortController();const cancel=()=>request.abort();signal.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,Math.min(7000,deadline-started));
   try{
    const response=await fetch(`/api/commentary/live/${script.id}`,{headers:{Authorization:`Bearer ${token}`},signal:request.signal});if(!response.ok)throw Error();
    const reader=response.body.getReader();let carry=null,next=null,first=true,total=0;
    while(true){const {value,done}=await reader.read();if(done)break;if(signal.aborted)throw Error();
     if(first&&performance.now()>deadline)throw Error('Stale');
     const bytes=new Uint8Array(value.length+(carry===null?0:1));if(carry!==null){bytes[0]=carry;bytes.set(value,1);}else bytes.set(value);carry=bytes.length%2?bytes.at(-1):null;
     const length=Math.floor(bytes.length/2);if(!length)continue;total+=length;if(total>24000*12)throw Error('Oversized speech');
     // Native AudioBuffer resampling handles the device sample rate; preserve split int16 frames.
     const view=new DataView(bytes.buffer,bytes.byteOffset,length*2);
     for(let offset=0;offset<length;offset+=2400){
      if(signal.aborted)throw Error('Cancelled');
      const count=Math.min(2400,length-offset),audio=context.createBuffer(1,count,24000),samples=audio.getChannelData(0);
      for(let i=0;i<count;i++)samples[i]=view.getInt16((offset+i)*2,true)/32768;
      if(first){next=context.currentTime+.08;if(performance.now()>deadline)throw Error('Stale');metrics.push({path:'live',script:script.id,firstScheduleMs:performance.now()-event.observedAt});clearTimeout(timer);first=false;}
      next=Math.max(next,context.currentTime+.01);track(audio,next);next+=audio.duration;
      // Slice large provider chunks and bound the scheduled queue, propagating fetch backpressure.
      if(next-context.currentTime>.9)await wait((next-context.currentTime-.5)*1000,signal);
     }
    }
    if(carry!==null)throw Error('Truncated PCM sample');await wait(Math.max(0,(next??context.currentTime)-context.currentTime)*1000,signal);return;
   }catch{if(!signal.aborted)stop();}finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);request.abort();}
  }
  await wait(2800,signal);
 }
 const director=new CommentaryDirector({play,stop,clock:()=>detector.time,caption:(text,speaker)=>{caption.textContent=text?`${speaker==='a'?'Rex':'Vera'}: ${text}`:'';}});
 function offer(event){event.observedAt=performance.now();director.offer(event);}
 document.getElementById('commentaryEnabled').onchange=e=>{enabled=e.target.checked;if(!enabled)director.cancel();};
 document.getElementById('commentaryMute').onchange=e=>{muted=e.target.checked;if(gain)gain.gain.value=muted?0:volume;if(muted)director.cancel();};
 document.getElementById('commentaryVolume').oninput=e=>{volume=Number(e.target.value);if(gain)gain.gain.value=muted?0:volume;};
 document.getElementById('commentaryCaptions').onchange=e=>caption.hidden=!e.target.checked;
 socket.on('disconnect',()=>{token=null;director.cancel();});
 return {
  unlock(){try{const ctx=audioContext();ctx.resume().catch(()=>{status.textContent='Audio blocked · captions available';});loadPromise??=preload();socket.emit('commentary:authorize',{},result=>{token=result.token;});}catch{status.textContent='Captions only · Web Audio unavailable';}},
  phase(phase,resumed){if(phase==='playing'){if(!resumed){detector.reset(++round);director.reset(round);if(enabled)offer(detector.event('round_start',null));}director.paused=false;}else if(phase!=='results'){director.cancel();director.paused=true;}},
  step(sim,dt){for(const event of detector.step(sim.motionEvents,sim.winner,dt,sim.fighters))if(enabled)offer(event);},
  tick(){if(enabled)void director.tick(SCRIPTS);if(metrics.length>100)metrics.splice(0,metrics.length-100);},
  metrics
 };
}

