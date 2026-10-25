import {CONFIG as C} from '../../shared/config.js';
import {createTerrainNavigator} from './bot-navigation.js';
import {worldToLegInput} from '../../shared/movement.js';

export function createBotController() {
  let arena=null,radius=null,navigator=null,path=[],goal=null,nextPlan=0,lastPosition=null,stuck=0;
  return (sim,index=1)=>{
    const f=sim.fighters[index], targets=sim.fighters.filter(target=>target.lives>0&&!target.respawnRemaining&&sim.enemies(f,target));
    const target=targets.sort((a,b)=>Math.hypot(a.x-f.x,a.z-f.z)-Math.hypot(b.x-f.x,b.z-f.z))[0],r=sim.rigs[index].radius;
    if(!target)return {legs:{moveX:0,moveZ:0,jump:false},arm:{turn:0,punch:false,power:.8}};
    const dx=target.x-f.x,dz=target.z-f.z,range=Math.hypot(dx,dz);
    let waypoint=target;
    if(sim.arena.navigation) {
      if(arena!==sim.arena||radius!==r) {
        arena=sim.arena;radius=r;navigator=createTerrainNavigator(arena,r);path=[];goal=null;nextPlan=0;stuck=0;lastPosition=null;
      }
      if(lastPosition&&f.grounded&&path.length&&Math.hypot(f.x-lastPosition.x,f.z-lastPosition.z)<.008)stuck+=C.tick;else stuck=0;
      lastPosition={x:f.x,z:f.z};
      if(f.grounded && (arena.time>=nextPlan||stuck>.5||!goal)) {
        const floor=arena.floorAt(target.x,target.z,target.y+.4);
        goal={x:target.x,z:target.z,y:floor?.y??target.y};
        path=navigator.route(f,goal);nextPlan=arena.time+.8;stuck=0;
      }
      while(path.length && Math.hypot(path[0].x-f.x,path[0].z-f.z)<.22 && Math.abs(path[0].y-f.y)<.5)path.shift();
      // Stop safely if a target is unreachable, rather than pushing into a wall.
      waypoint=path[0]??f;
    }
    const wx=waypoint.x-f.x,wz=waypoint.z-f.z,d=Math.hypot(wx,wz);
    const aim=range<2.4?Math.atan2(dx,dz):Math.atan2(wx,wz);
    const diff=Math.atan2(Math.sin(aim-f.heading),Math.cos(aim-f.heading));
    const clearApproach=!sim.arena.navigation||range>2.4||navigator.canTravel(f,{x:target.x,z:target.z,y:target.y});
    const stop=range<1.5&&Math.abs(target.y-f.y)<.8&&clearApproach;
    const speed=stop||d<.08?0:Math.min(.75,d*2.5);
    // Bots use the same arena-relative leg axes as phones and keyboards.
    const vx=d>0?wx/d*speed:0,vz=d>0?wz/d*speed:0;
    return {
      legs:{...worldToLegInput(vx,vz),
        jump:sim.arena.navigation?false:f.grounded&&(Math.abs(f.x)>C.arenaX-1||Math.abs(f.z)>C.arenaZ-1)},
      arm:{turn:Math.max(-1,Math.min(1,diff*2)),punch:range<2.1&&clearApproach&&Math.abs(target.y-f.y)<1.5&&Math.abs(diff)<.5,power:.8},
    };
  };
}
