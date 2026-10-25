const stat = (fighter, key) => fighter?.combat?.[key] ?? 1;

export function scaledDamage(attacker, target, base, max = Infinity) {
  const dealt = attacker === target ? 1 : stat(attacker, 'damageDealt');
  return Math.min(max * dealt, Math.round(base * dealt * stat(target, 'damageTaken')));
}

export function scaledLaunch(attacker, target, base, max = Infinity) {
  const dealt = attacker === target ? 1 : stat(attacker, 'launchDealt');
  return Math.min(max * dealt, base * dealt) * stat(target, 'launchTaken');
}
