import * as T from 'three';

// Same seeded skyline as the approved concept, batched into two draw calls.
export function createCity() {
  const city=new T.Group();city.name='Surrounding skyline';
  const buildings=[],windows=[];let seed=21;
  const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<65;i++) {
    const angle=rnd()*Math.PI*2,dist=38+rnd()*85,h=10+rnd()*42,w=6+rnd()*9,d=6+rnd()*9;
    const color=new T.Color().setHSL(.48+rnd()*.07,.09,.25+rnd()*.15),x=Math.cos(angle)*dist,z=Math.sin(angle)*dist;
    buildings.push({x,y:-24+h/2,z,w,h,d,color});
    for(let y=3;y<h-2;y+=3.1)for(let xx=-w/2+1;xx<w/2-1;xx+=2)
      windows.push({x:x+xx,y:-24+y,z:z+d/2+.02,color:new T.Color(rnd()>.5?'#b5b899':'#6d8883')});
  }
  const towers=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({roughness:1}),buildings.length);
  const panes=new T.InstancedMesh(new T.PlaneGeometry(.7,1),new T.MeshBasicMaterial(),windows.length);
  const transform=new T.Object3D();
  for(const [i,b] of buildings.entries()) {
    transform.position.set(b.x,b.y,b.z);transform.scale.set(b.w,b.h,b.d);transform.updateMatrix();
    towers.setMatrixAt(i,transform.matrix);towers.setColorAt(i,b.color);
  }
  transform.scale.set(1,1,1);
  for(const [i,w] of windows.entries()) {
    transform.position.set(w.x,w.y,w.z);transform.updateMatrix();panes.setMatrixAt(i,transform.matrix);panes.setColorAt(i,w.color);
  }
  city.add(towers,panes);return city;
}
