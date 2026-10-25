import * as T from 'three';
import { createCombatRig } from './combat-rig.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Fighter models from art/characters/. Exported in metres, facing +Z, feet at y=0, parts named <prefix>Torso,
// <prefix>Arm_L/R, <prefix>Leg_L/R. Every fighter shares one scale so the standard arm length
// (art/characters/wobble_kit.py ARM) stays equal in game.
const SCALE = 1.4;
export const FIGHTERS = {
  squish: { name: 'Sir Squish', url: '/host/assets/characters/sir_squish.glb', prefix: 'SS_', teamMaterial: 'SS_PastelBlue' },
  crank: { name: 'Crank', url: '/host/assets/characters/crank.glb', prefix: 'CR_' },
  bonk: { name: 'Bonk-3000', url: '/host/assets/characters/bonk3000.glb', prefix: 'BK_' },
  nik: { name: 'Nik', url: '/host/assets/characters/nik.glb', prefix: 'NK_', teamMaterial: 'NK_Gloves' },
  tung: { name: 'Tung Tung Sahur', url: '/host/assets/characters/tung_tung_sahur.glb', prefix: 'TS_' },
  // impactFx: extra hit effect for this fighter (crumbs.js).
  toast: { name: 'Toast Malone', url: '/host/assets/characters/toast_malone.glb', prefix: 'TM_', teamMaterial: 'TM_Gloves', impactFx: 'crumbs' },
  conehead: { name: 'Conehead', url: '/host/assets/characters/conehead.glb', prefix: 'CH_', teamMaterial: 'CH_Gloves' },
  bubbles: { name: 'Captain Bubbles', url: '/host/assets/characters/captain_bubbles.glb', prefix: 'CB_', teamMaterial: 'CB_Gloves' },
};
export const TEAM_FIGHTERS = ['crank', 'squish']; // default picks: red, blue
const gltfs = new Map();

// Resolves to make(teamColor) -> { root, torso, arms, legs, wobbly }, matching the placeholder rig in render.js:
// torso sways/bobs from the feet, arms pivot at the shoulders ([right, left]), legs at the hips.
export async function loadFighter(id) {
  const spec = FIGHTERS[id];
  if (!gltfs.has(id)) gltfs.set(id, new GLTFLoader().loadAsync(spec.url));
  const gltf = await gltfs.get(id);
  return teamColor => {
    const root = gltf.scene.clone(true); root.updateMatrixWorld(true);
    const node = name => root.getObjectByName(spec.prefix + name), materials = new Map();
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      o.material = materials.get(o.material.name) ?? materials.set(o.material.name, o.material.clone()).get(o.material.name);
    });
    // See-through parts (Captain Bubbles' glass bowl and water) shouldn't hide what's inside them.
    for (const m of materials.values()) if (m.transparent) m.depthWrite = false;
    // Optional team colour on one kit material, kept pastel.
    if (spec.teamMaterial) materials.get(spec.teamMaterial)?.color.set(teamColor).lerp(new T.Color('#ffffff'), 0.3);
    // Preserve authored metals now that every arena supplies environment illumination.
    // Heads and loose gear (pot helmet, shell) lag behind the body on top of their rest pose; see clumsy.js.
    const wobbly = [];
    // Gear: maxTilt caps the extra tilt (radians); lift = rim radius (m), so a tilted pot rides up on the head
    // instead of its rim swinging down through it.
    // butter: soft gear that jiggles (jiggle.js).
    // cone: a top-heavy hat that hops and rocks on the jiggle spring and lags loose enough to flop over.
    // water / fish / fishtail: the fishbowl head's sloshing water and swimming goldfish (fishbowl.js).
    const WOBBLY = { head: { kind: 'head' }, helmet: { kind: 'gear', maxTilt: .18, lift: .35 }, shell: { kind: 'gear', maxTilt: .6, lift: 0 }, butter: { kind: 'jiggle' }, cone: { kind: 'bounce', maxTilt: .55 },
      water: { kind: 'water' }, fish: { kind: 'fish' }, fishtail: { kind: 'fishtail' } };
    root.traverse(o => { const w = WOBBLY[o.userData.ragdoll_part]; if (w) wobbly.push({ node: o, ...w, rest: o.rotation.clone(), restY: o.position.y, restScale: o.scale.clone() }); });
    const legs = [node('Leg_R'), node('Leg_L')]; legs.forEach(leg => root.attach(leg));
    const torso = new T.Group(); root.add(torso); torso.attach(node('Torso'));
    // Team ring at the feet keeps mirror matches readable.
    const ring = new T.Mesh(new T.RingGeometry(.42, .52, 40), new T.MeshBasicMaterial({ color: teamColor }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .01; root.add(ring);
    root.scale.setScalar(SCALE);
    const collisionRoot = gltf.scene.clone(true);
    const collisionNode = name => collisionRoot.getObjectByName(spec.prefix + name);
    const combatRig = createCombatRig(collisionRoot,
      [collisionNode('Arm_R'), collisionNode('Arm_L')],
      [collisionNode('Hand_R') || collisionNode('Glove_R'), collisionNode('Hand_L') || collisionNode('Glove_L')], SCALE, collisionNode('Torso'));
    return { combatRig, root, torso, arms: [node('Arm_R'), node('Arm_L')], legs, wobbly, impactFx: spec.impactFx };
  };
}
