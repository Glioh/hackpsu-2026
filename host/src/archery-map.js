import {TARGET_RADIUS,ARROW_WARNING,ARROW_LINGER,ARROW_RADIUS} from '../../shared/archery-layout.js';

export function configureArchery(arena,random) {
  const floor={x:0,z:0,hw:TARGET_RADIUS,hd:TARGET_RADIUS,y:0,vx:0,vz:0,solid:true,state:'solid',kind:'target'};
  arena.pieces=[floor];arena.spawn=[[-3.5,0],[3.5,0]];
  arena.floorAt=(x,z,maxY=Infinity)=>maxY>=0&&Math.hypot(x,z)<=TARGET_RADIUS?floor:null;
  arena.arrows=[];
  let next=3+random()*2,serial=0;
  arena.update=(dt,fighters,events)=>{
    arena.shake=Math.max(0,arena.shake-dt);
    for(const a of arena.arrows)if(!a.impacted&&arena.time>=a.impactAt){
      a.impacted=true;
      arena.shake=.8;
      for(const f of fighters){
        const dx=f.x-a.x,dz=f.z-a.z,d=Math.hypot(dx,dz);
        // Warning includes body clearance; jumping above the ground burst evades it.
        if(d>ARROW_RADIUS||f.y>1.3||f.y<-.4)continue;
        const nx=d>.001?dx/d:Math.cos(a.angle),nz=d>.001?dz/d:Math.sin(a.angle);
        const damage=45,power=12+Math.min(5,(f.damage+damage)/30);
        f.damage+=damage;f.vx=nx*power;f.vz=nz*power;f.vy=8;
        f.grounded=false;f.hit=.5;f.stun=.55;
        events.push({type:'hit',team:f.team,x:nx,z:nz,strength:power,damage,hazard:'arrow'});
      }
    }
    arena.arrows=arena.arrows.filter(a=>arena.time<a.impactAt+ARROW_LINGER);
    if(arena.time>=next){
      // Uniform area sampling, fixed positions, whole warning inside the perimeter.
      const angle=random()*Math.PI*2,r=Math.sqrt(random())*(TARGET_RADIUS-ARROW_RADIUS-.2);
      arena.arrows.push({id:serial++,x:Math.cos(angle)*r,z:Math.sin(angle)*r,angle,
        bornAt:arena.time,impactAt:arena.time+ARROW_WARNING,impacted:false});
      next=arena.time+4+random()*2;
    }
    arena.warning=arena.arrows.some(a=>!a.impacted);
  };
}
