import {STATION_HULLS} from './station-hulls.js';
import {configureSolidTerrain} from './solid-terrain.js';
import {createTrainSchedule,TRAIN_HALF_LENGTH,TRAIN_HALF_WIDTH} from '../../shared/station-trains.js';

export function configureStation(arena,random) {
  configureSolidTerrain(arena,STATION_HULLS,[[-5,3.8],[7,3.8]]);
  // Navigation needs both the ground corridor and the overhead bridge surface.
  arena.navigationFloors=(x,z)=>{
    const pieces=arena.pieces.filter(p=>Math.abs(x-p.x)<=p.hw&&Math.abs(z-p.z)<=p.hd);
    return [...new Set(pieces.filter(p=>!pieces.some(other=>other.y>p.y+1e-5&&other.bottom<p.y+2.2)).map(p=>p.y))];
  };
  const schedule=createTrainSchedule(random),hitPass=[new Map(),new Map()];
  arena.trains=schedule(0);
  arena.update=(dt,fighters,events)=>{
    const previous=arena.trains;arena.trains=schedule(arena.time);
    arena.warning=arena.trains.some(t=>t.warning);
    arena.trains.forEach((train,i)=>{
      if(!train.passing)return;
      // Sweep movement so a fast train cannot skip a fighter between ticks.
      const lastX=previous[i].passing&&previous[i].pass===train.pass?previous[i].x:-74*train.direction;
      const minX=Math.min(lastX,train.x)-TRAIN_HALF_LENGTH-.62,maxX=Math.max(lastX,train.x)+TRAIN_HALF_LENGTH+.62;
      for(const f of fighters){
        if(f.y>=3.2||f.y+2.2<.02||f.x<minX||f.x>maxX||Math.abs(f.z-train.z)>TRAIN_HALF_WIDTH+.62||hitPass[i].get(f.team)===train.pass)continue;
        hitPass[i].set(f.team,train.pass);
        const before={x:f.x,y:f.y,z:f.z,vx:f.vx,vy:f.vy,vz:f.vz,grounded:f.grounded};
        f.vx=train.direction*42;f.vz=Math.sign(f.z-train.z)*3;f.vy=6;
        f.damage+=25;f.stun=1.1;f.hit=.4;f.grounded=false;
        events.push({type:'hit',source:'hazard',before,after:{x:f.x,y:f.y,z:f.z,vx:f.vx,vy:f.vy,vz:f.vz,grounded:f.grounded},hazardId:`train-${i}-${train.pass}`,team:f.team,x:train.direction,z:0,strength:42,damage:25,hazard:'train'});
      }
    });
  };
}
