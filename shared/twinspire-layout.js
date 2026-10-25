// Physical solids in meters, shared by the game and the prototype model.
const block=(name,x,y,z,w,h,d,color)=>({name,x,z,y:y+h/2,bottom:y-h/2,hw:w/2,hd:d/2,color});
export const TWINSPIRE_SPAWNS=[[-13,0],[13,0]];
export const TWINSPIRE_BRIDGES={centers:[-3,4],length:6.4,width:4.8,fenceHeight:1.5,fenceThickness:.14};
export const TWINSPIRE_LAYOUT=[];
for(const x of [-11,11]) {
  TWINSPIRE_LAYOUT.push(
    block('Roof slab',x,-.25,0,16.4,.5,20.4,'#c7c9b9'),
    block('Access penthouse',x-2,1.5,-7,5,3,4,'#c7c9b9'),
    block('Penthouse cap',x-2,3.07,-7,5.3,.15,4.3,'#253e49'),
    block('Raised service deck',x+4,.45,-7,4,.9,4,'#536e73'),
    block('HVAC housing',x+4,1.55,-7,2.7,1.3,2.4,'#a5b2a8'),
  );
  for(let i=0;i<4;i++)TWINSPIRE_LAYOUT.push(block('Service stairs',x+4,.1125*(i+1),-3.9-i*.43,2,.225*(i+1),.44,'#c7c9b9'));
}
const {centers,length,width,fenceHeight,fenceThickness}=TWINSPIRE_BRIDGES;
for(const z of centers) {
  TWINSPIRE_LAYOUT.push(block('Steel skybridge',0,-.19,z,length,.38,width,'#253e49'));
  for(const side of [-1,1])TWINSPIRE_LAYOUT.push(block('Bridge safety fence',0,fenceHeight/2,z+side*(width/2-fenceThickness/2),length,fenceHeight,fenceThickness,'#536e73'));
}
