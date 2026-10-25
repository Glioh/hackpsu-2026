import * as T from 'three';
import {SUMMIT_RIM} from '../../shared/quake-layout.js';

export function createQuakeView(scene){
  const root=new T.Group(),mountain=new T.Group();root.name='Earthquake Summit';mountain.name='Shaking mountain';root.add(mountain);scene.add(root);root.visible=false;
  const mesh=(geometry,color,parent=mountain)=>{
    const m=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:1,flatShading:true}));
    m.castShadow=m.receiveShadow=true;parent.add(m);return m;
  };
  const shape=new T.Shape(SUMMIT_RIM.map(([x,z])=>new T.Vector2(x,-z)));
  const top=mesh(new T.ShapeGeometry(shape),'#b6ab8b');top.name='Summit floor';top.rotation.x=-Math.PI/2;
  // Layered rock faces descend far below the playable summit, without a raised fence.
  const layers=[[1,0],[1.12,-2],[1.6,-10],[2.1,-24],[2.8,-42]],positions=[],colors=[];
  const palette=['#777f80','#89908a','#626e76','#96968a'];
  for(let layer=0;layer<layers.length-1;layer++)for(let i=0;i<SUMMIT_RIM.length;i++){
    const j=(i+1)%SUMMIT_RIM.length;
    const point=(index,l)=>{const [scale,y]=layers[l],[x,z]=SUMMIT_RIM[index];return [x*scale,y,z*scale];};
    const a=point(i,layer),b=point(j,layer),c=point(i,layer+1),d=point(j,layer+1);
    const color=new T.Color(palette[(i+layer)%palette.length]);
    for(const p of [a,b,c,b,d,c]){positions.push(...p);colors.push(color.r,color.g,color.b);}
  }
  const rock=new T.BufferGeometry();rock.setAttribute('position',new T.Float32BufferAttribute(positions,3));rock.setAttribute('color',new T.Float32BufferAttribute(colors,3));rock.computeVertexNormals();
  const cliffs=mesh(rock,'#ffffff');cliffs.name='Summit cliffs';cliffs.material.vertexColors=true;
  // Thin fissures pulse amber before and during tremors; these are solid stone.
  const cracks=[];
  for(let i=0;i<7;i++){
    const crack=mesh(new T.BoxGeometry(.055,.012,2.2+i%3),'#655848');
    crack.position.set(Math.cos(i*2.4)*(2+i%3),.015,Math.sin(i*2.4)*(1+i%3));crack.rotation.y=i*1.7;cracks.push(crack);
  }
  // Distant snowy peaks and a low cloud belt establish the height of the summit.
  for(let i=0;i<9;i++){
    const angle=i*Math.PI*2/9,x=Math.cos(angle)*38,z=Math.sin(angle)*38;
    const peak=mesh(new T.ConeGeometry(10+i%3,24+i%4*3,5),'#7f96a6',root);peak.position.set(x,-19,z);
    const snow=mesh(new T.ConeGeometry(3.1,7.5,5),'#eff4eb',root);snow.position.set(x,peak.position.y+(24+i%4*3)/2-3.7,z);
  }
  for(let i=0;i<14;i++){
    const angle=i*Math.PI/7,puff=mesh(new T.SphereGeometry(3.5,12,8),'#e3edf0',root);
    puff.position.set(Math.cos(angle)*(17+i%3*3),-9-i%3,Math.sin(angle)*(17+i%3*3));puff.scale.set(1.8,.3,1);puff.castShadow=false;
  }
  return arena=>{
    root.visible=arena.id==='quake';if(!root.visible)return;
    const s=arena.shake,t=arena.time;
    mountain.position.set(Math.sin(t*43)*s*.1,Math.sin(t*51)*s*.04,Math.cos(t*47)*s*.1);
    mountain.rotation.z=Math.sin(t*39)*s*.006;
    for(const crack of cracks){crack.material.emissive.set(arena.warning||s>.5?'#ffad49':'#000000');crack.material.emissiveIntensity=(.5+.5*Math.sin(t*12))*s;}
  };
}
