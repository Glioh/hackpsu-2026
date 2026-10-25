import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { SCRIPTS, scriptById } from '../shared/commentary-scripts.js';
import express from 'express';
import { generateDialogue, validDialogue } from './commentary-dialogue.js';
export function configuration(env=process.env){
 const voice=env.ELEVENLABS_VOICE_A||'qP6sk0PHiZEiIExgqoEz';
 return {key:env.ELEVENLABS_API_KEY,a:voice,b:voice,model:env.ELEVENLABS_MODEL_ID||'eleven_flash_v2_5',
  live:env.COMMENTARY_LIVE==='1',dialogue:env.COMMENTARY_DIALOGUE!=='0',
  geminiKey:env.GEMINI_API_KEY||env.GOOGLE_API_KEY,geminiModel:env.GEMINI_MODEL||'gemini-3.5-flash-lite'};
}
export function cacheKey(script,config,format='mp3_44100_128'){return createHash('sha256').update(JSON.stringify([script,config[script.speaker],config.model,format,'mix-1'])).digest('hex');}
const speechErrorHints={
 invalid_api_key:'Check ELEVENLABS_API_KEY on the game server.',
 missing_api_key:'Set ELEVENLABS_API_KEY on the game server.',
 voice_not_found:'The configured voice is not available to this ElevenLabs account.',
 invalid_voice_id:'Check ELEVENLABS_VOICE_A on the game server.',
 voice_access_denied:'This ElevenLabs key cannot access the configured voice.',
 model_not_found:'Check ELEVENLABS_MODEL_ID on the game server.',
 model_access_denied:'This ElevenLabs account cannot access the configured model.',
 unsupported_model:'The configured model does not support this speech operation.',
 invalid_output_format:'The configured model or account does not support the requested PCM format.',
 invalid_parameters:'ElevenLabs rejected a speech parameter; check the voice and model configuration.',
 insufficient_permissions:'The ElevenLabs key needs speech synthesis permission.',
 missing_permissions:'The ElevenLabs key needs speech synthesis permission.',
 insufficient_credits:'The ElevenLabs account has insufficient credits.',
 quota_exceeded:'The ElevenLabs account has reached its usage limit.',
 subscription_required:'The requested voice or model requires an eligible ElevenLabs subscription.',
 paid_plan_required:'The requested voice or model requires an eligible ElevenLabs subscription.',
 detected_unusual_activity:'ElevenLabs blocked speech from this server; check the account restrictions.',
};
export async function synthesize(script,config,{format='mp3_44100_128',signal,fetcher=fetch}={}){
 if(!config.key||!config[script.speaker])throw Error('Voice credentials missing');
 const result=await fetcher(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config[script.speaker])}/stream?output_format=${format}`,{method:'POST',headers:{'xi-api-key':config.key,'Content-Type':'application/json'},body:JSON.stringify({text:script.text,model_id:config.model}),signal});
 if(!result.ok){
  let detail;try{detail=(await result.json()).detail;}catch{}
  const rawCode=detail?.code||detail?.status;
  const providerCode=Object.hasOwn(speechErrorHints,rawCode)?rawCode:'unknown_provider_error';
  throw Object.assign(Error(`Speech provider status ${result.status}`),{providerStatus:result.status,providerCode,
   providerHint:speechErrorHints[providerCode]||'ElevenLabs rejected speech on this server; check the deployed account configuration.'});
 }
 return result;
}
export function installCommentary(app,io,{config=configuration(),fetcher=fetch,bankDir=new URL('../host/audio/commentary/',import.meta.url)}={}){
 const sessions=new Map();
 io.on('connection',socket=>{
  socket.on('commentary:authorize',(_,ack)=>{if(typeof ack!=='function')return;if(!socket.data.host)return ack({error:'Host only'});let session=[...sessions.values()].find(s=>s.socket===socket.id);if(!session){session={socket:socket.id,token:randomBytes(24).toString('hex'),lastBySpeaker:new Map(),busy:false,turns:new Map(),recent:[],lastDialogue:0};sessions.set(session.token,session);}ack({token:session.token});});
  socket.on('disconnect',()=>{for(const [key,s]of sessions)if(s.socket===socket.id){s.abort?.abort();s.dialogueAbort?.abort();sessions.delete(key);}});
 });
 app.get('/api/commentary/catalog',async(_,res)=>{
  let clips={};try{clips=JSON.parse(await readFile(new URL('manifest.json',bankDir),'utf8')).clips||{};}catch{}
  // Serve only files from the current voice/model/script configuration.
  const approved={};for(const script of SCRIPTS){const clip=clips[script.id];if(clip?.key===cacheKey(script,config))approved[script.id]={url:`/host/audio/commentary/${clip.key}.mp3`,offset:clip.offset||0};}
  res.set('Cache-Control','no-store').json({clips:approved,live:!!(config.live&&config.key&&config.a&&config.b),dialogue:!!(config.dialogue&&config.geminiKey)});
 });
 app.post('/api/commentary/dialogue',(req,res,next)=>{
  const session=sessions.get(req.get('Authorization')?.replace(/^Bearer /,''));if(!session)return res.sendStatus(403);
  req.commentarySession=session;next();
 },express.json({limit:'8kb'}),async(req,res)=>{
  const s=req.commentarySession;
  if(!validDialogue(req.body))return res.sendStatus(400);
  if(!config.dialogue||!config.geminiKey)return res.sendStatus(503);
  if(s.dialogueBusy||Date.now()-s.lastDialogue<8000)return res.sendStatus(429);
  s.dialogueBusy=true;s.lastDialogue=Date.now();const abort=new AbortController();s.dialogueAbort=abort;
  const timer=setTimeout(()=>abort.abort(),5000);res.on('close',()=>abort.abort());
  try{
   const turns=await generateDialogue(req.body,config,{signal:abort.signal,fetcher,recent:s.recent});
   if(abort.signal.aborted)return res.end();
   s.turns.clear();
   const exchange=turns.map(turn=>{const script={...turn,id:randomBytes(16).toString('hex'),expires:Date.now()+45000};s.turns.set(script.id,script);return {id:script.id,speaker:script.speaker,text:script.text};});
   s.recent.push(...turns.map(turn=>turn.text));s.recent=s.recent.slice(-40);
   res.set('Cache-Control','no-store').json({turns:exchange,provider:'gemini'});
  }catch{if(!res.headersSent&&!res.destroyed)res.status(502).json({error:'Gemini commentary unavailable. Using scripted commentary.'});}finally{clearTimeout(timer);s.dialogueBusy=false;}
 });
 app.get('/api/commentary/live/:id',async(req,res)=>{
  const s=sessions.get(req.get('Authorization')?.replace(/^Bearer /,''));if(!s)return res.sendStatus(403);
  const generated=s.turns.get(req.params.id),script=generated||scriptById(req.params.id);if(!script||generated?.expires<Date.now())return res.sendStatus(400);
  if(!config.live||!config.key||!config.a||!config.b)return res.sendStatus(503);
  if(s.busy||(!generated&&Date.now()-(s.lastBySpeaker.get(script.speaker)??-Infinity)<5000))return res.status(429).json({error:`Announcer ${script.speaker.toUpperCase()} voice is busy. Captions remain available.`});
  if(generated)s.turns.delete(req.params.id);
  s.busy=true;s.lastBySpeaker.set(script.speaker,Date.now());const abort=new AbortController();s.abort=abort;const timer=setTimeout(()=>abort.abort(),7000);res.on('close',()=>abort.abort());
  try{const upstream=await synthesize(script,config,{format:'pcm_24000',signal:abort.signal,fetcher});res.set({'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Audio-Sample-Rate':'24000'});res.flushHeaders();let bytes=0;for await(const chunk of upstream.body){bytes+=chunk.length;if(bytes>48000*12)throw Error('Speech too long');if(abort.signal.aborted)break;if(!res.write(chunk))await new Promise(resolve=>{res.once('drain',resolve);abort.signal.addEventListener('abort',resolve,{once:true});});}res.end();}catch(error){if(!res.headersSent)res.status(502).json({error:`Announcer ${script.speaker.toUpperCase()} custom voice unavailable. ${error.providerHint||''}`.trim(),providerStatus:error.providerStatus??null,providerCode:error.providerCode||null});else res.destroy();}finally{clearTimeout(timer);s.busy=false;}
 });
}
