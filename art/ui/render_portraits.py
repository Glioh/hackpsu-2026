"""Renders arcade character-select art for every Wobble Boxing fighter, from the real character .blend files.

For each fighter: <id>_portrait.png (1024, chest-up 3/4, VS banner) and <id>_head.png (512, character card icon).
Transparent PNGs in host/assets/ui/portraits/. Ids match FIGHTERS in host/src/fighter-model.js.

Non-destructive: copies of each character are appended from art/characters/<slug>/<slug>.blend into a separate
"Portraits" scene and posed there (the characters are rigid parts pivoting at their joints, no armature). The
original .blend/.glb files are never written. The render setup is saved to art/renders/portrait_setup.blend.

Run from Blender's Python console / MCP:
    exec(open(p).read(), {"__name__": "__main__", "__file__": p, "REPO": repo})                     # everything
    exec(open(p).read(), {"__name__": "__main__", "__file__": p, "REPO": repo, "ONLY": ["wukong"]})  # one fighter
"""
import bpy, math, os
from mathutils import Vector, Matrix, Euler

REPO = globals().get("REPO") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(REPO, "host", "assets", "ui", "portraits")
SETUP = os.path.join(REPO, "art", "renders", "portrait_setup.blend")
PALETTE = {"navy": "#101124", "red": "#FF4757", "blue": "#31C8FF", "yellow": "#FFD447", "purple": "#A45CFF", "magenta": "#FF4FD8"}

def rgb(hex_):
    h = hex_.lstrip("#"); return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))

# id (fighter-model.js) -> source .blend slug, part prefix, root empty, hand part name
FIGHTERS = {
    "squish": dict(slug="sir_squish", pfx="SS_", root="SirSquish", hand="Glove"),
    "bonk": dict(slug="bonk3000", pfx="BK_", root="Bonk3000", hand="Hand"),
    # No head part: the face is on the slice, so the head icon frames everything above face_z - 0.3.
    "toast": dict(slug="toast_malone", pfx="TM_", root="ToastMalone", hand="Hand", face="Slice", face_z=0.95),
    # The cone is taller than he is: the head icon crops it at head_clip so his face still reads.
    "conehead": dict(slug="conehead", pfx="CH_", root="Conehead", hand="Hand", head_clip=1.75),
    "bubbles": dict(slug="captain_bubbles", pfx="CB_", root="CaptainBubbles", hand="Hand"),
    "wukong": dict(slug="wukong", pfx="WK_", root="Wukong", hand="Hand"),
    "lebron": dict(slug="lebron", pfx="LB_", root="LeBron", hand="Hand"),
}
# Poses. Arm targets are world directions the shoulder->wrist segment points along (+X = the fighter's left,
# the big punching side; -Y = forward). torso/head: extra (x, y, z) rotation in radians; lift raises the whole body.
POSES = {
    "squish": {
        "portrait": dict(arms={"L": (0.55, -0.2, 1.0), "R": (-0.55, -0.55, -0.35)}, torso=(-0.08, 0.06, 0.12), head=(-0.12, -0.12, 0.08)),
    },
    "bonk": {
        "portrait": dict(arms={"L": (0.45, -0.75, 0.55), "R": (-0.85, -0.25, 0.55)}, torso=(0.04, 0.05, 0.14), head=(0.04, -0.1, 0.12)),
    },
    "toast": {
        "portrait": dict(arms={"L": (0.55, -0.35, 0.8), "R": (-0.45, -0.85, 0.3)}, torso=(0.05, 0.05, 0.12)),
    },
    "wukong": {
        "portrait": dict(arms={"L": (0.55, -0.6, 0.65), "R": (-0.8, 0.1, -0.35)}, torso=(0.06, 0.04, 0.1), head=(-0.08, 0.1, 0.08)),   # staff held low at his side
    },
    "lebron": {
        "portrait": dict(arms={"L": (0.6, -0.5, 0.7), "R": (-0.55, -0.6, 0.1)}, torso=(0.04, 0.04, 0.1), head=(-0.04, 0.08, 0.06)),
    },
    "bubbles": {
        "portrait": dict(arms={"L": (0.6, -0.55, 0.7), "R": (-0.4, -0.85, 0.3)}, torso=(0.06, 0.04, 0.1), head=(-0.04, 0.1, 0.06),
                         parts={"Fish": (0, 0, -1.4)}),                   # fish swum round to the front of the bowl
    },
    "conehead": {
        "portrait": dict(arms={"L": (0.6, -0.5, 0.7), "R": (-0.4, -0.85, 0.3)}, torso=(0.06, 0.04, 0.1), head=(-0.06, 0.06, 0.1)),
    },
}
# Shots: camera view direction (from subject towards the camera), which parts to frame, lens fill and size.
SHOTS = {
    "portrait": dict(size=1024, view=(0.62, -1.0, 0.22), frame="upper", fill=0.82),
    "head": dict(size=512, view=(0.45, -1.0, 0.12), frame="head", fill=0.86),
}
VIEW_OVERRIDE = {}
VIEW_OVERRIDE[("conehead", "portrait")] = (0.55, -1.0, -0.12)          # from a little below, so his eyes peek out
VIEW_OVERRIDE[("conehead", "head")] = (0.35, -1.0, -0.2)                #   from under the brim

# ---------- scene ----------
sc = bpy.data.scenes.get("Portraits") or bpy.data.scenes.new("Portraits")
bpy.context.window.scene = sc
for o in list(sc.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for c in list(sc.collection.children):
    sc.collection.children.unlink(c)
    if c.users == 0: bpy.data.collections.remove(c)

sc.render.engine = "BLENDER_EEVEE"
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.render.image_settings.color_depth = "8"
sc.render.image_settings.compression = 100                           # smallest lossless PNGs
sc.render.resolution_percentage = 100
try: sc.eevee.taa_render_samples = 128                             # smooth out subsurface grain
except AttributeError: pass
# Khronos PBR Neutral keeps the cartoon base colours true but rolls off highlights instead of clipping them.
try: sc.view_settings.view_transform = "Khronos PBR Neutral"
except TypeError: sc.view_settings.view_transform = "Standard"
sc.view_settings.exposure = 0

world = bpy.data.worlds.get("PT_World") or bpy.data.worlds.new("PT_World")
try: world.use_nodes = True
except Exception: pass
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs["Color"].default_value = (*rgb("#8a8aa0"), 1); bg.inputs["Strength"].default_value = 0.7   # neutral: keeps the pot silver
sc.world = world

def add_light(name, kind, loc, energy, color, size=1.0, target=(0, 0, 1.0)):
    light = bpy.data.lights.new(name, kind); light.energy = energy; light.color = color
    if kind == "AREA": light.size = size
    ob = bpy.data.objects.new(name, light); sc.collection.objects.link(ob); ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob

# Studio rig shared by every shot: warm key, soft fill, strong cyan + magenta rims from behind.
add_light("PT_Key", "AREA", (2.2, -3.6, 2.8), 650, (1.0, 0.97, 0.92), size=3)
add_light("PT_Fill", "AREA", (-3.2, -2.6, 1.6), 260, (1.0, 0.95, 0.85), size=3)
add_light("PT_Top", "AREA", (0.3, -0.6, 4.2), 110, (1.0, 1.0, 1.0), size=2)
add_light("PT_RimCyan", "AREA", (-2.6, 2.8, 2.4), 650, rgb(PALETTE["blue"]), size=0.8)
add_light("PT_RimMagenta", "AREA", (2.4, 3.0, 2.2), 380, rgb(PALETTE["magenta"]), size=0.6)
cam = bpy.data.objects.new("PT_Camera", bpy.data.cameras.new("PT_Camera")); sc.collection.objects.link(cam); sc.camera = cam

outline = bpy.data.materials.get("PT_Outline") or bpy.data.materials.new("PT_Outline")
try: outline.use_nodes = True
except Exception: pass
ob_bsdf = next(n for n in outline.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
ob_bsdf.inputs["Base Color"].default_value = (*rgb("#14102a"), 1); ob_bsdf.inputs["Roughness"].default_value = 1
outline.use_backface_culling = True
outline.diffuse_color = (*rgb("#14102a"), 1)

# ---------- characters (appended copies) ----------
def append_character(fid, spec):
    path = os.path.join(REPO, "art", "characters", spec["slug"], spec["slug"] + ".blend")
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n.startswith(spec["pfx"]) or n == spec["root"]]
    coll = bpy.data.collections.new("PT_" + fid); sc.collection.children.link(coll)
    objs = [o for o in dst.objects if o]
    for o in objs:
        coll.objects.link(o); o.animation_data_clear()
        see_through = o.type == "MESH" and any(m and getattr(m, "surface_render_method", "") == "BLENDED" for m in o.data.materials)
        for m in o.data.materials if see_through else ():             # dithered sorts per pixel, so things inside show
            if m.surface_render_method == "BLENDED": m.surface_render_method = "DITHERED"
        if o.type == "MESH" and not see_through:                     # comic outline: inverted hull (its dark back
            o.data = o.data.copy()                                   # would show through glass, so not on see-through parts)
            o.data.materials.append(outline)
            mod = o.modifiers.new("PT_Outline", "SOLIDIFY")
            mod.thickness = 0.014; mod.offset = 1; mod.use_flip_normals = True; mod.use_rim = False
            mod.material_offset = len(o.data.materials) - 1
    rest = {}
    for o in objs:
        if "rest_loc" in o:                                          # undo any baked animation pose
            o.location, o.rotation_euler, o.scale = Vector(o["rest_loc"]), Euler(o["rest_rot"]), Vector(o["rest_scale"])
        rest[o.name] = (o.location.copy(), o.rotation_euler.copy(), o.scale.copy())
    by_part = lambda name: next(o for o in objs if o.name.split(".")[0] == spec["pfx"] + name)
    root = next(o for o in objs if o.name.split(".")[0] == spec["root"])
    return dict(coll=coll, objs=objs, rest=rest, part=by_part, root=root, spec=spec)

def reset(ch):
    for o in ch["objs"]:
        o.location, o.rotation_euler, o.scale = (v.copy() for v in ch["rest"][o.name])

def aim(arm, hand, target):
    """Rotate arm (pivot at the shoulder) so the shoulder->wrist segment points along world direction target."""
    bpy.context.view_layer.update()
    d0 = (hand.matrix_world.translation - arm.matrix_world.translation).normalized()
    q = d0.rotation_difference(Vector(target).normalized())
    parent_rot = arm.parent.matrix_world.to_quaternion()
    local = parent_rot.inverted() @ q @ parent_rot @ arm.rotation_euler.to_quaternion()
    arm.rotation_euler = local.to_euler("XYZ", arm.rotation_euler)

def pose(fid, ch, shot):
    reset(ch)
    p, part = dict(POSES[fid]["portrait"]), ch["part"]
    if shot == "head": p["arms"] = {}                                 # keep hands out of the HUD icon
    torso, head = part("Torso"), part(ch["spec"].get("face", "Head"))
    torso.rotation_euler = Vector(torso.rotation_euler) + Vector(p.get("torso", (0, 0, 0)))
    head.rotation_euler = Vector(head.rotation_euler) + Vector(p.get("head", (0, 0, 0)))
    ch["root"].location.z += p.get("lift", 0)
    for name, rot in p.get("parts", {}).items():                      # extra rotation for any other part
        part(name).rotation_euler = Vector(part(name).rotation_euler) + Vector(rot)
    for s, target in p["arms"].items():
        aim(part("Arm_" + s), part(FIGHTERS[fid]["hand"] + "_" + s), target)
    bpy.context.view_layer.update()

def frame_points(ch, what):
    dg = bpy.context.evaluated_depsgraph_get(); pts = []
    head = ch["part"](ch["spec"].get("face", "Head"))
    if what == "head" and "face_z" in ch["spec"]:
        return [p for p in frame_points(ch, "all") if p.z > ch["spec"]["face_z"] - 0.3]
    for o in ch["objs"]:
        if o.type != "MESH": continue
        if what == "head" and not (o == head or o.parent == head): continue
        me = o.evaluated_get(dg).to_mesh()
        pts += [o.matrix_world @ v.co for i, v in enumerate(me.vertices) if i % 3 == 0]
        o.evaluated_get(dg).to_mesh_clear()
    if what == "upper":                                              # chest-up: crop at the hips
        cut = ch["part"]("Torso").matrix_world.translation.z + 0.28
        pts = [p for p in pts if p.z > cut]
    if what == "head":                                               # head plus a little shoulder, not raised hands
        c = head.matrix_world.translation
        pts += [p for p in frame_points(ch, "all") if p.z > c.z - 0.12 and math.hypot(p.x - c.x, p.y - c.y) < 0.45]
        if "head_clip" in ch["spec"]: pts = [p for p in pts if p.z < ch["spec"]["head_clip"]]
    return pts

def place_camera(points, view, fill, size):
    sc.render.resolution_x = sc.render.resolution_y = size
    view = Vector(view).normalized()
    cam.rotation_euler = (-view).to_track_quat("-Z", "Y").to_euler()
    cam.data.type = "PERSP"; cam.data.lens = 50; cam.data.sensor_fit = "AUTO"
    bpy.context.view_layer.update()
    loc, _ = cam.camera_fit_coords(bpy.context.evaluated_depsgraph_get(), [c for p in points for c in p])
    cam.location = loc
    cam.data.lens = 50 * fill                                        # back off so the character fills ~fill of the frame
    bpy.context.view_layer.update()

def render(fid, ch, shot):
    s = SHOTS[shot]
    for other in CHARS.values(): other["coll"].hide_render = other is not ch
    pose(fid, ch, shot)
    place_camera(frame_points(ch, s["frame"]), VIEW_OVERRIDE.get((fid, shot), s["view"]), s["fill"], s["size"])
    path = os.path.join(OUT, "%s_%s.png" % (fid, shot))
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True, scene=sc.name)
    print("rendered", path)

os.makedirs(OUT, exist_ok=True); os.makedirs(os.path.dirname(SETUP), exist_ok=True)
only = globals().get("ONLY") or list(FIGHTERS)
CHARS = {fid: append_character(fid, FIGHTERS[fid]) for fid in only}
for i, (fid, ch) in enumerate(CHARS.items()):
    ch["root"].location.x = 0                                        # each renders alone at the origin
for fid, ch in CHARS.items():
    for shot in SHOTS:
        render(fid, ch, shot)
for fid, ch in CHARS.items():                                        # leave the setup in the portrait pose
    pose(fid, ch, "portrait"); ch["coll"].hide_render = False; ch["coll"].hide_viewport = fid != only[0]
bpy.data.libraries.write(SETUP, {sc}, compress=True)
print("saved setup", SETUP)
