// Concert grand footprint and 88-key keyboard, in world meters.
export const PIANO_OUTLINE=[[-42,24],[42,24],[42,8],[41,3],[38,-2],[33,-6],[26,-9],[20,-13],[17,-20],[15,-28],[11,-35],[5,-40],[-4,-43],[-17,-44],[-29,-42],[-38,-37],[-42,-30]];
export const PIANO_KEYS=[];
let whiteIndex=0;
for(let midi=21;midi<=108;midi++){
 const black=[1,3,6,8,10].includes(midi%12);
 const x=-42+(black?whiteIndex:whiteIndex+.5)*84/52;
 if(!black)whiteIndex++;
 PIANO_KEYS.push({name:`Piano key ${midi}`,midi,black,x,z:black?18.6:22.5,hw:black?.49:84/104-.025,hd:black?2.6:6,y:black?.72:.12,bottom:-.3,color:black?'#101114':'#f5f0df'});
}
export function pianoSpan(z){
 const xs=[];
 for(let i=0;i<PIANO_OUTLINE.length;i++){
  const a=PIANO_OUTLINE[i],b=PIANO_OUTLINE[(i+1)%PIANO_OUTLINE.length];
  if((a[1]<=z&&b[1]>z)||(b[1]<=z&&a[1]>z))xs.push(a[0]+(z-a[1])*(b[0]-a[0])/(b[1]-a[1]));
 }
 return xs.length?[Math.min(...xs),Math.max(...xs)]:null;
}
export const PIANO_LAYOUT=[{name:'Navigation bounds',x:0,z:-7,hw:42,hd:37,y:0,bottom:-1.5,solid:false}];
// The soundboard is scenery; only the keyboard is playable.
export const PIANO_BACK_WALL_Z=16.025; // Front face of the fallboard.
// Cosmetic seams between white keys must not become holes under fighters.
PIANO_LAYOUT.push(...PIANO_KEYS.map(k=>({...k,hw:k.black?k.hw:k.hw+.025})));
export const PIANO_SPAWNS=[[-3.5,25],[3.5,25]];
