import * as T from 'three';
import {LAVA_CHUNKS,LAVA_COLLAPSE,LAVA_LAKE_Y,LAVA_HAZARDS} from '../../shared/lava-layout.js';

const vertexShader=`varying vec2 vUv; varying vec3 vPosition;
  void main(){vUv=uv;vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const noise=`
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}`;

function moltenMaterial(time,crust=false) {
  return new T.ShaderMaterial({uniforms:{time,flowScale:{value:new T.Vector2(13,21)}},side:T.DoubleSide,vertexShader,
    fragmentShader:`varying vec2 vUv;varying vec3 vPosition;uniform float time;uniform vec2 flowScale;${noise}
    void main(){
      vec3 color;
      ${crust?`
      vec2 p=vPosition.xy*.72;vec2 cell=floor(p),f=fract(p);float first=10.,second=10.;
      for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
        vec2 n=vec2(float(x),float(y));
        vec2 seed=vec2(hash(cell+n),hash(cell+n+17.));
        float d=length(n+seed-f);
        if(d<first){second=first;first=d;}else second=min(second,d);
      }
      float crack=1.-smoothstep(.025,.10,second-first);
      float grain=noise(p*13.);
      color=mix(vec3(.065,.055,.065)+grain*.055,vec3(1.8,.23,.012)*(1.+.12*sin(time*1.5+p.x)),crack);
      `:`
      vec2 p=vUv*flowScale;p.y+=time*1.5;
      float flow=noise(p+noise(p*.45+time*.12)*2.5);
      float veins=sin(p.y*2.+noise(p)*4.);
      color=mix(vec3(.24,.008,.002),vec3(1.5,.24,.008),smoothstep(.19,.83,flow));
      color+=vec3(.35,.09,.005)*smoothstep(.7,1.,veins);
      `}
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
}

export function createLavaView(scene) {
  const root=new T.Group();root.name='Volcano Crucible';root.visible=false;scene.add(root);
  const time={value:0},molten=moltenMaterial(time),crust=moltenMaterial(time,true);
  const basalt=new T.MeshStandardMaterial({color:'#30272d',roughness:.95});
  const hot=new T.MeshStandardMaterial({color:'#ff6010',emissive:'#ff3c00',emissiveIntensity:1.8,roughness:.8});
  function mesh(geometry,material,parent=root) {
    const m=new T.Mesh(geometry,material);parent.add(m);return m;
  }
  const rimGeometry=new T.CylinderGeometry(.035,.075,1,5);
  const transform=new T.Object3D(),up=new T.Vector3(0,1,0),direction=new T.Vector3();
  const chunks=LAVA_CHUNKS.map(outline=>{
    const xs=outline.map(p=>p[0]),zs=outline.map(p=>p[1]);
    const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
    const group=new T.Group();group.name='Magma chunk';root.add(group);
    const shape=new T.Shape(outline.map(([px,pz])=>new T.Vector2(px-x,z-pz)));
    const slab=mesh(new T.ExtrudeGeometry(shape,{depth:1.7,bevelEnabled:false}),basalt,group);
    slab.name='Magma island';slab.rotation.x=-Math.PI/2;slab.position.y=-1.7;slab.receiveShadow=slab.castShadow=true;
    const surface=mesh(new T.ShapeGeometry(shape),crust,group);surface.name='Magma crust';surface.rotation.x=-Math.PI/2;surface.position.y=.006;
    const lower=mesh(new T.ShapeGeometry(shape),molten,group);lower.rotation.x=-Math.PI/2;lower.position.y=-1.72;
    const fracture=new T.LineLoop(new T.BufferGeometry().setFromPoints(outline.map(([px,pz])=>new T.Vector3(px-x,.025,pz-z))),
      new T.LineBasicMaterial({color:'#ffb340',transparent:true,opacity:.3}));
    group.add(fracture);
    outline.forEach(([px,pz],i)=>{
      const [nx,nz]=outline[(i+1)%outline.length];
      const lip=mesh(rimGeometry,hot,group);lip.position.set((px+nx)/2-x,-1.55,(pz+nz)/2-z);
      direction.set(nx-px,0,nz-pz);lip.quaternion.setFromUnitVectors(up,direction.clone().normalize());lip.scale.set(2,direction.length(),2);
    });
    return {group,fracture};
  });

  const lakeMaterial=moltenMaterial(time);lakeMaterial.uniforms.flowScale.value.set(110,140);
  const lake=mesh(new T.CircleGeometry(100,96),lakeMaterial);lake.name='Molten lake';lake.rotation.x=-Math.PI/2;lake.position.y=LAVA_LAKE_Y;
  const walls=new T.InstancedMesh(new T.CylinderGeometry(.65,1.1,1,5),basalt,52);walls.name='Crater walls';root.add(walls);
  for(let i=0;i<walls.count;i++) {
    const angle=.06+(i%26)/25*(Math.PI-.12),rear=i>=26,radius=rear?33:26;
    const height=15+8*(.5+.5*Math.sin(i*4.1))+(rear?8:0);
    transform.position.set(Math.cos(angle)*radius,height/2+LAVA_LAKE_Y-1,-Math.sin(angle)*radius);
    transform.rotation.set(Math.sin(i)*.1,i*2.4,Math.cos(i*2.1)*.1);transform.scale.set(3.6,height,3.7);transform.updateMatrix();walls.setMatrixAt(i,transform.matrix);
  }
  walls.receiveShadow=true;walls.computeBoundingSphere();

  const splashRings=[];
  for(const [x,height,z,width] of [[-18,17,-12,2.1],[-8,24,-19,2.8],[5,22,-20,3.2],[17,18,-13,2.4]]) {
    const geometry=new T.PlaneGeometry(width,height,4,24),positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++) {
      const y=positions.getY(i),progress=(y+height/2)/height;
      positions.setXYZ(i,positions.getX(i)*(1.15-progress*.35)+Math.sin(progress*8+x)*.35,y,Math.sin(progress*3)*1.3);
    }
    geometry.computeVertexNormals();
    const fall=mesh(geometry,molten);fall.name='Lava waterfall';fall.position.set(x,LAVA_LAKE_Y+height/2,z);
    const pool=mesh(new T.CircleGeometry(width*1.7,32),molten);pool.rotation.x=-Math.PI/2;pool.position.set(x,LAVA_LAKE_Y+.025,z);
    for(let j=0;j<2;j++) {
      const ring=mesh(new T.RingGeometry(.85,1,32),hot);ring.rotation.x=-Math.PI/2;ring.position.set(x,LAVA_LAKE_Y+.05+j*.025,z);splashRings.push({ring,width,offset:j*.5});
    }
  }

  const rockGeometry=new T.IcosahedronGeometry(1,0);
  const embers=new T.InstancedMesh(new T.OctahedronGeometry(1),hot,120);
  embers.name='Rising embers';root.add(embers);
  // The fixed pool moves continuously; disabling culling avoids stale animated bounds.
  embers.frustumCulled=false;embers.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const slots=Array.from({length:3},()=>{
    const group=new T.Group();group.name='Volcanic hazard';root.add(group);group.visible=false;
    const marker=mesh(new T.RingGeometry(.88,1,48),new T.MeshBasicMaterial({color:'#fff1ad',side:T.DoubleSide}),group);
    marker.rotation.x=-Math.PI/2;marker.position.y=.035;
    const disk=mesh(new T.CircleGeometry(1,48),new T.MeshBasicMaterial({color:'#ff4814',transparent:true,opacity:.3,depthWrite:false,side:T.DoubleSide}),group);
    disk.rotation.x=-Math.PI/2;disk.position.y=.025;
    const bomb=new T.Group();bomb.name='Volcanic bomb';group.add(bomb);
    mesh(rockGeometry,hot,bomb).scale.setScalar(.75);
    for(let i=0;i<7;i++) {
      const rock=mesh(rockGeometry,basalt,bomb);const a=i*2.399;
      rock.position.set(Math.cos(a)*.46,Math.sin(i*3.7)*.4,Math.sin(a)*.46);rock.scale.setScalar(.48);
    }
    const tail=mesh(new T.ConeGeometry(.6,4,7),hot,bomb);tail.position.y=2.1;
    const jet=mesh(new T.CylinderGeometry(.1,.85,1,10),molten,group);jet.position.y=.5;
    const shock=mesh(new T.RingGeometry(.7,1,32),new T.MeshBasicMaterial({color:'#ffcf74',transparent:true,depthWrite:false,side:T.DoubleSide}),group);
    shock.rotation.x=-Math.PI/2;shock.position.y=.065;
    const fragments=Array.from({length:10},()=>mesh(rockGeometry,hot,group));
    return {group,marker,disk,bomb,jet,shock,fragments};
  });
  let current=null;
  return (arena,clock=arena.time)=>{
    root.visible=arena.id==='lava';
    if(current!==arena){slots.forEach(s=>s.group.visible=false);current=arena;}
    if(!root.visible)return;
    time.value=clock;
    chunks.forEach(({group,fracture},i)=>{
      const p=arena.pieces[i],age=Math.max(0,arena.time-p.fallAt),length=Math.hypot(p.x,p.z)||1;
      const warning=p.state==='warn',rattle=warning?Math.sin(arena.time*55+i)*.025:0;
      group.visible=p.state!=='gone';
      group.position.set(p.x+p.x/length*age*.7+rattle,p.y,p.z+p.z/length*age*.7);
      group.rotation.set(p.z/length*age*.35,0,-p.x/length*age*.35);
      fracture.material.opacity=warning?.65+.35*Math.sin(arena.time*18):.25;
      group.scale.setScalar(warning?1+.003*(1-(p.fallAt-arena.time)/LAVA_COLLAPSE.warning):1);
    });
    for(const {ring,width,offset} of splashRings)ring.scale.setScalar(width*(.6+((clock*.6+offset)%1)*1.7));
    for(let i=0;i<embers.count;i++) {
      const phase=(clock*.06+i*.618)%1,angle=i*2.399,radius=10+(i%13)*1.4;
      transform.position.set(Math.cos(angle)*radius+Math.sin(clock+i)*.5,LAVA_LAKE_Y+phase*23,Math.sin(angle)*radius);
      transform.rotation.set(clock,i,0);transform.scale.setScalar(.025+(i%4)*.012);transform.updateMatrix();embers.setMatrixAt(i,transform.matrix);
    }
    embers.instanceMatrix.needsUpdate=true;
    for(let i=0;i<slots.length;i++) {
      const s=slots[i],h=arena.volcanicHazards[i];s.group.visible=!!h;if(!h)continue;
      const settings=LAVA_HAZARDS[h.kind],age=Math.max(0,arena.time-h.impactAt),remaining=h.impactAt-arena.time;
      s.group.position.set(h.x,0,h.z);
      s.marker.visible=s.disk.visible=!h.impacted;s.marker.scale.setScalar(settings.radius);s.disk.scale.setScalar(settings.radius);
      s.marker.rotation.z=arena.time*.5;s.disk.material.opacity=.2+.16*(1-Math.max(0,remaining)/settings.warning);
      s.bomb.visible=h.kind==='bomb'&&!h.impacted;
      const progress=Math.max(0,Math.min(1,1-remaining/.8)),height=22*(1-progress*progress);
      s.bomb.position.set(Math.cos(h.angle)*height*.25,height+.7,Math.sin(h.angle)*height*.25);s.bomb.rotation.y=arena.time*3;
      s.jet.visible=h.kind==='vent'&&h.impacted;
      const eruption=Math.sin(Math.min(1,age/settings.linger)*Math.PI);
      s.jet.scale.set(1,Math.max(.01,eruption*6),1);s.jet.position.y=eruption*3;
      s.shock.visible=h.impacted;s.shock.scale.setScalar(Math.min(settings.radius,.2+age*5));s.shock.material.opacity=Math.max(0,1-age/settings.linger);
      s.fragments.forEach((fragment,j)=>{
        fragment.visible=h.impacted;const angle=j*2.399+h.angle,speed=2+(j%3);
        fragment.position.set(Math.cos(angle)*age*speed,.3+(3+j%3)*age-6*age*age,Math.sin(angle)*age*speed);
        fragment.rotation.set(age*4,j,age*3);fragment.scale.setScalar(.12*Math.max(0,1-age/settings.linger));
      });
    }
  };
}
