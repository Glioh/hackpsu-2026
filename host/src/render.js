import * as T from 'three';
import { CONFIG as C } from '../../shared/config.js';
import { TEAM_FIGHTERS, loadFighter } from './fighter-model.js';
export function createRenderer(container) {
  const scene = new T.Scene(); scene.background = new T.Color('#d8dfb2'); scene.fog = new T.Fog('#d8dfb2', 30, 65);
  const camera = new T.PerspectiveCamera(38, 1, 0.1, 100); camera.position.set(14, 16, 21); camera.lookAt(0, 0, 0);
  const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; container.appendChild(renderer.domElement);
  scene.add(new T.HemisphereLight('#fffbea', '#6d8060', 2.5)); const sun = new T.DirectionalLight('#fff4d5', 3); sun.position.set(-8, 17, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15}); scene.add(sun);
  function mesh(geometry, color, parent = scene) { const m = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.85 })); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  const platform = mesh(new T.BoxGeometry(C.arenaX * 2, 1, C.arenaZ * 2), '#737e59'); platform.position.y = -0.53;
  const floor = mesh(new T.BoxGeometry(C.arenaX * 2, 0.08, C.arenaZ * 2), '#e6dfb5'); floor.position.y = 0;
  for (const z of [-C.arenaZ + .13, C.arenaZ - .13]) { const edge = mesh(new T.BoxGeometry(C.arenaX*2,.03,.24),'#db945b'); edge.position.set(0,.06,z); }
  for (const x of [-C.arenaX + .13, C.arenaX - .13]) { const edge = mesh(new T.BoxGeometry(.24,.03,C.arenaZ*2),'#db945b'); edge.position.set(x,.06,0); }
  const grid = new T.GridHelper(14, 14, '#b9b18c', '#cbc39e'); grid.scale.z = C.arenaZ / C.arenaX; grid.position.y = .055; scene.add(grid);
  const ring = mesh(new T.RingGeometry(2.3,2.35,64),'#b9af86'); ring.rotation.x = -Math.PI/2; ring.position.y=.065;
  const ground = mesh(new T.PlaneGeometry(200,200),'#bac797'); ground.rotation.x=-Math.PI/2; ground.position.y=-6;
  const models = ['#ff665b','#63c7ec'].map(color => {
    const group = new T.Group(); scene.add(group); const torso = new T.Group(); group.add(torso);
    const body = mesh(new T.CapsuleGeometry(.53,.65,6,12),color,torso); body.position.y=1.15;
    const head = mesh(new T.SphereGeometry(.44,20,16),color,torso); head.position.set(0,2,0.02);
    for(const x of [-.16,.16]) { const eye=mesh(new T.SphereGeometry(.11,12,8),'#fff8e7',torso); eye.position.set(x,2.06,.38); const pupil=mesh(new T.SphereGeometry(.055,10,8),'#242b28',torso); pupil.position.set(x,2.06,.47); }
    const arms=[-.78,.78].map(x=>{const pivot=new T.Group();pivot.position.set(x,1.52,0);torso.add(pivot);const limb=mesh(new T.CapsuleGeometry(.19,.55,4,8),color,pivot);limb.position.y=-.3;const fist=mesh(new T.SphereGeometry(.28,12,12),color,pivot);fist.position.y=-.68;return pivot;});
    const legs=[-.29,.29].map(x=>{const leg=mesh(new T.CapsuleGeometry(.22,.4,4,8),'#333e35',group);leg.position.set(x,.39,0);return leg;});
    return {group,torso,arms,legs};
  });
  // Capsule fighters stay as the fallback until each team's character loads (or if it can't).
  models.forEach((m,i)=>loadFighter(TEAM_FIGHTERS[i]).then(make=>{const s=make(['#ff665b','#63c7ec'][i]);m.group.clear();m.group.add(s.root);Object.assign(m,s);},err=>console.warn(TEAM_FIGHTERS[i]+' model unavailable; using placeholder fighter',err)));
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}; new ResizeObserver(resize).observe(container); resize();
  return (fighters,time)=>{fighters.forEach((f,i)=>{const m=models[i], walk=Math.min(1,Math.hypot(f.vx,f.vz)/4);m.group.position.set(f.x,f.y+.09,f.z);m.group.rotation.y=f.heading;m.torso.rotation.z=Math.sin(time*9+i)*.07+f.hit*.6;m.torso.rotation.x=walk*.1;m.torso.position.y=Math.sin(time*13)*.05*walk;m.legs.forEach((leg,j)=>leg.rotation.x=Math.sin(time*13+j*Math.PI)*.6*walk);m.arms.forEach((arm,j)=>{arm.rotation.x=f.attack>0&&j===1?-2.1:Math.sin(time*9+j)*(.1+walk*.4);arm.rotation.z=(j?1:-1)*(.12+(f.grounded?0:.65));});});renderer.render(scene,camera);};
}
