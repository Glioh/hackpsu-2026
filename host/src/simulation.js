import { CONFIG as C } from '../../shared/config.js';
import { createArena } from './maps.js';
export function fighter(team, x, heading) {
  return { team, x, z: 0, y: 0, vx: 0, vz: 0, vy: 0, heading, grounded: true, cooldown: 0, attack: 0, punchArm: 1, hit: 0, stun: 0, landed: false };
}
export class Simulation {
  constructor(mapId = 'classic', seed = 1) { this.mapId = mapId; this.seed = seed; this.reset(); }
  setMap(mapId) { this.mapId = mapId; this.reset(); }
  // Each reset builds a fresh arena with a new seed, so hazards differ round to round.
  reset() {
    this.arena = createArena(this.mapId, this.seed++);
    const [[rx, rz], [bx, bz]] = this.arena.spawn;
    this.fighters = [Object.assign(fighter('red', rx, Math.PI / 2), { z: rz }), Object.assign(fighter('blue', bx, -Math.PI / 2), { z: bz })];
    this.winner = null; this.motionEvents = [];
  }
  step(inputs, dt = C.tick) {
    this.motionEvents.length = 0;
    if (this.winner) return [];
    const hits = [];
    this.arena.step(dt, this.fighters, this.motionEvents);
    for (const f of this.fighters) {
      const i = inputs[f.team] || {}, legs = i.legs || {}, arm = i.arm || {};
      f.cooldown = Math.max(0, f.cooldown - dt); f.hit = Math.max(0, f.hit - dt); f.stun = Math.max(0, f.stun - dt);
      f.heading += (arm.turn || 0) * C.turnRate * dt;
      let mx = legs.moveX || 0, mz = legs.moveZ || 0, len = Math.max(1, Math.hypot(mx, mz)); mx /= len; mz /= len;
      const x = mx * Math.cos(f.heading) + mz * Math.sin(f.heading), z = -mx * Math.sin(f.heading) + mz * Math.cos(f.heading);
      const drive = f.stun > 0 ? 0 : 1, floor = f.grounded ? this.arena.floorAt(f.x, f.z) : null, grip = floor?.grip ?? 1;
      f.vx += (x * C.speed * drive - f.vx) * (1 - Math.exp(-C.damping * grip * dt));
      f.vz += (z * C.speed * drive - f.vz) * (1 - Math.exp(-C.damping * grip * dt));
      if (legs.jump && f.grounded) { f.vy = C.jump; f.grounded = false; this.motionEvents.push({type:'takeoff',team:f.team}); }
      if (arm.punch && f.cooldown <= 0) { f.punchArm = 1 - f.punchArm; f.attack = 0.28; f.cooldown = C.punchCooldown; f.landed = false; f.power = arm.power ?? 0.6; this.motionEvents.push({type:'punch',team:f.team,arm:f.punchArm}); }
      f.attack = Math.max(0, f.attack - dt);
      if (floor) { f.x += floor.vx * dt; f.z += floor.vz * dt; } // moving platforms and conveyor belts carry you
      f.x += f.vx * dt; f.z += f.vz * dt;
      const support = this.arena.floorAt(f.x, f.z), top = support ? support.y : 0;
      f.vy -= C.gravity * dt; f.y += f.vy * dt;
      if (support && f.y <= top && f.y > top - 0.5 && f.vy <= 0) { if (!f.grounded) this.motionEvents.push({type:'landing',team:f.team,speed:-f.vy}); f.y = top; f.vy = 0; f.grounded = true; } else f.grounded = false;
    }
    const [a, b] = this.fighters;
    let dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz);
    if (dist < C.radius * 2 && Math.abs(a.y - b.y) < 1.5) {
      const nx = dist > 0.001 ? dx / dist : 1, nz = dist > 0.001 ? dz / dist : 0, push = (C.radius * 2 - dist) / 2;
      a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
    }
    for (const [f, target] of [[a, b], [b, a]]) {
      dx = target.x - f.x; dz = target.z - f.z; dist = Math.hypot(dx, dz);
      if (f.attack > 0 && f.attack < 0.19 && !f.landed && dist < C.punchReach && Math.abs(f.y - target.y) < 1.6 && (dx * Math.sin(f.heading) + dz * Math.cos(f.heading)) / Math.max(0.001, dist) > 0.35) {
        f.landed = true; const power = C.knockback * (0.65 + f.power * 0.6);
        target.vx += Math.sin(f.heading) * power; target.vz += Math.cos(f.heading) * power; target.vy = 3.5; target.hit = 0.3; target.stun = 0.3; hits.push(target.team);
        this.motionEvents.push({type:'hit',team:target.team,x:Math.sin(f.heading),z:Math.cos(f.heading),strength:power});
      }
    }
    const out = this.fighters.filter(f => f.y < C.eliminationY);
    if (out.length) this.winner = out.length === 2 ? 'draw' : out[0].team === 'red' ? 'blue' : 'red';
    return hits;
  }
}
