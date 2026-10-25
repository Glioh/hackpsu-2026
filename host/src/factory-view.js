import * as T from 'three';
import { CONFIG as C } from '../../shared/config.js';

// Scenery only: none of these meshes participate in floor queries or collisions.
// Keep the front production line below the arena, leaving its knockout edges open.
export function createFactoryView(scene) {
  const root = new T.Group(); root.name = 'factory-interior'; root.visible = false;
  scene.add(root);
  const materials = Object.fromEntries(Object.entries({
    steel: '#254b51', dark: '#18292e', concrete: '#435459', trim: '#dca349',
    metal: '#71898a', cargo: '#b56d3f', black: '#252e30',
  }).map(([key, color]) => [key, new T.MeshStandardMaterial({color, roughness: .72, metalness: .28})]));
  materials.light = new T.MeshStandardMaterial({color:'#c1f5e7', emissive:'#8bdcc7', emissiveIntensity:1.5});
  materials.signal = new T.MeshStandardMaterial({color:'#ffb63e', emissive:'#ff8e20', emissiveIntensity:1});
  const geometry = new T.BoxGeometry(1,1,1), animations = [];
  function box(x,y,z,w,h,d,material='steel',parent=root) {
    const mesh = new T.Mesh(geometry,materials[material]);
    mesh.position.set(x,y,z); mesh.scale.set(w,h,d); mesh.receiveShadow=true;
    parent.add(mesh); return mesh;
  }
  function cylinder(x,y,z,r,length,material='metal',parent=root) {
    const mesh=new T.Mesh(new T.CylinderGeometry(r,r,length,12),materials[material]);
    mesh.position.set(x,y,z); parent.add(mesh); return mesh;
  }
  function label(text,x,y,z,w,h) {
    const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=128;
    const ctx=canvas.getContext('2d'); ctx.fillStyle='#18292e';ctx.fillRect(0,0,1024,128);
    ctx.fillStyle='#eab75c';ctx.font='bold 64px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,68);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture}));
    mesh.position.set(x,y,z);root.add(mesh);
  }
  // A sunken service floor makes the unchanged floating belt boundaries explicit.
  box(0,-5.9,0,80,.25,70,'concrete');
  box(0,5,-15,65,22,.7,'steel');
  for(let x=-30;x<=30;x+=6) {
    box(x,4,-14.5,.35,20,.5,'metal');
    box(x,9,-14.1,5.4,2.4,.18,'dark');
    box(x,10.1,-13.95,4.6,.08,.08,'light');
    box(x,2,-14.05,5.2,.08,.12,'metal');
  }
  for(const x of [-21,21]) {
    box(x,3,-2,1,18,27,'steel');
    for(const z of [-12,-3,6])box(x,3,z,1.2,18,1.2,'metal');
  }
  for(const z of [-12,-3]) {
    box(0,12,z,44,.8,.6,'steel');
    for(let x=-18;x<=18;x+=6)box(x,11.4,z,3,.12,.4,'light');
  }
  label('ASSEMBLY  /  04',0,7.2,-14.5,13,1.6);
  label('KEEP CLEAR   •   AUTOMATED MACHINERY',0,.8,-14.45,14,.8);
  // Twin ventilation fans, with rotating blades behind stationary safety rings.
  for(const x of [-12,12]) {
    box(x,6,-14,4.5,4.5,.3,'dark');
    const ring=new T.Mesh(new T.TorusGeometry(1.8,.12,8,32),materials.metal);ring.position.set(x,6,-13.65);root.add(ring);
    const rotor=new T.Group();rotor.position.set(x,6,-13.7);root.add(rotor);
    for(let i=0;i<4;i++){const blade=box(0,.85,0,.5,1.4,.14,'metal',rotor);blade.rotation.z=i*Math.PI/2;blade.position.set(-Math.sin(i*Math.PI/2)*.85,Math.cos(i*Math.PI/2)*.85,0);}
    animations.push(t=>{rotor.rotation.z=t*1.4;});
  }
  // Background stamping cells. Heads reciprocate inside their own frames.
  for(const x of [-8,0,8]) {
    box(x,-2.2,-11,5,1.1,3.4,'dark');
    for(const dx of [-2,2])box(x+dx,1,-11,.5,6,1,'trim');
    box(x,4,-11,4.8,1,2,'steel');
    const piston=cylinder(x,2.4,-11,.28,2.4);
    const head=box(x,1.3,-11,3.3,.65,2.1,'metal');
    box(x+1.9,4.75,-10.7,.25,.35,.25,'signal');
    animations.push(t=>{const stroke=(1-Math.cos(t*2.2+x))*.65;head.position.y=1.3-stroke;piston.position.y=2.4-stroke*.5;piston.scale.y=1+stroke/2.4;});
  }
  // Low foreground transport line: moving parcels and exposed drive rollers.
  // It is four metres below the fight, never a visually implied extra platform.
  for(const z of [-10,11.5]) {
    box(0,-3.6,z,39,.6,2.4,'dark');
    for(const dz of [-1.15,1.15])box(0,-3.18,z+dz,39,.18,.16,'trim');
    for(let x=-19;x<=19;x+=1) {
      const roller=cylinder(x,-3.22,z,.17,2.1);roller.rotation.x=Math.PI/2;
      animations.push(t=>{roller.rotation.y=t*2;});
    }
    for(let i=0;i<10;i++) {
      const parcel=new T.Group();root.add(parcel);
      box(0,0,0,1.2,.85,1,'cargo',parcel);box(0,.44,0,.18,.025,1.02,'trim',parcel);
      box(0,0,.51,.5,.3,.015,'metal',parcel);
      animations.push(t=>{parcel.position.set(((i*4+t*(z>0?-1.3:1.1)+400)%40)-20,-2.65,z);});
    }
    for(const x of [-16,-8,0,8,16])box(x,-4.7,z,.4,2,1.7,'steel');
  }
  // Real arena bounds remain unchanged; dress only its underside and ends.
  for(const z of [-C.arenaZ,C.arenaZ]) {
    box(0,-.48,z,2*C.arenaX,.3,.18,'trim');
    for(let x=-10;x<=10;x+=2)box(x,-1.4,z,.24,1.6,.3,'steel');
  }
  for(const x of [-C.arenaX,C.arenaX])for(let i=0;i<4;i++) {
    const z=-C.arenaZ+(i*2+1)*C.arenaZ/4;
    const roller=cylinder(x,-.23,z,.25,3.85);roller.rotation.x=Math.PI/2;
    animations.push((t,arena)=>{roller.rotation.y=-t*arena.pieces[i].vx/.25;});
    box(x,-.55,z, .35,.12,3.9,'trim');
  }
  return arena => {
    root.visible=arena.id==='conveyor'; if(!root.visible)return;
    // Use round time so pausing freezes machinery and a new round resets it.
    const t=arena.time;
    for(const animate of animations)animate(t,arena);
    materials.signal.emissiveIntensity=arena.warning?1.2+Math.sin(t*18)*.8: .7;
  };
}
