import { mkdir,readFile,writeFile,rename } from 'node:fs/promises';
import { SCRIPTS } from '../shared/commentary-scripts.js';
import { configuration,cacheKey,synthesize } from '../server/commentary.js';
const config=configuration(),dir=new URL('../host/audio/commentary/',import.meta.url);
if(!config.key||!config.a||!config.b){console.error('Set ELEVENLABS_API_KEY, ELEVENLABS_VOICE_A and ELEVENLABS_VOICE_B. No clips generated.');process.exitCode=1;}
else{
 await mkdir(dir,{recursive:true});const manifest={version:1,clips:{}};
 for(const script of SCRIPTS){const key=cacheKey(script,config),file=new URL(`${key}.mp3`,dir);let present=false;try{present=(await readFile(file)).length>0;}catch{}
 if(!present){console.log('Generating',script.id);const response=await synthesize(script,config,{signal:AbortSignal.timeout(30000)});await writeFile(new URL(`${key}.tmp`,dir),Buffer.from(await response.arrayBuffer()));await rename(new URL(`${key}.tmp`,dir),file);}
 manifest.clips[script.id]={key,offset:0,text:script.text,speaker:script.speaker};
 }
 await writeFile(new URL('manifest.json',dir),JSON.stringify(manifest,null,2));console.log('Bank ready. Audition at /host/commentary-audition.html before use.');
}
