import * as T from 'three';
import {TWINSPIRE_LAYOUT,TWINSPIRE_BRIDGES} from '../../shared/twinspire-layout.js';

// Standalone review model. Roof level is Y=0; dimensions are meters.
export function createTwinspire({includePlayers=true}={}) {
  const root=new T.Group();root.name='TWINSPIRE / opposing rooftop arena';
  const materials=new Map();
  const mat=c=>{if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.72}));return materials.get(c);};
  function box(name,x,y,z,w,h,d,c){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(c));m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
  for(const p of TWINSPIRE_LAYOUT)box(p.name,p.x,(p.y+p.bottom)/2,p.z,p.hw*2,p.y-p.bottom,p.hd*2,p.color);
  const cream='#c7c9b9',dark='#253e49',gold='#edbd68';
  const spawns=[{team:'red',x:-13,z:0,y:0,facing:Math.PI/2},{team:'blue',x:13,z:0,y:0,facing:-Math.PI/2}];
  for(const [x,color,team] of [[-11,'#cf785e','red'],[11,'#65adbc','blue']]){
    box(`${team} tower`,x,-18.4,0,16,36,20,dark);
    for(let y=-35;y<-1;y+=2.2){
      box('Facade floor band',x,y,0,16.15,.15,20.15,'#4d6871');
      for(let dx=-7;dx<=7;dx+=2)for(const z of [-10.02,10.02])box('Window',x+dx,y+.95,z,1.3,1.35,.05,((dx+y)%3<1)?'#859e9e':'#d9c69a');
      for(let z=-8;z<=8;z+=2)for(const dx of [-8.02,8.02])box('Side window',x+dx,y+.95,z,.05,1.35,1.3,'#74949d');
    }
    box('Roof membrane',x,.025,0,15.8,.05,19.8,'#81938f');
    for(const z of [-9.7,9.7])box('Open edge caution',x,.065,z,16,.04,.25,gold);
    for(const dx of [-7.7,7.7])box('Open edge caution',x+dx,.065,0,.25,.04,19.6,gold);
    for(let z=-9;z<10;z+=2)box('Roof panel seam',x,.058,z,15.2,.012,.025,'#667e7c');
    // Rear utility structures leave the center and bridge approaches clear.
    box('Access door',x-2,1.1,-4.96,1.3,2.2,.07,color);
    box('Door lintel',x-2,2.45,-4.9,1.5,.14,.2,gold);
    for(let i=0;i<7;i++)box('HVAC louvers',x+3.05+i*.3,1.6,-5.78,.1,.8,.05,dark);
    box('Tower identity stripe',x,-1.2,10.12,15,.45,.08,color);
    box('Antenna mast',x-3.5,5,-7,.1,3.8,.1,dark);
    for(const y of [4.6,5.5,6.2])box('Antenna crossbar',x-3.5,y,-7,1.5,.08,.08,cream);
    const spawn=spawns.find(s=>s.team===team);
    const ring=new T.Mesh(new T.RingGeometry(1.05,1.2,48),mat(color));ring.rotation.x=-Math.PI/2;ring.position.set(spawn.x,.085,0);root.add(ring);
    box(`${team} spawn chevron`,spawn.x+(team==='red'?1.6:-1.6),.09,0,.5,.04,.65,color);
    if(includePlayers) {
      const body=new T.Mesh(new T.CapsuleGeometry(.3,.65,4,8),mat(color));body.name=`${team} player / facing opposing tower`;body.position.set(spawn.x,1,0);root.add(body);
      for(const dx of [-.18,.18])box('Fighter legs',spawn.x+dx,.3,0,.22,.6,.3,dark);
      box('Fighter visor',spawn.x+(team==='red'?.29:-.29),1.4,0,.08,.16,.36,dark);
    }
  }
  // Wide crossings with continuous physical fences and clear, open approaches.
  const {centers,length,width,fenceHeight,fenceThickness}=TWINSPIRE_BRIDGES;
  for(const z of centers){
    box('Skybridge grating',0,.025,z,length,.05,width-fenceThickness*2,'#a5b4ac');
    for(const side of [-1,1]){
      const edge=z+side*(width/2-fenceThickness/2);
      box('Bridge caution edge',0,.07,edge-side*.18,length,.04,.12,gold);
      box('Fence top rail',0,fenceHeight,edge,length,.1,.18,gold);
      for(let x=-length/2;x<=length/2+.01;x+=.4)box('Fence upright',x,fenceHeight/2,edge,.06,fenceHeight,.18,dark);
    }
    for(let x=-3;x<=3;x+=.4)box('Bridge transverse tread',x,.06,z,.035,.02,width-.6,'#607b7c');
    for(const x of [-2,0,2])box('Bridge underslung brace',x,-.6,z,.18,.8,width-.5,'#536e73');
    for(const side of [-1,1]){
      box('Bridge approach marking',side*4.3,.09,z,1.8,.04,.16,gold);
      for(const dz of [-.3,.3]){
        const arrow=box('Crossing direction chevron',side*3.65,.09,z+dz,.7,.04,.12,gold);
        arrow.rotation.y=side*Math.sign(dz)*Math.PI/4;
      }
    }
  }
  root.userData={spawns,roofHeight:0,gapWidth:6,prototype:true};
  return {root,spawns};
}
