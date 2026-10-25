import * as T from 'three';
import {MOUNTAIN_LAYOUT} from '../../shared/mountain-layout.js';
import {createRooftopVisibility} from './rooftop-visibility.js';

export function createMountainView(scene) {
  const root=new T.Group();root.name='Cloudpeak / mountain kung fu arena';root.visible=false;scene.add(root);
  const clouds=[];
  const terrain=new T.Group();root.add(terrain);const materials=new Map(),flags=[];
  const mat=color=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.88}));return materials.get(color);};
  function mesh(name,g,color,x,y,z,parent=terrain) {
    const m=new T.Mesh(g,mat(color));m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
  }
  const box=(name,x,y,z,w,h,d,color,parent)=>mesh(name,new T.BoxGeometry(w,h,d),color,x,y,z,parent);
  const cylinder=(name,x,y,z,r,h,color,r2=r,parent)=>mesh(name,new T.CylinderGeometry(r2,r,h,10),color,x,y,z,parent);
  // Build every playable solid from the same dimensions that drive physics.
  for(const p of MOUNTAIN_LAYOUT) {
    if(p.slopeZ) {
      const shape=new T.Shape();shape.moveTo(-p.hd,0);shape.lineTo(p.hd,0);shape.lineTo(-p.hd,p.y*2);shape.closePath();
      const g=new T.ExtrudeGeometry(shape,{depth:p.hw*2,bevelEnabled:false});g.rotateY(-Math.PI/2);g.translate(p.hw,0,0);
      mesh(p.name,g,p.color,p.x,0,p.z);
    } else if(p.name==='Garden boulder') {
      const g=new T.IcosahedronGeometry(1,1);g.computeBoundingBox();
      const size=g.boundingBox.getSize(new T.Vector3());g.scale(p.hw*2/size.x,(p.y-p.bottom)/size.y,p.hd*2/size.z);
      mesh(p.name,g,p.color,p.x,(p.y+p.bottom)/2,p.z);
    } else {
      box(p.name,p.x,(p.y+p.bottom)/2,p.z,p.hw*2,Math.max(.03,p.y-p.bottom),p.hd*2,p.color);
    }
  }
  // A warm stone court with joints and a carved circular sparring medallion.
  const medallion=mesh('Sparring circle',new T.RingGeometry(2.1,2.18,64),'#d8cb9b',0,.023,4.4);medallion.rotation.x=-Math.PI/2;
  const disc=(name,r,x,z,color,start=0,length=Math.PI*2,y=.026)=>{
    const m=mesh(name,new T.CircleGeometry(r,48,start,length),color,x,y,z);m.rotation.x=-Math.PI/2;return m;
  };
  disc('Taiji dark stone',1.55,0,4.4,'#5c7164');
  disc('Taiji light stone',1.55,0,4.4,'#d3c69f',0,Math.PI,.028);
  disc('Taiji light curve',.775,-.775,4.4,'#d3c69f',0,Math.PI*2,.03);
  disc('Taiji dark curve',.775,.775,4.4,'#5c7164',0,Math.PI*2,.032);
  disc('Taiji dark dot',.17,-.775,4.4,'#5c7164',0,Math.PI*2,.034);
  disc('Taiji light dot',.17,.775,4.4,'#d3c69f',0,Math.PI*2,.034);
  for(const z of [-9.87,9.87])box('Courtyard stone border',0,.019,z,25.8,.025,.18,'#d1c8a8');
  for(const x of [-12.87,12.87])box('Courtyard stone border',x,.019,0,.18,.025,19.8,'#d1c8a8');
  for(let i=0;i<16;i++) {
    const x=(i%2?1:-1)*(10.5+(i%3)*.45),z=-5+(i*2.3%12);
    const moss=mesh('Stone moss',new T.CircleGeometry(.35+i%3*.08,6),'#86966c',x,.025,z);moss.rotation.x=-Math.PI/2;
  }
  for(let i=0;i<6;i++)box('Worn stair nosing',0,.3*(i+1)+.018,.94-i*.5,4.5,.025,.08,'#e1cf9f');
  // Cliff support has sheer sides: a knocked-off fighter never finds a lower ledge.
  const cliff=mesh('Faceted cliff',new T.CylinderGeometry(14.5,9.5,26,9),'#637b71',0,-13.7,0,root);cliff.scale.z=.78;cliff.rotation.y=.18;
  for(let i=0;i<8;i++) {
    const angle=i*Math.PI/4,rock=mesh('Cliff rock rib',new T.ConeGeometry(3,18,5),'#708578',Math.cos(angle)*8,-14,Math.sin(angle)*6,root);
    rock.rotation.z=Math.sin(i)*.15;
  }
  // Vermilion mountain gate and curved layered roof, placed at the back edge.
  box('Gate lintel',0,5.25,-9.2,7,.45,.7,'#913f35');
  for(let tier=0;tier<3;tier++) {
    const w=8-tier*.7,y=5.55+tier*.24;
    box('Temple jade roof',0,y,-9.2,w,.16,2.2-tier*.35,'#3b665c');
    for(const side of [-1,1]){const eave=box('Upturned roof tip',side*(w/2-.2),y+.14,-9.2,.85,.15,2.2-tier*.35,'#3b665c');eave.rotation.z=side*.28;}
  }
  box('Gate plaque',0,4.65,-8.77,1.8,.55,.09,'#cfab60');
  // Bronze gong; frame poles already have solid collision hulls.
  box('Gong frame',5.25,4.3,-6,2.8,.22,.3,'#913f35');
  mat('#c69d51').metalness=.78;mat('#c69d51').roughness=.32;
  mat('#e2be70').metalness=.8;mat('#e2be70').roughness=.26;
  const gong=cylinder('Bronze gong',5.25,3.2,-6,.85,.12,'#c69d51');gong.rotation.x=Math.PI/2;
  const boss=cylinder('Gong boss',5.25,3.2,-5.9,.23,.14,'#e2be70');boss.rotation.x=Math.PI/2;
  for(const x of [4.8,5.7])box('Gong suspension',x,3.98,-6,.035,.55,.035,'#6a5541');
  for(const x of [-3.8,4])for(const y of [.8,1.2])box('Wooden dummy arm',x,y,x<0?3.2:3.5,1.1,.12,.15,'#b48854');
  // Pennants sit on the upper terrace, outside the principal fighting lanes.
  for(const x of [-6.3,7.8]) {
    cylinder('Banner mast',x,3.25,-7.7,.06,3,'#695d44');
    const flag=box('Crimson training banner',x+.48,3.65,-7.7,.85,1.6,.045,'#ad5443');flags.push(flag);
    box('Banner gold hem',x+.48,2.9,-7.66,.85,.08,.025,'#d4ba72');
  }
  for(const x of [-11.8,11.8]) {
    cylinder('Stone lantern foot',x,.3,7.8,.42,.6,'#7d8c7a');
    box('Stone lantern light',x,.95,7.8,.65,.7,.65,'#ecd99b');
    const cap=mesh('Lantern cap',new T.ConeGeometry(.7,.4,4),'#566e61',x,1.5,7.8);cap.rotation.y=Math.PI/4;
  }
  // Sparse bamboo and windswept pines frame the arena without perimeter walls.
  for(const x of [-11.8,11.8])for(let i=0;i<4;i++) {
    const z=-5.8-i*.45,y=1.6+i*.3;
    cylinder('Bamboo stalk',x+i*.12,y,z,.045,y*2,'#66855c');
    for(let k=0;k<3;k++) {
      const leaf=mesh('Bamboo leaves',new T.ConeGeometry(.32,1.3,3),'#7c9862',x+.2+i*.12,1.4+k*.75,z);
      leaf.rotation.z=-.8;
    }
  }
  // Distant karst peaks and low cloud banks are presentation only.
  for(let i=0;i<24;i++) {
    const angle=i*2.399,dist=42+(i%4)*12,height=24+(i*13%28);
    const radius=9+i%5;
    const profile=[[.85,0],[1,.12],[.72,.38],[.52,.65],[.3,.88],[.06,1]].map(([r,y])=>new T.Vector2(radius*r,height*y-height/2));
    const peak=mesh('Distant mountain',new T.LatheGeometry(profile,7),'#6f958d',Math.cos(angle)*dist,-26+height/2,Math.sin(angle)*dist,root);
    peak.scale.z=.65;peak.rotation.y=i;peak.castShadow=peak.receiveShadow=false;
  }
  // Soft radial alpha banks, below the court. No depth writes or shadow work;
  // horizontal cards avoid billboard rotation and never veil the fighting lanes.
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const r=Math.hypot((x+ .5-size/2)/(size/2),(y+.5-size/2)/(size/2));
    const alpha=Math.pow(Math.max(0,1-r*r),2)*.3;
    data.set([220,232,218,Math.round(alpha*255)],(y*size+x)*4);
  }
  const mist=new T.DataTexture(data,size,size);mist.colorSpace=T.SRGBColorSpace;mist.magFilter=T.LinearFilter;mist.needsUpdate=true;
  const mistMaterial=new T.MeshBasicMaterial({map:mist,transparent:true,depthWrite:false,side:T.DoubleSide,fog:true});
  const mistGeometry=new T.PlaneGeometry(1,1);
  for(let i=0;i<16;i++) {
    const cloud=new T.Mesh(mistGeometry,mistMaterial);cloud.name='Valley mist';
    const x=Math.sin(i*5)*46,z=Math.cos(i*5)*46;
    cloud.position.set(x,-10-i%3*2,z);cloud.rotation.x=-Math.PI/2;cloud.scale.set(38+i%3*9,18+i%4*3,1);
    clouds.push({cloud,x,z});root.add(cloud);
  }
  // Tiny overlay details should not spend a shadow draw or cause court acne.
  terrain.traverse(m=>{if(m.isMesh&&/joint|moss|Taiji|circle|nosing/i.test(m.name))m.castShadow=false;});
  const visibility=createRooftopVisibility(terrain);
  return (active,time,fighters,camera)=>{
    root.visible=active;if(!active)return;
    clouds.forEach(({cloud,x,z},i)=>{cloud.position.x=x+Math.sin(time*.035+i)*3;cloud.position.z=z+Math.cos(time*.025+i)*2;});
    flags.forEach((f,i)=>{f.rotation.y=Math.sin(time*1.5+i)*.08;});
    if(camera)visibility(fighters,camera);
  };
}
