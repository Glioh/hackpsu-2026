import * as T from 'three';
import { CONFIG as C } from '../../shared/config.js';

// Use the same damage range that increases launch recoil in the simulation.
export function hitColor(damage = 0) {
  const heat = Math.max(0, Math.min(1, damage / C.knockbackSoftCap));
  return new T.Color('#fff2cb').lerp(new T.Color('#ff2020'), heat);
}

export function hitDirection(body, impact) {
  let x = impact?.x ?? body.vx, z = impact?.z ?? body.vz;
  const length = Math.hypot(x, z);
  if (length > .001) return { x: x / length, z: z / length };
  return { x: Math.sin(body.heading), z: Math.cos(body.heading) };
}

// Preserve every material's original appearance, including shared rig materials.
export function createHitFlash(group) {
  const originals = new Map();
  group.traverse(o => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || originals.has(m)) continue;
      originals.set(m, { color: m.color?.clone(), emissive: m.emissive?.clone(), intensity: m.emissiveIntensity });
    }
  });
  return (strength, damage = 0) => {
    const color = hitColor(damage);
    for (const [m, base] of originals) {
      if (base.color) m.color.copy(base.color).lerp(color, strength);
      if (base.emissive) { m.emissive.copy(base.emissive).lerp(color, strength); m.emissiveIntensity = (base.intensity ?? 1) + strength * 1.2; }
    }
  };
}

export function createHitEffects(scene, texture = new T.TextureLoader().load('/host/assets/ko/flare.svg')) {
  const particles = Array.from({ length: 120 }, () => {
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
    sprite.visible = false; scene.add(sprite);
    return { sprite, velocity: new T.Vector3(), age: 0, life: 0, size: 0 };
  });
  const trails = new Map(); let cursor = 0;
  function emit(body, direction, burst = false) {
    const p = particles[cursor++ % particles.length];
    const { x: nx, z: nz } = direction;
    const side = (Math.random() - .5) * .35, forward = burst ? 3 + Math.random() * 2 : 1.5;
    // Exit the far side of the victim, away from the attacker, in a narrow cone.
    p.sprite.position.set(body.x + nx * .7 - nz * side, body.y + 1.2, body.z + nz * .7 + nx * side);
    p.velocity.set(nx * forward - nz * side * 2, .6 + Math.random() * 1.2, nz * forward + nx * side * 2);
    p.age = 0; p.life = burst ? .25 + Math.random() * .2 : .35;
    p.size = burst ? .22 + Math.random() * .22 : .2 + Math.random() * .15;
    p.sprite.material.color.copy(hitColor(body.damage));
    p.sprite.material.opacity = 1; p.sprite.scale.setScalar(p.size); p.sprite.visible = true;
  }
  return {
    hit(body, impact) {
      const direction = hitDirection(body, impact);
      trails.set(body.team, { remaining: .22, accumulator: 0, direction });
      for (let i = 0; i < 12; i++) emit(body, direction, true);
    },
    update(bodies, dt) {
      for (const p of particles) {
        if (!p.sprite.visible) continue;
        p.age += dt;
        if (p.age >= p.life) { p.sprite.visible = false; continue; }
        p.velocity.y -= dt * 5; p.sprite.position.addScaledVector(p.velocity, dt);
        const fade = 1 - p.age / p.life;
        p.sprite.material.opacity = fade * fade; p.sprite.scale.setScalar(p.size * (.5 + fade));
      }
      for (const body of bodies) {
        const trail = trails.get(body.team); if (!trail) continue;
        trail.remaining -= dt; trail.accumulator += dt;
        while (trail.accumulator >= .03 && trail.remaining > 0) { trail.accumulator -= .03; emit(body, trail.direction); }
        if (trail.remaining <= 0) trails.delete(body.team);
      }
    },
    clear() { trails.clear(); particles.forEach(p => { p.sprite.visible = false; }); },
  };
}
