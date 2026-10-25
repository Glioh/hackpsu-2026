import {CommentaryDetector,CommentaryDirector} from './commentary.js';
import {SCRIPTS} from '../../shared/commentary-scripts.js';
const announcerScripts=SCRIPTS.filter(script=>script.speaker==='a');
export function createCommentary(socket){
 const detector=new CommentaryDetector();let round=0,context,gain,catalog={clips:{}},token,enabled=true,muted=false,volume=.75,loadPromise,catalogPromise;
 let match={},nextGenerationAt=0;
 let game={map:'classic',winner:null,fighters:['red','blue'].map(team=>({team,damage:0,grounded:true}))};
 const buffers=new Map(),active=new Set(),metrics=[];
 const caption=document.getElementById('commentaryCaption'),status=document.getElementById('commentaryStatus');
 const stop=()=>{for(const node of active){try{node.stop();}catch{}}active.clear();};
 function audioContext(){if(!context){context=new AudioContext({latencyHint:'interactive'});gain=context.createGain();gain.connect(context.destination);gain.gain.value=muted?0:volume;}return context;}
 async function preload(){
  try{catalogPromise=fetch('/api/commentary/catalog').then(r=>r.json());catalog=await catalogPromise;
   const ctx=audioContext();const entries=Object.entries(catalog.clips).filter(([id])=>announcerScripts.some(script=>script.id===id));let cursor=0;
   await Promise.all(Array.from({length:Math.min(3,entries.length)},async()=>{while(cursor<entries.length){const [id,clip]=entries[cursor++];try{const response=await fetch(clip.url);if(response.ok)buffers.set(id,await ctx.decodeAudioData(await response.arrayBuffer()));}catch{}}}));
   status.textContent=`${buffers.size} voice clips ready${catalog.dialogue?' · Gemini live commentary':' · scripted commentary'}${catalog.live?' · live voice':buffers.size?'':' · captions only'}`;
  }catch{status.textContent='Captions only · voice bank unavailable';}
 }
 function track(buffer,when,offset,signal,nodes){
  return new Promise(resolve=>{
   if(signal.aborted)return resolve(false);
   const node=context.createBufferSource();node.buffer=buffer;node.connect(gain);active.add(node);nodes.add(node);
   let finished=false;
   const done=()=>{if(finished)return;finished=true;active.delete(node);nodes.delete(node);signal.removeEventListener('abort',cancel);node.disconnect();resolve(!signal.aborted);};
   const cancel=()=>{try{node.stop();}catch{}done();};
   node.onended=done;signal.addEventListener('abort',cancel,{once:true});node.start(when,offset);
  });
 }
 function wait(ms,signal){return new Promise(resolve=>{const timer=setTimeout(done,ms);function done(){clearTimeout(timer);signal.removeEventListener('abort',done);resolve();}signal.addEventListener('abort',done,{once:true});if(signal.aborted)done();});}
 async function play(script,event,signal){
  if(!enabled||signal.aborted)return false;const nodes=new Set(),ended=[],started=performance.now();const deadline=script.generated?started+5000:started+Math.max(0,event.expires-detector.time)*1000;
  const buffer=buffers.get(script.id);
  if(buffer&&context?.state==='running'&&!muted){const ended=track(buffer,context.currentTime,catalog.clips[script.id]?.offset||0,signal,nodes);metrics.push({path:'local',script:script.id,scheduleMs:performance.now()-event.observedAt,baseLatency:context.baseLatency,outputLatency:context.outputLatency});return ended;}
  if(catalog.live&&token&&!muted&&context?.state==='running'){
   const request=new AbortController();const cancel=()=>request.abort();signal.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,Math.min(7000,deadline-started));
   try{
    const response=await fetch(`/api/commentary/live/${script.id}`,{headers:{Authorization:`Bearer ${token}`},signal:request.signal});if(!response.ok){const detail=await response.json().catch(()=>({}));throw Error(detail.error||`Announcer ${script.speaker.toUpperCase()} voice unavailable (${response.status}).`);}
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
      next=Math.max(next,context.currentTime+.01);ended.push(track(audio,next,0,signal,nodes));next+=audio.duration;
      // Slice large provider chunks and bound the scheduled queue, propagating fetch backpressure.
      if(next-context.currentTime>.9)await wait((next-context.currentTime-.5)*1000,signal);
     }
    }
    if(carry!==null)throw Error('Truncated PCM sample');if(first)throw Error('Empty speech');await Promise.all(ended);return !signal.aborted;
   }catch(error){for(const node of nodes){try{node.stop();}catch{}}await Promise.all(ended);if(!signal.aborted)status.textContent=`${error.message||'Custom voice unavailable.'} Captions only; keeping your selected voice.`;}finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);request.abort();}
  }
  await wait(Math.max(1800,script.text.split(/\s+/).length*280),signal);return !signal.aborted;
 }
 async function prepare(event,history,firstSpeaker,signal){
  if(catalogPromise)await catalogPromise;
  if(!catalog.dialogue||!token||signal.aborted||performance.now()<nextGenerationAt)return null;
  nextGenerationAt=performance.now()+8000;
  const request=new AbortController(),cancel=()=>request.abort();signal.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(cancel,4500),started=performance.now();
  try{
   const response=await fetch('/api/commentary/dialogue',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:request.signal,
    body:JSON.stringify({round,firstSpeaker:'a',event:{type:event.type,team:event.team==='draw'?null:event.team,time:event.time,hazard:event.evidence?.hazard},game,history})});
   if(!response.ok)throw Error('Gemini unavailable');
   const result=await response.json();
   if(!Array.isArray(result.turns)||result.turns.length!==1||result.turns.some(turn=>turn.speaker!=='a'||typeof turn.id!=='string'||typeof turn.text!=='string'||!turn.text.trim()||turn.text.length>180))throw Error('Invalid Gemini commentary');
   if(signal.aborted)return null;
   metrics.push({path:'gemini',generateMs:performance.now()-started,event:event.type});
   status.textContent='Gemini live commentary';
   return result.turns.map(turn=>({...turn,generated:true}));
  }catch{if(!signal.aborted)status.textContent='Gemini unavailable · scripted commentary';return null;}
  finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);request.abort();}
 }
 const director=new CommentaryDirector({play,prepare,stop,clock:()=>detector.time,caption:text=>{caption.textContent=text;}});
 function offer(event){event.observedAt=performance.now();if(catalog.dialogue||catalog.live)event.expires=Math.max(event.expires,event.time+5);director.offer(event);}
 document.getElementById('commentaryEnabled').onchange=e=>{enabled=e.target.checked;if(!enabled)director.cancel();};
 document.getElementById('commentaryMute').onchange=e=>{muted=e.target.checked;if(gain)gain.gain.value=muted?0:volume;if(muted)director.cancel();};
 document.getElementById('commentaryVolume').oninput=e=>{volume=Number(e.target.value);if(gain)gain.gain.value=muted?0:volume;};
 document.getElementById('commentaryCaptions').onchange=e=>caption.hidden=!e.target.checked;
 socket.on('disconnect',()=>{token=null;director.cancel();});
 loadPromise=preload();
 return {
  unlock(){try{const ctx=audioContext();ctx.resume().catch(()=>{status.textContent='Audio blocked · captions available';});loadPromise??=preload();socket.emit('commentary:authorize',{},result=>{token=result.token;});}catch{status.textContent='Captions only · Web Audio unavailable';}},
  phase(phase,resumed,details={}){if(phase==='playing'){if(!resumed){match=details;game={map:details.map||'classic',winner:null,fighters:['red','blue'].map(team=>({team,character:details.fighters?.[team],damage:0,grounded:true}))};detector.reset(++round);director.reset(round,details);if(enabled)offer(detector.event('round_start',null));}director.paused=false;}else if(phase!=='results'){director.cancel();director.paused=true;}},
  fight(){director.cancel();director.nextAt=0;},
  countdown(index){
   director.cancel();director.paused=index!==3;
   const script=SCRIPTS.find(s=>s.id===`countdown-${index}`);
   if(!script||!enabled||muted)return;
   const buffer=buffers.get(script.id);
   if(buffer&&context?.state==='running'){
    void track(buffer,context.currentTime,catalog.clips[script.id]?.offset||0,new AbortController().signal,new Set());
   }
   if(index===3){
    // Welcome the players after the countdown finishes.
    director.nextAt=detector.time+1.2;
    const opening=detector.event('round_start',null);opening.expires=detector.time+6;offer(opening);
   }
  },
  step(sim,dt){game={map:sim.arena.id,winner:sim.winner??null,fighters:sim.fighters.map(f=>({team:f.team,character:match.fighters?.[f.team],damage:f.damage,grounded:f.grounded,lives:f.lives}))};for(const event of detector.step(sim.motionEvents,sim.winner,dt,sim.fighters))if(enabled)offer(event);},
  tick(){if(enabled)void director.tick(announcerScripts);if(metrics.length>100)metrics.splice(0,metrics.length-100);},
  metrics
 };
}

