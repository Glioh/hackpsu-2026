import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { SCRIPTS, scriptById } from '../shared/commentary-scripts.js';
export function configuration(env=process.env){return {key:env.ELEVENLABS_API_KEY,a:env.ELEVENLABS_VOICE_A,b:env.ELEVENLABS_VOICE_B,model:env.ELEVENLABS_MODEL_ID||'eleven_flash_v2_5',live:env.COMMENTARY_LIVE==='1'};}
export function cacheKey(script,config,format='mp3_44100_128'){return createHash('sha256').update(JSON.stringify([script,config[script.speaker],config.model,format,'mix-1'])).digest('hex');}
export async function synthesize(script,config,{format='mp3_44100_128',signal,fetcher=fetch}={}){
 if(!config.key||!config[script.speaker])throw Error('Voice credentials missing');
 const result=await fetcher(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config[script.speaker])}/stream?output_format=${format}`,{method:'POST',headers:{'xi-api-key':config.key,'Content-Type':'application/json'},body:JSON.stringify({text:script.text,model_id:config.model}),signal});
 if(!result.ok)throw Error(`Speech provider status ${result.status}`);return result;
}
export function installCommentary(app,io,{config=configuration(),fetcher=fetch,bankDir=new URL('../host/audio/commentary/',import.meta.url)}={}){
 const sessions=new Map();
 io.on('connection',socket=>{
  socket.on('commentary:authorize',(_,ack)=>{if(typeof ack!=='function')return;if(!socket.data.host)return ack({error:'Host only'});let session=[...sessions.values()].find(s=>s.socket===socket.id);if(!session){session={socket:socket.id,token:randomBytes(24).toString('hex'),last:0,busy:false};sessions.set(session.token,session);}ack({token:session.token});});
  socket.on('disconnect',()=>{for(const [key,s]of sessions)if(s.socket===socket.id){s.abort?.abort();sessions.delete(key);}});
 });
 app.get('/api/commentary/catalog',async(_,res)=>{
  let clips={};try{clips=JSON.parse(await readFile(new URL('manifest.json',bankDir),'utf8')).clips||{};}catch{}
  // Serve only files from the current voice/model/script configuration.
  const approved={};for(const script of SCRIPTS){const clip=clips[script.id];if(clip?.key===cacheKey(script,config))approved[script.id]={url:`/host/audio/commentary/${clip.key}.mp3`,offset:clip.offset||0};}
  res.set('Cache-Control','no-store').json({clips:approved,live:!!(config.live&&config.key&&config.a&&config.b)});
 });
 app.get('/api/commentary/live/:id',async(req,res)=>{
  const s=sessions.get(req.get('Authorization')?.replace(/^Bearer /,''));if(!s)return res.sendStatus(403);
  const script=scriptById(req.params.id);if(!script)return res.sendStatus(400);
  if(!config.live||!config.key||!config.a||!config.b)return res.sendStatus(503);
  if(s.busy||Date.now()-s.last<5000)return res.sendStatus(429);
  s.busy=true;s.last=Date.now();const abort=new AbortController();s.abort=abort;const timer=setTimeout(()=>abort.abort(),7000);res.on('close',()=>abort.abort());
  try{const upstream=await synthesize(script,config,{format:'pcm_24000',signal:abort.signal,fetcher});res.set({'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Audio-Sample-Rate':'24000'});res.flushHeaders();let bytes=0;for await(const chunk of upstream.body){bytes+=chunk.length;if(bytes>48000*12)throw Error('Speech too long');if(abort.signal.aborted)break;if(!res.write(chunk))await new Promise(resolve=>{res.once('drain',resolve);abort.signal.addEventListener('abort',resolve,{once:true});});}res.end();}catch{if(!res.headersSent)res.sendStatus(502);else res.destroy();}finally{clearTimeout(timer);s.busy=false;}
 });
}
