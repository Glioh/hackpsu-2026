"""Builds LeBron (Limb-Possible) in its own Blender scene. Re-runnable: rebuilds from scratch.

Run from Blender's Python console / MCP:
    exec(open(p).read(), {"__name__": "__main__", "__file__": p})                    # build only
    exec(open(p).read(), {"__name__": "__main__", "__file__": p, "REPO": repo})      # build + save + export

A friendly Funko-style caricature of LeBron James in a Philadelphia-style home kit: royal-blue jersey and shorts
with red-and-white trim and a big 23 front and back (team colours and number only, no official team or league
logos), white headband, short beard, tall socks and sneakers, team-coloured wristbands (LB_Wristband) and a
basketball. The ball (LB_Rock) hangs off the right arm at the wrist, not the hand, so his fist's hit sphere stays the
standard size.
"""
import os
from mathutils import Vector

SCENE, PFX, ROOT_NAME = "LeBron", "LB_", "LeBron"
MAT_SPEC = {
    "skin":    ("Skin", (104, 66, 44), 0.6, 0.0, 0.08),
    "hair":    ("Hair", (26, 20, 18), 0.8),
    "eye":     ("EyeBlack", (14, 12, 14), 0.25),
    "shine":   ("EyeShine", (255, 255, 255), 0.3),
    "mouth":   ("Mouth", (70, 30, 26), 0.6),
    "teeth":   ("Teeth", (250, 248, 240), 0.4),
    "band":    ("Headband", (250, 250, 250), 0.6),
    "jersey":  ("Jersey", (0, 98, 180), 0.55),
    "red":     ("Red", (226, 30, 52), 0.55),
    "white":   ("White", (250, 250, 250), 0.5),
    "sock":    ("Sock", (246, 246, 246), 0.7),
    "shoe":    ("Sneaker", (230, 34, 52), 0.5),
    "sole":    ("Sole", (250, 250, 250), 0.6),
    "wrist":   ("Wristband", (250, 250, 250), 0.6),
    "ball":    ("Ball", (232, 110, 30), 0.65),
    "seam":    ("Seam", (30, 20, 16), 0.7),
}
KIT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "wobble_kit.py")
exec(compile(open(KIT, encoding="utf-8").read(), KIT, "exec"), globals())

def text(bm, body, M, size, mat, offset=0.0):
    """Flat extruded lettering (the kit's default font), in the XZ plane facing -Y, transformed by M."""
    cu = bpy.data.curves.new("_tmp_txt", "FONT"); cu.body = body; cu.size = size; cu.extrude = 0.006; cu.offset = offset
    cu.align_x = "CENTER"; cu.align_y = "CENTER"
    ob = bpy.data.objects.new("_tmp_txt", cu); sc.collection.objects.link(ob); bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    t = bmesh.new(); t.from_mesh(me)
    bmesh.ops.transform(t, matrix=M @ Rot(math.pi / 2, "X"), verts=t.verts)
    for f in t.faces: f.material_index = mat
    merge(bm, t)
    bpy.data.objects.remove(ob); bpy.data.curves.remove(cu); bpy.data.meshes.remove(me)

# ---------- skeleton pivots (world) ----------
TORSO = Vector((0, 0, 0.32)); NECK = Vector((0, 0, 0.86))
SH = {s: Vector((0.33 * s, 0, 0.75)) for s in (1, -1)}
WR = {s: wrist(SH[s], s) for s in (1, -1)}                                   # standard arm length
HIP = {s: Vector((0.14 * s, 0, 0.33)) for s in (1, -1)}
ANK = {s: Vector((0.15 * s, -0.01, 0.1)) for s in (1, -1)}

# ---------- torso: athletic build in a sleeveless home jersey ----------
TM = ["jersey", "red", "white", "skin"]
bm = bmesh.new()
blob(bm, "box", (0.56, 0.38, 0.58), T((0, 0, 0.27)), 0, bulge=0.06, soft=0.25, taper=0.08)
torso = make_obj("Torso", bm, TM, TORSO, root, "torso")
def kit(bm):
    L = lambda v: Vector(v) - TORSO
    blob(bm, "cyl", (0.22, 0.2, 0.08), T(L((0, 0, 0.86))), 3, cuts=2)                       # neck
    ring = [L(Vector((0.13 * math.cos(t), -0.02 + 0.11 * math.sin(t), 0.845 - 0.07 * max(0, -math.sin(t)) ** 2))) for t in [2 * math.pi * k / 24 for k in range(25)]]
    tube(bm, ring, 0.018, 1, sides=6)                                                        # red collar trim
    for s in (1, -1):                                                                        # armhole trim
        ring = [L(Vector((0.27 * s, 0.13 * math.cos(t), 0.72 + 0.11 * math.sin(t)))) for t in [2 * math.pi * k / 20 for k in range(21)]]
        tube(bm, ring, 0.016, 2, sides=6)
    blob(bm, "cyl", (0.6, 0.42, 0.05), T(L((0, 0, 0.36))), 1, cuts=2)                       # waist trim
append_to(torso, kit)
bm = bmesh.new()                                                                             # big 23, front and back
for side in (-1, 1):
    p, n = surf(torso, (0, 1.5 * side, 0.6), (0, -side, 0))
    M = T(p - TORSO + n * 0.012) @ Rot(0 if side < 0 else math.pi, "Z")
    text(bm, "23", M @ T((0, 0.004, 0)), 0.24, 1, offset=0.012)
    text(bm, "23", M @ T((0, -0.004, 0)), 0.24, 0)
make_obj("Number", bm, ["white", "red"], TORSO, torso, "number", subsurf=0)

# ---------- head: Funko-style block, short cropped hair, beard, white headband ----------
HM = ["skin", "hair", "eye", "shine", "mouth", "teeth", "band"]
bm = bmesh.new()
blob(bm, "box", (0.62, 0.58, 0.6), T((0, 0, 0.32)), 0, soft=0.2, taper=0.03)
head = make_obj("Head", bm, HM, NECK, torso, "head")
def face(bm):
    L = lambda v: Vector(v) - NECK
    def hit(x, z): return surf(head, (x, -1.5, z), (0, 1, 0))
    blob(bm, "box", (0.64, 0.6, 0.18), T(L((0, 0.01, 1.43))), 1, soft=0.35, cuts=2)          # close-cropped hair
    sq = lambda c: math.copysign(abs(c) ** 0.5, c)                                           # superellipse hugs the block
    ring = [L(Vector((0.318 * sq(math.cos(t)), 0.298 * sq(math.sin(t)), 1.34))) for t in [2 * math.pi * k / 48 for k in range(49)]]
    tube(bm, ring, 0.035, 6, sides=8)                                                        # headband
    for s in (1, -1):
        p, n = hit(0.12 * s, 1.16)                                                           # Funko eyes
        blob(bm, "sphere", (0.1, 0.035, 0.12), T(L(p - n * 0.004)) @ align(n), 2, cuts=2)
        blob(bm, "sphere", (0.025, 0.02, 0.03), T(L(p + n * 0.014 + Vector((0.018 * s, 0, 0.03)))) @ align(n), 3, cuts=1)
        p, n = hit(0.13 * s, 1.255)                                                          # brows
        blob(bm, "box", (0.13, 0.04, 0.035), T(L(p)) @ align(n) @ Rot(0.08 * s, "Y"), 1, cuts=2)
        p, n = surf(head, (1.5 * s, 0.0, 1.14), (-s, 0, 0))                                   # ears
        blob(bm, "sphere", (0.05, 0.09, 0.12), T(L(p + n * 0.01)), 0, cuts=2)
        p, n = surf(head, (1.5 * s, -0.04, 1.04), (-s, 0, 0))                                 # beard up the jaw
        blob(bm, "box", (0.035, 0.2, 0.16), T(L(p + n * 0.002 + Vector((0, -0.08, -0.04)))), 1, soft=0.3, cuts=2)
    p, n = hit(0, 1.065)                                                                      # nose
    blob(bm, "sphere", (0.09, 0.06, 0.06), T(L(p + n * 0.01)), 0, cuts=2)
    p, n = hit(0, 0.94)                                                                      # beard round the chin
    blob(bm, "sphere", (0.46, 0.14, 0.2), T(L(p - n * 0.03 + Vector((0, 0, -0.01)))), 1, cuts=2)
    p, n = hit(0, 1.012)                                                                     # moustache
    blob(bm, "box", (0.16, 0.04, 0.03), T(L(p + n * 0.006)) @ align(n), 1, cuts=2, soft=0.3)
    p, n = hit(0, 0.97)                                                                     # big smile
    blob(bm, "sphere", (0.15, 0.04, 0.06), T(L(p + n * 0.035)) @ align(n), 4, cuts=2, flat=0.1)
    blob(bm, "box", (0.11, 0.03, 0.025), T(L(p + n * 0.05 + Vector((0, 0, 0.012)))) @ align(n), 5, cuts=1)
append_to(head, face)

# ---------- arms (standard length): bare, team wristbands; the ball rides the right arm ----------
for s in (1, -1):
    d = (WR[s] - SH[s]).normalized(); Ln = (WR[s] - SH[s]).length
    bm = bmesh.new()
    blob(bm, "sphere", (0.18, 0.18, 0.18), T((0, 0, 0)), 0, cuts=2)                              # shoulder
    blob(bm, "cyl", (0.13, 0.13, Ln + 0.04), T(d * Ln / 2) @ along(d), 0, bulge=0.3)
    blob(bm, "cyl", (0.15, 0.15, 0.08), T(d * (Ln - 0.04)) @ along(d), 1, cuts=2)                # wristband
    arm = make_obj("Arm_" + SIDE[s], bm, ["skin", "wrist"], SH[s], torso, "upper_arm")
    bm = bmesh.new(); inward = Vector((-s, 0, 0)); fwd = Vector((0, -1, 0))
    blob(bm, "sphere", (0.18, 0.17, 0.2), T(d * 0.1) @ along(d), 0)
    blob(bm, "sphere", (0.06, 0.07, 0.09), T(d * 0.08 + fwd * 0.07 + inward * 0.03) @ along(d), 0, cuts=2)
    make_obj("Hand_" + SIDE[s], bm, ["skin"], WR[s], arm, "hand")
    if s == -1:                                                                                  # basketball at the palm
        c = WR[s] + d * 0.1 + Vector((0.13 * s, -0.1, 0.0))                                  # cradled out and forward of the fist
        bm = bmesh.new()
        blob(bm, "sphere", (0.3, 0.3, 0.3), T((0, 0, 0)), 0, cuts=4)
        for M in (Matrix(), Rot(math.pi / 2, "X"), Rot(math.pi / 2, "Y")):
            tube(bm, [M @ Vector((0.152 * math.cos(t), 0.152 * math.sin(t), 0)) for t in [2 * math.pi * k / 32 for k in range(33)]], 0.007, 1, sides=5)
        make_obj("Rock", bm, ["ball", "seam"], c, arm, "ball")    # "the rock": sorts after Hand_R, which must export first

# ---------- shorts, tall socks, sneakers ----------
for s in (1, -1):
    bm = bmesh.new()
    blob(bm, "cyl", (0.24, 0.24, 0.18), T((0, 0, -0.03)), 0, bulge=0.2)                         # baggy shorts
    blob(bm, "box", (0.03, 0.2, 0.17), T((0.115 * s, 0, -0.03)), 1, cuts=2)                     # side stripes
    blob(bm, "box", (0.031, 0.08, 0.17), T((0.117 * s, 0, -0.03)), 2, cuts=1)
    blob(bm, "cyl", (0.12, 0.12, 0.14), T((0, 0, -0.17)), 3, cuts=2)                            # tall sock
    leg = make_obj("Leg_" + SIDE[s], bm, ["jersey", "red", "white", "sock"], HIP[s], torso, "leg")
    bm = bmesh.new(); F = lambda v: T(Vector(v) - ANK[s])
    blob(bm, "box", (0.18, 0.3, 0.13), F((0.15 * s, -0.04, 0.08)), 0, soft=0.1)
    blob(bm, "box", (0.2, 0.32, 0.05), F((0.15 * s, -0.045, 0.025)), 1, cuts=2)
    make_obj("Foot_" + SIDE[s], bm, ["shoe", "sole"], ANK[s], leg, "foot")

bpy.context.view_layer.update()
check_arms()
present((0.55, 0.58, 0.66))
print("built:", sorted(o.name for o in coll.objects))
if globals().get("REPO"):
    save_and_export(REPO, "lebron")
