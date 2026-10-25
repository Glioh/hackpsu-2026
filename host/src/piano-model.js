import * as T from 'three';
import {PIANO_OUTLINE,PIANO_KEYS,PIANO_SPAWNS} from '../../shared/piano-layout.js';
export function createPiano(){
 const root=new T.Group();root.name='FORTE / concert grand piano';const keys=[];
 const ebony=new T.MeshPhysicalMaterial({color:'#090b10',roughness:.16,metalness:.18,clearcoat:1,clearcoatRoughness:.08});
 const gold=new T.MeshStandardMaterial({color:'#bc9247',metalness:.78,roughness:.28});
 const wood=new T.MeshStandardMaterial({color:'#ac7542',roughness:.48});
 const ivory=new T.MeshPhysicalMaterial({color:'#f5f0df',roughness:.26,clearcoat:.5});
 const felt=new T.MeshStandardMaterial({color:'#752a30',roughness:1});
 function mesh(name,g,material,x=0,y=0,z=0){const m=new T.Mesh(g,material);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
 const box=(name,x,y,z,w,h,d,material)=>mesh(name,new T.BoxGeometry(w,h,d),material,x,y,z);
 const shape=new T.Shape();PIANO_OUTLINE.forEach(([x,z],i)=>shape[i?'lineTo':'moveTo'](x,-z));shape.closePath();
 const caseMesh=mesh('Polished grand case',new T.ExtrudeGeometry(shape,{depth:2,bevelEnabled:true,bevelSize:.12,bevelThickness:.12,bevelSegments:3}),ebony,0,-2.15);caseMesh.rotation.x=-Math.PI/2;
 const board=mesh('Maple soundboard',new T.ShapeGeometry(shape),wood,0,0);board.rotation.x=-Math.PI/2;
 // Rim follows the asymmetric grand silhouette; the keyboard edge stays open.
 const points=PIANO_OUTLINE.slice(2).concat([PIANO_OUTLINE[0]]).map(([x,z])=>new T.Vector3(x,.28,z));
 const rim=mesh('Continuous lacquer rim',new T.TubeGeometry(new T.CatmullRomCurve3(points,false,'centripetal'),160,.24,8,false),ebony);
 mesh('Brass case beading',new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>p.clone().add(new T.Vector3(0,-.15,0))),false,'centripetal'),160,.045,6,false),gold);
 for(const k of PIANO_KEYS){const key=box(k.name,k.x,(k.y+k.bottom)/2,k.z,k.hw*2,k.y-k.bottom,k.hd*2,k.black?ebony.clone():ivory.clone());key.userData={midi:k.midi,key:true};keys.push(key);}
 for(const x of [-42.7,42.7])box('Keyboard cheek block',x,0,22,1.3,1.5,14,ebony);
 box('Key front rail',0,-.6,28.8,86,1.3,.6,ebony);
 box('Red felt key strip',0,.16,16.25,83,.08,.18,felt);
 box('Fallboard',0,.65,15.8,84,1.3,.45,ebony);
 // Fine strings fan out across the gold plate, with tuning pins at the front.
 for(let i=0;i<76;i++){
  const x=-39+i*.91,endZ=-29+Math.max(0,x+10)*.5;
  const curve=new T.LineCurve3(new T.Vector3(x,.055,14.8),new T.Vector3(x*.72-8,.055,endZ));
  mesh('Copper wound string',new T.TubeGeometry(curve,1,i<22?.035:.018,4,false),gold);
  box('Tuning pin',x,.16,14.9,.08,.24,.12,gold);
 }
 for(const [x,z,w] of [[-7,-22,51],[-2,-8,65],[0,12,80]])box('Cast brass plate crossbar',x,.06,z,w,.1,.38,gold);
 for(const [x,z] of [[-22,-18],[-5,-11],[14,-4]]){const ring=mesh('Plate sound hole',new T.RingGeometry(1.1,1.3,40),gold,x,.12,z);ring.rotation.x=-Math.PI/2;}
 // A partially raised, full silhouette lid is hinged along the straight bass side.
 const lidGroup=new T.Group();lidGroup.name='Raised grand lid';lidGroup.position.set(-42,1,-8);root.add(lidGroup);
 const lidShape=new T.Shape();PIANO_OUTLINE.forEach(([x,z],i)=>lidShape[i?'lineTo':'moveTo'](x,-Math.min(15.5,z)));lidShape.closePath();
 const lidGeometry=new T.ExtrudeGeometry(lidShape,{depth:.45,bevelEnabled:true,bevelSize:.12,bevelThickness:.08,bevelSegments:2});lidGeometry.rotateX(-Math.PI/2);lidGeometry.translate(42,0,8);
 const lid=new T.Mesh(lidGeometry,ebony);lid.castShadow=true;lidGroup.add(lid);lidGroup.rotation.z=.42;
 const stick=box('Lid prop',24,15,-11,.23,30,.23,ebony);stick.rotation.z=-.25;
 // Music desk and three tapered legs complete the recognizable instrument.
 box('Music desk foot',0,1.1,11,15,.25,2.5,ebony);
 const desk=box('Music desk',0,3.5,10.5,14,4.2,.28,ebony);desk.rotation.x=-.3;
 box('Music ledge',0,1.6,11.2,14,.2,.8,gold);
 for(const [x,z] of [[-38,22],[38,22],[-18,-36]]){
  const leg=mesh('Tapered concert leg',new T.CylinderGeometry(.95,.48,13,8),ebony,x,-8.5,z);
  mesh('Brass leg ferrule',new T.CylinderGeometry(.5,.5,.65,16),gold,x,-15,z);
  const wheel=mesh('Caster wheel',new T.CylinderGeometry(.6,.6,.45,20),gold,x,-15.65,z);wheel.rotation.z=Math.PI/2;
 }
 for(const x of [-2,2])box('Pedal lyre upright',x,-8,23,.35,11,.4,ebony);
 box('Pedal lyre base',0,-13,23,5,.6,1.4,ebony);
 for(const x of [-1.5,0,1.5])box('Brass pedal',x,-13.3,24.5,.7,.25,2.5,gold);
 const spawns=PIANO_SPAWNS.map(([x,z],i)=>({team:i?'blue':'red',x,z,y:.12,facing:i?-Math.PI/2:Math.PI/2}));
 root.userData={prototype:false,spawns,width:84,keys:88};root.updateMatrixWorld(true);
 return {root,spawns,keys};
}
