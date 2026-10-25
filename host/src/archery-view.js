import * as T from 'three';
import {TARGET_RADIUS,TARGET_RINGS,ARROW_RADIUS,ARROW_FALL,ARROW_LINGER} from '../../shared/archery-layout.js';

export function createArcheryView(scene) {
  const root=new T.Group(),hazards=new T.Group(),items=new Map();
  root.name='Bullseye Brawl';root.visible=false;scene.add(root);root.add(hazards);
  const board=new T.Group();board.name='Target board';root.add(board);
  const mesh=(geometry,color,parent=board)=>{
    const m=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.8}));
    m.castShadow=m.receiveShadow=true;parent.add(m);return m;
  };
  const base=mesh(new T.CylinderGeometry(TARGET_RADIUS,TARGET_RADIUS,.65,128),'#bd8b57');base.position.y=-.325;
  TARGET_RINGS.forEach((color,i)=>{
    const outer=TARGET_RADIUS*(5-i)/5,inner=TARGET_RADIUS*(4-i)/5;
    const ring=mesh(new T.RingGeometry(inner,outer,128),color);ring.rotation.x=-Math.PI/2;ring.position.y=.002;
    const line=mesh(new T.RingGeometry(Math.max(0,outer-.025),outer,128),'#684f3d');line.rotation.x=-Math.PI/2;line.position.y=.008;
  });
  let current;
  function remove(id,item){hazards.remove(item.group);item.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});items.delete(id);}
  return arena=>{
    root.visible=arena.id==='archery';
    if(arena!==current){for(const [id,item] of items)remove(id,item);current=arena;}
    if(!root.visible)return;
    // Cosmetic recoil only: the support surface and warning centers stay fixed.
    const recoil=arena.shake;
    board.position.set(Math.sin(arena.time*49)*.09*recoil,Math.sin(arena.time*57)*.045*recoil,Math.cos(arena.time*43)*.09*recoil);
    board.rotation.set(Math.sin(arena.time*39)*.009*recoil,0,Math.cos(arena.time*45)*.009*recoil);
    const live=new Set(arena.arrows.map(a=>a.id));
    for(const [id,item] of items)if(!live.has(id))remove(id,item);
    for(const a of arena.arrows){
      let item=items.get(a.id);
      if(!item){
        const group=new T.Group(),arrow=new T.Group();hazards.add(group);group.position.set(a.x,0,a.z);group.add(arrow);
        const warning=mesh(new T.CircleGeometry(ARROW_RADIUS,48),'#ff862c',group);warning.rotation.x=-Math.PI/2;warning.position.y=.025;
        const outline=mesh(new T.RingGeometry(ARROW_RADIUS-.09,ARROW_RADIUS,48),'#fff5dc',group);outline.rotation.x=-Math.PI/2;outline.position.y=.035;
        const crosses=[];
        for(const angle of [0,Math.PI/2]){
          const cross=mesh(new T.BoxGeometry(.12,.025,.85),'#4d2343',group);cross.rotation.y=angle;cross.position.y=.045;crosses.push(cross);
        }
        const shaft=mesh(new T.CylinderGeometry(.09,.09,5,12),'#f5cf85',arrow);shaft.position.y=3;
        const tip=mesh(new T.ConeGeometry(.32,.65,4),'#697c9b',arrow);tip.rotation.z=Math.PI;tip.position.y=.325;
        for(const angle of [0,Math.PI/2]){
          const feather=mesh(new T.BoxGeometry(.85,1,.07),'#d86cb3',arrow);feather.position.y=5.1;feather.rotation.y=angle;
        }
        // The shaft points back along its diagonal approach; the tip still lands
        // exactly at the fixed warning center. Contrails never imply extra damage.
        const axis=new T.Vector3(Math.cos(a.angle)*.6,1,Math.sin(a.angle)*.6).normalize();
        arrow.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),axis);
        const trail=new T.Group();trail.name='Arrow contrail';arrow.add(trail);
        for(let i=0;i<9;i++){
          const streak=mesh(new T.CylinderGeometry(.1+i*.045,.06+i*.04,1.8,8),'#fff0c0',trail);
          streak.position.y=6+i*1.15;streak.material.transparent=true;streak.material.opacity=.55*(1-i/10);
          streak.material.depthWrite=false;streak.material.emissive.set('#ffad49');streak.material.emissiveIntensity=.8;
          streak.castShadow=false;
        }
        const burst=new T.Group();burst.name='Arrow splinters';group.add(burst);
        for(let i=0;i<16;i++){
          const shard=mesh(new T.BoxGeometry(i%3===0?.3:.09,.5+(i%4)*.23,.09),i%3===0?'#d86cb3':'#f5cf85',burst);
          shard.name='Splinter';
        }
        const shock=mesh(new T.RingGeometry(.8,1,48),'#fff0bd',group);shock.name='Impact puff';shock.rotation.x=-Math.PI/2;shock.position.y=.07;
        shock.material.transparent=true;shock.material.depthWrite=false;
        item={group,arrow,warning,outline,crosses,burst,shock};items.set(a.id,item);
      }
      const remaining=a.impactAt-arena.time;
      item.arrow.visible=remaining<=ARROW_FALL&&!a.impacted;
      const progress=1-Math.max(0,Math.min(1,remaining/ARROW_FALL));
      const height=18*(1-progress*progress);
      item.arrow.position.set(Math.cos(a.angle)*height*.6,height,Math.sin(a.angle)*height*.6);
      const age=Math.max(0,arena.time-a.impactAt);
      item.burst.visible=item.shock.visible=a.impacted;
      item.burst.children.forEach((shard,i)=>{
        const angle=a.angle+i*2.39996,speed=2+(i%5)*.7;
        const flight=Math.min(age,.8);
        shard.position.set(Math.cos(angle)*speed*flight,Math.max(.12,.25+(3+i%3)*age-7*age*age),Math.sin(angle)*speed*flight);
        shard.rotation.set(flight*(i%3+3),angle+flight*5,flight*(i%4+2));
        shard.scale.setScalar(Math.min(1,Math.max(0,ARROW_LINGER-age)));
      });
      item.shock.scale.setScalar(Math.min(ARROW_RADIUS,.1+age*5));
      item.shock.material.opacity=Math.max(0,1-age/.35);
      for(const m of [item.warning,item.outline,...item.crosses])m.visible=!a.impacted;
      item.warning.material.color.set(Math.sin(arena.time*16)>0?'#ff862c':'#ffcf72');
    }
  };
}
