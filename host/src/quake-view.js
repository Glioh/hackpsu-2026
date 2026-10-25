import * as T from 'three';

// Each rock shelf follows its physical floor, including the open fault below it.
export function createQuakeView(scene) {
  const root=new T.Group();root.name='Earthquake / fractured mountain';root.visible=false;scene.add(root);
  const materials=new Map();
  const mat=color=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:1,flatShading:true}));return materials.get(color);};
  const mesh=(parent,name,geometry,color,x,y,z)=>{
    const m=new T.Mesh(geometry,mat(color));m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
  };
  const shelves=new T.Group();root.add(shelves);
  let current=null,items=[];
  // Jagged distant peaks sit below the summit, leaving the playable edges clear.
  for(let i=0;i<16;i++){
    const angle=i*2.399,r=34+i%4*7,h=12+i*7%18;
    const peak=mesh(root,'Distant rocky peak',new T.ConeGeometry(6+i%3,h,5),'#71877c',Math.cos(angle)*r,-24+h/2,Math.sin(angle)*r);
    peak.rotation.y=i;peak.scale.z=.7;
  }
  function build(arena){
    shelves.traverse(m=>m.geometry?.dispose());shelves.clear();
    items=arena.pieces.map((p,i)=>{
      const group=new T.Group();shelves.add(group);
      mesh(group,'Summit stone shelf',new T.BoxGeometry(p.hw*2,.55,p.hd*2),i%2?'#b4ad91':'#a6a48b',0,-.275,0);
      // Taper each shelf to a crag rather than supporting it with a flat slab.
      const rock=mesh(group,'Broken mountain face',new T.CylinderGeometry(1,.38,17,7),i%2?'#68796a':'#78816e',0,-9,0);
      rock.scale.set(p.hw,1,p.hd);rock.rotation.y=i*.4;
      for(let layer=0;layer<4;layer++){
        const ledge=mesh(group,'Weathered rock strata',new T.BoxGeometry(p.hw*2*(1-layer*.12),.7,p.hd*2*(1-layer*.12)),'#858b75',0,-1-layer*2.4,0);
        ledge.rotation.y=(i%2?1:-1)*.025;
      }
      // Low angular stone patches add relief without hiding the fault openings.
      for(let k=0;k<7;k++){
        const patch=mesh(group,'Summit rock texture',new T.CylinderGeometry(.45+k%3*.15,.6,.025,5),k%2?'#969d80':'#c0b79b',Math.sin(k*7+i)*p.hw*.78,.015,Math.cos(k*5+i)*p.hd*.78);
        patch.rotation.y=k;
      }
      const faultMaterial=new T.MeshStandardMaterial({color:'#e1a95e',emissive:'#bf642d',emissiveIntensity:0,roughness:1});
      const warning=new T.Mesh(new T.BoxGeometry(.09,.025,p.hd*2),faultMaterial);warning.name='Fault warning';warning.position.set(-p.sx*(p.hw-.06),.025,0);group.add(warning);
      const cross=new T.Mesh(new T.BoxGeometry(p.hw*2,.025,.09),faultMaterial);cross.position.set(0,.025,-p.sz*(p.hd-.06));group.add(cross);
      return {p,group,faultMaterial,warning,cross};
    });current=arena;
  }
  return (arena,time=0)=>{
    root.visible=arena.id==='quake';if(!root.visible)return;
    if(current!==arena)build(arena);
    for(const {p,group,faultMaterial,warning,cross} of items){
      group.position.set(p.x,p.y,p.z);
      warning.visible=cross.visible=arena.warning||arena.fracture>0;
      faultMaterial.emissiveIntensity=arena.warning?.4+.4*Math.sin(time*18):.2;
    }
  };
}
