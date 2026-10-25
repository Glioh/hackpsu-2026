# Active-ragdoll character motion — revised after model pull

## Revised recommendation

The cosmetic-spring proposal below is superseded as the main approach. Boneloaf explicitly described Gang Beasts as a constant ragdoll controlled with forces in its [2016 developer statement](https://discussions.unity.com/t/official-physics-improvements/619788/24). That establishes the architecture, but does not disclose their exact balancing, gait, joint settings, or current implementation. The following design is our proposed adaptation.

### Latest assets inspected

Pulled origin/main through `4d9fcc6`. `host/assets/characters/crank.glb` contains 12,610 exported position vertices; `sir_squish.glb` contains 11,024. Neither contains skins or animation clips. Both contain independently pivoted meshes tagged with `ragdoll_part`, including torso, head, arms, hands, legs, and feet. Crank also has a shell; Sir Squish has a helmet. The loader already supports character selection, but exposes only torso, arms, and legs and drives them with procedural rotations.

Mesh resolution and physical articulation are separate concerns. These assets can support a segmented rigid-body puppet without skinning. They lack elbow and knee segments, so anatomically bending limbs would require splitting/rebuilding those parts or adding a skinned rig. Start with the existing articulation before investing in mesh changes.

### Proposed implementation gates

1. **Physics sandbox and engine capability check.** Evaluate Rapier's JavaScript/WASM build in the existing no-bundler app. Verify initialization, static arena, collision groups, debug drawing, joint limits, and actual motor APIs exposed by the chosen package version. The [joint guide](https://rapier.rs/docs/user_guides/javascript/joints/) describes spherical/revolute constraints and PD motors, but validate multi-axis drive/limit support in a minimal test before committing the rig. Use explicit relative-orientation PD torques if the required shoulder/neck motor API is unavailable. Pin the verified version.
2. **Passive ragdoll with the new models.** Create a common physics descriptor per character: collider dimensions, joint anchors, mass, local axes, rest transforms, and limits. Begin with seven dynamic bodies: torso, head, two arm/hand assemblies, two leg/foot assemblies, and pelvis. The pelvis can be invisible because the current torso is one mesh. Keep hands/feet as fixed visual attachments initially. Attach helmet/shell to their owning body. Use primitive colliders rather than render-mesh collision. Drop each character onto the arena and verify joints, resting contact, and impacts before adding control.
3. **Force-driven standing and movement.** Apply a bounded horizontal velocity controller to the pelvis and bounded upright torque to pelvis/torso. Use grounded contact information and support-aware height assistance; disable assistance when feet lose arena support, so characters fall off edges. Add heading torque rather than directly assigning rotation. Give the neck low stiffness and limited rotation so head lag emerges from physics. No per-tick teleporting of dynamic limbs.
4. **Gait and recovery.** Generate alternating leg targets from desired movement and actual grounded speed. Drive them with bounded joint torques, using contact state to decide stance versus swing. Tune weight transfer, friction, foot clearance, and upright strength together. A seven-body prototype may require stronger assistance because it has no knees. Add knees/elbows only if this limits acceptable motion. First milestone: idle standing, starts/stops, turning, and returning to balance after a shove.
5. **Physical combat and jumps.** Arm input supplies desired reach/strike targets; motors/forces move the arm toward them. Register punches from hand collider contacts during an attack window, with a per-attack hit guard and bounded impulse/damage rules. Avoid applying both full collision momentum and the old scripted knockback. Jump from grounded support with an impulse to the central bodies. Temporarily reduce posture strength on hits/stun and restore it gradually. This creates controllable weakness and recovery instead of a cosmetic hit rotation.
6. **Replace the movement authority coherently.** Keep Socket.IO room/input handling and the fixed host tick. Make rigid bodies the source of positions, velocities, grounded state, and fall/elimination state. Remove overlapping custom gravity, circle separation, and scripted root integration when enabling the physical fighter. Keep the old simulation behind a temporary debug switch for comparison. Read ring-out from a central body, not a loose hand or foot.
7. **Rendering and lifecycle.** Extend `fighter-model.js` to return named part bindings/rest transforms. For each physics body, convert its world transform into the corresponding visual parent's local space and include the collider-to-mesh offset. Account for the loader's 1.4 uniform scale once when building descriptors. Interpolate previous/current body transforms, with quaternion slerp for orientation. Update physics before fitting the camera. Character switches and rematches must destroy/recreate bodies and joints without leaks.

### Stability and acceptance

- Use the existing fixed 60 Hz tick, then measure whether substeps or extra solver iterations are needed. Test mass ratios, adjacent-part collision filtering, bounded motor strength, damping, and joint errors before increasing solver cost.
- Validate adjacent self-collision filtering without disabling opponent contacts. Use CCD selectively for fast fists if tunneling occurs.
- Gate progression on both characters standing, walking, turning, jumping, recovering from shoves, punching once per attack, falling off all edges, and resetting cleanly.
- Run scripted stress scenarios: repeated impacts, bodies piled together, edge contacts, rapid turn reversals, and repeated character swaps. Check finite transforms, bounded joint separation, and body/joint counts after reset.
- Test render schedules at 30/60/120+ Hz against identical fixed-tick inputs and profile on the demo laptop. Browser visual review remains required; model inspection alone does not establish animation quality.

This is a larger physics change than the original MVP scope. Build and evaluate the passive-ragdoll and standing/walking sandbox first; use that evidence to decide whether to migrate combat. No implementation of the new physics engine is included in this research task.

---

# Earlier cosmetic-spring proposal (reference only)

## Goal and scope

Make starts, stops, turns, punches, jumps, and landings produce connected body motion: the torso responds first, the head and arms lag, and the character settles naturally. This is a proposed visual approximation of floppy movement, not a claim about Gang Beasts' implementation.

Keep the current host-authoritative movement and combat. The procedural pose must not change collision footprints, punch reach, controller roles, or ring-out rules. PLAN.md already scopes the MVP to cosmetic floppy meshes.

## Findings in this repository

- `host/src/simulation.js` contains custom root movement, gravity, footprint separation, and combat. There is no articulated physics engine dependency.
- `host/src/characters.js` has arm and leg pivots, but the head meshes share the torso. The torso rotates about ground level rather than the waist.
- `host/src/render.js` overwrites limb rotations with wall-clock sine waves each frame. Punching snaps the right arm directly to a fixed angle.
- `host/src/main.js` runs a fixed 60 Hz accumulator, but renders current state without interpolation.

## Technical approach

Use angular springs with an angle and angular velocity per axis. For unit mass:

`acceleration = frequencyRadians² * (target - angle) - 2 * dampingRatio * frequencyRadians * angularVelocity`

Use an exact damped-spring update for a constant target within each tick, following Daniel Holden's derivation. Ordinary exponential damping is useful for smoothing targets but does not retain the velocity needed for overshoot. Keep spring angles bounded; remove outward angular velocity when a limit is reached.

Update poses at the existing fixed timestep. Store previous/current root and pose states, then interpolate with `accumulator / tick` for rendering. Use shortest-path heading interpolation. This adds up to one simulation tick of visual latency; check punch readability during tuning.

## Implementation sequence

### 1. Build a usable hierarchy

In `characters.js`, introduce a waist pivot around y=0.9 and a neck pivot around y=1.82. Rebase child positions so the neutral silhouette stays unchanged. Put every helmet element, visor, eye, receiver, crest, jaw, and antenna under the head pivot. Preserve the reactor reference and keep legs under the character root. Return named pose pivots.

Prefer explicit local coordinates during construction. Three.js `Object3D.attach` can preserve world transforms during reparenting, but has limitations with non-uniformly scaled ancestors. Check the optional model export script for compatibility with the new hierarchy.

Deliverable: the neutral models look identical, and head and torso rotate around sensible joints.

### 2. Add a pure motion module

Create `host/src/motion.js` with spring update, pose creation/reset, fixed-step pose update, and interpolation functions. Keep it independent of Three.js so it can be tested in Node. Keep tunable values in one exported motion configuration.

Maintain torso pitch/roll, head pitch/roll/yaw, arm pitch/roll, body vertical offset, and gait phase. A small bounded-angle scalar spring per axis is sufficient for this scope.

Deliverable: an impulse produces controlled overshoot and returns to rest without instability.

### 3. Connect movement to pose

Compute actual root acceleration from tick-to-tick velocity changes, then transform it to the fighter's local frame. Clamp extreme input to the pose system. Use local acceleration for start/stop inertia, local velocity for a modest sustained movement lean, and wrapped heading change for turn lag. Do not differentiate render-interpolated positions.

Advance gait phase by grounded distance traveled, rather than wall-clock time. Scale stride by speed and blend it out in the air or at rest. Use subtle gait-driven torso bob and shoulder counter-swing. Keep idle breathing small.

The head inherits the torso transform, so its local spring offset should compensate partially for torso changes to create lag rather than duplicate the torso's lean. Use a smaller opposite yaw response to root turns.

Deliverable: forward, backward, strafe, reverse, and turn movement all react in the appropriate direction.

### 4. Add discrete reactions

Expose transient local motion events from simulation ticks while preserving the existing team-name hit return used for phone feedback. Include punch start, received hit with direction/strength, takeoff, and landing with pre-contact downward speed. Consume events once per tick, including during multi-tick render frames.

- Punch: use windup, extension, and recovery targets tied to the existing 0.28-second attack timer; layer spring follow-through on top. Align visible extension with the existing hit window.
- Received hit: inject directional angular velocity into torso/head and a smaller arm kick.
- Landing: inject compression proportional to downward speed, then let the spring recover. Bound compression so boots remain near the platform.
- Airborne: blend to relaxed leg/arm targets and reduce gait. Avoid claiming physical limb contact or supported full-body collapse.

Deliverable: repeated impacts remain bounded, landings vary with impact speed, and attack timing remains legible.

### 5. Integrate smooth rendering and reset

In `main.js`, update cosmetic motion after each simulation tick and pass interpolated root/pose state to the renderer. `render.js` applies the pose instead of generating gameplay animation from wall-clock time. Keep reactor glow time-based.

Reset both pose snapshots, gait, event state, and spring velocities at round reset. Freeze or settle poses deliberately on results; do not continue integrating from elapsed hidden-tab time. Initialize both interpolation snapshots to the same reset state to avoid a rematch teleport trail.

Deliverable: consistent behavior at 30, 60, and 120/144 Hz with clean rematches.

## Initial tuning hypotheses

These are starting points for visual testing, not source-backed prescriptions.

| Channel | Frequency | Damping ratio | Approximate angular limit |
| --- | --- | --- | --- |
| Torso pitch/roll | 3–4 Hz | 0.7–0.85 | 15–20 degrees |
| Head pitch/roll | 2–3 Hz | 0.45–0.65 | 20–25 degrees |
| Head yaw lag | 2.5–3.5 Hz | 0.65–0.8 | 20 degrees |
| Arm secondary swing | 2–3 Hz | 0.5–0.7 | 25 degrees around action pose |
| Landing compression | 4–5 Hz | 0.7–0.85 | 0.08–0.12 world units |

Tune torso/head first, then gait, then arms and impacts. Expose a debug motion enable switch and presets so the same keyboard sequence can be compared against the baseline.

## Verification and acceptance

- Run existing `npm test` to confirm combat and room behavior still pass.
- Add focused motion tests for spring decay, bounded repeated impulses, zero/invalid timestep handling, heading wraparound, and full reset.
- Replay identical fixed-step inputs under different render schedules and compare resulting pose state. Render frequency must not change motion evolution.
- Verify events fire once through multi-step frames, especially landing and hit reactions.
- Inspect both characters in-browser: start/stop, sudden reverse, strafing while turning, repeated punches, receiving hits from different directions, jump/landing, edge fall, results, and rematch.
- Record short clips at 30, 60, and high refresh rates. Accept when the head visibly lags and settles, torso reacts directionally, steps stop at rest, fists reach visibly during the hit window, and no excessive neck gaps or mesh intersections occur.
- Check frame cost on the intended demo laptop. Reuse pose objects and avoid per-frame vector allocations.

## Follow-up scope

If this still needs physical collapses, grabbing, or limbs that collide with the arena, scope a separate active-ragdoll prototype with rigid bodies, joint limits, collision filtering, motors, and an upright controller. Cosmetic springs cannot provide those interactions.

## Research

- Daniel Holden, [Spring-It-On: The Game Developer's Spring-Roll-Call](https://theorangeduck.com/page/spring-roll-call): exact spring updates, damping regimes, frequency controls, and rotation extensions.
- Glenn Fiedler, [Spring Physics](https://gafferongames.com/post/spring_physics/): spring forces, damping, and angular/upright constraints.
- Glenn Fiedler, [Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/): fixed simulation updates and previous/current-state render interpolation.
- Three.js, [Object3D](https://threejs.org/docs/pages/Object3D.html): transform hierarchy and reparenting behavior.
- Three.js, [MathUtils](https://threejs.org/docs/pages/MathUtils.html): delta-time-aware damping; useful for smoothing but insufficient alone for inertial overshoot.
