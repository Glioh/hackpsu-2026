import * as T from 'three';

// Fade only the roof meshes that obscure a fighter; restore them when the view clears.
export function createRooftopVisibility(model) {
  const ray=new T.Raycaster(),target=new T.Vector3(),direction=new T.Vector3();
  const original=new Map(),faded=new Map();let previous=new Set();
  return (fighters,camera)=>{
    for(const mesh of previous)mesh.material=original.get(mesh);
    const next=new Set();model.updateMatrixWorld(true);
    for(const f of fighters) {
      if(f.y<-1.5)continue;
      for(const height of [.8,1.7]) {
        target.set(f.x,f.y+height,f.z);direction.subVectors(target,camera.position);
        ray.set(camera.position,direction.clone().normalize());ray.far=Math.max(0,direction.length()-.5);
        for(const hit of ray.intersectObject(model,true))next.add(hit.object);
      }
    }
    for(const mesh of next) {
      if(!original.has(mesh)) {
        original.set(mesh,mesh.material);
        const clone=m=>{const c=m.clone();c.transparent=true;c.opacity=.22;c.depthWrite=false;return c;};
        faded.set(mesh,Array.isArray(mesh.material)?mesh.material.map(clone):clone(mesh.material));
      }
      mesh.material=faded.get(mesh);
    }
    previous=next;
  };
}
