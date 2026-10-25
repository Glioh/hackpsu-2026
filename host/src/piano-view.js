import {createPiano} from './piano-model.js';
import {createPianoAudio} from './piano-audio.js';
import {createRooftopVisibility} from './rooftop-visibility.js';
export function createPianoView(scene){
 const model=createPiano();model.root.visible=false;scene.add(model.root);
 const play=createPianoAudio(),contacts=new Map();let current=null;
 const colors=new Map(model.keys.map(k=>[k,k.material.color.clone()]));
 const visibility=createRooftopVisibility(model.root);
 return (arena,fighters,camera)=>{
  const active=arena.id==='piano';model.root.visible=active;
  if(arena!==current){contacts.clear();current=arena;}
  // The low gameplay camera can pass behind the lid, desk, or raised keys.
  // Fade only meshes crossing the sightline to a fighter, and restore on exit.
  if(camera)visibility(active?fighters:[],camera);
  const pressed=new Set();
  if(active)for(const f of fighters){
   const floor=f.grounded?arena.floorAt(f.x,f.z):null;
   const midi=floor&&Math.abs(f.y-floor.y)<.2?floor.midi:undefined;
   if(midi!==undefined){pressed.add(midi);if(contacts.get(f.team)!==midi)play(midi);}
   contacts.set(f.team,midi);
  }
  for(const k of model.keys){k.material.color.copy(colors.get(k));k.position.y-=k.userData.depression||0;const d=pressed.has(k.userData.midi)?-.045:0;k.position.y+=d;k.userData.depression=d;if(d)k.material.color.lerp({r:1,g:.72,b:.25},.2);}
 };
}
