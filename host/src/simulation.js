import { CONFIG as C } from '../../shared/config.js';
import { fallbackCombatRig, uppercutHits } from './combat-rig.js';
import { createArena } from './maps.js';
import { createWeapons } from './weapons.js';
import { legInputToWorld } from '../../shared/movement.js';
export function fighter(team, x, heading) {
  return { team, lives: 3, respawnRemaining: 0, damage: 0, x, z: 0, y: 0, vx: 0, vz: 0, vy: 0, heading, grounded: true, cooldown: 0, attack: 0, hit: 0, stun: 0, landed: false };
}
export class Simulation {
  constructor(mapId = 'classic', seed = 1) { this.rigs = [fallbackCombatRig(), fallbackCombatRig()]; this.mapId = mapId; this.seed = seed; this.reset(); }
  setCombatRig(index, rig) { this.rigs[index] = rig; }
  configureMatch(match) {
    this.match = match;
    this.rigs = (match?.fighters || [0, 1]).map((_, i) => this.rigs[i] || fallbackCombatRig());
    if (match?.mapId) this.mapId = match.mapId;
    this.reset();
  }
  enemies(a, b) { return a !== b && (this.match?.mode !== 'teams' || a.side !== b.side); }
  setMap(mapId) { this.mapId = mapId; this.reset(); }
  // Each reset builds a fresh arena with a new seed, so hazards differ round to round.
  reset() {
    this.arena = createArena(this.mapId, this.seed++);
    const [[rx, rz], [bx, bz]] = this.arena.spawn;
    this.fighters = [Object.assign(fighter('red', rx, Math.PI / 2), { z: rz }), Object.assign(fighter('blue', bx, -Math.PI / 2), { z: bz })];
    this.teamLives = this.match?.mode === 'teams' ? { red: this.match.lives, blue: this.match.lives } : null;
    if (this.match) {
      const placed = [];
      this.fighters = this.match.fighters.map((spec, index) => {
        const anchor = this.arena.spawn[spec.side === 'blue' ? 1 : this.match.mode === 'ffa' ? index % 2 : 0];
        const spots = [anchor];
        for (const piece of this.arena.pieces.filter(p => p.solid)) {
          spots.push([piece.x, piece.z]);
          for (let x = piece.x - piece.hw + .8; x <= piece.x + piece.hw - .8; x += 1.9)
            for (let z = piece.z - piece.hd + .8; z <= piece.z + piece.hd - .8; z += 1.9) spots.push([x, z]);
        }
        const distance = spot => Math.hypot(spot[0] - anchor[0], spot[1] - anchor[1]);
        const clear = spot => placed.every(f => Math.hypot(f.x - spot[0], f.z - spot[1]) > 1.8);
        spots.sort((a, b) => distance(a) - distance(b));
        const [x, z] = spots.find(spot => clear(spot) && this.arena.floorAt(...spot)) || anchor;
        const f = Object.assign(fighter(spec.id, x, Math.atan2(-x, -z)), { side: spec.side, color: spec.color, lives: this.match.lives, z });
        placed.push(f); return f;
      });
    }
    for (const f of this.fighters) f.y = this.arena.floorAt(f.x, f.z)?.y ?? 0;
    this.winner = null; this.motionEvents = []; this.attackSequence = 0; this.weapons = createWeapons(this.seed);
  }
  respawn(f) {
    const radius = this.rigs[this.fighters.indexOf(f)].radius + .1;
    const spots = [{ x: 0, z: 0 }, ...this.arena.pieces
      .filter(p => p.solid && !['falling', 'gone', 'lava'].includes(p.state) && p.y > C.eliminationY)
      .map(p => ({ x: Math.max(p.x - p.hw + Math.min(radius, p.hw), Math.min(0, p.x + p.hw - Math.min(radius, p.hw))),
        z: Math.max(p.z - p.hd + Math.min(radius, p.hd), Math.min(0, p.z + p.hd - Math.min(radius, p.hd))) }))];
    if (this.match) for (const p of this.arena.pieces.filter(p => p.solid && !['falling', 'gone', 'lava'].includes(p.state))) {
      for (let x = p.x - p.hw + radius; x <= p.x + p.hw - radius; x += radius * 2)
        for (let z = p.z - p.hd + radius; z <= p.z + p.hd - radius; z += radius * 2) spots.push({ x, z });
    }
    const crowded = spot => this.fighters.some(other => other !== f && other.lives > 0 && !other.respawnRemaining && Math.hypot(other.x - spot.x, other.z - spot.z) < radius * 2);
    spots.sort((a, b) => Number(crowded(a)) - Number(crowded(b)) || Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
    for (const spot of spots) {
      const floor = this.arena.floorAt(spot.x, spot.z);
      if (!floor || floor.y <= C.eliminationY || ['falling', 'gone', 'lava'].includes(floor.state)) continue;
      const { lives, side, color } = f;
      Object.assign(f, fighter(f.team, spot.x, (f.side || f.team) === 'red' ? Math.PI / 2 : -Math.PI / 2),
        { lives, side, color, z: spot.z, y: floor.y, weapon: null, weaponAttack: null });
      this.motionEvents.push({ type: 'respawn', team: f.team });
      return true;
    }
    if (this.arena.id === 'falling') {
      // A fresh life still needs footing after the last permanent tile collapses.
      const tile = this.arena.pieces.reduce((a, b) => Math.hypot(a.x, a.z) < Math.hypot(b.x, b.z) ? a : b);
      Object.assign(tile, { solid: true, state: 'solid', y: 0, vy: 0, load: 0 });
      return this.respawn(f);
    }
    return false;
  }
  step(inputs, dt = C.tick) {
    this.motionEvents.length = 0;
    if (this.winner) return [];
    const hits = [], previousAttacks = [];
    for (const f of this.fighters) if (f.respawnRemaining > 0 && f.lives > 0) {
      f.respawnRemaining = Math.max(0, f.respawnRemaining - dt);
      if (f.respawnRemaining === 0 && !this.respawn(f)) f.respawnRemaining = C.tick;
    }
    this.arena.step(dt, this.fighters.filter(f => !f.respawnRemaining && f.lives > 0), this.motionEvents);
    for(const event of this.motionEvents)if(event.type==='hit'&&event.hazard)hits.push(event.team);
    for (const f of this.fighters) {
      if (f.respawnRemaining || f.lives === 0) { previousAttacks.push(0); continue; }
      const i = inputs[f.team] || {}, legs = i.legs || {}, arm = i.arm || {};
      f.cooldown = Math.max(0, f.cooldown - dt); f.hit = Math.max(0, f.hit - dt); f.stun = Math.max(0, f.stun - dt);
      f.heading += (arm.turn || 0) * C.turnRate * dt;
      const { x, z } = legInputToWorld(legs.moveX || 0, legs.moveZ || 0);
      // Brief hitstun preserves launch momentum; ordinary movement regains control smoothly.
      const floor = f.grounded ? this.arena.floorAt(f.x, f.z) : null, grip = floor?.grip ?? 1;
      const damping = f.stun > 0 ? C.launchDamping : C.damping * grip, drive = f.stun > 0 ? 0 : 1;
      f.vx += (x * C.speed * drive - f.vx) * (1 - Math.exp(-damping * dt));
      f.vz += (z * C.speed * drive - f.vz) * (1 - Math.exp(-damping * dt));
      if (legs.jump && f.grounded) { f.vy = C.jump; f.grounded = false; this.motionEvents.push({type:'takeoff',team:f.team}); }
      if (arm.punch && f.cooldown <= 0 && !this.weapons.attack(f, this.motionEvents)) { f.attackId = ++this.attackSequence; f.attack = .28; f.cooldown = C.punchCooldown; f.landed = false; f.power = arm.power ?? .6; this.motionEvents.push({type:'punch',team:f.team}); }
      previousAttacks.push(f.attack);
      f.attack = Math.max(0, f.attack - dt);
      if (floor) { f.x += floor.vx * dt; f.z += floor.vz * dt; } // moving platforms and conveyor belts carry you
      const previous = { x: f.x, z: f.z, y: f.y, grounded: f.grounded };
      f.x += f.vx * dt; f.z += f.vz * dt;
      f.vy -= C.gravity * dt; f.y += f.vy * dt;
      if (this.arena.resolveMotion) {
        this.arena.resolveMotion(f, previous, this.rigs[this.fighters.indexOf(f)].radius, this.motionEvents);
        continue;
      }
      const support = this.arena.floorAt(f.x, f.z), top = support ? support.y : 0;
      if (support && f.y <= top && f.y > top - 0.5 && f.vy <= 0) { if (!f.grounded) this.motionEvents.push({type:'landing',team:f.team,speed:-f.vy}); f.y = top; f.vy = 0; f.grounded = true; } else f.grounded = false;
    }
    let dx, dz, dist;
    const active = f => !f.respawnRemaining && f.lives > 0;
    for (let i = 0; i < this.fighters.length; i++) for (let j = i + 1; j < this.fighters.length; j++) {
      const a = this.fighters[i], b = this.fighters[j];
      if (!active(a) || !active(b)) continue;
      dx = b.x - a.x; dz = b.z - a.z; dist = Math.hypot(dx, dz);
      const contact = this.rigs[i].radius + this.rigs[j].radius;
      if (dist >= contact || Math.abs(a.y - b.y) >= 1.5) continue;
      const nx = dist > .001 ? dx / dist : 1, nz = dist > .001 ? dz / dist : 0, push = (contact - dist) / 2;
      const before = [a, b].map(f => ({ x: f.x, z: f.z, y: f.y, grounded: f.grounded }));
      a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
      if (this.arena.resolveMotion) [a, b].forEach((f, k) => this.arena.resolveMotion(f, before[k], this.rigs[k ? j : i].radius, this.motionEvents));
    }
    // Snapshot all contacts before applying launches so simultaneous attacks trade fairly.
    const contacts = this.fighters.map((f, index) => active(f) && !f.landed && previousAttacks[index] > 0
      ? this.fighters.findIndex((target, j) => active(target) && this.enemies(f, target) &&
        uppercutHits(this.rigs[index], this.rigs[j], f, target, previousAttacks[index], dt)) : -1);
    const contactStates = this.fighters.map(f => ({x:f.x,y:f.y,z:f.z,vx:f.vx,vy:f.vy,vz:f.vz,grounded:f.grounded}));
    const velocities = this.fighters.map(f => ({x:f.vx,z:f.vz}));
    for (const [index, f] of this.fighters.entries()) {
      const targetIndex = contacts[index];
      if (targetIndex < 0) continue;
      const target = this.fighters[targetIndex]; f.landed = true;
      dx = target.x-f.x; dz = target.z-f.z; dist = Math.hypot(dx,dz);
      const punchPower = Math.max(0,Math.min(1,f.power ?? .6)), velocity = velocities[index];
      const momentum = Math.max(0,(velocity.x*dx+velocity.z*dz)/Math.max(.001,dist));
      const damage = Math.min(C.maxPunchDamage,Math.round(C.punchDamage*(.65+punchPower*.6)+momentum*C.momentumDamage));
      target.damage += damage;
      const growth = Math.min(1,target.damage/C.knockbackSoftCap);
      const power = Math.min(C.maxKnockback,C.knockback*(.85+punchPower*.3)*(1+growth*C.knockbackGrowth));
      const nx = dist > .001 ? dx/dist : Math.sin(f.heading), nz = dist > .001 ? dz/dist : Math.cos(f.heading);
      target.vx = nx*power; target.vz = nz*power; target.vy = C.uppercutLift+growth*1.5;
      target.grounded = false; target.hit = .3; target.stun = .22+growth*.14; hits.push(target.team);
      this.motionEvents.push({type:'hit',source:'fighter',attacker:f.team,attackId:f.attackId,attackerBefore:contactStates[index],before:contactStates[targetIndex],after:{x:target.x,y:target.y,z:target.z,vx:target.vx,vy:target.vy,vz:target.vz,grounded:target.grounded},team:target.team,x:nx,z:nz,strength:power,damage});
    }
    hits.push(...this.weapons.step(dt, this));
    for (const f of this.fighters) if (!f.respawnRemaining && f.lives > 0 && f.y < C.eliminationY) {
      if (this.teamLives) {
        this.teamLives[f.side] = Math.max(0, this.teamLives[f.side] - 1);
        for (const teammate of this.fighters) if (teammate.side === f.side) teammate.lives = this.teamLives[f.side];
      } else f.lives--;
      f.respawnRemaining = f.lives > 0 ? 1.5 : 0;
      f.vx = f.vy = f.vz = f.attack = 0; f.grounded = false;
      f.weapon = f.weaponAttack = null;
      this.motionEvents.push({ type: 'ringout', team: f.team, color: f.color, x: f.x, z: f.z, lives: f.lives });
    }
    const alive = [...new Set(this.fighters.filter(f => f.lives > 0).map(f => this.teamLives ? f.side : f.team))];
    if (alive.length <= 1) this.winner = alive[0] || 'draw';
    return hits;
  }
}
