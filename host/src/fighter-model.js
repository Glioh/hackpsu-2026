import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Fighter models from art/characters/. Exported in metres, facing +Z, feet at y=0, parts named <prefix>Torso,
// <prefix>Arm_L/R, <prefix>Leg_L/R. Every fighter shares one scale so the standard arm length
// (art/characters/wobble_kit.py ARM) stays equal in game.
const SCALE = 1.4;
export const FIGHTERS = {
  squish: { url: '/host/assets/characters/sir_squish.glb', prefix: 'SS_', teamMaterial: 'SS_PastelBlue' },
  crank: { url: '/host/assets/characters/crank.glb', prefix: 'CR_' },
};
export const TEAM_FIGHTERS = ['crank', 'squish']; // red, blue
const gltfs = new Map();

// Resolves to make(teamColor) -> { root, torso, arms, legs }, matching the placeholder rig in render.js:
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
    const legs = [node('Leg_R'), node('Leg_L')]; legs.forEach(leg => root.attach(leg));
    const torso = new T.Group(); root.add(torso); torso.attach(node('Torso'));
    root.scale.setScalar(SCALE);
    return { root, torso, arms: [node('Arm_R'), node('Arm_L')], legs };
  };
}
