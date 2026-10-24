// Records the in-game procedural animation (host/src/simulation.js + host/src/wobble.js) as per-frame poses,
// so bake_game_animations.py can keyframe the exact same motion onto the characters in Blender.
// Usage: node art/characters/export_game_poses.mjs  ->  art/characters/game_poses.json
import { writeFileSync } from 'node:fs';
import { Simulation } from '../../host/src/simulation.js';
import { createWobble } from '../../host/src/wobble.js';
import { CONFIG as C } from '../../shared/config.js';

const FPS = 30, SUB = Math.round(1 / C.tick / FPS);
// Each clip: seconds of pre-roll (not recorded, lets springs settle), recorded seconds, input at time t.
const CLIPS = [
  { name: 'Idle', pre: 1, len: 2, input: () => ({}) },
  { name: 'Walk', pre: 1.5, len: 3, input: () => ({ legs: { moveZ: .5 } }) },
  { name: 'Run', pre: 1.5, len: 3, input: () => ({ legs: { moveZ: 1 } }) },
  { name: 'Punch', pre: 1, len: 2, input: t => ({ arm: { punch: near(t, .2) || near(t, 1), power: 1 } }) },
  { name: 'Jump', pre: 1, len: 2, input: t => ({ legs: { jump: near(t, .3) } }) },
];
function near(t, at) { return t >= at && t < at + C.tick; }

const clips = CLIPS.map(clip => {
  const sim = new Simulation(), wobble = createWobble(0), f = sim.fighters[0], frames = [];
  const ticks = Math.round((clip.pre + clip.len) / C.tick);
  for (let k = 0; k < ticks; k++) {
    const time = k * C.tick, t = time - clip.pre;
    sim.step({ red: t >= 0 ? clip.input(t) : clip.name === 'Walk' || clip.name === 'Run' ? clip.input(0) : {} });
    f.x = 0; f.z = 0; // in place: keep velocity (it drives the wobble), drop travel
    const pose = wobble(f, C.tick, time);
    if (t >= 0 && k % SUB === 0) frames.push({ y: f.y, ...pose });
  }
  return { name: clip.name, frames };
});
writeFileSync(new URL('./game_poses.json', import.meta.url), JSON.stringify({ fps: FPS, clips }));
console.log(clips.map(c => `${c.name}: ${c.frames.length} frames`).join(', '));
