import { CONFIG as C } from '../../shared/config.js';
export function fighter(team, x, heading) {
  return { team, health: C.maxHealth, x, z: 0, y: 0, vx: 0, vz: 0, vy: 0, heading, grounded: true, cooldown: 0, attack: 0, punchArm: 1, hit: 0, stun: 0, landed: false };
}
export class Simulation {
  constructor() { this.reset(); }
  reset() { this.fighters = [fighter('red', -3, Math.PI / 2), fighter('blue', 3, -Math.PI / 2)]; this.winner = null; this.motionEvents = []; }
  step(inputs, dt = C.tick) {
    this.motionEvents.length = 0;
    if (this.winner) return [];
    const hits = [];
    for (const f of this.fighters) {
      const i = inputs[f.team] || {}, legs = i.legs || {}, arm = i.arm || {};
      f.cooldown = Math.max(0, f.cooldown - dt); f.hit = Math.max(0, f.hit - dt); f.stun = Math.max(0, f.stun - dt);
      f.heading += (arm.turn || 0) * C.turnRate * dt;
      let mx = legs.moveX || 0, mz = legs.moveZ || 0, len = Math.max(1, Math.hypot(mx, mz)); mx /= len; mz /= len;
      const x = mx * Math.cos(f.heading) + mz * Math.sin(f.heading), z = -mx * Math.sin(f.heading) + mz * Math.cos(f.heading);
      const drive = f.stun > 0 ? 0 : 1;
      f.vx += (x * C.speed * drive - f.vx) * (1 - Math.exp(-C.damping * dt));
      f.vz += (z * C.speed * drive - f.vz) * (1 - Math.exp(-C.damping * dt));
      if (legs.jump && f.grounded) { f.vy = C.jump; f.grounded = false; this.motionEvents.push({type:'takeoff',team:f.team}); }
      if (arm.punch && f.cooldown <= 0) { f.punchArm = 1 - f.punchArm; f.attack = 0.28; f.cooldown = C.punchCooldown; f.landed = false; f.power = arm.power ?? 0.6; this.motionEvents.push({type:'punch',team:f.team,arm:f.punchArm}); }
      f.attack = Math.max(0, f.attack - dt);
      f.x += f.vx * dt; f.z += f.vz * dt;
      const support = Math.abs(f.x) <= C.arenaX && Math.abs(f.z) <= C.arenaZ;
      f.vy -= C.gravity * dt; f.y += f.vy * dt;
      if (support && f.y <= 0 && f.y > -0.5 && f.vy <= 0) { if (!f.grounded) this.motionEvents.push({type:'landing',team:f.team,speed:-f.vy}); f.y = 0; f.vy = 0; f.grounded = true; } else f.grounded = false;
    }
    const [a, b] = this.fighters;
    let dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz);
    if (dist < C.radius * 2 && Math.abs(a.y - b.y) < 1.5) {
      const nx = dist > 0.001 ? dx / dist : 1, nz = dist > 0.001 ? dz / dist : 0, push = (C.radius * 2 - dist) / 2;
      a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
    }
    // Snapshot approach momentum before either hit applies knockback, so trades are symmetric.
    const velocities = this.fighters.map(f => ({ x: f.vx, z: f.vz }));
    for (const [index, [f, target]] of [[a, b], [b, a]].entries()) {
      dx = target.x - f.x; dz = target.z - f.z; dist = Math.hypot(dx, dz);
      if (f.attack > 0 && f.attack < 0.19 && !f.landed && dist < C.punchReach && Math.abs(f.y - target.y) < 1.6 && (dx * Math.sin(f.heading) + dz * Math.cos(f.heading)) / Math.max(0.001, dist) > 0.35) {
        f.landed = true;
        const punchPower = Math.max(0, Math.min(1, f.power ?? .6));
        const velocity = velocities[index];
        // Equal fighter masses: momentum is approach speed. Lateral/retreating motion adds no damage.
        const momentum = Math.max(0, (velocity.x * dx + velocity.z * dz) / Math.max(.001, dist));
        const damage = Math.min(C.maxPunchDamage, Math.round(C.punchDamage * (.65 + punchPower * .6) + momentum * C.momentumDamage));
        target.health = Math.max(0, target.health - damage);
        const power = C.knockback * (0.65 + punchPower * 0.6);
        target.vx += Math.sin(f.heading) * power; target.vz += Math.cos(f.heading) * power; target.vy = 3.5; target.hit = 0.3; target.stun = 0.3; hits.push(target.team);
        this.motionEvents.push({type:'hit',team:target.team,x:Math.sin(f.heading),z:Math.cos(f.heading),strength:power,damage});
      }
    }
    const out = this.fighters.filter(f => f.health <= 0 || f.y < C.eliminationY);
    if (out.length) this.winner = out.length === 2 ? 'draw' : out[0].team === 'red' ? 'blue' : 'red';
    return hits;
  }
}
