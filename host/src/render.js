import * as T from 'three';
import { CONFIG as C } from '../../shared/config.js';
import { CAMERA_DIRECTION, CAMERA_FOV, CAMERA_MIN_DISTANCE, frameFighters } from './camera.js';
import { createCharacter } from './characters.js';
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
  // torsoY: rest height of the torso group (capsule fallback sits at .9, loaded characters at their feet).
  const models = ['#ff665b','#63c7ec'].map(color => { const model = createCharacter(color, mesh); scene.add(model.group); return { ...model, torsoY: model.torso.position.y }; });
  const wobbles = models.map((_, i) => createWobble(i));
  // Swaps team i's body to character id. The current body (capsule fallback at first) stays if loading fails,
  // and a slower earlier pick never overwrites a newer one.
  const setFighter=(i,id)=>{const m=models[i];m.pick=id;loadFighter(id).then(make=>{if(m.pick!==id)return;const s=make(['#ff665b','#63c7ec'][i]);m.group.clear();m.group.add(s.root);Object.assign(m,s,{head:null,torsoY:0});},err=>console.warn(id+' model unavailable; keeping current fighter',err));};
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}; new ResizeObserver(resize).observe(container); resize();
  // fighters: interpolated motion poses from motion.js; bodies: raw simulation fighters (velocity, landings, hits).
  const draw = (fighters, time, bodies = []) => {
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
      const m = models[i], pose = f.pose, body = bodies[i];
      m.group.position.set(f.x, f.y + .09, f.z);
      m.group.rotation.y = f.heading;
      // Joints follow motion.js; squash & stretch and loose gear (pot, shell) come from wobble.js.
      const extra = body ? wobbles[i](body, dt, time) : null;
      if (extra) m.group.scale.set(extra.scale.xz, extra.scale.y, extra.scale.xz);
      m.torso.rotation.set(pose.torsoPitch, 0, pose.torsoRoll);
      m.torso.position.y = m.torsoY + pose.bodyOffset;
      m.head?.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll);
      m.legs.forEach((leg, j) => leg.rotation.x = pose[`leg${j}Pitch`]);
      m.arms.forEach((arm, j) => {
        arm.rotation.x = pose[`arm${j}Action`] + pose[`arm${j}Pitch`];
        arm.rotation.z = (j ? 1 : -1) * .12 + pose[`arm${j}Roll`];
      });
      m.wobbly?.forEach(({ node, kind, rest }) => {
        if (kind === 'head') node.rotation.set(rest.x + pose.headPitch, rest.y + pose.headYaw, rest.z + pose.headRoll);
        else if (extra) node.rotation.set(rest.x + extra.gear.x, rest.y, rest.z + extra.gear.z);
      });
    });
    renderer.render(scene, camera);
  };
  draw.setFighter = setFighter;
  return draw;
}
