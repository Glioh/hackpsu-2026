import { CONFIG as C } from '../../shared/config.js';

// Weapon pickups (simulation side; rendering in weapon-view.js). Two or three times a round a weapon drops somewhere on
// the floor, spinning like a dropped item; walk over it to pick it up. While holding one, the arm player's punch
// uses the weapon instead of the fist until its uses run out. Weapon hits go through the same damage/knockback
// rules as fists and are reported as fighter hits, so commentary, hit effects and the damage meter all react.
// reach / width / radius are metres from the attacker's centre to the target's body (target rig radius added).
export const WEAPONS = {
  spring: { name: 'Spring Glove', uses: 4, cooldown: .8, damage: 11, knockback: 1.7, reach: 3.2, width: .45 },
  sword: { name: 'Sword', uses: 3, cooldown: .6, damage: 19, knockback: 1.05, reach: 1.8, arc: 1.15 },
  grenade: { name: 'Grenade', uses: 1, cooldown: .5, damage: 24, knockback: 1.5, radius: 2.8, fuse: 1.5, throwSpeed: 6.5, throwLift: 6 },
};
export const WEAPON_TYPES = Object.keys(WEAPONS);
// Spring glove extension (0..1) over its attack: shoots out, holds, snaps back.
export const springExtension = t => t < .1 ? t / .1 : t < .28 ? 1 : Math.max(0, 1 - (t - .28) / .14);
// Sword swing progress (0..1): a fast sweep from the off side across the front.
export const swordSwing = t => Math.min(1, t / .22);
const ATTACK_TIME = { spring: .42, sword: .32, grenade: .25 };
export const PICKUP_LIFE = 25;
const PICKUP_RANGE = .9, BLAST_LIFE = .9;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWeapons(seed = 1) {
  const rng = mulberry32(seed * 7919 + 13);
  // Drop schedule (simulation seconds): an early drop, a mid-round one, and usually a late one. Never more than one
  // on the floor at once.
  const drops = [8 + rng() * 7, 28 + rng() * 10];
  if (rng() < .75) drops.push(52 + rng() * 15);
  const state = { time: 0, drops, pickups: [], grenades: [], blasts: [], nextId: 1 };

  const floorY = (arena, x, z, y = Infinity) => arena.floorAt(x, z, y)?.y;
  // A random spot on solid floor between the two spawn points, preferring spots away from both fighters.
  function findSpot(arena, fighters) {
    const [[ax, az], [bx, bz]] = arena.spawn;
    let best = null;
    for (let tries = 0; tries < 24; tries++) {
      const u = rng(), a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 3;
      const x = ax + (bx - ax) * u + Math.cos(a) * r, z = az + (bz - az) * u + Math.sin(a) * r, y = floorY(arena, x, z);
      if (y === undefined || !Number.isFinite(y)) continue;
      const clearance = Math.min(...fighters.map(f => Math.hypot(f.x - x, f.z - z)));
      if (!best || clearance > best.clearance) best = { x, y, z, clearance };
      if (clearance > 2.5) break;
    }
    return best;
  }

  const api = {
    state,
    // Puts a weapon on the floor now (also used by tests and the drop schedule).
    spawn(arena, type, x, z) {
      const y = floorY(arena, x, z) ?? 0, pickup = { id: state.nextId++, type, x, y, z, vy: 0, age: 0 };
      state.pickups.push(pickup);
      return pickup;
    },
    // Called when the arm player punches: uses the held weapon instead of the fist. Returns true if it did.
    attack(f, events) {
      const w = f.weapon;
      if (!w || f.cooldown > 0) return false;
      const spec = WEAPONS[w.type];
      f.cooldown = spec.cooldown; f.attack = .28; f.landed = true;             // arm animation; no fist contact
      f.weaponAttack = { type: w.type, t: 0, landed: false };
      events.push({ type: 'punch', team: f.team, weapon: w.type });
      if (w.type === 'grenade') {
        const s = Math.sin(f.heading), c = Math.cos(f.heading);
        state.grenades.push({ id: state.nextId++, owner: f.team, x: f.x + s * .6, y: f.y + 1.3, z: f.z + c * .6,
          vx: s * spec.throwSpeed + f.vx * .5, vy: spec.throwLift, vz: c * spec.throwSpeed + f.vz * .5, fuse: spec.fuse, spin: 0 });
        events.push({ type: 'throw', team: f.team, weapon: 'grenade' });
      }
      if (--w.uses <= 0) f.weapon = null;
      return true;
    },
    // Advances drops, pickups, swings and grenades. Returns the teams that were hit this step.
    step(dt, sim) {
      const { arena, fighters, rigs, motionEvents: events } = sim, hits = [];
      state.time += dt;
      if (state.drops.length && state.time >= state.drops[0] && !state.pickups.length) {
        const spot = findSpot(arena, fighters);
        state.drops.shift();
        if (spot) { const p = api.spawn(arena, WEAPON_TYPES[Math.floor(rng() * WEAPON_TYPES.length)], spot.x, spot.z); events.push({ type: 'weapon_drop', weapon: p.type, x: p.x, y: p.y, z: p.z }); }
      }
      // Pickups rest on the floor (and fall if it disappears), vanish after a while, and go to whoever walks over them.
      for (const p of state.pickups) {
        p.age += dt;
        const y = floorY(arena, p.x, p.z, p.y + .3);
        if (y !== undefined && p.y <= y + .01) { p.y = y; p.vy = 0; } else { p.vy -= C.gravity * dt; p.y = Math.max(y ?? -Infinity, p.y + p.vy * dt); }
        const taker = fighters.find(f => !f.respawnRemaining && f.lives !== 0 && !f.weapon && Math.hypot(f.x - p.x, f.z - p.z) < PICKUP_RANGE && Math.abs(f.y - p.y) < 1.3);
        if (taker) {
          taker.weapon = { type: p.type, uses: WEAPONS[p.type].uses }; p.taken = true;
          events.push({ type: 'pickup', team: taker.team, weapon: p.type });
        }
      }
      state.pickups = state.pickups.filter(p => !p.taken && p.age < PICKUP_LIFE && p.y > C.eliminationY);

      // Spring glove and sword strikes: one hit per attack, inside each weapon's reach.
      fighters.forEach((f, i) => {
        const a = f.weaponAttack;
        if (!a || f.respawnRemaining || f.lives === 0) return;
        a.t += dt;
        if (a.t >= ATTACK_TIME[a.type]) { f.weaponAttack = null; return; }
        if (a.landed || a.type === 'grenade') return;
        const target = fighters[1 - i], spec = WEAPONS[a.type], r = rigs[1 - i].radius;
        if (target.respawnRemaining || target.lives === 0) return;
        const dx = target.x - f.x, dz = target.z - f.z, s = Math.sin(f.heading), c = Math.cos(f.heading);
        const forward = dx * s + dz * c, side = dx * c - dz * s;
        if (Math.abs(target.y - f.y) > 1.3 || forward <= 0) return;
        let inReach = false;
        if (a.type === 'spring') inReach = springExtension(a.t) > .6 && forward < spec.reach * springExtension(a.t) + r && Math.abs(side) < spec.width + r;
        else inReach = a.t > .04 && a.t < .2 && Math.hypot(dx, dz) < spec.reach + r && Math.abs(Math.atan2(side, forward)) < spec.arc;
        if (!inReach) return;
        a.landed = true;
        const d = Math.hypot(dx, dz) || 1;
        hits.push(strike(f, target, dx / d, dz / d, spec.damage, spec.knockback, a.type, events));
      });

      // Grenades: lob, bounce, then blow up and fling everyone nearby (thrower included).
      for (const g of state.grenades) {
        g.fuse -= dt; g.spin += dt * 12;
        g.vy -= C.gravity * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
        const y = floorY(arena, g.x, g.z, g.y + .4);
        if (y !== undefined && g.y < y + .12 && g.vy < 0) { g.y = y + .12; g.vy *= -.35; g.vx *= .55; g.vz *= .55; }
        if (g.fuse > 0) continue;
        g.done = true;
        const spec = WEAPONS.grenade;
        state.blasts.push({ id: g.id, x: g.x, y: g.y, z: g.z, radius: spec.radius, age: 0, floor: floorY(arena, g.x, g.z, g.y + .4) ?? null });
        events.push({ type: 'explosion', x: g.x, y: g.y, z: g.z, radius: spec.radius, owner: g.owner });
        for (const target of fighters) {
          if (target.respawnRemaining || target.lives === 0) continue;
          const dx = target.x - g.x, dz = target.z - g.z, d = Math.hypot(dx, dz, target.y + .6 - g.y);
          if (d > spec.radius) continue;
          const falloff = 1 - d / spec.radius, flat = Math.hypot(dx, dz);
          const nx = flat > .05 ? dx / flat : Math.sin(target.heading + Math.PI), nz = flat > .05 ? dz / flat : Math.cos(target.heading + Math.PI);
          const attacker = fighters.find(f => f.team === g.owner) ?? target;
          hits.push(strike(attacker, target, nx, nz, Math.round(spec.damage * (.4 + .6 * falloff)), spec.knockback * (.5 + .5 * falloff), 'grenade', events));
        }
      }
      state.grenades = state.grenades.filter(g => !g.done && g.y > C.eliminationY);
      for (const b of state.blasts) b.age += dt;
      state.blasts = state.blasts.filter(b => b.age < BLAST_LIFE);
      return hits;
    },
  };
  return api;
}

// Same damage and knockback rules as a fist (simulation.js), scaled per weapon.
function strike(f, target, nx, nz, damage, knockback, weapon, events) {
  const before = { x: target.x, y: target.y, z: target.z, vx: target.vx, vy: target.vy, vz: target.vz, grounded: target.grounded };
  target.damage += damage;
  const growth = Math.min(1, target.damage / C.knockbackSoftCap);
  const power = Math.min(C.maxKnockback * knockback, C.knockback * knockback * (1 + growth * C.knockbackGrowth));
  target.vx = nx * power; target.vz = nz * power; target.vy = C.uppercutLift + growth * 1.5;
  target.grounded = false; target.hit = .3; target.stun = .22 + growth * .14;
  events.push({ type: 'hit', source: 'fighter', weapon, attacker: f.team, before, team: target.team, x: nx, z: nz, strength: power, damage,
    after: { x: target.x, y: target.y, z: target.z, vx: target.vx, vy: target.vy, vz: target.vz, grounded: target.grounded } });
  return target.team;
}
