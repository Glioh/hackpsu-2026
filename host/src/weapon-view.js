import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PICKUP_LIFE, springExtension, swordSwing } from './weapons.js';

// Draws weapons.js state: spinning pickups (like a dropped item: spin, bob, glow ring), weapons held in the
// punching hand, the spring glove shooting out, sword swooshes, grenades in flight and their explosions.
// Render-only. Models come from art/weapons/build_weapons.py, drawn at fighter scale.
const SCALE = 1.4, PICKUP_SIZE = 1.15, BLAST_LIFE = .9;
const URLS = { spring: '/host/assets/weapons/spring_glove.glb', sword: '/host/assets/weapons/sword.glb', grenade: '/host/assets/weapons/grenade.glb' };
const COLORS = { spring: '#ff4757', sword: '#31c8ff', grenade: '#9be15d' };
// Glove travel (world metres) at full extension: the tip reaches about WEAPONS.spring.reach from the fighter.
const SPRING_TRAVEL = 1.75;

export function createWeaponView(scene) {
  const templates = {};
  for (const [type, url] of Object.entries(URLS))
    new GLTFLoader().loadAsync(url).then(gltf => { gltf.scene.traverse(o => { if (o.isMesh) o.castShadow = true; }); templates[type] = gltf.scene; },
      err => console.warn(type + ' weapon model unavailable', err));
  const root = new T.Group(); scene.add(root);
  let lastState = null;
  const pickups = new Map(), grenades = new Map(), blasts = new Map(), held = [null, null], swooshes = [null, null];

  // A pickup: the weapon centred on a pivot so it spins about its middle, plus a glow ring and a light beam.
  function makePickup(type) {
    const group = new T.Group(), spin = new T.Group(), model = templates[type].clone(true);
    const box = new T.Box3().setFromObject(model), size = box.getSize(new T.Vector3()), centre = box.getCenter(new T.Vector3());
    model.position.sub(centre); spin.add(model); spin.scale.setScalar(PICKUP_SIZE / Math.max(size.x, size.y, size.z));
    if (type === 'spring') spin.rotation.z = .5;                                // tilted so it reads from the side
    const color = new T.Color(COLORS[type]);
    const ring = new T.Mesh(new T.RingGeometry(.42, .56, 40), new T.MeshBasicMaterial({ color, transparent: true, opacity: .8, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .03;
    const beam = new T.Mesh(new T.CylinderGeometry(.32, .45, 2.4, 24, 1, true),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: .16, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
    beam.position.y = 1.2;
    group.add(spin, ring, beam); root.add(group);
    return { group, spin, ring, beam };
  }
  function makeHeld(type) {
    const obj = templates[type].clone(true); obj.scale.setScalar(SCALE); root.add(obj);
    const spring = obj.getObjectByName('WP_Spring'), glove = obj.getObjectByName('WP_Glove');
    return { type, obj, spring, glove, gloveZ: glove?.position.z };
  }
  function makeSwoosh() {
    const mesh = new T.Mesh(new T.RingGeometry(.55, 1.75, 32, 1, 0, 2.3),
      new T.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }));
    mesh.rotation.order = 'YXZ'; root.add(mesh); return mesh;
  }
  function makeBlast() {
    const group = new T.Group();
    const fire = new T.Mesh(new T.SphereGeometry(1, 24, 16), new T.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, depthWrite: false }));
    const core = new T.Mesh(new T.SphereGeometry(1, 16, 12), new T.MeshBasicMaterial({ color: '#ffe066', transparent: true, depthWrite: false }));
    const wave = new T.Mesh(new T.RingGeometry(.8, 1, 48), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, side: T.DoubleSide }));
    wave.rotation.x = -Math.PI / 2;
    const smoke = Array.from({ length: 7 }, (_, i) => {
      const puff = new T.Mesh(new T.SphereGeometry(1, 12, 8), new T.MeshStandardMaterial({ color: '#7d7a78', roughness: 1, transparent: true, depthWrite: false }));
      puff.userData.dir = new T.Vector3(Math.cos(i * 2.4) * .7, 1, Math.sin(i * 2.4) * .7); return puff;
    });
    group.add(fire, core, wave, ...smoke); root.add(group);
    return { group, fire, core, wave, smoke };
  }
  const drop = (map, id) => { const v = map.get(id); (v.group ?? v.obj ?? v).removeFromParent(); map.delete(id); };
  const clear = () => {
    for (const map of [pickups, grenades, blasts]) for (const id of [...map.keys()]) drop(map, id);
    held.forEach((h, i) => { h?.obj.removeFromParent(); held[i] = null; });
  };
  const handOf = m => {
    const arm = m.arms?.[1]; let hand = null;
    arm?.traverse(o => { if (!hand && /(Hand|Glove)_L$/.test(o.name)) hand = o; });
    return hand ?? arm ?? m.group;
  };
  const p = new T.Vector3();

  // Spring glove impact: a comic POW! starburst and a shockwave ring on the target.
  const canvasTexture = paint => { const c = document.createElement('canvas'); c.width = c.height = 256; paint(c.getContext('2d')); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
  const powTexture = canvasTexture(g => {
    g.translate(128, 128); g.beginPath();
    for (let k = 0; k < 24; k++) { const r = k % 2 ? 70 : 122 - (k % 4) * 8, a = k / 24 * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fillStyle = '#ffd447'; g.fill(); g.lineWidth = 10; g.strokeStyle = '#ff4757'; g.stroke();
    g.rotate(-.18); g.font = '900 72px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 12; g.strokeStyle = '#101124'; g.strokeText('POW!', 0, 4); g.fillStyle = '#ffffff'; g.fillText('POW!', 0, 4);
  });
  const ringTexture = canvasTexture(g => { g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.lineWidth = 16; g.strokeStyle = '#ffffff'; g.stroke(); });
  const sprite = map => { const s = new T.Sprite(new T.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false })); s.renderOrder = 10; s.visible = false; root.add(s); return s; };
  const pows = [0, 1].map(() => ({ pow: sprite(powTexture), ring: sprite(ringTexture), age: Infinity })), shown = new WeakSet();
  const POW_LIFE = .5;

  return {
    clear() { clear(); pows.forEach(k => { k.age = Infinity; k.pow.visible = k.ring.visible = false; }); },
    // state: sim.weapons.state; bodies: raw simulation fighters; models: render.js fighter models (already posed).
    // Returns the fighters a spring glove just landed on, so the renderer can add sparks and camera shake.
    update(state, bodies, models, time, dt = 0) {
      const impacts = [];
      if (!state) return impacts;
      if (state !== lastState) { clear(); lastState = state; }               // new round

      // Pickups: pop in, spin and bob, blink before they vanish.
      const live = new Set(state.pickups.map(k => k.id));
      for (const id of pickups.keys()) if (!live.has(id)) drop(pickups, id);
      for (const k of state.pickups) {
        if (!templates[k.type]) continue;
        if (!pickups.has(k.id)) pickups.set(k.id, makePickup(k.type));
        const v = pickups.get(k.id), pop = Math.min(1, k.age / .35), grow = pop < 1 ? 1 - Math.pow(1 - pop, 3) * Math.cos(pop * 9) : 1;
        v.group.position.set(k.x, k.y, k.z);
        v.spin.position.y = .65 + Math.sin(time * 2.6) * .12;
        v.spin.rotation.y = time * 2.4;
        v.group.scale.setScalar(Math.max(.01, grow));
        v.group.visible = k.age < PICKUP_LIFE - 3 || Math.sin(k.age * 18) > 0;
        const pulse = .5 + .5 * Math.sin(time * 5);
        v.ring.material.opacity = .45 + .4 * pulse; v.ring.scale.setScalar(1 + .12 * pulse);
      }

      // Held weapons ride the punching hand; the spring glove fires level, the sword sweeps across the front.
      bodies.forEach((f, i) => {
        const landed = f.weaponAttack?.type === 'spring' && f.weaponAttack.landed ? f.weaponAttack : null;
        if (landed && !shown.has(landed)) {
          shown.add(landed); const target = bodies[1 - i]; impacts.push(target);
          const k = pows[i]; k.age = 0; k.pow.position.set(target.x, target.y + 1.6, target.z); k.ring.position.set(target.x, target.y + 1.1, target.z);
        }
        const m = models[i], type = f.weapon?.type ?? (f.weaponAttack && f.weaponAttack.type !== 'grenade' ? f.weaponAttack.type : null);
        if (held[i]?.type !== type) { held[i]?.obj.removeFromParent(); held[i] = type && templates[type] ? makeHeld(type) : null; }
        const swoosh = swooshes[i] ??= makeSwoosh();
        swoosh.material.opacity = 0;
        const h = held[i];
        if (!h || !m) return;
        m.group.updateMatrixWorld(true); handOf(m).getWorldPosition(p);
        h.obj.visible = m.group.visible;
        h.obj.position.copy(p);
        const a = f.weaponAttack?.type === h.type ? f.weaponAttack : null;
        if (h.type === 'spring') {
          const ext = a ? springExtension(a.t) * SPRING_TRAVEL / SCALE : 0;
          h.obj.rotation.set(0, f.heading, 0);
          h.spring.scale.z = 1 + ext / .26; h.glove.position.z = h.gloveZ + ext;
          h.glove.scale.setScalar(1 + .7 * (a ? springExtension(a.t) : 0));         // cartoon: the glove swells as it flies
        } else if (h.type === 'sword') {
          h.obj.rotation.order = 'YXZ';
          if (a) {
            const s = swordSwing(a.t);
            h.obj.rotation.set(.3 + 1.25 * Math.sin(Math.min(1, s * 1.4) * Math.PI / 2), f.heading + 1.2 - 2.3 * s, 0);
            swoosh.position.set(f.x, p.y, f.z); swoosh.rotation.set(-Math.PI / 2, f.heading, 0);
            swoosh.rotation.z = 1.2 - 2.3 * s - Math.PI / 2;                     // trails the blade back to where it started
            swoosh.material.opacity = a.t < .26 ? .55 * (1 - a.t / .26) : 0;
          } else h.obj.rotation.set(.45, f.heading + .25, 0);
        } else h.obj.rotation.set(0, f.heading, 0);
      });

      // POW!: pops up big with a little overshoot, wobbles, fades; the ring races outwards.
      for (const k of pows) {
        k.age += dt; const u = k.age / POW_LIFE;
        k.pow.visible = k.ring.visible = u < 1;
        if (u >= 1) continue;
        const pop = Math.min(1, k.age / .12);
        k.pow.scale.setScalar(2.3 * (pop < 1 ? pop * 1.25 : 1.25 - .25 * Math.min(1, (k.age - .12) / .1)));
        k.pow.material.rotation = Math.sin(k.age * 30) * .08 * (1 - u); k.pow.material.opacity = u < .7 ? 1 : (1 - u) / .3;
        k.ring.scale.setScalar(.6 + 4.2 * Math.sqrt(u)); k.ring.material.opacity = .9 * (1 - u);
      }

      // Grenades tumble through the air, flashing faster as the fuse runs down.
      const flying = new Set(state.grenades.map(g => g.id));
      for (const id of grenades.keys()) if (!flying.has(id)) drop(grenades, id);
      for (const g of state.grenades) {
        if (!templates.grenade) continue;
        if (!grenades.has(g.id)) { const obj = templates.grenade.clone(true); root.add(obj); grenades.set(g.id, { obj }); }
        const { obj } = grenades.get(g.id), blink = Math.sin(time * (g.fuse < .6 ? 40 : 14)) > .3;
        obj.position.set(g.x, g.y, g.z); obj.rotation.set(g.spin, g.spin * .6, 0);
        obj.scale.setScalar(SCALE * 1.5 * (blink ? 1.12 : 1));
      }

      // Explosions: fireball and white-hot core, a shockwave along the floor, smoke drifting up.
      const booms = new Set(state.blasts.map(b => b.id));
      for (const id of blasts.keys()) if (!booms.has(id)) drop(blasts, id);
      for (const b of state.blasts) {
        if (!blasts.has(b.id)) blasts.set(b.id, makeBlast());
        const v = blasts.get(b.id), u = Math.min(1, b.age / BLAST_LIFE), quick = Math.min(1, b.age / .18);
        v.group.position.set(b.x, b.y, b.z);
        v.fire.scale.setScalar(.3 + b.radius * .75 * (1 - Math.pow(1 - quick, 3))); v.fire.material.opacity = Math.max(0, 1 - u * 1.6);
        v.core.scale.setScalar(.2 + b.radius * .4 * quick); v.core.material.opacity = Math.max(0, 1 - u * 3);
        v.wave.scale.setScalar(.2 + b.radius * 1.15 * Math.min(1, b.age / .35)); v.wave.material.opacity = Math.max(0, .9 - u * 1.8);
        v.wave.position.y = -.08;                                              // grenades rest .12 above the floor
        v.smoke.forEach((puff, i) => {
          puff.position.copy(puff.userData.dir).multiplyScalar(.4 + b.age * (1.4 + i * .1));
          puff.scale.setScalar((.35 + i * .04) * (.6 + u)); puff.material.opacity = u < .15 ? 0 : .7 * (1 - u);
        });
      }
      return impacts;
    },
  };
}
