"""Shared Blender build kit for Wobble Boxing fighters.

A character script sets SCENE, PFX, ROOT_NAME and MAT_SPEC, then execs this file into its own globals:
    exec(open(KIT).read(), globals())

Conventions every fighter follows (the host page's loader relies on them):
- faces -Y in Blender (+Z in glTF), feet at z=0, metres;
- one mesh per body part, origin at the joint it pivots on, tagged with a `ragdoll_part` property;
- parts named <PFX>Torso, <PFX>Head, <PFX>Arm_L/R, <PFX>Leg_L/R (L = +X, the punching side);
- every arm uses ARM: the same shoulder->wrist segment, so all fighters have equal arm length.
"""
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

ARM = Vector((0.20, -0.02, -0.25))            # shoulder -> wrist for the +X arm (mirror X for -X)
ARM_LENGTH = ARM.length                         # 0.3207 m

def wrist(shoulder, s): return Vector(shoulder) + Vector((ARM.x * s, ARM.y, ARM.z))

T = Matrix.Translation
def Rot(a, ax): return Matrix.Rotation(a, 4, ax)
SIDE = {1: "L", -1: "R"}

# ---------- scene / cleanup ----------
sc = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
bpy.context.window.scene = sc
for o in list(bpy.data.objects):
    if o.name.startswith(PFX) or o.name == ROOT_NAME:
        bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.meshes):
    if (m.name.startswith(PFX) or m.name.startswith("_tmp")) and m.users == 0:
        bpy.data.meshes.remove(m)
coll = bpy.data.collections.get(ROOT_NAME) or bpy.data.collections.new(ROOT_NAME)
if ROOT_NAME not in sc.collection.children:
    sc.collection.children.link(coll)

# ---------- materials ----------
def lin(c): return tuple((v / 255.0) ** 2.2 for v in c) + (1.0,)
def make_mat(key, rgb, rough=0.65, metal=0.0, sss=0.0, emit=0.0):
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
    if emit:
        try:
            b.inputs["Emission Color"].default_value = lin(rgb)
            b.inputs["Emission Strength"].default_value = emit
        except Exception: pass
    m.diffuse_color = lin(rgb); m.roughness = rough; m.metallic = metal
    return m

MATS = {k: make_mat(*v) for k, v in MAT_SPEC.items()}

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

def helix(bm, M, radius, height, turns, wire, mat):
    """Coil spring along local +Z from 0 to height."""
    n = int(turns * 12)
    tube(bm, [M @ Vector((radius * math.cos(2 * math.pi * turns * k / n), radius * math.sin(2 * math.pi * turns * k / n),
                          height * k / n)) for k in range(n + 1)], wire, mat)

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
    return Vector((0, 0, 1)).rotation_difference(Vector(d).normalized()).to_matrix().to_4x4()

root = bpy.data.objects.new(ROOT_NAME, None)
root.empty_display_type = "PLAIN_AXES"; root.empty_display_size = 0.3
coll.objects.link(root)
PIV = {root.name: Vector((0, 0, 0))}

def make_obj(name, bm, mats, pivot, parent, part, subsurf=1):
    me = bpy.data.meshes.new(PFX + name); bm.to_mesh(me); bm.free()
    for k in mats: me.materials.append(MATS[k])
    ob = bpy.data.objects.new(PFX + name, me); coll.objects.link(ob)
    PIV[ob.name] = Vector(pivot)
    ob.parent = parent
    ob.location = Vector(pivot) - PIV[parent.name]
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

# ---------- checks, presentation, save + export ----------
def check_arms():
    for s in (1, -1):
        a, h = bpy.data.objects[PFX + "Arm_" + SIDE[s]], bpy.data.objects[PFX + "Hand_" + SIDE[s]]
        seg = h.matrix_world.translation - a.matrix_world.translation
        assert abs(seg.length - ARM_LENGTH) < 1e-4, (a.name, seg.length, ARM_LENGTH)
    print("arm length ok: %.4f m" % ARM_LENGTH)

def present(world_rgb=(0.55, 0.52, 0.62), cam_target=None):
    w = bpy.data.worlds.get(PFX + "World") or bpy.data.worlds.new(PFX + "World")
    try: w.use_nodes = True
    except Exception: pass
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (*world_rgb, 1); sc.world = w
    for n in (PFX + "Cam", PFX + "Key"):
        if n in bpy.data.objects: bpy.data.objects.remove(bpy.data.objects[n])
    cam = bpy.data.objects.new(PFX + "Cam", bpy.data.cameras.new(PFX + "Cam"))
    cam.location = (3.2, -4.2, 1.6); cam.data.lens = 70; sc.collection.objects.link(cam); sc.camera = cam
    c = cam.constraints.new("TRACK_TO"); c.target = root
    key = bpy.data.objects.new(PFX + "Key", bpy.data.lights.new(PFX + "Key", "SUN"))
    key.rotation_euler = (0.8, 0.2, 0.6); key.data.energy = 2.5; sc.collection.objects.link(key)

def save_and_export(repo, slug):
    """Writes only this scene to art/characters/<slug>/<slug>.blend (the open session's file is untouched)
    and exports host/assets/characters/<slug>.glb."""
    blend_dir = os.path.join(repo, "art", "characters", slug); glb_dir = os.path.join(repo, "host", "assets", "characters")
    os.makedirs(blend_dir, exist_ok=True); os.makedirs(glb_dir, exist_ok=True)
    bpy.data.libraries.write(os.path.join(blend_dir, slug + ".blend"), {sc}, compress=True)
    bpy.context.window.scene = sc
    for o in sc.objects: o.select_set(o.name in coll.objects)
    bpy.ops.export_scene.gltf(filepath=os.path.join(glb_dir, slug + ".glb"), export_format="GLB",
                              use_selection=True, use_active_scene=True, export_apply=True,
                              export_extras=True, export_yup=True)
    print("saved + exported", slug)
