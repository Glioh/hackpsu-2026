import {ROOFTOP_HULLS} from './rooftop-hulls.js';

const STEP=.4, HEIGHT=2.2, EPS=1e-5;
const topAt=(p,x,z)=>p.y+(p.slopeZ||0)*(z-p.z);
const contains=(p,x,z,r=0)=>Math.abs(x-p.x)<=p.hw+r && Math.abs(z-p.z)<=p.hd+r;

export function configureRooftop(arena) {
  // The slab is support only: it never clamps motion at the open edges.
  const floor={name:'Roof',x:0,z:.648,hw:11.16,hd:8.352,y:0,bottom:-.7,kind:'roof',solid:true,state:'solid',vx:0,vz:0};
  arena.pieces=[floor,...ROOFTOP_HULLS.map(h=>({...h,kind:'roof',solid:true,state:'solid',vx:0,vz:0}))];
  arena.spawn=[[-5.1,5.8],[3.6,5.8]];
  // Heights are sampled at the queried position, including continuous ramp surfaces.
  arena.floorAt=(x,z,maxY=Infinity)=>{
    let best=null;
    for(const p of arena.pieces) {
      if(!contains(p,x,z))continue;
      const y=topAt(p,x,z);
      if(y<=maxY+EPS && (!best||y>best.y))best={...p,y};
    }
    return best;
  };
  arena.resolveMotion=(f,previous,radius,events=[])=>{
    const endX=f.x,endZ=f.z;
    f.x=previous.x;f.z=previous.z;
    const count=Math.max(1,Math.ceil(Math.hypot(endX-f.x,endZ-f.z)/.12));
    const dx=(endX-f.x)/count,dz=(endZ-f.z)/count;
    let feet=previous.y;
    for(let i=0;i<count;i++)for(const [axis,delta] of [['x',dx],['z',dz]]) {
      const nx=f.x+(axis==='x'?delta:0),nz=f.z+(axis==='z'?delta:0);
      const currentSupport=previous.grounded?arena.floorAt(f.x,f.z,feet+EPS):null;
      const slopeAllowance=currentSupport?.slopeZ ? Math.abs(currentSupport.slopeZ)*radius : /stair|step-up/.test(currentSupport?.name||'') ? radius : 0;
      const allowed=feet+(previous.grounded?STEP+slopeAllowance:0);
      const blocker=arena.pieces.slice(1).some(p=>{
        if(!contains(p,nx,nz,radius))return false;
        // Stair risers are stepped at the feet, not at the capsule's forward rim.
        if(previous.grounded && /stair|step-up/.test(p.name) && !contains(p,nx,nz))return false;
        const px=Math.max(p.x-p.hw,Math.min(p.x+p.hw,nx)),pz=Math.max(p.z-p.hd,Math.min(p.z+p.hd,nz));
        // A circle against the box avoids invisible square corners around cylindrical fighters.
        if(Math.hypot(nx-px,nz-pz)>radius+EPS)return false;
        return topAt(p,px,pz)>allowed+EPS && p.bottom<Math.max(feet,f.y)+HEIGHT-EPS;
      });
      if(blocker)f[axis==='x'?'vx':'vz']=0;
      else {
        f[axis]=axis==='x'?nx:nz;
        if(previous.grounded) {
          const support=arena.floorAt(f.x,f.z,feet+STEP);
          if(support && support.y>=feet-STEP)feet=support.y;
        }
      }
    }
    // Walk up ramps and short risers; leaving a ledge starts an ordinary fall.
    const support=arena.floorAt(f.x,f.z,previous.grounded?feet+EPS:previous.y+EPS);
    if(previous.grounded && support && Math.abs(support.y-feet)<=STEP && f.vy<=0) {
      f.y=support.y;f.vy=0;f.grounded=true;return;
    }
    f.grounded=false;
    if(support && f.vy<=0 && previous.y>=support.y-EPS && f.y<=support.y) {
      events.push({type:'landing',team:f.team,speed:-f.vy});
      f.y=support.y;f.vy=0;f.grounded=true;
    }
    // Hit the underside of an elevated solid rather than passing through its ceiling.
    if(f.vy>0)for(const p of arena.pieces.slice(1)) {
      if(contains(p,f.x,f.z) && previous.y+HEIGHT<=p.bottom && f.y+HEIGHT>=p.bottom) {
        f.y=p.bottom-HEIGHT;f.vy=0;
      }
    }
  };
}
