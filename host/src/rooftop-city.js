import * as T from 'three';

// Seeded near/mid/far skyline. Roof setbacks share the tower batch, all four
// facades share the window batch: richer silhouettes still cost two draw calls.
export function createCity() {
  const city=new T.Group();city.name='Surrounding skyline';
  const buildings=[],windows=[];let seed=21;
  const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<65;i++) {
    const angle=rnd()*Math.PI*2,layer=i%3,dist=40+layer*30+rnd()*20,h=12+rnd()*38,w=6+rnd()*9,d=6+rnd()*9;
    const color=new T.Color().setHSL(.54+rnd()*.025,.12,.22+layer*.055+rnd()*.08),x=Math.cos(angle)*dist,z=Math.sin(angle)*dist;
    buildings.push({x,y:-24+h/2,z,w,h,d,color});
    const capHeight=2+rnd()*5;
    buildings.push({x:x+w*.1,y:-24+h+capHeight/2,z,w:w*.65,h:capHeight,d:d*.7,color:color.clone().multiplyScalar(.85)});
    if(i%4===0)buildings.push({x,y:-24+h+capHeight+2,z,w:.16,h:4,d:.16,color});
    for(let side=0;side<4;side++) {
      const horizontal=side%2===0,span=horizontal?w:d;
      for(let y=3;y<h-2;y+=3.1)for(let u=-span/2+1;u<span/2-1;u+=2) {
        const lit=rnd()>.78;
        windows.push({x:x+(horizontal?u:(side===1?w/2+.025:-w/2-.025)),y:-24+y,z:z+(horizontal?(side===0?d/2+.025:-d/2-.025):u),rotation:side*Math.PI/2,color:new T.Color(lit?'#e9c58f':'#5f8290').multiplyScalar(lit?1:.65)});
      }
    }
  }
  const towers=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({roughness:.78,metalness:.12}),buildings.length);
  const panes=new T.InstancedMesh(new T.PlaneGeometry(.7,1),new T.MeshBasicMaterial(),windows.length);
  const transform=new T.Object3D();
  for(const [i,b] of buildings.entries()) {
    transform.position.set(b.x,b.y,b.z);transform.scale.set(b.w,b.h,b.d);transform.updateMatrix();
    towers.setMatrixAt(i,transform.matrix);towers.setColorAt(i,b.color);
  }
  transform.scale.set(1,1,1);
  for(const [i,w] of windows.entries()) {
    transform.position.set(w.x,w.y,w.z);transform.rotation.y=w.rotation;transform.updateMatrix();panes.setMatrixAt(i,transform.matrix);panes.setColorAt(i,w.color);
  }
  city.add(towers,panes);return city;
}
