import {insideLava,LAVA_HAZARDS,LAVA_CHUNKS,LAVA_COLLAPSE} from '../../shared/lava-layout.js';

export function configureLava(arena,random) {
  arena.pieces=LAVA_CHUNKS.map((outline,i)=>{
    const xs=outline.map(p=>p[0]),zs=outline.map(p=>p[1]);
    const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
    return {x,z,hw:(Math.max(...xs)-Math.min(...xs))/2,hd:(Math.max(...zs)-Math.min(...zs))/2,
      y:0,vx:0,vz:0,solid:true,state:'solid',kind:'magma',outline,
      fallAt:i===0?Infinity:LAVA_COLLAPSE.start+((i-1)*7%(LAVA_CHUNKS.length-1))*LAVA_COLLAPSE.interval};
  });
  arena.spawn=[[-3.5,0],[3.5,0]];
  arena.floorAt=(x,z,maxY=Infinity)=>maxY>=0?arena.pieces.find(p=>p.solid&&insideLava(x,z,0,p.outline))??null:null;
  arena.volcanicHazards=[];
  let next=3,serial=0;
  arena.update=(dt,fighters,events)=>{
    arena.shake=Math.max(0,arena.shake-dt*2);
    for(const p of arena.pieces) {
      const age=arena.time-p.fallAt;
      p.solid=age<0;
      p.y=age<0?0:Math.max(-8,-6*age*age);
      p.state=age<-LAVA_COLLAPSE.warning?'solid':age<0?'warn':p.y>-8?'falling':'gone';
      if(age>=0&&age<dt)arena.shake=Math.max(arena.shake,.3);
    }
    arena.volcanicHazards=arena.volcanicHazards.filter(h=>h.impacted||arena.floorAt(h.x,h.z));
    for(const h of arena.volcanicHazards) {
      if(h.impacted||arena.time<h.impactAt)continue;
      h.impacted=true;
      const settings=LAVA_HAZARDS[h.kind];
      arena.shake=Math.max(arena.shake,h.kind==='bomb'?.65:.25);
      for(const f of fighters) {
        const dx=f.x-h.x,dz=f.z-h.z,distance=Math.hypot(dx,dz);
        if(distance>settings.radius||f.y>1.3||f.y<-.4)continue;
        const before={x:f.x,y:f.y,z:f.z,vx:f.vx,vy:f.vy,vz:f.vz,grounded:f.grounded};
        const nx=distance>.001?dx/distance:Math.cos(h.angle),nz=distance>.001?dz/distance:Math.sin(h.angle);
        f.damage+=settings.damage;f.vx=nx*settings.speed;f.vz=nz*settings.speed;f.vy=settings.lift;
        f.grounded=false;f.hit=.4;f.stun=.45;
        events.push({type:'hit',source:'hazard',hazard:'lava',hazardId:h.id,team:f.team,x:nx,z:nz,
          strength:settings.speed,damage:settings.damage,before,
          after:{x:f.x,y:f.y,z:f.z,vx:f.vx,vy:f.vy,vz:f.vz,grounded:f.grounded}});
      }
    }
    arena.volcanicHazards=arena.volcanicHazards.filter(h=>arena.time<h.impactAt+LAVA_HAZARDS[h.kind].linger);
    if(arena.time>=next) {
      const kind=serial%2===0?'vent':'bomb',settings=LAVA_HAZARDS[kind];
      if(arena.volcanicHazards.length<3)for(let attempt=0;attempt<24;attempt++) {
        const x=(random()-.5)*15,z=(random()-.5)*10;
        if(!insideLava(x,z,settings.radius+.3)||arena.volcanicHazards.some(h=>Math.hypot(h.x-x,h.z-z)<settings.radius+LAVA_HAZARDS[h.kind].radius+.5))continue;
        if(!arena.floorAt(x,z)||Array.from({length:12},(_,i)=>{
          const angle=i*Math.PI/6,r=settings.radius+.3;
          return !arena.floorAt(x+Math.cos(angle)*r,z+Math.sin(angle)*r);
        }).some(Boolean))continue;
        arena.volcanicHazards.push({id:serial++,kind,x,z,angle:random()*Math.PI*2,bornAt:arena.time,impactAt:arena.time+settings.warning,impacted:false});
        break;
      }
      next=arena.time+Math.max(.95,2.6-arena.time*.018);
    }
    arena.warning=arena.pieces.some(p=>p.state==='warn')||arena.volcanicHazards.some(h=>!h.impacted);
  };
}
