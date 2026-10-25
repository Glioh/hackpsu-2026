import * as T from 'three';
import { createEnvironment, QUALITY } from './environment.js';
import { enrichMaterials } from './surface-materials.js';
import { CAMERA_DIRECTION, ROOFTOP_CAMERA_DIRECTION, CAMERA_FOV, CAMERA_MIN_DISTANCE, frameFighters } from './camera.js';
import { createCharacter } from './characters.js';
import { loadFighter } from './fighter-model.js';
import { createClumsy } from './clumsy.js';
import { createArenaView } from './arena-view.js';
import { createArena } from './maps.js';
import { createKOEffects } from './ko-effects.js';
import { createHitEffects, createHitFlash } from './hit-effects.js';
export function createRenderer(container, onCombatRig = () => {}) {
  const scene = new T.Scene();
  const quality = QUALITY[new URLSearchParams(location.search).get('quality')] ?? QUALITY.medium;
  const ko = createKOEffects(scene), hitEffects = createHitEffects(scene);
  const hitAges = [Infinity, Infinity];
  const camera = new T.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 500);
  const cameraFocus = new T.Vector3(), cameraDirection = new T.Vector3(...CAMERA_DIRECTION);
  let cameraDistance = CAMERA_MIN_DISTANCE, previousTime = null, materialArena = null;
  const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, quality.pixelRatio)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; container.appendChild(renderer.domElement);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  const hemisphere = new T.HemisphereLight();
  const sun = new T.DirectionalLight();sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  sun.shadow.bias = -.00015;sun.shadow.normalBias = .035;
  scene.add(hemisphere, sun, sun.target);
  const environment = createEnvironment(scene, renderer, sun, hemisphere);
  function mesh(geometry, color, parent = scene) { const m = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.85 })); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  const drawArena = createArenaView(scene), fallbackArena = createArena('classic');
  const ground = mesh(new T.PlaneGeometry(1000,1000),'#bac797'); ground.rotation.x=-Math.PI/2; ground.position.y=-6; ground.castShadow=false;
  // torsoY: rest height of the torso group (capsule fallback sits at .9, loaded characters at their feet).
  const models = ['#ff665b','#63c7ec'].map(color => { const model = createCharacter(color, mesh); scene.add(model.group); return { ...model, torsoY: model.torso.position.y }; });
  let flashes = models.map(m => createHitFlash(m.group));
  let clumsies = models.map((_, i) => createClumsy(i));
  // 1 when the floor ends within reach of a grounded fighter (map edge, tile hole, platform edge): time to teeter.
  const edgeNear = (arena, f) => {
    if (!f.grounded) return 0;
    for (let k = 0; k < 8; k++) if (!arena.floorAt(f.x + Math.cos(k * Math.PI / 4) * .8, f.z + Math.sin(k * Math.PI / 4) * .8)) return 1;
    return 0;
  };
  // Swaps team i's body to character id. The current body (capsule fallback at first) stays if loading fails,
  // and a slower earlier pick never overwrites a newer one.
  const setFighter=(i,id)=>{const m=models[i];m.pick=id;loadFighter(id).then(make=>{if(m.pick!==id)return;const s=make(['#ff665b','#63c7ec'][i]);enrichMaterials(s.root);m.group.clear();m.group.add(s.root);Object.assign(m,s,{head:null,torsoY:0});flashes[i]=createHitFlash(m.group);onCombatRig(i,s.combatRig);},err=>console.warn(id+' model unavailable; keeping current fighter',err));};
  const resize=()=>{const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}; const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); resize();
  // fighters: interpolated motion poses from motion.js; bodies: raw simulation fighters (velocity, landings, hits);
  // arena: the simulation's current map (maps.js).
  const draw = (fighters, time, bodies = [], arena = fallbackArena, { active = true, motionEnabled = true, finishAge = null } = {}) => {
    const dt = previousTime === null ? 0 : Math.max(0, Math.min(.1, time - previousTime));
    renderer.domElement.style.filter = finishAge === null ? '' : `grayscale(${Math.min(1, finishAge / .22)}) contrast(1.15)`;
    ko.update(finishAge ?? 0);
    hitEffects.update(bodies, active ? dt : 0);
    const piano=arena.id==='piano';
    const twinspire=arena.id==='twinspire';
    const rooftop = arena.id === 'skyline'||twinspire||arena.id==='station', mountain = arena.id === 'mountain', elevated = rooftop || mountain;
    ground.position.y = twinspire ? -39 : piano ? -24 : mountain ? -40 : rooftop ? -24 : -6;
    ground.material.color.set(piano ? '#292830' : mountain ? '#879bb1' : rooftop ? '#66798d' : '#96a7ba');
    cameraDirection.fromArray(elevated ? ROOFTOP_CAMERA_DIRECTION : CAMERA_DIRECTION);
    const framingOptions=piano?{minDistance:7,padding:1.08}:undefined;
    const framing = frameFighters(fighters, camera.aspect, undefined, elevated, framingOptions);
    const desiredFocus = new T.Vector3(...framing.target);
    if (previousTime === null) cameraFocus.copy(desiredFocus);
    else cameraFocus.lerp(desiredFocus, 1 - Math.exp(-2.5 * dt));
    // Fit against the smoothed focus too, so fighters stay visible during pans.
    const requiredDistance = frameFighters(fighters, camera.aspect, cameraFocus.toArray(), elevated, framingOptions).distance;
    if (previousTime === null || requiredDistance > cameraDistance) cameraDistance = requiredDistance;
    else cameraDistance += (requiredDistance - cameraDistance) * (1 - Math.exp(-1.5 * dt));
    camera.position.copy(cameraFocus).addScaledVector(cameraDirection, cameraDistance);
    camera.lookAt(cameraFocus);
    if (arena.shake) camera.position.add(new T.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(.45 * arena.shake)); // quake
    drawArena(arena, time, arena.id==='piano'?bodies:fighters, camera);
    previousTime = time;

    fighters.forEach((f, i) => {
      const m = models[i], pose = f.pose, body = bodies[i];
      if (active) hitAges[i] += dt;
      const age = hitAges[i];
      flashes[i](age < .075 ? 1 : age < .13 ? .15 : age < .19 ? .8 * (1 - (age - .13) / .06) : 0);
      m.group.visible = !(finishAge !== null && body?.y < -5);
      m.group.position.set(f.x, f.y + .09, f.z);
      m.group.rotation.y = f.heading;
      // Joints follow motion.js; clumsy.js adds the lurching, stumbling, flailing and teetering on top.
      const c = body ? clumsies[i](body, active ? dt : 0, time, { enabled: motionEnabled, edge: edgeNear(arena, body) }) : null;
      const k = c ?? { torso: { x: 0, z: 0 }, drop: 0, head: { x: 0, z: 0 }, arms: [{ x: 0, z: 0 }, { x: 0, z: 0 }], legs: [0, 0], gear: { x: 0, z: 0 } };
      m.torso.rotation.set(pose.torsoPitch + k.torso.x, 0, pose.torsoRoll + k.torso.z);
      m.torso.position.y = m.torsoY + pose.bodyOffset + k.drop;
      m.head?.rotation.set(pose.headPitch + k.head.x, pose.headYaw, pose.headRoll + k.head.z); // capsule fallback
      m.legs.forEach((leg, j) => leg.rotation.x = pose[`leg${j}Pitch`] + k.legs[j]);
      m.arms.forEach((arm, j) => {
        arm.rotation.x = pose[`arm${j}Action`] + (body?.attack > 0 ? 0 : pose[`arm${j}Pitch`] + k.arms[j].x);
        arm.rotation.z = body?.attack > 0 ? (j ? -1 : 1)*.6 : (j ? 1 : -1)*.12 + pose[`arm${j}Roll`] + k.arms[j].z;
      });
      m.wobbly?.forEach(({ node, kind, rest, restY, maxTilt, lift }) => {
        if (kind === 'head') node.rotation.set(rest.x + pose.headPitch + k.head.x, rest.y + pose.headYaw, rest.z + pose.headRoll + k.head.z);
        else {
          const x = Math.max(-maxTilt, Math.min(maxTilt, k.gear.x)), z = Math.max(-maxTilt, Math.min(maxTilt, k.gear.z));
          node.rotation.set(rest.x + x, rest.y, rest.z + z);
          node.position.y = restY + lift * (Math.abs(Math.sin(x)) + Math.abs(Math.sin(z))); // rock on the rim
        }
      });
    });
    environment.apply(arena, camera);
    if(materialArena!==arena){enrichMaterials(scene);materialArena=arena;}
    renderer.render(scene, camera);
  };
  draw.resetMotion = () => { hitEffects.clear(); hitAges.fill(Infinity); flashes.forEach(flash => flash(0)); clumsies = models.map((_, i) => createClumsy(i)); };
  draw.setFighter = setFighter;
  draw.dispose = () => { resizeObserver.disconnect(); environment.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  draw.diagnostics = () => ({ calls:renderer.info.render.calls, triangles:renderer.info.render.triangles, textures:renderer.info.memory.textures, environments:environment.cacheSize, exposure:renderer.toneMappingExposure });
  draw.hit = body => { const index = body.team === 'red' ? 0 : 1; hitAges[index] = 0; hitEffects.hit(body); };
  draw.startKO = fighters => ko.trigger(fighters);
  draw.clearKO = () => { ko.clear(); renderer.domElement.style.filter = ''; };
  return draw;
}
