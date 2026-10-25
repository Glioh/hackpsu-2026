import {PIANO_LAYOUT,PIANO_SPAWNS,PIANO_BACK_WALL_Z} from '../../shared/piano-layout.js';
import {configureSolidTerrain} from './solid-terrain.js';
export function configurePiano(arena){
 configureSolidTerrain(arena,PIANO_LAYOUT,PIANO_SPAWNS);
 const resolveTerrain=arena.resolveMotion;
 arena.resolveMotion=(f,previous,radius,events=[])=>{
  // Keep the whole fighter in front of the piano case, including during
  // jumps, knockback and player separation. The other keyboard edges stay open.
  const backLimit=PIANO_BACK_WALL_Z+radius;
  if(f.z<backLimit){f.z=backLimit;if(f.vz<0)f.vz=0;}
  resolveTerrain(f,previous,radius,events);
 };
 arena.floorAt=(x,z,maxY=Infinity)=>{
  let best=null;
  for(const p of arena.pieces)if(p.solid&&Math.abs(x-p.x)<=p.hw&&Math.abs(z-p.z)<=p.hd&&p.y<=maxY+1e-5&&(!best||p.y>best.y))best={...p};
  return best;
 };
}
