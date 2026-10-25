import * as T from 'three';
import {createTrainSchedule} from '../../../shared/station-trains.js';

// Standalone environment study, in meters. X runs along the tracks; +Z is front.
export function createStation({random=Math.random}={}) {
  const root=new T.Group(); root.name='CROSSLINE / station concept';
  const materials=new Map();
  const mat=c=>{if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.72}));return materials.get(c);};
  function box(name,x,y,z,w,h,d,c,parent=root){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(c));m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const teal='#286c69',cream='#c9c5ad',dark='#293c44',yellow='#efb950';
  box('Cutaway station foundation',0,-1.3,0,39,1.2,29,'#4d6065');
  box('Island fighting platform',0,-.35,0,30,1.7,11,cream);
  box('Platform stone surface',0,.54,0,30,.08,11,'#b5baae');
  for(let x=-14;x<15;x+=1.5)box('Paving joint',x,.586,0,.025,.012,10.5,'#899891');
  for(const z of [-5.25,5.25]){
    box('Yellow tactile edge',0,.6,z,30,.06,.4,yellow);
    for(let x=-14.7;x<15;x+=.38)box('Tactile groove',x,.637,z,.06,.012,.32,'#b68e40');
  }
  for(const z of [-8,8]){
    box('Sunken track bed',0,-.48,z,72,.22,4.3,'#526167');
    for(let x=-35;x<=35;x+=.85)box('Track sleeper',x,-.3,z,.24,.18,3.4,'#766d60');
    for(const dz of [-1.1,1.1])box('Steel rail',0,-.12,z+dz,72,.22,.13,'#a7b4b6');
    box('Outer station platform',0,-.1,z*1.55,38,1.2,4.4,'#82928c');
    box('Outer platform edge',0,.54,z*1.3,38,.06,.24,yellow);
  }
  // Different elevations interrupt the central fighting space without enclosing it.
  box('West raised waiting terrace',-9,1.18,-1,8,1.2,5.5,teal);
  box('West terrace coping',-9,1.83,-1,8.2,.12,5.7,cream);
  for(let i=0;i<5;i++){
    const top=.58+(i+1)*.25;
    box('West broad stair',-9,(top+.58)/2,4-i*.48,3.7,top-.58,.49,cream);
    box('West stair nosing',-9,top+.02,4.2-i*.48,3.7,.035,.07,yellow);
  }
  box('East luggage podium',9,.99,1.8,5,.82,3.4,'#9ba89a');
  for(let i=0;i<3;i++)box('Podium stair',5.5+i*.5,.58+(i+1)*.14,1.8,.5,(i+1)*.28,2,cream);
  // A walkable bridge crosses the arena and both train lines, at 4.8m.
  box('Overhead transfer footbridge',2,4.63,0,3.8,.34,27,teal);
  box('Footbridge walkway',2,4.83,0,3.6,.06,27,cream);
  for(const x of [.12,3.88])for(const z of [-10.5,-7,7,10.5])box('Bridge guard post',x,5.32,z,.1,1,.1,dark);
  for(const x of [.12,3.88])for(const z of [-9,9])box('Bridge handrail',x,5.82,z,.1,.1,9,dark);
  for(const z of [-11.8,11.8])for(const x of [.4,3.6])box('Bridge pier',x,2.65,z,.42,4.3,.42,teal);
  // Stairs rise along X; clear space beneath the bridge remains visible.
  for(let i=0;i<14;i++){
    const top=.58+(i+1)*(4.28/14);
    box('Transfer staircase',-6.6+i*.52,(top+.58)/2,-3.5,.53,top-.58,2.4,cream);
    box('Transfer stair edge',-6.82+i*.52,top+.02,-3.5,.065,.03,2.4,yellow);
  }
  box('Upper stair landing',1.2,4.66,-3.5,2.2,.34,2.4,teal);
  for(const [x,z,y] of [[-10,-1,1.9],[10,-2,.6]]){
    box('Bench seat',x,y+.55,z,3.2,.18,.8,'#ae7951');
    box('Bench back',x,y+1,z-.38,3.2,.8,.12,'#ae7951');
    for(const dx of [-1.2,1.2])box('Bench leg',x+dx,y+.25,z,.12,.5,.65,dark);
  }
  box('Ticket machine',-12,2.7,-2.4,1,1.7,.7, yellow);
  box('Ticket display',-12,2.95,-2.035,.7,.5,.04,dark);
  for(const [x,z] of [[7,-2],[10,2]]){
    box('Luggage stack',x,1.1,z,1.1,1,.8,'#b77652');
    box('Luggage handle',x,1.67,z,.4,.12,.12,dark);
  }
  // Open steel ribs suggest a train hall without a roof obscuring the map.
  for(const x of [-17,17]){
    for(const z of [-13,13])box('Hall column',x,4.4,z,.55,8,.55,teal);
    box('Hall crossbeam',x,8.5,0,.65,.5,27,teal);
    for(const z of [-8,0,8])box('Warm hall luminaire',x,8.17,z,.8,.12,2,'#ffe4a4');
  }
  const signals=[];
  for(const [x,z] of [[-16,-6],[16,6]]){
    box('Signal mast',x,1.8,z,.15,3.6,.15,dark);
    box('Signal housing',x,3.4,z,.5,1,.4,dark);
    const lamp=box('Arrival warning lamp',x,3.6,z+.23,.28,.28,.08,'#75d9b4');
    lamp.material=lamp.material.clone();lamp.userData.stationSignal=signals.length;signals.push(lamp);
  }
  for(const [x,z,y,c] of [[-4,1,.6,'#e87b60'],[8,1.8,1.4,'#67b9ce']]){
    const body=new T.Mesh(new T.CapsuleGeometry(.3,.65,4,8),mat(c));body.name='Fighter scale reference';body.position.set(x,y+1,z);root.add(body);
    for(const dx of [-.18,.18])box('Fighter feet',x+dx,y+.3,z,.22,.6,.3,dark);
  }
  const trains=[];
  for(const [z,color] of [[-8,'#d7a553'],[8,'#689d9a']]){
    const train=new T.Group();train.name=z<0?'Rear eastbound train':'Front westbound train';root.add(train);
    for(let car=0;car<3;car++){
      const x=(car-1)*10;
      box('Train carriage',x,1.65,0,9.5,2.7,3.3,color,train);
      box('Carriage roof',x,3.08,0,9.5,.2,3.4,cream,train);
      box('Train undercarriage',x,.24,0,8.6,.45,2.6,dark,train);
      for(const side of [-1,1]){
        for(const dx of [-3.4,-1.9,1.9,3.4])box('Passenger window',x+dx,2.05,side*1.67,1.05,.95,.06,'#25434e',train);
        box('Double carriage door',x,1.62,side*1.68,1.4,2.3,.08,teal,train);
        box('Door seam',x,1.62,side*1.73,.04,2.3,.02,cream,train);
        box('Carriage stripe',x,.68,side*1.68,9.4,.16,.06,yellow,train);
      }
      for(const dx of [-4.77,4.77])box('Cab windscreen',x+dx,2.1,0,.07,1,2.5,'#25434e',train);
      for(const dx of [-4.82,4.82])for(const dz of [-1,1])box('Train headlight',x+dx,1.1,dz,.06,.27,.36,'#ffe9b3',train);
    }
    train.position.z=z;train.userData.stationTrain=trains.length;trains.push(train);
  }
  // Expand the footprint while preserving heights and human-scale props/trains.
  const footprintScale=1.4;
  for(const child of root.children){
    child.position.x*=footprintScale;child.position.z*=footprintScale;
    if(child.isMesh&&!/Bench|Ticket|Luggage stack|Luggage handle|Signal|Arrival warning|Fighter/i.test(child.name)){
      child.scale.x*=footprintScale;child.scale.z*=footprintScale;
    }
  }
  root.userData={prototype:true,platformWidth:42,platformDepth:15.4,platformHeight:.58,terraceHeight:1.89,bridgeHeight:4.86,trackCenters:[-11.2,11.2]};
  // Each line independently chooses a fresh 5–18 second clear gap after a pass.
  const schedule=createTrainSchedule(random);
  function update(time){const states=schedule(time);trains.forEach((train,i)=>{
    const state=states[i];train.visible=state.passing;train.position.x=state.x;
    signals[i].material.color.set(state.warning?'#ffb64d':state.passing?'#ee6452':'#75d9b4');
  });return states;}
  update(0);return {root,trains,update};
}
