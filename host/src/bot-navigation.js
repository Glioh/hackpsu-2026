// Lazy navigation graph. Each edge is checked against the same collision resolver
// that moves fighters, so stairs, slopes, equipment and body clearance agree.
const GRID=.5, EPS=.025;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

class Heap {
  values=[];
  push(value) {const a=this.values;a.push(value);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].score<=value.score)break;a[i]=a[p];i=p;}a[i]=value;}
  pop(){const a=this.values,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].score<a[c].score)c++;if(a[c].score>=last.score)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
}

export function createTerrainNavigator(arena,radius) {
  const nodes=new Map(),edges=new Map(),bounds=arena.navigationBounds??arena.pieces[0],clearance=radius+.1;
  const safe=p=>Math.abs(p.x-bounds.x)<bounds.hw-clearance-.2&&Math.abs(p.z-bounds.z)<bounds.hd-clearance-.2&&
    (!arena.navigationFloorClearance||Array.from({length:8},(_,i)=>{
      const a=i*Math.PI/4;
      return arena.floorAt(p.x+Math.cos(a)*(clearance+.15),p.z+Math.sin(a)*(clearance+.15));
    }).every(Boolean));
  function node(ix,iz,height) {
    const key=ix+','+iz+(height===undefined?'':','+height);if(nodes.has(key))return nodes.get(key);
    const x=ix*GRID,z=iz*GRID,floor=height===undefined?arena.floorAt(x,z):{y:height};
    const value=floor&&safe({x,z})?{key,ix,iz,x,z,y:floor.y}:null;nodes.set(key,value);return value;
  }
  function nodesAt(ix,iz){
    const key='surfaces:'+ix+','+iz;if(nodes.has(key))return nodes.get(key);
    const values=arena.navigationFloors?arena.navigationFloors(ix*GRID,iz*GRID).map(y=>node(ix,iz,y)).filter(Boolean):[node(ix,iz)].filter(Boolean);
    nodes.set(key,values);return values;
  }
  function canTravel(a,b) {
    if(!safe(b)||b.y-a.y>1.6||a.y-b.y>3)return false;
    const f={...a,x:b.x,z:b.z,y:a.y,grounded:true,vx:0,vz:0,vy:0};
    arena.resolveMotion(f,{...a,grounded:true},clearance);
    return distance(f,b)<EPS&&(Math.abs(f.y-b.y)<.41 || (!f.grounded&&b.y<a.y));
  }
  function near(point) {
    const list=[],ix=Math.round(point.x/GRID),iz=Math.round(point.z/GRID);
    for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++) {
      for(const n of nodesAt(ix+x,iz+z))if(Math.abs(n.y-point.y)<.5)list.push(n);
    }
    return list.sort((a,b)=>distance(a,point)-distance(b,point));
  }
  function neighbours(n) {
    if(edges.has(n.key))return edges.get(n.key);
    const result=[];
    for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)if(x||z) {
      for(const next of nodesAt(n.ix+x,n.iz+z))if(canTravel(n,next))result.push(next);
    }
    edges.set(n.key,result);return result;
  }
  return {
    canTravel,
    route(from,target) {
      const start=near(from).find(n=>canTravel(from,n));if(!start)return [];
      const goals=near(target).filter(n=>canTravel(n,target));
      const goalKeys=new Set(goals.map(n=>n.key));
      const heuristic=n=>distance(n,target)+Math.abs(n.y-target.y)*2;
      const open=new Heap(),cost=new Map([[start.key,0]]),parent=new Map(),closed=new Set();
      let best=start;open.push({node:start,score:heuristic(start)});
      while(open.values.length) {
        const n=open.pop().node;if(closed.has(n.key))continue;closed.add(n.key);
        if(heuristic(n)<heuristic(best))best=n;
        if(goalKeys.has(n.key)){best=n;break;}
        for(const next of neighbours(n)) {
          if(closed.has(next.key))continue;
          const value=cost.get(n.key)+distance(n,next)+Math.abs(n.y-next.y)*.25;
          if(value>=(cost.get(next.key)??Infinity))continue;
          cost.set(next.key,value);parent.set(next.key,n);open.push({node:next,score:value+heuristic(next)});
        }
      }
      const path=[];for(let n=best;n;n=parent.get(n.key))path.unshift(n);
      if(goalKeys.has(best.key)&&canTravel(best,target))path.push({...target});
      return path;
    },
  };
}
