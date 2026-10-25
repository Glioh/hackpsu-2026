// Arena maps: floor layout + hazards, stepped by the simulation each tick. Pure logic (no three.js);
// render.js draws `arena.pieces` from their live state.
//
// A piece is a box of floor: centre (x, z), half sizes (hw, hd), top height y, carry velocity (vx, vz) applied to
// fighters standing on it (moving platforms, conveyor belts), optional grip (< 1 = slippery), and a state
// ('solid' | 'warn' | 'gone' | 'lava' | 'falling') that the renderer shows. Only pieces with solid === true hold you up.
import { CONFIG as C } from '../../shared/config.js';
import { configureRooftop } from './rooftop-physics.js';
import {configurePiano} from './piano-map.js';
import { configureMountain } from './mountain-map.js';
import {configureStation} from './station-map.js';
import {configureTwinspire} from './twinspire-map.js';

export const MAPS = [
  { id: 'classic', name: 'Classic Ring', tier: 'Early', blurb: 'Solid floor. Learn to shove.' },
  { id: 'ice', name: 'Ice Rink', tier: 'Early', blurb: 'No grip. Momentum carries you off the edge.' },
  { id: 'quake', name: 'Earthquake Arena', tier: 'Early', blurb: 'Tremors bounce everyone around.' },
  { id: 'skyline', name: 'Skyline Rooftop', tier: 'Mid', blurb: 'Climb ramps and stairs, brawl around rooftop utilities, and knock rivals off open edges.' },
  { id: 'station', name: 'Crossline Station', tier: 'Mid', blurb: 'Climb the terraces and transfer bridge. Trains sweep the front and rear tracks at random intervals—watch the warning signals.' },
  { id: 'mountain', name: 'Cloudpeak Dojo', tier: 'Mid', blurb: 'Kung fu above the clouds. Climb stone terraces, weave through training obstacles, and send rivals over the cliffs.' },
  {id:'twinspire',name:'Twinspire',tier:'Mid',blurb:'Spawn on opposite skyscrapers. Cross two narrow skybridges and knock your rival into the city below.'},
  {id:'piano',name:'Forte Grand Piano',tier:'Mid',blurb:'88 playable keys on a giant concert grand. Jump onto the sharps, play notes with your feet, and knock rivals off the case.'},
  { id: 'tiles', name: 'Disappearing Tiles', tier: 'Mid', blurb: 'Blinking tiles drop out, then come back.' },
  { id: 'split', name: 'Splitting Floor', tier: 'Mid', blurb: 'The floor splits in half, then slams shut.' },
  { id: 'platforms', name: 'Moving Platforms', tier: 'Mid', blurb: 'A small island and platforms that drift past.' },
  { id: 'lava', name: 'Lava Floor', tier: 'Late', blurb: 'Lava bursts up through the floor. Hot feet fly.' },
  { id: 'falling', name: 'Falling Platform Arena', tier: 'Late', blurb: 'Tiles crumble under your feet and never return.' },
  { id: 'conveyor', name: 'Factory / Conveyor Chaos', tier: 'Late', blurb: 'Belts drag you to the edge, then reverse.' },
];

// Small seeded PRNG so rounds differ but tests are repeatable.
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TILE = 2;
const piece = (x, z, hw, hd, extra = {}) => ({ x, z, hw, hd, y: 0, vx: 0, vz: 0, vy: 0, solid: true, state: 'solid', t: 0, load: 0, kind: 'floor', ...extra });
const grid = kind => {
  const tiles = [];
  for (let x = -C.arenaX + TILE / 2; x < C.arenaX; x += TILE)
    for (let z = -C.arenaZ + TILE / 2; z < C.arenaZ; z += TILE) tiles.push(piece(x, z, TILE / 2, TILE / 2, { kind }));
  return tiles;
};
const smooth = v => v * v * (3 - 2 * v);

export function createArena(id = 'classic', seed = 1) {
  const rng = mulberry32(seed), pick = list => list[Math.floor(rng() * list.length)];
  const arena = {
    id, time: 0, shake: 0, warning: false, pieces: [], spawn: [[-3, 0], [3, 0]], update() {},
    step(dt, fighters, events) { this.time += dt; this.update(dt, fighters, events); },
    // Highest solid piece under (x, z), or null over the void.
    floorAt(x, z) {
      let best = null;
      for (const p of this.pieces) if (p.solid && Math.abs(x - p.x) <= p.hw && Math.abs(z - p.z) <= p.hd && (!best || p.y > best.y)) best = p;
      return best;
    },
  };
  const standingOn = f => (f.grounded ? arena.floorAt(f.x, f.z) : null);
  const shove = (f, angle, speed, up, events, strength) => {
    f.vx += Math.cos(angle) * speed; f.vz += Math.sin(angle) * speed; f.vy = up; f.grounded = false; f.hit = Math.max(f.hit, .25);
    events.push({ type: 'hit', team: f.team, x: Math.cos(angle), z: Math.sin(angle), strength });
  };
  // Tiles count down in their current state, then move on (warn -> next, next -> after).
  const tick = (p, dt, next) => { if ((p.t -= dt) <= 0) Object.assign(p, next(p)); };

  switch (id) {
    case 'station':
      configureStation(arena,rng);
      break;
    case 'twinspire':
      configureTwinspire(arena);
      break;
    case 'piano':
      configurePiano(arena);
      break;

    case 'mountain':
      configureMountain(arena);
      break;

    case 'skyline':
      configureRooftop(arena);
      break;

    case 'ice':
      arena.pieces = [piece(0, 0, C.arenaX, C.arenaZ, { kind: 'ice', grip: .12 })];
      break;

    case 'quake': {
      arena.pieces = [piece(0, 0, C.arenaX, C.arenaZ, { kind: 'quake' })];
      let wait = 3 + rng() * 2, quake = 0, jolt = 0;
      arena.update = (dt, fighters, events) => {
        if (quake > 0) {
          quake -= dt;
          if ((jolt -= dt) <= 0) { jolt = .3; for (const f of fighters) if (f.grounded) shove(f, rng() * 2 * Math.PI, 3 + rng() * 3, 2.5 + rng() * 1.5, events, 6); }
          if (quake <= 0) wait = 4 + rng() * 3;
        } else if ((wait -= dt) <= 0) { quake = 1.8; jolt = 0; }
        arena.warning = quake <= 0 && wait < 1;
        arena.shake = quake > 0 ? 1 : arena.warning ? .25 : Math.max(0, arena.shake - dt * 4);
      };
      break;
    }

    case 'tiles': {
      arena.pieces = grid('tile');
      let timer = 1.5;
      arena.update = dt => {
        if ((timer -= dt) <= 0) { timer = .9; const p = pick(arena.pieces.filter(p => p.state === 'solid')); if (p) Object.assign(p, { state: 'warn', t: 1.4 }); }
        for (const p of arena.pieces) if (p.state !== 'solid')
          tick(p, dt, p => p.state === 'warn' ? { state: 'gone', solid: false, t: 5 } : { state: 'solid', solid: true, t: 0 });
      };
      break;
    }

    case 'split': {
      // 9 s cycle: closed 3 s, opens over 2 s, stays open 3 s, slams shut in 1 s. Alternates splitting left/right and front/back.
      const GAP = 5, gapAt = t => { const c = ((t % 9) + 9) % 9; return c < 3 ? 0 : c < 5 ? GAP * smooth((c - 3) / 2) : c < 8 ? GAP : GAP * (1 - (c - 8)); };
      arena.pieces = [piece(-C.arenaX / 2, 0, C.arenaX / 2, C.arenaZ, { kind: 'half' }), piece(C.arenaX / 2, 0, C.arenaX / 2, C.arenaZ, { kind: 'half' })];
      arena.update = dt => {
        const g = gapAt(arena.time), speed = (g - gapAt(arena.time - dt)) / dt / 2, alongX = Math.floor(arena.time / 9) % 2 === 0;
        arena.warning = ((arena.time % 9) + 9) % 9 > 2 && g === 0;
        arena.pieces.forEach((p, i) => {
          const s = i ? 1 : -1;
          if (alongX) Object.assign(p, { x: s * (C.arenaX / 2 + g / 2), z: 0, hw: C.arenaX / 2, hd: C.arenaZ, vx: s * speed, vz: 0 });
          else Object.assign(p, { x: 0, z: s * (C.arenaZ / 2 + g / 2), hw: C.arenaX, hd: C.arenaZ / 2, vx: 0, vz: s * speed });
        });
      };
      break;
    }

    case 'platforms': {
      const W = 2 * Math.PI / 10, path = [t => [7 * Math.sin(W * t), 5.4], t => [-7 * Math.sin(W * t), -5.4],
        t => [8.4, 4.5 * Math.cos(W * t)], t => [-8.4, -4.5 * Math.cos(W * t)]];
      const plats = path.map((at, i) => { const [x, z] = at(0); return piece(x, z, i < 2 ? 2.5 : 2, i < 2 ? 2 : 2.5, { kind: 'platform' }); });
      arena.pieces = [piece(0, 0, 4, 3, { kind: 'island' }), ...plats];
      arena.update = dt => plats.forEach((p, i) => {
        const [x, z] = path[i](arena.time);
        Object.assign(p, { vx: (x - p.x) / dt, vz: (z - p.z) / dt, x, z });
      });
      break;
    }

    case 'lava': {
      arena.pieces = grid('lava');
      let timer = 2;
      arena.update = (dt, fighters, events) => {
        if ((timer -= dt) <= 0) { timer = Math.max(.45, 1.6 - arena.time * .02); const p = pick(arena.pieces.filter(p => p.state === 'solid')); if (p) Object.assign(p, { state: 'warn', t: 1.2 }); }
        for (const p of arena.pieces) if (p.state !== 'solid') tick(p, dt, p => p.state === 'warn' ? { state: 'lava', t: 4 } : { state: 'solid', t: 0 });
        for (const f of fighters) {
          const p = standingOn(f);
          if (p?.state !== 'lava') continue;
          f.vx = 0; f.vz = 0; f.stun = .45;                                     // hot foot: launched up and away
          shove(f, Math.atan2(f.z - p.z, f.x - p.x) + (rng() - .5) * 1.2, 7, 9, events, 9);
        }
      };
      break;
    }

    case 'falling': {
      arena.pieces = grid('crumble');
      let timer = 4;
      arena.update = (dt, fighters) => {
        for (const f of fighters) { const p = standingOn(f); if (p && p.state !== 'falling') p.load += dt; }
        if ((timer -= dt) <= 0) { timer = Math.max(.8, 3 - arena.time * .04); const p = pick(arena.pieces.filter(p => p.state === 'solid')); if (p) Object.assign(p, { state: 'warn', load: 1 }); }
        for (const p of arena.pieces) {
          if (p.state === 'warn') p.load += dt;                                 // once cracked, it keeps crumbling
          // Stood on: cracks after .5 s, collapses ~.85 s later (standing on a cracked tile speeds it up).
          if (p.state === 'solid' && p.load > .5) p.state = 'warn';
          if (p.state === 'warn' && p.load > 2.2) p.state = 'falling';
          if (p.state === 'falling') { p.vy -= 18 * dt; p.y += p.vy * dt; if (p.y < -12) Object.assign(p, { state: 'gone', solid: false }); }
        }
      };
      break;
    }

    case 'conveyor': {
      const ROWS = 4, hd = C.arenaZ / ROWS;
      arena.pieces = Array.from({ length: ROWS }, (_, i) => piece(0, -C.arenaZ + hd * (2 * i + 1), C.arenaX, hd, { kind: 'belt', vx: (i % 2 ? -1 : 1) * (2.2 + rng() * 1.2) }));
      let flip = 6;
      arena.update = dt => {
        if ((flip -= dt) <= 0) { flip = 5 + rng() * 3; for (const p of arena.pieces) p.vx = -p.vx; }
        arena.warning = flip < 1;
      };
      break;
    }

    default:
      arena.id = 'classic';
      arena.pieces = [piece(0, 0, C.arenaX, C.arenaZ, { kind: 'floor' })];
  }
  return arena;
}
