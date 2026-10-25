import * as T from 'three';

// Two soft decals supplement the shadow map on wide arenas, using the live
// floor query for holes and moving platforms. No extra light or render pass.
export function createContactShadows(scene, count = 2) {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
    data.set([20, 25, 40, Math.round(Math.pow(Math.max(0, 1 - r * r), 3) * 170)], (y * size + x) * 4);
  }
  const texture = new T.DataTexture(data, size, size);
  texture.magFilter = T.LinearFilter; texture.needsUpdate = true;
  const geometry = new T.PlaneGeometry(1, 1);
  const makeShadow = () => {
    const material = new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new T.Mesh(geometry, material);
    mesh.name = 'Fighter contact shadow'; mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false; scene.add(mesh); return mesh;
  };
  const shadows = Array.from({ length: count }, makeShadow);
  return {
    update(fighters, arena) {
      while (shadows.length < fighters.length) shadows.push(makeShadow());
      shadows.forEach((mesh, i) => {
        const f = fighters[i], floor = f && arena.floorAt(f.x, f.z, f.y + .1);
        const height = floor ? f.y - floor.y : Infinity;
        mesh.visible = height >= -.1 && height < 4;
        if (!mesh.visible) return;
        mesh.position.set(f.x, floor.y + .065, f.z);
        mesh.rotation.x = -Math.PI / 2 - Math.atan(floor.slopeZ || 0);
        // Keep the quad inside its supporting piece rather than over the void.
        let radius = (.85 + Math.max(0, height) * .16) * (f.scale ?? 1);
        if (floor.kind === 'target') radius = Math.min(radius, Math.max(0, (floor.hw - Math.hypot(f.x, f.z)) / Math.SQRT2));
        const halfX = Math.min(radius, floor.hw - Math.abs(f.x - floor.x));
        const halfZ = Math.min(radius, floor.hd - Math.abs(f.z - floor.z));
        mesh.scale.set(Math.max(0, halfX * 2), Math.max(0, halfZ * 2), 1);
        mesh.material.opacity = .48 * (1 - Math.max(0, height) / 4);
      });
    },
    dispose() { shadows.forEach(m => { scene.remove(m); m.material.dispose(); }); geometry.dispose(); texture.dispose(); },
  };
}
