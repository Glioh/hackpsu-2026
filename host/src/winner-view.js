import * as T from 'three';
import { loadFighter, FIGHTERS } from './fighter-model.js';

export function victoryPose(time, reduced = false, index = 0) {
  if(reduced)return {hop:0,side:0,yaw:0,sway:0,lean:0,twist:0,arms:[-2.55,-2.55],armRoll:[-.4,.4],legs:[0,0],legRoll:[0,0]};
  const t=time+index*.35, beat=t*Math.PI*3;
  const step=Math.sin(beat), groove=Math.sin(beat*.5);
  // Alternate arm pumps and a disco wave, then finish the eight-second phrase
  // with a smooth full turn. The next phrase starts at the same orientation.
  const wave=(1-Math.cos(t*Math.PI/2))/2;
  const turn=Math.max(0,Math.min(1,((t%8)-6.5)/1.5));
  const spin=turn*turn*(3-2*turn)*Math.PI*2;
  return {
    hop:Math.max(0,Math.sin(beat*2))*.2,
    side:groove*.24,
    yaw:groove*.35+spin,
    sway:step*.12,
    lean:Math.cos(beat*2)*.08,
    twist:-groove*.2,
    arms:[-1.9+step*.85-wave*.6,-1.9-step*.85+wave*.35],
    armRoll:[-.45-wave*.55+.15*Math.cos(beat),.45+wave*.55-.15*Math.cos(beat)],
    legs:[Math.max(0,-step)*.55,Math.max(0,step)*.55],
    legRoll:[-.08-groove*.14,.08-groove*.14],
  };
}

// A transparent, isolated character display reuses the real selected fighter.
// Geometry belongs to the shared GLTF cache; only cloned materials are released.
export function createWinnerView(container) {
  let renderer,scene,camera,stage,observer,models=[],frame=null,generation=0,start=0,visible=false;
  let focus=new T.Vector3(),halfHeight=3;
  const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function resize() {
    if(!renderer||!visible)return;
    const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight),aspect=width/height;
    renderer.setSize(width,height,false);
    const box=new T.Box3().setFromObject(stage),size=box.getSize(new T.Vector3());
    if(!box.isEmpty()) {focus=box.getCenter(new T.Vector3());halfHeight=Math.max(size.y*.6+.4,size.x/aspect*.6+.4);}
    camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;
    camera.position.set(focus.x,focus.y+.6,12);camera.lookAt(focus);camera.updateProjectionMatrix();
    renderer.render(scene,camera);
  }
  function initialize() {
    if(renderer)return;
    renderer=new T.WebGLRenderer({alpha:true,antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.setClearColor(0,0);container.append(renderer.domElement);
    scene=new T.Scene();stage=new T.Group();scene.add(stage);
    scene.add(new T.HemisphereLight('#f4f4ff','#6c7592',2.5));
    const key=new T.DirectionalLight('#fff0d7',3);key.position.set(-3,6,8);scene.add(key);
    const rim=new T.DirectionalLight('#9cdfff',2);rim.position.set(4,3,-4);scene.add(rim);
    camera=new T.OrthographicCamera(-3,3,3,-3,.1,100);
    observer=new ResizeObserver(resize);observer.observe(container);
  }
  function pose(time) {
    models.forEach((model,index)=>{
      const p=victoryPose(time,reduced(),index);
      model.root.position.x=model.victoryX+p.side;model.root.position.y=p.hop;model.root.rotation.y=p.yaw;
      model.torso.rotation.set(p.lean,p.twist,p.sway);
      model.arms.forEach((arm,i)=>{arm.rotation.x=p.arms[i];arm.rotation.z=p.armRoll[i];});
      model.legs.forEach((leg,i)=>{leg.rotation.x=p.legs[i];leg.rotation.z=p.legRoll[i];});
      model.wobbly?.forEach(({node,kind,rest})=>{
        if(kind==='head'||kind==='gear'||kind==='bounce')node.rotation.set(rest.x-p.lean*.5,rest.y-p.twist*.5,rest.z-p.sway*.45);
      });
    });
  }
  function animate(now) {
    if(!visible)return;
    pose((now-start)/1000);renderer.render(scene,camera);
    frame=reduced()?null:requestAnimationFrame(animate);
  }
  function clear() {
    const materials=new Set();
    stage?.traverse(node=>{
      if(node.material)for(const m of Array.isArray(node.material)?node.material:[node.material])materials.add(m);
      if(node.geometry?.type==='RingGeometry')node.geometry.dispose();
    });
    materials.forEach(m=>m.dispose());stage?.clear();models=[];
  }
  function hide() {
    visible=false;generation++;if(frame!==null)cancelAnimationFrame(frame);frame=null;clear();
    renderer?.clear();
    container.replaceChildren(...(renderer?[renderer.domElement]:[]));
  }
  return {
    async show(winner,picks) {
      hide();visible=true;const token=generation;
      const indices=winner==='draw'?[0,1]:[winner==='blue'?1:0];
      const ids=indices.map(i=>picks[i]);
      container.setAttribute('aria-label',ids.map(id=>FIGHTERS[id].name).join(' and ')+(winner==='draw'?' draw':' celebrating victory'));
      try {
        initialize();
        const factories=await Promise.all(ids.map(loadFighter));
        if(token!==generation||!visible)return;
        models=factories.map((make,i)=>{
          const model=make(indices[i]===0?'#ff7964':'#69dbe8');
          const rings=[];
          model.root.traverse(node=>{if(node.geometry?.type==='RingGeometry')rings.push(node);});
          for(const ring of rings){ring.removeFromParent();ring.geometry.dispose();ring.material.dispose();}
          model.victoryX=indices.length===2?(i?2:-2):0;model.root.position.x=model.victoryX;stage.add(model.root);return model;
        });
        pose(0);resize();start=performance.now();frame=requestAnimationFrame(animate);
      } catch {
        if(token!==generation||!visible)return;
        clear();
        // Portrait fallback still identifies the selected character if WebGL fails.
        const images=ids.map(id=>{const img=document.createElement('img');img.src=`/host/assets/ui/portraits/${id}_portrait.png`;img.alt=FIGHTERS[id].name;img.className='winner-portrait';return img;});
        container.replaceChildren(...images);
      }
    },
    hide,
  };
}
