import * as T from 'three';

// Original white masks: tintable, transparent, and independent of recorded footage.
export function createKOEffects(scene) {
  const loader = new T.TextureLoader();
  const textures = Object.fromEntries(['beam', 'flare', 'ring'].map(name => [name, loader.load(`/host/assets/ko/${name}.svg`)]));
  let blasts = [];
  function sprite(name, color, group) {
    const material = new T.SpriteMaterial({ map: textures[name], color, transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false });
    const s = new T.Sprite(material); s.renderOrder = 10; group.add(s); return s;
  }
  function clear() {
    for (const b of blasts) { scene.remove(b.group); b.group.traverse(o => o.material?.dispose()); }
    blasts = [];
  }
  function trigger(fighters) {
    for (const f of fighters) {
      const group = new T.Group(); group.position.set(f.x, -4.5, f.z); scene.add(group);
      const color = f.color || (f.team === 'red' ? '#ff456d' : '#47caff');
      const beam = sprite('beam', color, group), core = sprite('beam', '#ffffff', group);
      const flare = sprite('flare', '#ffffff', group), ring = sprite('ring', color, group);
      beam.center.set(.5, 0); core.center.set(.5, 0);
      const sparks = Array.from({ length: 18 }, (_, i) => ({ sprite: sprite('flare', i % 3 ? color : '#ffffff', group), angle: i * 2.39996, speed: 3 + (i % 5) }));
      blasts.push({ group, beam, core, flare, ring, sparks, age: 0 });
    }
  }
  function update(dt) {
    for (const b of blasts) {
      const age = b.age += dt;
      const grow = Math.min(1, age / .09), fade = Math.max(0, 1 - Math.max(0, age - .25) / 1.25);
      b.beam.scale.set((2.8 + Math.sin(age * 40) * .2) * grow * fade, 22 * grow, 1);
      b.core.scale.set(.65 * grow * fade, 24 * grow, 1);
      b.beam.material.opacity = fade; b.core.material.opacity = fade;
      b.flare.scale.setScalar((3 + age * 5) * grow); b.flare.material.opacity = fade * fade;
      b.ring.scale.set(2 + age * 20, 1 + age * 6, 1); b.ring.material.opacity = Math.max(0, 1 - age / .65);
      for (const s of b.sparks) {
        s.sprite.position.set(Math.cos(s.angle) * age * s.speed, Math.abs(Math.sin(s.angle)) * age * s.speed * 2, 0);
        s.sprite.scale.set(.12 * fade, (.5 + age) * fade, 1); s.sprite.material.opacity = fade;
      }
    }
    blasts = blasts.filter(b => {
      if (b.age < 1.5) return true;
      scene.remove(b.group); b.group.traverse(o => o.material?.dispose());
      return false;
    });
  }
  return { trigger, update, clear };
}
