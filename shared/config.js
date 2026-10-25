export const CONFIG = Object.freeze({
  version: 1, tick: 1 / 60, staleMs: 400, reconnectMs: 30000,
  arenaX: 11, arenaZ: 8, radius: 0.62, speed: 5, acceleration: 17,
  damping: 5, turnRate: 3, gravity: 20, jump: 8, eliminationY: -5,
  punchReach: 2.15, punchCooldown: 0.65, knockback: 11,
  maxHealth: 100, punchDamage: 12, momentumDamage: 2.4, maxPunchDamage: 32,
  deadZone: 8, saturation: 35, joltThreshold: 12, joltCooldown: 350,
});
export const SLOTS = ['red:legs', 'red:arm', 'blue:legs', 'blue:arm'];
export function validInput(role, p) {
  if (!p || !Number.isSafeInteger(p.seq) || p.seq < 0) return false;
  const fields = role === 'legs' ? ['moveX', 'moveZ'] : ['turn', 'power'];
  return fields.every(k => Number.isFinite(p[k]) && Math.abs(p[k]) <= 1)
    && (role !== 'arm' || p.power >= 0)
    && [p.jumpId, p.actId].every(v => v === undefined || (Number.isSafeInteger(v) && v >= 0));
}
