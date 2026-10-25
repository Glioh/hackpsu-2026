// One outline drives the visible magma crust and its support boundary.
export const LAVA_OUTLINE = [
  [-9,-2.4],[-7.8,-4.6],[-5.1,-5.2],[-3.4,-6.4],[-.5,-5.9],
  [2.2,-6.3],[4.8,-5],[7.2,-4.7],[8.8,-2.3],[8.2,.1],
  [9,2.1],[6.8,4.5],[4,5.5],[1.7,5],[-.8,6],[-3.6,5.2],
  [-6,5.5],[-8.4,3.3],[-7.9,.8],
];
export const LAVA_LAKE_Y = -4;
export const LAVA_COLLAPSE = {start:10,interval:1.4,warning:2};
const core=LAVA_OUTLINE.map(([x,z])=>[x*.55,z*.55]);
export const LAVA_CHUNKS = [core,...LAVA_OUTLINE.map((point,i)=>{
  const next=(i+1)%LAVA_OUTLINE.length;
  return [core[i],point,LAVA_OUTLINE[next],core[next]];
})];
export const LAVA_HAZARDS = {
  vent: { radius:1.35, warning:1.2, linger:.8, damage:12, speed:7, lift:9 },
  bomb: { radius:1.8, warning:1.6, linger:1, damage:24, speed:10, lift:8 },
};

export function insideLava(x,z,margin=0,outline=LAVA_OUTLINE) {
  let inside=false;
  for(let i=0,j=outline.length-1;i<outline.length;j=i++) {
    const [ax,az]=outline[j],[bx,bz]=outline[i];
    const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
    const distance=Math.hypot(x-ax-t*dx,z-az-t*dz);
    if(distance<1e-8)return margin===0;
    if(distance<margin)return false;
    if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
  }
  return inside;
}
