/** Rebuild from the repo root: node art/characters/tung_tung_sahur/build_tung_tung_sahur.mjs
 * Metres, +Z facing, feet at zero; same joints and .3208 m arms as wobble_kit.py.
 * Uses Three.js so the model can be rebuilt without a local Blender installation.
 */
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mkdir, writeFile } from 'node:fs/promises';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
};
const root = new T.Group(); root.name = 'TungTungSahur';
const materials = Object.fromEntries(Object.entries({
  Wood: '#aa682f', Grain: '#75421e', Endgrain: '#cf9855',
  White: '#fff4dc', Pupil: '#211710', Mouth: '#452517', Shine: '#ffffff',
}).map(([name, color]) => [name, new T.MeshStandardMaterial({ name: `TS_${name}`, color, roughness: name === 'Pupil' ? .3 : .78 })]));
function part(name, parent, position, tag) {
  const group = new T.Group(); group.name = `TS_${name}`; group.position.set(...position);
  group.userData.ragdoll_part = tag; parent.add(group); return group;
}
function mesh(parent, geometry, material, position = [0, 0, 0]) {
  const obj = new T.Mesh(geometry, materials[material]); obj.position.set(...position); parent.add(obj); return obj;
}
function oval(parent, dims, material, position) {
  const obj = mesh(parent, new T.SphereGeometry(1, 20, 14), material, position);
  obj.scale.set(...dims.map(v => v / 2)); return obj;
}
function line(parent, points, radius, material) {
  return mesh(parent, new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 24, radius, 6, false), material);
}
const torso = part('Torso', root, [0, .34, 0], 'torso');
mesh(torso, new T.CylinderGeometry(.285, .30, .65, 32), 'Wood', [0, .325, 0]);
// Separate upper log follows the existing head-lag animation with a nearly invisible seam.
const head = part('Head', torso, [0, .65, 0], 'head');
mesh(head, new T.CylinderGeometry(.28, .285, .54, 32), 'Wood', [0, .27, 0]);
mesh(head, new T.CylinderGeometry(.274, .274, .008, 40), 'Endgrain', [0, .543, 0]);
for (const radius of [.075, .14, .215]) {
  const ring = mesh(head, new T.TorusGeometry(radius, .004, 5, 48), 'Grain', [0, .549, 0]);
  ring.rotation.x = -Math.PI / 2;
}
// Fine longitudinal grain wraps the entire cylinder, leaving room around the face.
for (let i = 0; i < 22; i++) {
  const angle = i * Math.PI * 2 / 22;
  for (const [parent, length, bottom] of [[torso, .60, .025], [head, .49, .015]]) {
    if (parent === head && Math.cos(angle) > .55) continue;
    const points = Array.from({ length: 13 }, (_, j) => {
      const a = angle + .018 * Math.sin(j * .8 + i);
      const radius = parent === head ? .286 - j * .0003 : .30 - j * .001;
      return [Math.sin(a) * radius, bottom + length * j / 12, Math.cos(a) * radius];
    });
    line(parent, points, i % 3 ? .0025 : .004, 'Grain');
  }
}
for (const s of [-1, 1]) {
  oval(head, [.19, .22, .10], 'White', [s * .118, .31, .265]);
  oval(head, [.085, .12, .045], 'Pupil', [s * .108, .30, .318]);
  oval(head, [.025, .033, .015], 'Shine', [s * .108 - .014, .329, .341]);
  line(head, [[s * .04, .438, .282], [s * .12, .458, .275], [s * .20, .43, .23]], .018, 'Grain');
}
oval(head, [.08, .12, .13], 'Wood', [0, .21, .30]);
line(head, [[-.12, .13, .265], [-.065, .095, .284], [0, .083, .292], [.065, .095, .284], [.12, .13, .265]], .013, 'Mouth');
for (const s of [-1, 1]) {
  const arm = part(`Arm_${s === 1 ? 'L' : 'R'}`, torso, [s * .30, .43, 0], 'upper_arm');
  const direction = new T.Vector3(s * .20, -.25, .02);
  const shaft = mesh(arm, new T.CylinderGeometry(.052, .062, direction.length(), 14), 'Wood');
  shaft.position.copy(direction).multiplyScalar(.5);
  shaft.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.clone().normalize());
  const hand = part(`Hand_${s === 1 ? 'L' : 'R'}`, arm, direction.toArray(), 'hand');
  // Keep the wrist first, matching the existing exported rig hierarchy.
  arm.remove(shaft); arm.add(shaft);
  oval(hand, [.15, .17, .14], 'Wood', [s * .018, -.035, .025]);
  for (let finger = 0; finger < 3; finger++)
    oval(hand, [.035, .09, .06], 'Endgrain', [s * .02 + (finger - 1) * .037, -.067, .07]);
  if (s === -1) {
    // Long bat (longer than the sword pickup), with no separate weapon animation or reach multiplier. The hand
    // keeps only the handle and lower barrel, spanning exactly the old compact bat's extent, so the fist's hit
    // sphere (combat-rig.js sizes it from the hand) is unchanged; the rest of the bat rides on the arm at the wrist.
    oval(hand, [.075, .04, .075], 'Grain', [0, -.02, .025]);                                  // knob
    mesh(hand, new T.CylinderGeometry(.032, .032, .17, 12), 'Grain', [0, .07, .025]);          // handle
    mesh(hand, new T.CylinderGeometry(.066, .034, .305, 16), 'Endgrain', [0, .3075, .025]);    // lower barrel, top .46 as wide as the old cap
    const wrist = new T.Vector3(...direction.toArray()).add(new T.Vector3(0, 0, .025));
    mesh(arm, new T.CylinderGeometry(.09, .066, .84, 18), 'Endgrain', wrist.clone().add(new T.Vector3(0, .88, 0)).toArray());  // upper barrel .46-1.3
    oval(arm, [.18, .09, .18], 'Endgrain', wrist.clone().add(new T.Vector3(0, 1.3, 0)).toArray());                         // rounded end
    for (const y of [.62, .86, 1.1])                                                                                         // grain bands
      mesh(arm, new T.CylinderGeometry(.073 + y * .015, .073 + y * .015, .012, 18), 'Grain', wrist.clone().add(new T.Vector3(0, y, 0)).toArray());
  }
  const leg = part(`Leg_${s === 1 ? 'L' : 'R'}`, torso, [s * .135, -.015, 0], 'leg');
  mesh(leg, new T.CylinderGeometry(.055, .048, .22, 14), 'Wood', [0, -.11, 0]);
  const foot = part(`Foot_${s === 1 ? 'L' : 'R'}`, leg, [0, -.245, .055], 'foot');
  oval(foot, [.17, .16, .29], 'Wood', [0, 0, .025]);
  for (let toe = 0; toe < 3; toe++)
    oval(foot, [.045, .07, .075], 'Endgrain', [(toe - 1) * .048, -.025, .145]);
}
root.updateMatrixWorld(true);
const output = new URL('../../../host/assets/characters/tung_tung_sahur.glb', import.meta.url);
await mkdir(new URL('.', output), { recursive: true });
const data = await new GLTFExporter().parseAsync(root, { binary: true, trs: true });
await writeFile(output, Buffer.from(data));
console.log(`Exported Tung Tung Sahur: ${data.byteLength} bytes`);
