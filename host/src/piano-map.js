import {PIANO_LAYOUT,PIANO_SPAWNS} from '../../shared/piano-layout.js';
import {configureSolidTerrain} from './solid-terrain.js';
export function configurePiano(arena){
 configureSolidTerrain(arena,PIANO_LAYOUT,PIANO_SPAWNS);
 arena.floorAt=(x,z,maxY=Infinity)=>{
  let best=null;
  for(const p of arena.pieces)if(p.solid&&Math.abs(x-p.x)<=p.hw&&Math.abs(z-p.z)<=p.hd&&p.y<=maxY+1e-5&&(!best||p.y>best.y))best={...p};
  return best;
 };
}
