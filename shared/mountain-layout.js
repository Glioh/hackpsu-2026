// Shared visual/collision dimensions for Cloudpeak's original procedural terrain.
const block=(name,x,z,hw,hd,y,color,bottom=0)=>({name,x,z,hw,hd,y,bottom,color});
export const MOUNTAIN_LAYOUT=[
  block('Cliff courtyard',0,0,13,10,0,'#b4af94',-.65),
  block('Upper training terrace',0,-6,7,4,1.8,'#b7b49b'),
  block('West rear shoulder',-10,-8.7,3,1.3,1.8,'#9fa58c'),
  block('East rear shoulder',10,-8.7,3,1.3,1.8,'#9fa58c'),
  block('West meditation terrace',-9,1,3,3,.9,'#9fa58c'),
  {...block('West stone incline',-9,5.5,1.6,1.5,.45,'#b4af94'),slopeZ:-.3},
  ...Array.from({length:6},(_,i)=>block('Temple stair',0,.75-i*.5,2.3,.25,(i+1)*.3,'#c9c1a2')),
  block('Garden boulder',8.5,1.2,1.35,1.1,1.45,'#7f8e7c'),
  block('Garden boulder',10.5,2.1,.85,.85,.9,'#8f9a85'),
  block('Training dummy base',-3.8,3.2,.45,.45,.28,'#6a5541'),
  block('Training dummy trunk',-3.8,3.2,.2,.2,1.65,'#b48854',.28),
  block('Training dummy base',4,3.5,.45,.45,.28,'#6a5541'),
  block('Training dummy trunk',4,3.5,.2,.2,1.65,'#b48854',.28),
  block('Gong pillar',4.1,-6,.18,.18,4.3,'#913f35',1.8),
  block('Gong pillar',6.4,-6,.18,.18,4.3,'#913f35',1.8),
  block('Temple gate pillar',-2.9,-9.2,.26,.3,5.3,'#913f35',1.8),
  block('Temple gate pillar',2.9,-9.2,.26,.3,5.3,'#913f35',1.8),
];
