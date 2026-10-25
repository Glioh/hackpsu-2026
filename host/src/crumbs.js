import * as T from 'three';
import { hitDirection } from './hit-effects.js';

// Toast crumbs for fighters with impactFx: 'crumbs': small tumbling bread chunks that burst out on impacts,
// bounce on the floor and fade. Pooled meshes, so bursts cost nothing to allocate mid-fight.
const COLORS = ['#e8b670', '#b2682e', '#d79a52', '#6a3a1e'];

export function createCrumbs(scene, count = 96) {
  const geometry = new T.BoxGeometry(1, 1, 1);
  const pool = Array.from({ length: count }, (_, i) => {
    const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ color: COLORS[i % COLORS.length], roughness: .9, transparent: true }));
    mesh.visible = false; mesh.castShadow = true; scene.add(mesh);
    return { mesh, velocity: new T.Vector3(), spin: new T.Vector3(), age: 0, life: 0 };
  });
  let cursor = 0;
  return {
    // power scales how far and high they fly; body is the raw simulation fighter that got hit or landed.
    burst(body, amount = 28, power = 1, impact) {
      const direction = impact ? hitDirection(body, impact) : null;
      for (let i = 0; i < amount; i++) {
        const c = pool[cursor++ % pool.length], a = Math.random() * Math.PI * 2, s = (1.5 + Math.random() * 3.5) * power;
        c.mesh.position.set(body.x + Math.cos(a) * .3, body.y + .6 + Math.random() * .9, body.z + Math.sin(a) * .3);
        c.velocity.set(Math.cos(a) * s + body.vx * .3, (2.5 + Math.random() * 4) * power, Math.sin(a) * s + body.vz * .3);
        if (direction) {
          const {x, z} = direction, side = (Math.random() - .5) * .4;
          c.mesh.position.set(body.x + x * .7 - z * side, body.y + 1.1, body.z + z * .7 + x * side);
          c.velocity.set(x * s - z * side, (1 + Math.random() * 2) * power, z * s + x * side);
        }
        c.spin.set(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6);
        c.mesh.scale.set(.05 + Math.random() * .07, .04 + Math.random() * .05, .05 + Math.random() * .07);
        c.age = 0; c.life = 1.2 + Math.random() * .8; c.mesh.material.opacity = 1; c.mesh.visible = true;
      }
    },
    // floorAt(x, z) -> floor top height there, or undefined over the void (crumbs then keep falling).
    update(dt, floorAt) {
      for (const c of pool) {
        if (!c.mesh.visible) continue;
        if ((c.age += dt) >= c.life) { c.mesh.visible = false; continue; }
        c.velocity.y -= 20 * dt;
        c.mesh.position.addScaledVector(c.velocity, dt);
        c.mesh.rotation.x += c.spin.x * dt; c.mesh.rotation.y += c.spin.y * dt; c.mesh.rotation.z += c.spin.z * dt;
        const floor = floorAt?.(c.mesh.position.x, c.mesh.position.z);
        if (floor !== undefined && c.velocity.y < 0 && c.mesh.position.y < floor + .1 && c.mesh.position.y > floor - .3) {
          c.mesh.position.y = floor + .1; c.velocity.y *= -.35; c.velocity.x *= .6; c.velocity.z *= .6; c.spin.multiplyScalar(.5);
        }
        c.mesh.material.opacity = Math.min(1, (c.life - c.age) / .4);
      }
    },
    clear() { pool.forEach(c => { c.mesh.visible = false; }); },
  };
}
