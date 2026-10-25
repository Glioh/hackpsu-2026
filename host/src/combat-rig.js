import * as T from 'three';
import { createCharacter } from './characters.js';
import { punchAngle } from './motion.js';

// Mesh-local boxes preserve each part's orientation; hands sweep along the same
// shoulder arc as the rendered uppercut. No cone or invisible reach extension.
export function createCombatRig(root, arms, hands, scale = 1, torso = null) {
  const group = new T.Group(); group.add(root); root.scale.setScalar(scale);
  const parts = [];
  root.traverse(node => {
    if (!node.isMesh) return;
    node.geometry.computeBoundingBox();
    parts.push({ node, box: node.geometry.boundingBox.clone() });
  });
  group.updateMatrixWorld(true);
  const bounds = (node, ownOnly = false) => {
    const box = new T.Box3(), inverse = node.matrixWorld.clone().invert();
    node.traverse(part => {
      if (part.isMesh && (!ownOnly || part === node || part.parent === node))
        box.union(part.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(part.matrixWorld)));
    });
    return box;
  };
  // Use the main torso mesh for solid body contact. Small attached decoration
  // remains hittable but must not hold opponents outside their arm reach.
  const torsoMeshes = torso ? (torso.isMesh ? [torso] : torso.children.filter(p => p.isMesh)) : [];
  const mainTorso = torsoMeshes.sort((a,b) => {
    const size = node => node.geometry.boundingBox.getSize(new T.Vector3());
    const av=size(a), bv=size(b); return bv.x*bv.y*bv.z-av.x*av.y*av.z;
  })[0];
  const bodyBox = mainTorso ? mainTorso.geometry.boundingBox.clone().applyMatrix4(mainTorso.matrixWorld) : null;
  const radius = bodyBox ? Math.max(bodyBox.max.x-bodyBox.min.x, bodyBox.max.z-bodyBox.min.z)/2 : .62;
  const handSpheres = hands.map(hand => bounds(hand).getBoundingSphere(new T.Sphere()));
  return { group, arms, hands, handSpheres, parts, radius,
    pose(f, remaining = f.attack) {
      group.position.set(f.x, f.y + .09, f.z); group.rotation.y = f.heading;
      arms.forEach((arm, j) => arm.rotation.set(punchAngle(remaining), 0, (remaining > 0 ? (j ? -1 : 1)*.6 : (j ? 1 : -1)*.12)));
      group.updateMatrixWorld(true);
    },
  };
}
export function fallbackCombatRig() {
  const m = createCharacter('#ffffff', (geometry, color, parent) => {
    const mesh = new T.Mesh(geometry); parent.add(mesh); return mesh;
  });
  return createCombatRig(m.group, m.arms, m.arms.map(a => a.children[1]));
}
export function uppercutHits(attacker, target, f, victim, previousAttack, dt) {
  const forward = (victim.x-f.x)*Math.sin(f.heading)+(victim.z-f.z)*Math.cos(f.heading);
  if (forward <= 0) return false;
  target.pose(victim);
  const inverse = new T.Matrix4(), sphere = new T.Sphere(), local = new T.Sphere();
  // Substeps also prevent a fast hand from skipping thin character parts.
  for (let step = 0; step <= 8; step++) {
    const t = step / 8, remaining = previousAttack + (f.attack - previousAttack)*t;
    if (remaining > .23 || remaining < .09) continue;
    attacker.pose({ ...f, x:f.x-f.vx*dt*(1-t), y:f.y-f.vy*dt*(1-t), z:f.z-f.vz*dt*(1-t) }, remaining);
    for (let j=0;j<attacker.hands.length;j++) {
      sphere.copy(attacker.handSpheres[j]).applyMatrix4(attacker.hands[j].matrixWorld);
      for (const part of target.parts) {
        inverse.copy(part.node.matrixWorld).invert();
        local.copy(sphere).applyMatrix4(inverse);
        if (part.box.intersectsSphere(local)) return true;
      }
    }
  }
  return false;
}
