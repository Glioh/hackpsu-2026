// Simulation owns targeting, timing and hits; the view only reads this state.
export const SUMO = Object.freeze({ halfX: 9, halfZ: 7, warning: 1.5, beam: .45, cycle: 6, radius: 1.65, damage: 18 });
export const SUMO_GIANTS = Object.freeze([
  { character: 'wukong', x: -13, z: 0, color: '#ff704f' },
  { character: 'squish', x: 0, z: -11, color: '#58cfff' },
  { character: 'bonk', x: 13, z: 0, color: '#d795ff' },
]);

export function configureSumo(arena, random) {
  arena.pieces = [{ x: 0, z: 0, hw: SUMO.halfX, hd: SUMO.halfZ, y: 0, vx: 0, vz: 0, solid: true, state: 'solid', kind: 'sumo' }];
  arena.lasers = SUMO_GIANTS.map((_, i) => ({ source: i, state: 'idle', x: 0, z: 0, radius: SUMO.radius, warnAt: 2 + i * 2, fireAt: 0, endAt: 0, hit: new Set() }));
  arena.update = (dt, fighters, events) => {
    for (const laser of arena.lasers) {
      // Process transitions in order even when a step crosses more than one boundary.
      while (true) {
        if (laser.state === 'idle' && arena.time >= laser.warnAt) {
          const candidates = fighters.filter(f => f.y >= -.5 && arena.floorAt(f.x, f.z));
          const target = candidates[Math.floor(random() * candidates.length)];
          laser.x = Math.max(-SUMO.halfX + laser.radius, Math.min(SUMO.halfX - laser.radius, target?.x ?? (random() - .5) * 12));
          laser.z = Math.max(-SUMO.halfZ + laser.radius, Math.min(SUMO.halfZ - laser.radius, target?.z ?? (random() - .5) * 8));
          laser.fireAt = laser.warnAt + SUMO.warning;
          laser.endAt = laser.fireAt + SUMO.beam;
          laser.hit.clear(); laser.state = 'warning';
        } else if (laser.state === 'warning' && arena.time >= laser.fireAt) {
          laser.state = 'firing';
        } else break;
      }
      // Test the active interval, including a step that crosses the entire short beam.
      if (laser.state === 'firing' && arena.time - dt < laser.endAt) {
        for (const f of fighters) {
          if (laser.hit.has(f.team) || !arena.floorAt(f.x, f.z) || f.y < -.5 || f.y > 3 || Math.hypot(f.x - laser.x, f.z - laser.z) > laser.radius) continue;
          laser.hit.add(f.team);
          const source = SUMO_GIANTS[laser.source], distance = Math.hypot(f.x - source.x, f.z - source.z);
          const nx = (f.x - source.x) / distance, nz = (f.z - source.z) / distance;
          const strength = 9 + Math.min(4, f.damage / 40);
          f.damage += SUMO.damage; f.vx = nx * strength; f.vz = nz * strength; f.vy = 5;
          f.grounded = false; f.stun = .4; f.hit = .3;
          events.push({ type: 'hit', hazard: 'laser', team: f.team, x: nx, z: nz, strength, damage: SUMO.damage });
        }
      }
      if (laser.state === 'firing' && arena.time >= laser.endAt) {
        laser.state = 'idle'; laser.warnAt += SUMO.cycle;
      }
    }
    arena.warning = arena.lasers.some(l => l.state === 'warning');
  };
}
