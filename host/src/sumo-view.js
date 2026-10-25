import * as T from 'three';
import { loadFighter } from './fighter-model.js';
import { SUMO, SUMO_GIANTS } from './sumo-map.js';

export function createSumoView(scene) {
  const root = new T.Group(); root.name = 'Open sumo laser stage'; root.visible = false; scene.add(root);
  let built = false;
  const effects = [];
  const mesh = (geometry, color, basic = false) => {
    const m = new T.Mesh(geometry, basic ? new T.MeshBasicMaterial({ color, transparent: true }) : new T.MeshStandardMaterial({ color, roughness: .85 }));
    root.add(m); return m;
  };
  return arena => {
    root.visible = arena.id === 'sumo'; if (!root.visible) return;
    if (!built) {
      built = true;
      const floor = mesh(new T.BoxGeometry(18, .8, 14), '#c9a36e'); floor.position.y = -.4; floor.receiveShadow = true;
      const ring = mesh(new T.RingGeometry(5.8, 6, 96), '#fff1ce'); ring.rotation.x = -Math.PI / 2; ring.position.y = .015;
      for (const x of [-1.1, 1.1]) {
        const line = mesh(new T.BoxGeometry(.12, .025, 1.8), '#fff1ce'); line.position.set(x, .02, 0);
      }
      SUMO_GIANTS.forEach((source, i) => {
        const giant = new T.Group(); giant.position.set(source.x, -1, source.z); giant.rotation.y = Math.atan2(-source.x, -source.z); giant.scale.setScalar(3.2); root.add(giant);
        loadFighter(source.character).then(make => giant.add(make(source.color).root)).catch(error => console.error('Sumo giant failed to load', error));
        const target = mesh(new T.RingGeometry(SUMO.radius - .12, SUMO.radius, 64), source.color, true);
        target.rotation.x = -Math.PI / 2;
        const fill = mesh(new T.CircleGeometry(SUMO.radius, 64), source.color, true); fill.rotation.x = -Math.PI / 2;
        const cross = new T.Group(); root.add(cross);
        for (const rotation of [0, Math.PI / 2]) {
          const bar = new T.Mesh(new T.BoxGeometry(.08, .025, SUMO.radius * 2.5), new T.MeshBasicMaterial({ color: '#fff4cf' })); bar.rotation.y = rotation; cross.add(bar);
        }
        const countdown = mesh(new T.RingGeometry(SUMO.radius * .9, SUMO.radius, 64), '#fff4cf', true); countdown.rotation.x = -Math.PI / 2;
        const beam = mesh(new T.CylinderGeometry(.16, .3, 1, 16), source.color, true);
        const core = mesh(new T.CylinderGeometry(.06, .12, 1, 12), '#ffffff', true);
        const impact = mesh(new T.SphereGeometry(1, 24, 12), source.color, true);
        effects[i] = { target, fill, cross, countdown, beam, core, impact, origin: new T.Vector3(source.x, 7.2, source.z), giant };
      });
    }
    arena.lasers.forEach((laser, i) => {
      const fx = effects[i], warning = laser.state === 'warning', firing = laser.state === 'firing', visible = warning || firing;
      const progress = T.MathUtils.clamp((arena.time - (laser.fireAt - SUMO.warning)) / SUMO.warning, 0, 1);
      for (const marker of [fx.target, fx.fill, fx.cross, fx.countdown]) { marker.visible = visible; marker.position.set(laser.x, .04, laser.z); }
      fx.target.material.opacity = .75 + .25 * Math.sin(arena.time * 22);
      fx.fill.material.opacity = firing ? .65 : .12 + progress * .2;
      fx.countdown.scale.setScalar(Math.max(.01, 1 - progress));
      fx.countdown.visible = warning;
      const end = new T.Vector3(laser.x, .1, laser.z), direction = end.clone().sub(fx.origin);
      for (const beam of [fx.beam, fx.core]) {
        beam.visible = firing; beam.position.copy(fx.origin).add(end).multiplyScalar(.5);
        beam.scale.y = direction.length(); beam.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.clone().normalize());
      }
      fx.impact.visible = firing; fx.impact.position.copy(end);
      fx.impact.scale.set(laser.radius, .3 + .15 * Math.sin(arena.time * 60), laser.radius);
      fx.impact.material.opacity = .65;
      // Aim the existing character toward its locked target throughout the warning and shot.
      if (visible) fx.giant.rotation.y = Math.atan2(laser.x - fx.origin.x, laser.z - fx.origin.z);
    });
  };
}
