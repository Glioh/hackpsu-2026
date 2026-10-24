"""Keyframes the in-game animation (recorded by export_game_poses.mjs) onto every Wobble Boxing character in
the open Blender session, one timeline marker per clip (Idle, Walk, Run, Punch, Jump), then re-saves each .blend.
The .glb files the game loads are not touched: the game animates the characters itself.

Run from Blender's Python console / MCP:
    exec(open(p).read(), {"__name__": "__main__", "__file__": p})                    # bake only
    exec(open(p).read(), {"__name__": "__main__", "__file__": p, "REPO": repo})      # bake + save .blend files

Mirrors host/src/render.js + fighter-model.js: the whole fighter squashes/stretches from the feet, the upper body
leans about the feet (legs stay with the root), arms swing at the shoulders, heads and gear wobble on top of their
rest pose. three.js is Y-up facing +Z; Blender is Z-up facing -Y, so a three.js Z rotation is a Blender -Y rotation.
"""
import bpy, json, os
from mathutils import Matrix, Vector, Euler

GAME_SCALE = 1.4                                    # fighter-model.js SCALE (game units per Blender metre)
CHARACTERS = {"SirSquish": ("Sir_Squish", "sir_squish"), "Crank": ("Crank", "crank"), "Bonk3000": ("Bonk3000", "bonk3000")}
here = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(here, "game_poses.json"), encoding="utf-8"))

def R(x, z):                                        # three.js Euler(x, 0, z) as a Blender rotation matrix
    return Matrix.Rotation(x, 4, "X") @ Matrix.Rotation(-z, 4, "Y")

def rest(o):                                        # rest transform, remembered across re-runs
    if "rest_loc" not in o:
        o["rest_loc"] = list(o.location); o["rest_rot"] = list(o.rotation_euler); o["rest_scale"] = list(o.scale)
    return Vector(o["rest_loc"]), Euler(o["rest_rot"]).to_matrix().to_4x4(), Vector(o["rest_scale"])

def key(o, M, frame):
    loc, rot, scale = M.decompose()
    o.location, o.scale = loc, scale
    o.rotation_euler = rot.to_euler("XYZ", o.rotation_euler)   # stay continuous through big punch swings
    o.keyframe_insert("location", frame=frame); o.keyframe_insert("rotation_euler", frame=frame); o.keyframe_insert("scale", frame=frame)

for root_name, (scene_name, slug) in CHARACTERS.items():
    root, sc = bpy.data.objects.get(root_name), bpy.data.scenes.get(scene_name)
    if not root or not sc:
        print("skip", root_name, "(not in this session)"); continue
    parts = [root] + list(root.children_recursive)
    for o in parts:
        o.animation_data_clear(); r = rest(o)
        o.location, o.rotation_euler, o.scale = r[0], r[1].to_euler(), r[2]
    by_part = lambda p: [o for o in parts if o.get("ragdoll_part") == p]
    torso = by_part("torso")[0]
    side = lambda objs, s: next(o for o in objs if o.name.endswith("_" + s))
    arms = [side(by_part("upper_arm"), "R"), side(by_part("upper_arm"), "L")]      # render.js order
    legs = [side(by_part("leg"), "R"), side(by_part("leg"), "L")]
    wobbly = [(o, "head") for o in by_part("head")] + [(o, "gear") for o in by_part("helmet") + by_part("shell")]
    pt = rest(torso)[0]

    for m in list(sc.timeline_markers): sc.timeline_markers.remove(m)
    sc.render.fps = data["fps"]; frame = 1
    for clip in data["clips"]:
        sc.timeline_markers.new(clip["name"], frame=frame)
        for p in clip["frames"]:
            key(root, Matrix.Translation((0, 0, p["y"] / GAME_SCALE)) @ Matrix.Diagonal((p["scale"]["xz"], p["scale"]["xz"], p["scale"]["y"], 1)), frame)
            torso_m = Matrix.Translation((0, 0, p["bob"])) @ R(p["lean"]["x"], p["lean"]["z"]) @ Matrix.Translation(pt)
            key(torso, torso_m, frame)
            for leg, a in zip(legs, p["legs"]):                                     # legs ride the root, not the lean
                key(leg, torso_m.inverted() @ Matrix.Translation(rest(leg)[0] + pt) @ Matrix.Rotation(a, 4, "X"), frame)
            for arm, a in zip(arms, p["arms"]):
                key(arm, Matrix.Translation(rest(arm)[0]) @ R(a["x"], a["z"]), frame)
            for o, kind in wobbly:
                loc, rot, _ = rest(o)
                key(o, Matrix.Translation(loc) @ rot @ R(p[kind]["x"], p[kind]["z"]), frame)
            frame += 1
    sc.frame_start, sc.frame_end, sc.frame_current = 1, frame - 1, 1
    print("baked", root_name, "frames 1-%d" % (frame - 1), [m.name for m in sorted(sc.timeline_markers, key=lambda m: m.frame)])
    if globals().get("REPO"):
        bpy.data.libraries.write(os.path.join(REPO, "art", "characters", slug, slug + ".blend"), {sc}, compress=True)
        print("saved", slug + ".blend")
