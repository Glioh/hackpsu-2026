import * as T from 'three';

export const KO_LIFETIME = 1.5;

// Render-only world objects. No physics bodies or live fighter references.
export function createKOEffects(scene) {
  const puffGeometry = new T.IcosahedronGeometry(1, 1);
  const chipGeometry = new T.OctahedronGeometry(1);
  const ringGeometry = new T.TorusGeometry(1, .045, 6, 48);
  const seen = new Set(), blasts = new Set();
  let clock = 0;
  function remove(b) {
    scene.remove(b.group);
    b.materials.forEach(m => m.dispose());
    blasts.delete(b);
  }
  function trigger(fighters) {
    for (const f of fighters) {
      if (seen.has(f.team)) continue;
      seen.add(f.team);
      const color = f.team === 'red' ? '#ff5575' : '#49ceff';
      const material = (tint, emissiveIntensity) => new T.MeshStandardMaterial({
        color: tint, emissive: tint, emissiveIntensity, roughness: .65,
        transparent: true, depthWrite: false,
      });
      const cloud = material(color, .28), cream = material('#fff1d6', .12), glow = material(color, 1.3);
      const group = new T.Group(); group.name = `World KO: ${f.team}`;
      // Capture the actual torso location independently of subsequent respawns.
      group.position.set(f.x, f.y + .9, f.z); scene.add(group);
      const puffs = Array.from({ length: 12 }, (_, i) => {
        const mesh = new T.Mesh(puffGeometry, i % 3 ? cloud : cream); group.add(mesh);
        const angle = i * 2.39996;
        return { mesh, direction: new T.Vector3(Math.cos(angle), .35 + (i % 4) * .25, Math.sin(angle)), speed: 1.4 + (i % 3) * .45 };
      });
      const chips = Array.from({ length: 10 }, (_, i) => {
        const mesh = new T.Mesh(chipGeometry, i % 2 ? cream : glow); group.add(mesh);
        const angle = i * Math.PI * 2 / 10;
        return { mesh, velocity: new T.Vector3(Math.cos(angle) * 2.4, 9 + (i % 3), Math.sin(angle) * 2.4) };
      });
      const rings = [0, 1].map(i => {
        const mesh = new T.Mesh(ringGeometry, glow);
        mesh.rotation.set(Math.PI / 2 + i * .45, i * .4, 0); group.add(mesh); return mesh;
      });
      blasts.add({ group, puffs, chips, rings, materials: [cloud, cream, glow], born: clock });
    }
    update(clock);
  }
  function update(time) {
    clock = time;
    for (const b of blasts) {
      const age = Math.max(0, time - b.born);
      if (age >= KO_LIFETIME) { remove(b); continue; }
      const fade = 1 - age / KO_LIFETIME;
      b.materials.forEach(m => { m.opacity = Math.min(1, fade * 2); });
      for (const { mesh, direction, speed } of b.puffs) {
        mesh.position.copy(direction).multiplyScalar(.15 + age * speed);
        // Rise above the arena lip, including deaths behind the rear edge.
        mesh.position.y += age * 4.8;
        mesh.scale.setScalar((.25 + Math.sin(Math.min(1, age / .45) * Math.PI / 2) * .55) * fade);
        mesh.rotation.set(age, speed + age * .7, age * .5);
      }
      for (const { mesh, velocity } of b.chips) {
        mesh.position.copy(velocity).multiplyScalar(age); mesh.position.y -= 2.5 * age * age;
        mesh.rotation.set(age * 7, age * 5, age * 3); mesh.scale.set(.13 * fade, .3 * fade, .13 * fade);
      }
      b.rings.forEach((ring, i) => { ring.scale.setScalar(.35 + age * (3.5 + i)); ring.position.y = age * (5.5 + i); });
    }
  }
  function clear() { for (const b of blasts) remove(b); seen.clear(); clock = 0; }
  return {
    trigger, update, clear,
    get count() { return blasts.size; },
    dispose() { clear(); puffGeometry.dispose(); chipGeometry.dispose(); ringGeometry.dispose(); },
  };
}
