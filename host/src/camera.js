// A wider, lower view tracks the fight like a horizontal camera dolly.
// Keep the viewing direction stable so steering stays readable during pans.
const length = Math.hypot(.1, .42, 1);
export const CAMERA_DIRECTION = Object.freeze([.1 / length, .42 / length, 1 / length]);
export const CAMERA_FOV = 52;
export const CAMERA_MIN_DISTANCE = 12;
const [dx, dy, dz] = CAMERA_DIRECTION;
const horizontal = Math.hypot(dx, dz);
const right = [dz / horizontal, 0, -dx / horizontal];
const up = [-dy * dx / horizontal, horizontal, -dy * dz / horizontal];
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

export const ROOFTOP_CAMERA_DIRECTION = Object.freeze([0, .75, 1].map(v => v / Math.hypot(.75, 1)));

export function frameFighters(fighters, aspect, focus, rooftop = false) {
  const direction = rooftop ? ROOFTOP_CAMERA_DIRECTION : CAMERA_DIRECTION;
  const [cx, cy, cz] = direction, ch = Math.hypot(cx, cz);
  const cameraRight = rooftop ? [cz/ch, 0, -cx/ch] : right;
  const cameraUp = rooftop ? [-cy*cx/ch, ch, -cy*cz/ch] : up;
  const points = fighters.map(f => [f.x, Math.max(-1.5, Math.min(6, f.y)), f.z]);
  const target = [
    (Math.min(...points.map(p => p[0])) + Math.max(...points.map(p => p[0]))) / 2,
    rooftop ? Math.max(1.1, ...points.map(p => p[1] + 1.1)) : 1.1,
    (Math.min(...points.map(p => p[2])) + Math.max(...points.map(p => p[2]))) / 2,
  ];
  const center = focus || target;
  const tanY = Math.tan(CAMERA_FOV * Math.PI / 360);
  const tanX = tanY * Math.max(.1, aspect);
  let distance = rooftop ? 19 : CAMERA_MIN_DISTANCE;
  // Fit the whole bodies, including hands and jumping heads, with 25% padding.
  // Project bounds into camera space instead of zooming out to fit the map.
  for (const p of points) for (const x of [-1.15, 1.15]) for (const y of [0, 2.6]) for (const z of [-1.15, 1.15]) {
    const delta = [p[0] + x - center[0], p[1] + y - center[1], p[2] + z - center[2]];
    distance = Math.max(distance, dot(delta, direction) + 1.25 * Math.max(Math.abs(dot(delta, cameraRight)) / tanX, Math.abs(dot(delta, cameraUp)) / tanY));
  }
  return { target, distance };
}
