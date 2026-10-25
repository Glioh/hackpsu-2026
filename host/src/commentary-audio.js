import {CommentaryDetector,CommentaryDirector} from './commentary.js';
import {SCRIPTS} from '../../shared/commentary-scripts.js';
export function createCommentary(socket){
 const detector=new CommentaryDetector();let round=0,context,gain,catalog={clips:{}},token,enabled=true,muted=false,volume=.75,loadPromise,catalogPromise;
 let game={map:'classic',winner:null,fighters:['red','blue'].map(team=>({team,damage:0,grounded:true}))};
 let match={};
 const buffers=new Map(),active=new Set(),metrics=[];
 const caption=document.getElementById('commentaryCaption'),status=document.getElementById('commentaryStatus');
 let speaking=false;
 const stop=()=>{for(const node of active){try{node.stop();}catch{}}active.clear();if(speaking){globalThis.speechSynthesis?.cancel();speaking=false;}};
 function audioContext(){if(!context){context=new AudioContext({latencyHint:'interactive'});gain=context.createGain();gain.connect(context.destination);gain.gain.value=muted?0:volume;}return context;}
 async function preload(){
  try{catalogPromise=fetch('/api/commentary/catalog').then(r=>r.json());catalog=await catalogPromise;
   const ctx=audioContext();const entries=Object.entries(catalog.clips);let cursor=0;
   await Promise.all(Array.from({length:Math.min(3,entries.length)},async()=>{while(cursor<entries.length){const [id,clip]=entries[cursor++];try{const response=await fetch(clip.url);if(response.ok)buffers.set(id,await ctx.decodeAudioData(await response.arrayBuffer()));}catch{}}}));
   status.textContent=`${buffers.size} voice clips ready${catalog.dialogue?' · fresh dialogue':' · scripted fallback'}${catalog.live?' · live voices':buffers.size?'':' · captions only'}`;
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
      next=Math.max(next,context.currentTime+.01);ended.push(track(audio,next,0,signal,nodes));next+=audio.duration;
      // Slice large provider chunks and bound the scheduled queue, propagating fetch backpressure.
      if(next-context.currentTime>.9)await wait((next-context.currentTime-.5)*1000,signal);
     }
    }
    if(carry!==null)throw Error('Truncated PCM sample');if(first)throw Error('Empty speech');await Promise.all(ended);return !signal.aborted;
   }catch{for(const node of nodes){try{node.stop();}catch{}}await Promise.all(ended);}finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);request.abort();}
  }
  // New scripts remain audible before their studio voice clips are rendered.
  if(!muted&&globalThis.speechSynthesis&&globalThis.SpeechSynthesisUtterance&&!signal.aborted){
   const utterance=new SpeechSynthesisUtterance(script.text);
   utterance.volume=volume;utterance.rate=script.speaker==='a'?1.08:.96;utterance.pitch=script.speaker==='a'?.85:1.1;
   const voices=speechSynthesis.getVoices().filter(v=>v.lang.startsWith('en'));
   utterance.voice=voices[script.speaker==='a'?0:Math.min(1,voices.length-1)]||null;
   await new Promise(resolve=>{
    let finished=false;
    const done=()=>{if(finished)return;finished=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);speaking=false;resolve();};
    const cancel=()=>{speechSynthesis.cancel();done();};
    const timer=setTimeout(cancel,12000);utterance.onend=utterance.onerror=done;
    signal.addEventListener('abort',cancel,{once:true});speaking=true;speechSynthesis.speak(utterance);
   });return !signal.aborted;
  }
  await wait(Math.max(1800,script.text.split(/\s+/).length*280),signal);return !signal.aborted;
 }
 async function prepare(event,history,firstSpeaker,signal){
  if(catalogPromise)await catalogPromise;
  if(!catalog.dialogue||!token||signal.aborted)return null;
  const request=new AbortController(),cancel=()=>request.abort();signal.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,5500);
  try{
   const response=await fetch('/api/commentary/dialogue',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({round,event:{type:event.type,team:event.team==='draw'?null:event.team,time:event.time,hazard:event.evidence?.hazard},game,history,firstSpeaker}),signal:request.signal});
   if(!response.ok)throw Error('Dialogue unavailable');
   const result=await response.json();
   if(!Array.isArray(result.turns)||result.turns.length!==2||result.turns.some((turn,i)=>turn.speaker!==[firstSpeaker,firstSpeaker==='a'?'b':'a'][i]||typeof turn.id!=='string'||typeof turn.text!=='string'||!turn.text.trim()||turn.text.length>180))throw Error('Invalid dialogue');
   status.textContent=catalog.live?'Fresh dialogue · live voices':'Fresh dialogue · captions only';
   return result.turns.map(turn=>({...turn,generated:true}));
  }catch(error){if(!signal.aborted)status.textContent='Scripted fallback · fresh dialogue unavailable';throw error;}
  finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);request.abort();}
 }
 const director=new CommentaryDirector({play,prepare,stop,clock:()=>detector.time,caption:(text,speaker)=>{caption.textContent=text?`${speaker==='a'?'Rex':'Vera'}: ${text}`:'';}});
 function offer(event){event.observedAt=performance.now();if(catalog.dialogue)event.expires=Math.max(event.expires,event.time+5);director.offer(event);}
 document.getElementById('commentaryEnabled').onchange=e=>{enabled=e.target.checked;if(!enabled)director.cancel();};
 document.getElementById('commentaryMute').onchange=e=>{muted=e.target.checked;if(gain)gain.gain.value=muted?0:volume;if(muted)director.cancel();};
 document.getElementById('commentaryVolume').oninput=e=>{volume=Number(e.target.value);if(gain)gain.gain.value=muted?0:volume;};
 document.getElementById('commentaryCaptions').onchange=e=>caption.hidden=!e.target.checked;
 socket.on('disconnect',()=>{token=null;director.cancel();});
 return {
  unlock(){try{const ctx=audioContext();ctx.resume().catch(()=>{status.textContent='Audio blocked · captions available';});loadPromise??=preload();socket.emit('commentary:authorize',{},result=>{token=result.token;});}catch{status.textContent='Captions only · Web Audio unavailable';}},
  phase(phase,resumed,details={}){if(phase==='playing'){if(!resumed){match=details;game={map:match.map||'classic',winner:null,fighters:['red','blue'].map(team=>({team,character:match.fighters?.[team],damage:0,grounded:true}))};detector.reset(++round);director.reset(round,match);if(enabled)offer(detector.event('round_start',null));}director.paused=false;}else if(phase!=='results'){director.cancel();director.paused=true;}},
  fight(){director.cancel();director.nextAt=0;},
  step(sim,dt){game={map:sim.arena.id,winner:sim.winner??null,fighters:sim.fighters.map(f=>({team:f.team,character:match.fighters?.[f.team],damage:f.damage,grounded:f.grounded}))};for(const event of detector.step(sim.motionEvents,sim.winner,dt,sim.fighters))if(enabled)offer(event);},
  tick(){if(enabled)void director.tick(SCRIPTS);if(metrics.length>100)metrics.splice(0,metrics.length-100);},
  metrics
 };
}

