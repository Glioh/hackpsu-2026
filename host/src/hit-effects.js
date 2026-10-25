import * as T from 'three';

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
  return strength => {
    for (const [m, base] of originals) {
      if (base.color) m.color.copy(base.color).lerp(new T.Color('#ffffff'), strength);
      if (base.emissive) { m.emissive.copy(base.emissive).lerp(new T.Color('#fff2cb'), strength); m.emissiveIntensity = (base.intensity ?? 1) + strength * 2; }
    }
  };
}

export function createHitEffects(scene) {
  const texture = new T.TextureLoader().load('/host/assets/ko/flare.svg');
  const particles = Array.from({ length: 120 }, () => {
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
    sprite.visible = false; scene.add(sprite);
    return { sprite, velocity: new T.Vector3(), age: 0, life: 0, size: 0 };
  });
  const trails = new Map(); let cursor = 0;
  function emit(body, burst = false) {
    const p = particles[cursor++ % particles.length], speed = Math.hypot(body.vx, body.vz);
    const nx = speed > .01 ? body.vx / speed : Math.sin(body.heading), nz = speed > .01 ? body.vz / speed : Math.cos(body.heading);
    const spread = burst ? 5 : 1.4;
    p.sprite.position.set(body.x - nx * .5, body.y + 1.2, body.z - nz * .5);
    p.velocity.set(-nx * (burst ? 4 : 1.5) + (Math.random() - .5) * spread, 1 + Math.random() * spread, -nz * (burst ? 4 : 1.5) + (Math.random() - .5) * spread);
    p.age = 0; p.life = burst ? .25 + Math.random() * .2 : .35;
    p.size = burst ? .22 + Math.random() * .22 : .2 + Math.random() * .15;
    p.sprite.material.color.set(burst ? '#fff0a1' : body.team === 'red' ? '#ff8c7c' : '#8de8ff');
    p.sprite.material.opacity = 1; p.sprite.scale.setScalar(p.size); p.sprite.visible = true;
  }
  return {
    hit(body) {
      trails.set(body.team, { remaining: .34, accumulator: 0 });
      for (let i = 0; i < 16; i++) emit(body, true);
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
        while (trail.accumulator >= .02 && trail.remaining > 0) { trail.accumulator -= .02; emit(body); }
        if (trail.remaining <= 0) trails.delete(body.team);
      }
    },
    clear() { trails.clear(); particles.forEach(p => { p.sprite.visible = false; }); },
  };
}
