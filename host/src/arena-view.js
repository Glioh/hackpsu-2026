import * as T from 'three';
import {createPianoView} from './piano-view.js';
import { CONFIG as C } from '../../shared/config.js';
import { createRooftopView } from './rooftop-view.js';
import { createMountainView } from './mountain-view.js';
import {createStationView} from './station-view.js';
import {createTwinspireView} from './twinspire-view.js';
import { createSumoView } from './sumo-view.js';

// Draws the current arena (maps.js) from its live state: each floor piece is a dark base plus a coloured top,
// moved/hidden/recoloured every frame (blinking warnings, glowing lava, scrolling belts, falling tiles).
const TOP = { floor: '#e6dfb5', ice: '#d4f1ff', quake: '#e4d3a6', tile: '#e6dfb5', half: '#e6dfb5', island: '#e6dfb5',
  platform: '#f3c98b', lava: '#e0cba0', crumble: '#ddd0a6', belt: '#ffffff' };
const BASE = { ice: '#7fb3c9', platform: '#a77f55', belt: '#3b4048' };
const WARN = '#ff8a65', LAVA = '#ff5a1f', LAVA_GLOW = '#ff3a00', HOT = '#9b3b22', CRACKED = '#b39f75';

function beltTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4f57'; g.fillRect(0, 0, 128, 64);
  g.strokeStyle = '#f2c14e'; g.lineWidth = 10;
  for (const x of [20, 84]) { g.beginPath(); g.moveTo(x, 10); g.lineTo(x + 24, 32); g.lineTo(x, 54); g.stroke(); }
  const t = new T.CanvasTexture(c); t.wrapS = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace;
  return t;
}

export function createArenaView(scene) {
  const root = new T.Group(), box = new T.BoxGeometry(1, 1, 1), belt = beltTexture();
  scene.add(root);
  const rooftop = createRooftopView(scene);
  const station=createStationView(scene);
  const mountain = createMountainView(scene);
  const twinspire=createTwinspireView(scene);
  const piano=createPianoView(scene);
  const sumo = createSumoView(scene);
  let current = null, items = [], last = 0;

  function build(arena) {
    for (const o of root.children) o.traverse(m => m.material?.map !== belt && m.material?.map?.dispose?.());
    root.clear();
    if (arena.id === 'sumo') { items = []; current = arena; return; }
    if (arena.id === 'skyline' || arena.id === 'mountain' || arena.id === 'piano' || arena.id === 'twinspire' || arena.id === 'station') { items = []; current = arena; return; }
    items = arena.pieces.map(p => {
      const base = new T.Mesh(box, new T.MeshStandardMaterial({ color: BASE[p.kind] ?? '#737e59', roughness: .85 }));
      const top = new T.Mesh(box, new T.MeshStandardMaterial({ color: TOP[p.kind] ?? TOP.floor, roughness: p.kind === 'ice' ? .12 : .85 }));
      if (p.kind === 'belt') top.material.map = Object.assign(belt.clone(), { needsUpdate: true });
      for (const m of [base, top]) { m.castShadow = m.receiveShadow = true; root.add(m); }
      return { p, base, top, scroll: 0 };
    });
    // Full-floor maps keep the original yard look: orange trim, grid, centre ring.
    if (arena.pieces.length === 1) {
      const add = (geometry, color, setup) => { const m = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: .85 })); m.receiveShadow = true; setup(m); root.add(m); };
      for (const z of [-C.arenaZ + .13, C.arenaZ - .13]) add(new T.BoxGeometry(C.arenaX * 2, .03, .24), '#db945b', m => m.position.set(0, .06, z));
      for (const x of [-C.arenaX + .13, C.arenaX - .13]) add(new T.BoxGeometry(.24, .03, C.arenaZ * 2), '#db945b', m => m.position.set(x, .06, 0));
      if (arena.id !== 'ice') {
        const grid = new T.GridHelper(C.arenaX * 2, C.arenaX * 2, '#b9b18c', '#cbc39e'); grid.scale.z = C.arenaZ / C.arenaX; grid.position.y = .055; root.add(grid);
        add(new T.RingGeometry(2.3, 2.35, 64), '#b9af86', m => { m.rotation.x = -Math.PI / 2; m.position.y = .065; });
      }
    }
    current = arena;
  }

  return (arena, time, fighters = [], camera) => {
    sumo(arena);
    rooftop(arena.id === 'skyline', fighters, camera);
    station(arena,fighters,camera);
    piano(arena,fighters,camera);
    mountain(arena.id === 'mountain', time, fighters, camera);
    twinspire(arena.id==='twinspire',fighters,camera);
    if (arena !== current) { build(arena); last = time; }
    const dt = Math.max(0, Math.min(.1, time - last)); last = time;
    const blink = Math.sin(time * 18) > 0, pulse = .5 + .5 * Math.sin(time * 6);
    for (const item of items) {
      const { p, base, top } = item;
      base.visible = top.visible = p.state !== 'gone';
      if (!base.visible) continue;
      // Cracked crumbling tiles rattle before they drop.
      const rattle = p.kind === 'crumble' && p.state === 'warn' ? (Math.random() - .5) * .05 : 0;
      base.scale.set(p.hw * 2, .5, p.hd * 2); base.position.set(p.x + rattle, p.y - .29, p.z);
      top.scale.set(p.hw * 2 - (items.length > 1 ? .06 : 0), .08, p.hd * 2 - (items.length > 1 ? .06 : 0)); top.position.set(p.x + rattle, p.y, p.z + rattle);
      const m = top.material;
      m.color.set(TOP[p.kind] ?? TOP.floor); m.emissive.set('#000000'); m.emissiveIntensity = 1;
      if (p.state === 'lava') { m.color.set(LAVA); m.emissive.set(LAVA_GLOW); m.emissiveIntensity = .6 + .5 * pulse; }
      else if (p.state === 'warn' && p.kind === 'lava') { m.color.set(HOT); m.emissive.set('#7a1a00'); m.emissiveIntensity = pulse; }
      else if (p.state === 'warn' && p.kind === 'crumble') m.color.set(CRACKED);
      else if (p.state === 'warn' && blink) m.color.set(WARN);
      else if (p.state === 'falling') m.color.set(CRACKED);
      if (p.kind === 'belt') {
        item.scroll -= p.vx * dt / 2;                                   // one chevron tile = 2 m
        m.map.repeat.set(Math.sign(p.vx || 1) * p.hw, 1); m.map.offset.x = item.scroll * Math.sign(p.vx || 1);
        if (arena.warning && blink) m.color.set('#ffd9a0');             // about to reverse
      }
    }
  };
}
