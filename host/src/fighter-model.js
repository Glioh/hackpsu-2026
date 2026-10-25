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
};
export const TEAM_FIGHTERS = ['crank', 'squish']; // default picks: red, blue
const gltfs = new Map();

// Jelly body: bends every vertex sideways by uJelly (world units at the top of the body) scaled by
// (height above the feet / uHeight)^2, so feet stay planted and the top lags and sways. Shadows stay rigid.
function makeJelly(material, uniforms) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uJelly; uniform vec3 uFeet; uniform float uHeight;')
      .replace('#include <project_vertex>', `
        vec4 jellyWorld = modelMatrix * vec4( transformed, 1.0 );
        float jellyH = clamp( ( jellyWorld.y - uFeet.y ) / uHeight, 0.0, 1.5 );
        jellyWorld.xyz += uJelly * jellyH * jellyH;
        vec4 mvPosition = viewMatrix * jellyWorld;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  material.customProgramCacheKey = () => 'jelly';
}

// Resolves to make(teamColor) -> { root, torso, arms, legs, wobbly, jelly }, matching the placeholder rig in render.js:
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
    // Optional team colour on one kit material, kept pastel.
    if (spec.teamMaterial) materials.get(spec.teamMaterial)?.color.set(teamColor).lerp(new T.Color('#ffffff'), 0.3);
    // The arena has no environment map, so full metal (Sir Squish's pot) would render near-black.
    for (const m of materials.values()) if (m.metalness > 0.5) Object.assign(m, { metalness: 0.3, roughness: 0.4 });
    const jelly = { uJelly: { value: new T.Vector3() }, uFeet: { value: new T.Vector3() }, uHeight: { value: 2.4 } };
    for (const m of materials.values()) makeJelly(m, jelly);
    // Heads and loose gear (pot helmet, shell) wobble on top of their rest pose; see wobble.js.
    const wobbly = [];
    // Gear: maxTilt caps the extra wobble (radians); lift = rim radius (m), so a tilted pot rides up on the head
    // instead of its rim swinging down through it.
    const WOBBLY = { head: { kind: 'head' }, helmet: { kind: 'gear', maxTilt: .18, lift: .35 }, shell: { kind: 'gear', maxTilt: .6, lift: 0 } };
    root.traverse(o => { const w = WOBBLY[o.userData.ragdoll_part]; if (w) wobbly.push({ node: o, ...w, rest: o.rotation.clone(), restY: o.position.y }); });
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
    return { combatRig, root, torso, arms: [node('Arm_R'), node('Arm_L')], legs, wobbly, jelly };
  };
}
