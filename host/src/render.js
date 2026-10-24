import * as T from 'three';
import { CONFIG as C } from '../../shared/config.js';
import { CAMERA_DIRECTION, CAMERA_FOV, CAMERA_MIN_DISTANCE, frameFighters } from './camera.js';
import { loadFighter } from './fighter-model.js';
import { createWobble } from './wobble.js';
export function createRenderer(container) {
  const scene = new T.Scene(); scene.background = new T.Color('#d8dfb2'); scene.fog = new T.Fog('#d8dfb2', 30, 65);
  const camera = new T.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 180);
  const cameraFocus = new T.Vector3(), cameraDirection = new T.Vector3(...CAMERA_DIRECTION);
  let cameraDistance = CAMERA_MIN_DISTANCE, previousTime = null;
  const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; container.appendChild(renderer.domElement);
  scene.add(new T.HemisphereLight('#fffbea', '#6d8060', 2.5)); const sun = new T.DirectionalLight('#fff4d5', 3); sun.position.set(-8, 22, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20,far:70}); scene.add(sun);
  function mesh(geometry, color, parent = scene) { const m = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.85 })); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  const platform = mesh(new T.BoxGeometry(C.arenaX * 2, 1, C.arenaZ * 2), '#737e59'); platform.position.y = -0.53;
  const floor = mesh(new T.BoxGeometry(C.arenaX * 2, 0.08, C.arenaZ * 2), '#e6dfb5'); floor.position.y = 0;
  for (const z of [-C.arenaZ + .13, C.arenaZ - .13]) { const edge = mesh(new T.BoxGeometry(C.arenaX*2,.03,.24),'#db945b'); edge.position.set(0,.06,z); }
  for (const x of [-C.arenaX + .13, C.arenaX - .13]) { const edge = mesh(new T.BoxGeometry(.24,.03,C.arenaZ*2),'#db945b'); edge.position.set(x,.06,0); }
  const grid = new T.GridHelper(C.arenaX * 2, C.arenaX * 2, '#b9b18c', '#cbc39e'); grid.scale.z = C.arenaZ / C.arenaX; grid.position.y = .055; scene.add(grid);
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
  const wobbles = models.map((_, i) => createWobble(i));
  // Swaps team i's body to character id. The current body (capsule fallback at first) stays if loading fails,
  // and a slower earlier pick never overwrites a newer one.
  const setFighter=(i,id)=>{const m=models[i];m.pick=id;loadFighter(id).then(make=>{if(m.pick!==id)return;const s=make(['#ff665b','#63c7ec'][i]);m.group.clear();m.group.add(s.root);Object.assign(m,s);},err=>console.warn(id+' model unavailable; keeping current fighter',err));};
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}; new ResizeObserver(resize).observe(container); resize();
  const draw = (fighters, time) => {
    const dt = previousTime === null ? 0 : Math.max(0, Math.min(.1, time - previousTime));
    const framing = frameFighters(fighters, camera.aspect);
    const desiredFocus = new T.Vector3(...framing.target);
    if (previousTime === null) cameraFocus.copy(desiredFocus);
    else cameraFocus.lerp(desiredFocus, 1 - Math.exp(-2.5 * dt));
    // Fit against the smoothed focus too, so fighters stay visible during pans.
    const requiredDistance = frameFighters(fighters, camera.aspect, cameraFocus.toArray()).distance;
    if (previousTime === null || requiredDistance > cameraDistance) cameraDistance = requiredDistance;
    else cameraDistance += (requiredDistance - cameraDistance) * (1 - Math.exp(-1.5 * dt));
    camera.position.copy(cameraFocus).addScaledVector(cameraDirection, cameraDistance);
    camera.lookAt(cameraFocus);
    previousTime = time;

    fighters.forEach((f, i) => {
      const m = models[i], pose = wobbles[i](f, dt, time);
      m.group.position.set(f.x, f.y + .09, f.z);
      m.group.rotation.y = f.heading;
      m.group.scale.set(pose.scale.xz, pose.scale.y, pose.scale.xz); // squash & stretch from the feet
      m.torso.rotation.x = pose.lean.x;
      m.torso.rotation.z = pose.lean.z;
      m.torso.position.y = pose.bob;
      m.legs.forEach((leg, j) => leg.rotation.x = pose.legs[j]);
      m.arms.forEach((arm, j) => { arm.rotation.x = pose.arms[j].x; arm.rotation.z = pose.arms[j].z; });
      m.wobbly?.forEach(({ node, kind, rest }) => node.rotation.set(rest.x + pose[kind].x, rest.y, rest.z + pose[kind].z));
    });
    renderer.render(scene, camera);
  };
  draw.setFighter = setFighter;
  return draw;
}
