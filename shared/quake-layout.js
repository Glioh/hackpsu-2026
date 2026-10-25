// Flat, irregular summit rim; shared by the visible mountain and floor support.
export const SUMMIT_RIM=Array.from({length:12},(_,i)=>{
  const angle=i*Math.PI/6,r=[1,.93,1.03,.95,1,.92,1.02,.94,1,.96,1.04,.94][i];
  return [Math.cos(angle)*9*r,Math.sin(angle)*7*r];
});
export function onSummit(x,z){
  // Convex rim, ordered counterclockwise. Boundary points remain supported.
  return SUMMIT_RIM.every(([ax,az],i)=>{
    const [bx,bz]=SUMMIT_RIM[(i+1)%SUMMIT_RIM.length];
    return (bx-ax)*(z-az)-(bz-az)*(x-ax)>=-1e-8;
  });
}
