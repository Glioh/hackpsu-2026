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
import { FINISH_TIME_SCALE } from './ko-finish.js';
import { createHitEffects, createHitFlash } from './hit-effects.js';
import { createJiggle } from './jiggle.js';
import { createFishbowl } from './fishbowl.js';
import { createWukongGags } from './wukong-gags.js';
import { createWeaponView } from './weapon-view.js';
import { createCrumbs } from './crumbs.js';
import { createContactShadows } from './contact-shadows.js';
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
  const contactShadows = createContactShadows(scene);
  function mesh(geometry, color, parent = scene) { const m = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.85 })); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  const drawArena = createArenaView(scene), fallbackArena = createArena('classic');
  const ground = mesh(new T.PlaneGeometry(1000,1000),'#bac797'); ground.rotation.x=-Math.PI/2; ground.position.y=-6; ground.castShadow=false;
  // torsoY: rest height of the torso group (capsule fallback sits at .9, loaded characters at their feet).
  const models = ['#ff665b','#63c7ec'].map(color => { const model = createCharacter(color, mesh); scene.add(model.group); return { ...model, torsoY: model.torso.position.y }; });
  let flashes = models.map(m => createHitFlash(m.group));
  let clumsies = models.map((_, i) => createClumsy(i));
  // Per-fighter extras that only some characters opt into: jiggling gear and crumbs on impacts.
  let jiggles = models.map(() => createJiggle()), bowls = models.map(() => createFishbowl()), gags = models.map(() => createWukongGags());
  const knockedOut = new Set();                                            // teams rung out this round (startKO)
  const crumbs = createCrumbs(scene), landings = [null, null], weaponView = createWeaponView(scene);
  let punchShake = 0;                                                     // spring glove impacts rattle the camera
  // 1 when the floor ends within reach of a grounded fighter (map edge, tile hole, platform edge): time to teeter.
  const edgeNear = (arena, f) => {
    if (!f.grounded) return 0;
    for (let k = 0; k < 8; k++) if (!arena.floorAt(f.x + Math.cos(k * Math.PI / 4) * .8, f.z + Math.sin(k * Math.PI / 4) * .8)) return 1;
    return 0;
  };
  // Swaps team i's body to character id. The current body (capsule fallback at first) stays if loading fails,
  // and a slower earlier pick never overwrites a newer one.
  const setFighter=(i,id,color)=>{ensureModels(i+1);const m=models[i];m.color=color||m.color||['#ff665b','#63c7ec'][i%2];m.pick=id;loadFighter(id).then(make=>{if(m.pick!==id)return;const s=make(m.color);enrichMaterials(s.root);m.group.clear();m.group.add(s.root);Object.assign(m,s,{head:null,torsoY:0});flashes[i]=createHitFlash(m.group);onCombatRig(i,s.combatRig);},err=>console.warn(id+' model unavailable; keeping current fighter',err));};
  function ensureModels(count) {
    while (models.length < count) {
      const i = models.length, model = createCharacter('#ffd447', mesh);
      scene.add(model.group); models.push({ ...model, torsoY: model.torso.position.y });
      flashes.push(createHitFlash(model.group)); clumsies.push(createClumsy(i));
      jiggles.push(createJiggle()); bowls.push(createFishbowl()); gags.push(createWukongGags()); landings.push(null); hitAges.push(Infinity);
    }
  }
  const resize=()=>{const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}; const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); resize();
  // fighters: interpolated motion poses from motion.js; bodies: raw simulation fighters (velocity, landings, hits);
  // arena: the simulation's current map (maps.js).
  // weapons: the simulation's weapon pickups, grenades and blasts (weapons.js state).
  const draw = (fighters, time, bodies = [], arena = fallbackArena, { active = true, motionEnabled = true, finishAge = null, weapons = null } = {}) => {
    const dt = previousTime === null ? 0 : Math.max(0, Math.min(.1, time - previousTime));
    renderer.domElement.style.filter = finishAge === null ? '' : `grayscale(${Math.min(1, finishAge / .22)}) contrast(1.15)`;
    ko.update(active ? dt / (finishAge === null ? 1 : FINISH_TIME_SCALE) : 0);
    hitEffects.update(bodies, active ? dt : 0);
    crumbs.update(active ? dt : 0, (x, z) => { const floor = arena.floorAt?.(x, z); return floor ? floor.y + .04 : undefined; });
    const piano=arena.id==='piano';
    const factory=arena.id==='conveyor';
    const twinspire=arena.id==='twinspire';
    const lava = arena.id === 'lava';
    ground.visible = !lava;
    const rooftop = arena.id === 'skyline'||twinspire||arena.id==='station', mountain = arena.id === 'mountain'||arena.id==='quake', elevated = rooftop || mountain || lava;
    ground.position.y = twinspire ? -39 : piano ? -24 : mountain ? -40 : rooftop ? -24 : -6;
    ground.material.color.set(factory ? '#435459' : piano ? '#292830' : mountain ? '#879bb1' : rooftop ? '#66798d' : '#96a7ba');
    cameraDirection.fromArray(elevated ? ROOFTOP_CAMERA_DIRECTION : CAMERA_DIRECTION);
    const framingOptions=lava?{minDistance:Math.max(24,25/camera.aspect),padding:1.2}:piano?{minDistance:7,padding:1.08}:undefined;
    ensureModels(fighters.length);
    models.forEach((m, i) => { if (i >= fighters.length) m.group.visible = false; });
    const visibleFighters = fighters.filter((_, i) => !bodies[i] || bodies[i].lives > 0 && !bodies[i].respawnRemaining);
    const framed = visibleFighters.length ? visibleFighters : fighters.slice(0, 1);
    const framing = frameFighters(framed, camera.aspect, undefined, elevated, framingOptions);
    const desiredFocus = new T.Vector3(...framing.target);
    if (previousTime === null) cameraFocus.copy(desiredFocus);
    else cameraFocus.lerp(desiredFocus, 1 - Math.exp(-2.5 * dt));
    // Fit against the smoothed focus too, so fighters stay visible during pans.
    const requiredDistance = frameFighters(framed, camera.aspect, cameraFocus.toArray(), elevated, framingOptions).distance;
    if (previousTime === null || requiredDistance > cameraDistance) cameraDistance = requiredDistance;
    else cameraDistance += (requiredDistance - cameraDistance) * (1 - Math.exp(-1.5 * dt));
    camera.position.copy(cameraFocus).addScaledVector(cameraDirection, cameraDistance);
    camera.lookAt(cameraFocus);
    if (arena.shake) camera.position.add(new T.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(.45 * arena.shake)); // quake
    drawArena(arena, time, arena.id==='piano'?bodies:fighters, camera);
    contactShadows.update(fighters, arena);
    previousTime = time;

    fighters.forEach((f, i) => {
      const m = models[i], pose = f.pose, body = bodies[i];
      if (m.marker) {
        m.marker.visible = m.label.visible = !body?.respawnRemaining && body?.lives !== 0;
        m.marker.position.set(f.x, f.y + .04, f.z);
        m.label.position.set(f.x, f.y + 3.25, f.z);
      }
      if (active) hitAges[i] += dt;
      const age = hitAges[i];
      flashes[i](age < .075 ? 1 : age < .13 ? .15 : age < .19 ? .8 * (1 - (age - .13) / .06) : 0, body?.damage ?? 0);
      m.group.visible = !body?.respawnRemaining && body?.lives !== 0;
      m.group.position.set(f.x, f.y + .09, f.z);
      m.group.rotation.y = f.heading;
      // Wukong: a winner's victory twirl topples him over; a loser's headband slips over his eyes.
      const hasStaff = m.wobbly?.some(w => w.kind === 'staff'), won = finishAge !== null && knockedOut.size === 1 && body && !knockedOut.has(body.team);
      const victory = hasStaff && won ? gags[i].victory(finishAge) : null;
      m.group.rotation.order = 'YXZ'; m.group.rotation.z = victory?.tilt ?? 0;
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
      if (body && m.impactFx === 'crumbs') {                                   // hard landings shed crumbs too
        const was = landings[i];
        if (was && !was.grounded && body.grounded && was.vy < -9) crumbs.burst(body, 14, .7);
        landings[i] = { grounded: body.grounded, vy: body.vy };
      }
      const j = body && m.wobbly?.some(w => w.kind === 'jiggle' || w.kind === 'bounce') ? jiggles[i](body, active ? dt : 0, motionEnabled) : null;
      const bowl = body && m.wobbly?.some(w => w.kind === 'fish' || w.kind === 'water') ? bowls[i](body, active ? dt : 0, motionEnabled) : null;
      const falling = body && (knockedOut.has(body.team) || (!body.grounded && body.vy < -4 && !arena.floorAt(body.x, body.z, body.y)));
      m.wobbly?.forEach(({ node, kind, rest, restY, restScale, maxTilt, lift }) => {
        if (kind === 'staff') { node.rotation.set(rest.x + (victory ? victory.spin : gags[i].staff(m.arms[0].rotation.x, active ? dt : 0, motionEnabled)), rest.y, rest.z); return; }
        if (kind === 'crown') { const slip = gags[i].crown(falling, active ? dt : 0); node.position.y = restY - .18 * slip; node.rotation.set(rest.x + .3 * slip, rest.y, rest.z); return; }
        if (kind === 'water' || kind === 'fish' || kind === 'fishtail') {                      // fishbowl head
          if (!bowl) return;
          if (kind === 'water') node.rotation.set(rest.x + bowl.water.x, rest.y, rest.z + bowl.water.z);
          else if (kind === 'fish') { node.rotation.set(rest.x + bowl.fish.pitch, rest.y + bowl.fish.yaw, rest.z + bowl.fish.roll); node.position.y = restY + bowl.fish.y; }
          else node.rotation.set(rest.x, rest.y + bowl.tail, rest.z);
        }
        else if (kind === 'jiggle') { if (j) { node.scale.set(restScale.x * j.xz, restScale.y * j.y, restScale.z * j.xz); node.rotation.set(rest.x, rest.y, rest.z + j.tilt); } }
        else if (kind === 'bounce') {                                           // cone hops off the head and rocks
          const b = j ? 1 - j.y : 0, x = Math.max(-maxTilt, Math.min(maxTilt, k.gear.x * 1.6 + b * .7)), z = Math.max(-maxTilt, Math.min(maxTilt, k.gear.z * 1.6 + b * .35));
          node.rotation.set(rest.x + x, rest.y, rest.z + z);
          node.position.y = restY + Math.abs(b) * .3 + .25 * (Math.abs(Math.sin(x)) + Math.abs(Math.sin(z)));
        }
        else if (kind === 'head') node.rotation.set(rest.x + pose.headPitch + k.head.x, rest.y + pose.headYaw, rest.z + pose.headRoll + k.head.z);
        else {
          const x = Math.max(-maxTilt, Math.min(maxTilt, k.gear.x)), z = Math.max(-maxTilt, Math.min(maxTilt, k.gear.z));
          node.rotation.set(rest.x + x, rest.y, rest.z + z);
          node.position.y = restY + lift * (Math.abs(Math.sin(x)) + Math.abs(Math.sin(z))); // rock on the rim
        }
      });
    });
    for (const target of weaponView.update(weapons, bodies, models, time, active ? dt : 0)) { hitEffects.hit(target); punchShake = .3; }
    punchShake = Math.max(punchShake, weaponView.takeShake());               // grenade blasts too
    if (punchShake > 0) { camera.position.add(new T.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(1.6 * punchShake)); punchShake = Math.max(0, punchShake - dt); }
    environment.apply(arena, camera);
    if(materialArena!==arena){enrichMaterials(scene);materialArena=arena;}
    renderer.render(scene, camera);
  };
  draw.resetMotion = () => { hitEffects.clear(); weaponView.clear(); crumbs.clear(); landings.fill(null); hitAges.fill(Infinity); flashes.forEach(flash => flash(0)); clumsies = models.map((_, i) => createClumsy(i)); jiggles = models.map(() => createJiggle()); bowls = models.map(() => createFishbowl()); gags.forEach(g => g.reset()); };
  draw.setFighter = setFighter;
  draw.configure = fighters => {
    ensureModels(fighters.length);
    fighters.forEach((f, i) => {
      const m = models[i]; m.fighterId = f.id; setFighter(i, f.character, f.color);
      if (!m.marker) {
        m.marker = new T.Mesh(new T.RingGeometry(.7, .83, 40), new T.MeshBasicMaterial({ color: f.color, side: T.DoubleSide, depthWrite: false }));
        m.marker.rotation.x = -Math.PI / 2; scene.add(m.marker);
        m.label = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
        m.label.scale.set(2.4, .6, 1); scene.add(m.label);
      }
      m.marker.material.color.set(f.color);
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
      const context = canvas.getContext('2d'); context.fillStyle = '#080d18dd'; context.fillRect(0, 0, 256, 64);
      context.font = 'bold 32px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = f.color;
      context.fillText((f.label || f.id).toUpperCase(), 128, 34);
      m.label.material.map?.dispose(); m.label.material.map = new T.CanvasTexture(canvas); m.label.material.needsUpdate = true;
    });
    models.forEach((m, i) => { if (i >= fighters.length) { m.group.visible = false; if (m.marker) m.marker.visible = m.label.visible = false; } });
  };
  draw.weaponAudio = weaponView.audio;                                    // grenade sounds (weapon-audio.js)
  draw.weaponDrop = event => weaponView.weaponDrop(event);
  draw.clearDropEffects = () => weaponView.clearDropEffects();
  draw.dispose = () => { resizeObserver.disconnect(); ko.clear(); contactShadows.dispose(); environment.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  draw.diagnostics = () => ({ calls:renderer.info.render.calls, triangles:renderer.info.render.triangles, textures:renderer.info.memory.textures, geometries:renderer.info.memory.geometries, environments:environment.cacheSize, exposure:renderer.toneMappingExposure });
  draw.hit = (body, impact) => {
    if (!body) return;
    const index = models.findIndex(m => m.fighterId === body.team);
    const targetIndex = index < 0 ? (body.team === 'red' ? 0 : 1) : index;
    hitAges[targetIndex] = 0; hitEffects.hit(body, impact);
    if (models[targetIndex]?.impactFx === 'crumbs') { const heavy = Math.hypot(body.vx, body.vz) > 7; crumbs.burst(body, heavy ? 24 : 6, heavy ? 1.2 : .6, impact); }
  };
  draw.startKO = fighters => { ko.trigger(fighters); fighters.forEach(f => knockedOut.add(f.team)); };
  draw.clearKO = () => { ko.clear(); knockedOut.clear(); renderer.domElement.style.filter = ''; };
  return draw;
}
