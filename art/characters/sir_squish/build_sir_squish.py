"""Builds Sir Squish (Wobble Boxing) in its own Blender scene. Re-runnable: rebuilds from scratch.

Faces -Y (Blender front view). Ground at z=0. Each body part is its own mesh with its origin
at the joint it pivots on, so parts map 1:1 to future bones / ragdoll rigid bodies.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix

SCENE = "Sir_Squish"
PFX = "SS_"
T = Matrix.Translation
def Rot(a, ax): return Matrix.Rotation(a, 4, ax)

# ---------- scene / cleanup ----------
sc = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
bpy.context.window.scene = sc
for o in list(bpy.data.objects):
    if o.name.startswith(PFX) or o.name == "SirSquish":
        bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.meshes):
    if (m.name.startswith(PFX) or m.name.startswith("_tmp")) and m.users == 0:
        bpy.data.meshes.remove(m)
coll = bpy.data.collections.get("SirSquish") or bpy.data.collections.new("SirSquish")
if "SirSquish" not in sc.collection.children:
    sc.collection.children.link(coll)

# ---------- materials (pastel, simple Principled) ----------
def lin(c): return tuple((v / 255.0) ** 2.2 for v in c) + (1.0,)
def make_mat(key, rgb, rough=0.65, metal=0.0, sss=0.0):
    m = bpy.data.materials.get(PFX + key) or bpy.data.materials.new(PFX + key)
    try: m.use_nodes = True
    except Exception: pass
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = lin(rgb)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if sss:
        try:
            b.inputs["Subsurface Weight"].default_value = sss
            b.inputs["Subsurface Radius"].default_value = (0.3, 0.2, 0.15)
        except Exception: pass
    m.diffuse_color = lin(rgb)
    m.roughness = rough; m.metallic = metal
    return m

MATS = {
    "cream": make_mat("Marshmallow", (248, 239, 222), 0.75, sss=0.12),
    "metal": make_mat("PotSilver", (176, 182, 194), 0.33, 0.8),
    "lav":   make_mat("Lavender", (188, 166, 232), 0.7),
    "blue":  make_mat("PastelBlue", (158, 196, 238), 0.7),
    "eye":   make_mat("EyeDark", (42, 34, 56), 0.35),
    "white": make_mat("Highlight", (255, 255, 255), 0.3),
    "pink":  make_mat("Blush", (246, 168, 182), 0.8),
    "brow":  make_mat("BrowPlum", (86, 62, 104), 0.6),
    "cuff":  make_mat("CuffWhite", (252, 250, 244), 0.8),
}

# ---------- geometry helpers ----------
def merge(bm, t):
    me = bpy.data.meshes.new("_tmp"); t.to_mesh(me); t.free()
    bm.from_mesh(me); bpy.data.meshes.remove(me)

def finish(t, mat):
    for f in t.faces:
        f.material_index = mat; f.smooth = True
    bmesh.ops.recalc_face_normals(t, faces=t.faces[:])

def blob(bm, shape, dims, M, mat, cuts=3, bulge=0.0, taper=0.0, soft=0.0, flat=None):
    """Quad-cage primitive: 'box' | 'cyl' (axis Z) | 'sphere'. Subsurf softens it."""
    t = bmesh.new()
    bmesh.ops.create_cube(t, size=2.0)
    bmesh.ops.subdivide_edges(t, edges=t.edges[:], cuts=cuts, use_grid_fill=True)
    for v in t.verts:
        p = v.co.copy()
        if shape == "sphere":
            p = p.normalized()
        elif shape == "cyl":
            r = max(abs(p.x), abs(p.y)); l = math.hypot(p.x, p.y)
            if l > 1e-6: p.x, p.y = p.x / l * r, p.y / l * r
        if flat is not None: p.z = max(p.z, -flat)
        k = (1 + bulge * (1 - p.z * p.z)) * (1 + taper * p.z) * (1 - soft * abs(p.z) ** 3)
        v.co = M @ Vector((p.x * k * dims[0] / 2, p.y * k * dims[1] / 2, p.z * dims[2] / 2))
    finish(t, mat); merge(bm, t)

def tube(bm, pts, radius, mat, sides=6):
    t = bmesh.new(); rings = []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        q = Vector((0, 0, 1)).rotation_difference(d)
        rings.append([t.verts.new(p + q @ Vector((math.cos(a) * radius, math.sin(a) * radius, 0)))
                      for a in (2 * math.pi * k / sides for k in range(sides))])
    for a, b in zip(rings, rings[1:]):
        for k in range(sides):
            t.faces.new((a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]))
    t.faces.new(rings[0][::-1]); t.faces.new(rings[-1])
    finish(t, mat); merge(bm, t)

def align(n):  # rotation taking local -Y (outward) onto normal n
    return Vector((0, -1, 0)).rotation_difference(n).to_matrix().to_4x4()

def along(d):  # rotation taking local +Z onto direction d
    return Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()

PIV = {}
def make_obj(name, bm, mats, pivot, parent, part, subsurf=1):
    me = bpy.data.meshes.new(PFX + name); bm.to_mesh(me); bm.free()
    for k in mats: me.materials.append(MATS[k])
    ob = bpy.data.objects.new(PFX + name, me); coll.objects.link(ob)
    PIV[ob.name] = Vector(pivot)
    ob.parent = parent
    ob.location = Vector(pivot) - (PIV[parent.name] if parent.name in PIV else parent.location)
    if subsurf:
        md = ob.modifiers.new("Subdiv", "SUBSURF"); md.levels = subsurf; md.render_levels = subsurf + 1
    ob["ragdoll_part"] = part
    return ob

def surf(ob, origin_w, dir_w):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    oe = ob.evaluated_get(dg); mw = ob.matrix_world; inv = mw.inverted()
    ok, loc, nor, _ = oe.ray_cast(inv @ Vector(origin_w), (inv.to_3x3() @ Vector(dir_w)).normalized())
    if not ok: raise RuntimeError("ray miss on %s at %s" % (ob.name, origin_w))
    return mw @ loc, (mw.to_3x3() @ nor).normalized()

def append_to(ob, build):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    build(bm); bm.to_mesh(ob.data); bm.free()

# ---------- skeleton pivots (world) ----------
ROOT = (0, 0, 0)
TORSO = Vector((0, 0, 0.40)); NECK = Vector((0, 0, 0.95)); HELM = Vector((0, 0, 1.385))
SH = {s: Vector((0.40 * s, 0, 0.80)) for s in (1, -1)}      # +X = his left
WR = {s: SH[s] + Vector((0.20 * s, -0.02, -0.25)) for s in (1, -1)}  # standard arm: wobble_kit.ARM
HIP = {s: Vector((0.19 * s, 0, 0.36)) for s in (1, -1)}
ANK = {s: Vector((0.20 * s, -0.01, 0.15)) for s in (1, -1)}
SIDE = {1: "L", -1: "R"}

root = bpy.data.objects.new("SirSquish", None)
root.empty_display_type = "PLAIN_AXES"; root.empty_display_size = 0.3
coll.objects.link(root); PIV[root.name] = Vector(ROOT)

# ---------- torso: one big squat marshmallow ----------
TM = ["cream", "blue", "lav"]
bm = bmesh.new()
blob(bm, "cyl", (0.92, 0.78, 0.64), T((0, 0, 0.24)), 0, bulge=0.10, taper=-0.07, soft=0.22)
torso = make_obj("Torso", bm, TM, TORSO, root, "torso")

# padded chest plate: grid shrink-wrapped onto the torso front, then thickened
def chest(bm):
    t = bmesh.new(); NU, NV = 9, 7; grid = []
    for j in range(NV):
        z = 0.50 + 0.36 * j / (NV - 1); row = []
        for i in range(NU):
            th = -1.0 + 2.0 * i / (NU - 1)
            p, n = surf(torso, (math.sin(th) * 1.5, -math.cos(th) * 1.5, z), (-math.sin(th), math.cos(th), 0))
            quilt = 0.0 if (i == NU // 2 or j == NV // 2) else 0.018   # puffy quilted cells
            row.append(t.verts.new(p + n * (0.010 + quilt) - TORSO))
        grid.append(row)
    for j in range(NV - 1):
        for i in range(NU - 1):
            t.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    bmesh.ops.recalc_face_normals(t, faces=t.faces[:])
    # make sure normals point outward (-Y-ish) before thickening inward
    if sum(f.normal.y for f in t.faces) > 0:
        bmesh.ops.reverse_faces(t, faces=t.faces[:])
    bmesh.ops.solidify(t, geom=t.faces[:], thickness=0.05)
    finish(t, 1); merge(bm, t)
    # lavender badge + bottle-cap rivets
    p, n = surf(torso, (0, -1.5, 0.70), (0, 1, 0))
    blob(bm, "cyl", (0.15, 0.15, 0.05), T(p + n * 0.05 - TORSO) @ align(n) @ Rot(math.pi / 2, "X"), 2, cuts=2)
    for th, z in ((-0.78, 0.82), (0.78, 0.82), (-0.78, 0.55), (0.78, 0.55)):
        p, n = surf(torso, (math.sin(th) * 1.5, -math.cos(th) * 1.5, z), (-math.sin(th), math.cos(th), 0))
        blob(bm, "sphere", (0.045, 0.045, 0.045), T(p + n * 0.05 - TORSO), 2, cuts=1)
append_to(torso, chest)

# ---------- head: smaller marshmallow + face ----------
HM = ["cream", "eye", "white", "brow", "pink"]
bm = bmesh.new()
blob(bm, "cyl", (0.66, 0.58, 0.46), T((0, 0, 0.21)), 0, bulge=0.07, taper=-0.05, soft=0.2)
head = make_obj("Head", bm, HM, NECK, torso, "head")

def face(bm):
    def hit(x, z): return surf(head, (x, -1.5, z), (0, 1, 0))
    for s in (1, -1):
        p, n = hit(0.11 * s, 1.16)                                           # eyes
        blob(bm, "sphere", (0.085, 0.05, 0.13), T(p - n * 0.008 - NECK) @ align(n), 1, cuts=2)
        blob(bm, "sphere", (0.028, 0.02, 0.034),
             T(p + n * 0.014 - NECK) @ align(n) @ T((0.012 * s, 0, 0.026)), 2, cuts=1)
        p, n = hit(0.13 * s, 1.258)                                          # heroic brows
        blob(bm, "box", (0.15, 0.045, 0.045), T(p - NECK) @ align(n) @ Rot(-0.42 * s, "Y"), 3, cuts=2)
        p, n = hit(0.215 * s, 1.08)                                         # blush
        blob(bm, "sphere", (0.085, 0.02, 0.05), T(p - n * 0.004 - NECK) @ align(n), 4, cuts=2)
    pts = []                                                                 # determined smirk
    for k in range(7):
        u = -1 + 2 * k / 6
        p, n = hit(0.06 * u, 1.065 + 0.022 * u * u + 0.01 * u)
        pts.append(p + n * 0.002 - NECK)
    tube(bm, pts, 0.012, 1)
append_to(head, face)

# ---------- helmet: dented cooking pot, mismatched handle, duster plume ----------
bm = bmesh.new()
t = bmesh.new()
bmesh.ops.create_cone(t, cap_ends=True, cap_tris=False, segments=16, radius1=0.35, radius2=0.335, depth=0.24)
bottom = [f for f in t.faces if len(f.verts) == 16 and f.calc_center_median().z < 0]
bmesh.ops.delete(t, geom=bottom, context="FACES_ONLY")
side_edges = [e for e in t.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 0.1]
bmesh.ops.subdivide_edges(t, edges=side_edges, cuts=2)
top = [f for f in t.faces if len(f.verts) == 16][0]
bmesh.ops.inset_individual(t, faces=[top], thickness=0.12)
rim = [e for e in t.edges if e.is_boundary]
new = bmesh.ops.extrude_edge_only(t, edges=rim)["geom"]
for v in (g for g in new if isinstance(g, bmesh.types.BMVert)):
    v.co.x *= 1.09; v.co.y *= 1.09; v.co.z -= 0.012
dent_dir = math.atan2(-0.85, 0.5)                                            # front, his left
for v in t.verts:
    da = abs((math.atan2(v.co.y, v.co.x) - dent_dir + math.pi) % (2 * math.pi) - math.pi)
    w = max(0.0, 1 - da / 0.55) * max(0.0, (v.co.z + 0.02) / 0.14)
    r = math.hypot(v.co.x, v.co.y)
    if r > 1e-6 and w > 0:
        k = (r - 0.075 * w) / r; v.co.x *= k; v.co.y *= k; v.co.z -= 0.015 * w
bmesh.ops.recalc_face_normals(t, faces=t.faces[:])
bmesh.ops.solidify(t, geom=t.faces[:], thickness=0.022)
finish(t, 0); merge(bm, t)
blob(bm, "box", (0.10, 0.38, 0.055), T((0, 0.51, 0.03)) @ Rot(0.14, "X"), 1, cuts=2)        # handle
blob(bm, "cyl", (0.14, 0.14, 0.06), T((0, 0.70, 0.058)) @ Rot(0.14, "X"), 1, cuts=2)          # handle end
for c, d in (((0, 0.0, 0.17), 0.18), ((0, 0.07, 0.25), 0.17), ((0, 0.15, 0.30), 0.15), ((0, 0.23, 0.31), 0.12)):    # plume
    blob(bm, "sphere", (d, d, d), T(c), 2, cuts=2)
helmet = make_obj("Helmet", bm, ["metal", "blue", "lav"], HELM, head, "helmet")
helmet.rotation_euler = (math.radians(-5), math.radians(9), 0)

# ---------- arms + mismatched gloves + mismatched shoulder pads ----------
for s in (1, -1):
    d = (WR[s] - SH[s]).normalized(); L = (WR[s] - SH[s]).length
    bm = bmesh.new()
    blob(bm, "cyl", (0.16, 0.16, L + 0.1), T(d * L / 2) @ along(d), 0)
    if s == 1:   # his left: one big foam dome
        blob(bm, "sphere", (0.30, 0.30, 0.17), T((0.0, 0, 0.10)) @ Rot(-0.35, "Y"), 1, cuts=3)
    else:        # his right: stacked pool-noodle rolls
        for c in ((0.08, 0, 0.17), (-0.05, 0, 0.13), (-0.15, 0, 0.03)):
            blob(bm, "cyl", (0.16, 0.16, 0.32), T(c) @ Rot(math.pi / 2, "X"), 2, cuts=2)
    arm = make_obj("Arm_" + SIDE[s], bm, ["cream", "lav", "blue"], SH[s], torso, "upper_arm")

    bm = bmesh.new(); inward = Vector((-s, 0, 0)); fwd = Vector((0, -1, 0))
    if s == 1:   # lavender boxing glove, cream cuff
        blob(bm, "sphere", (0.33, 0.31, 0.36), T(d * 0.19) @ along(d), 0, bulge=0.05)
        blob(bm, "sphere", (0.11, 0.12, 0.17), T(d * 0.15 + fwd * 0.14 + inward * 0.04) @ along(d), 0, cuts=2)
        blob(bm, "cyl", (0.2, 0.2, 0.09), T(d * 0.01) @ along(d), 1, cuts=2)
        gm = ["lav", "cuff"]
    else:        # pastel-blue oven mitt, lavender cuff
        blob(bm, "cyl", (0.25, 0.34, 0.38), T(d * 0.2) @ along(d), 0, soft=0.35)
        blob(bm, "sphere", (0.11, 0.12, 0.18), T(d * 0.14 + fwd * 0.16 + inward * 0.03) @ along(d), 0, cuts=2)
        blob(bm, "cyl", (0.21, 0.21, 0.10), T(d * 0.01) @ along(d), 1, cuts=2)
        gm = ["blue", "lav"]
    make_obj("Glove_" + SIDE[s], bm, gm, WR[s], arm, "hand")

# ---------- stubby legs + round feet ----------
for s in (1, -1):
    bm = bmesh.new()
    blob(bm, "cyl", (0.22, 0.22, 0.30), T((0, 0, -0.10)), 0)
    if s == -1:  # knee pad on one leg only
        blob(bm, "box", (0.17, 0.07, 0.13), T((0.0, -0.115, -0.12)), 1, cuts=2)
    else:        # odd lavender sock band on the other
        blob(bm, "cyl", (0.24, 0.24, 0.06), T((0, 0, -0.19)), 2, cuts=2)
    leg = make_obj("Leg_" + SIDE[s], bm, ["cream", "blue", "lav"], HIP[s], torso, "leg")
    bm = bmesh.new()
    blob(bm, "sphere", (0.27, 0.36, 0.26), T(Vector((0.21 * s, -0.06, 0.08)) - ANK[s]), 0, flat=0.62)
    make_obj("Foot_" + SIDE[s], bm, ["cream"], ANK[s], leg, "foot")

bpy.context.view_layer.update()
print("built:", sorted(o.name for o in coll.objects))

# ---------- save + export (only when REPO is given) ----------
# In Blender's Python console / MCP:
#   exec(open(p).read(), {"__name__": "__main__", "REPO": r"C:\path\to\hackpsu-2026"})
# Writes only this scene to the .blend (the open session's file is untouched) and exports the GLB
# the host page loads (host/src/fighter-model.js).
REPO = globals().get("REPO")
if REPO:
    import os
    bpy.data.libraries.write(os.path.join(REPO, "art", "characters", "sir_squish", "sir_squish.blend"), {sc}, compress=True)
    for o in sc.objects: o.select_set(o.name in coll.objects)
    bpy.ops.export_scene.gltf(filepath=os.path.join(REPO, "host", "assets", "characters", "sir_squish.glb"),
                              export_format="GLB", use_selection=True, use_active_scene=True,
                              export_apply=True, export_extras=True, export_yup=True)
    print("saved + exported to", REPO)
