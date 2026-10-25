// Both devices speak the same arena-relative language: +X is screen right,
// +Z input is forward (away from the camera). Facing only affects the arms.
export function legInputToWorld(moveX = 0, moveZ = 0) {
  const length = Math.max(1, Math.hypot(moveX, moveZ));
  return { x: moveX / length, z: -moveZ / length };
}

export function worldToLegInput(x, z) {
  return { moveX: x, moveZ: -z };
}
