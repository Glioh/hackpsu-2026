import { CONFIG as C } from '../../shared/config.js';

export const FINISH_DURATION = 1.8;
export const FINISH_TIME_SCALE = .12;

// Advance only the victory tableau; combat and the winner are already locked.
export function stepFinish(sim, dt) {
  for (const f of sim.fighters) {
    if (f.y < C.eliminationY) continue;
    const oldY = f.y;
    f.x += f.vx * dt; f.z += f.vz * dt;
    const floor = sim.arena.floorAt(f.x, f.z);
    if (!floor || !f.grounded) { f.grounded = false; f.vy -= C.gravity * dt; f.y += f.vy * dt; }
    if (floor && f.vy <= 0 && oldY >= floor.y && f.y <= floor.y) {
      f.y = floor.y; f.vy = 0; f.grounded = true;
    }
    f.attack = Math.max(0, f.attack - dt);
    f.hit = Math.max(0, f.hit - dt);
  }
}
