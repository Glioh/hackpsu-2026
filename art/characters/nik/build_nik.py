"""Builds Nik (Two-Body Brawl) in its own Blender scene. Re-runnable: rebuilds from scratch.

Run from Blender's Python console / MCP:
    exec(open(p).read(), {"__name__": "__main__", "__file__": p})                    # build only
    exec(open(p).read(), {"__name__": "__main__", "__file__": p, "REPO": repo})      # build + save + export

Funko-Pop-style brawler: oversized rounded-cube head, solid black oval eyes and a confident smirk, a big fluffy
black hairdo, dark hoodie (hood bunched behind the neck, drawstrings, kangaroo pocket), joggers, chunky sneakers
and oversized boxing gloves that take the team colour in game (NK_Gloves).
"""
import os
from mathutils import Vector

SCENE, PFX, ROOT_NAME = "Nik", "NK_", "Nik"
MAT_SPEC = {
    "skin":    ("Skin", (170, 112, 80), 0.6, 0.0, 0.08),
    "hair":    ("Hair", (26, 22, 24), 0.75),
    "hair2":   ("HairSheen", (48, 42, 46), 0.6),
    "hoodie":  ("Hoodie", (46, 48, 62), 0.85),
    "hoodiedk": ("HoodieDark", (32, 33, 44), 0.9),
    "string":  ("Drawstring", (236, 232, 224), 0.7),
    "jogger":  ("Joggers", (92, 94, 108), 0.85),
    "shoe":    ("Sneaker", (244, 242, 236), 0.6),
    "sole":    ("Sole", (64, 66, 80), 0.7),
    "gloves":  ("Gloves", (226, 62, 62), 0.45),
    "eye":     ("EyeBlack", (16, 14, 18), 0.25),
    "white":   ("EyeShine", (255, 255, 255), 0.3),
    "mouth":   ("Mouth", (90, 44, 38), 0.6),
    "patch":   ("Patch", (255, 212, 71), 0.6),
}
KIT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "wobble_kit.py")
exec(compile(open(KIT, encoding="utf-8").read(), KIT, "exec"), globals())

# ---------- skeleton pivots (world) ----------
TORSO = Vector((0, 0, 0.32)); NECK = Vector((0, 0, 0.80))
SH = {s: Vector((0.32 * s, 0, 0.70)) for s in (1, -1)}
WR = {s: wrist(SH[s], s) for s in (1, -1)}                                   # standard arm length
HIP = {s: Vector((0.14 * s, 0, 0.33)) for s in (1, -1)}
ANK = {s: Vector((0.15 * s, -0.01, 0.11)) for s in (1, -1)}

# ---------- torso: soft hoodie block with hood, drawstrings, pocket ----------
TM = ["hoodie", "hoodiedk", "string", "patch"]
bm = bmesh.new()
blob(bm, "box", (0.60, 0.44, 0.52), T((0, 0, 0.24)), 0, bulge=0.08, soft=0.3)
blob(bm, "cyl", (0.64, 0.48, 0.07), T((0, 0, 0.02)), 1, cuts=2)              # ribbed hem
torso = make_obj("Torso", bm, TM, TORSO, root, "torso")
def hoodie(bm):
    L = lambda v: Vector(v) - TORSO
    blob(bm, "sphere", (0.58, 0.28, 0.22), T(L((0, 0.17, 0.84))), 0)          # hood bunched behind the neck
    blob(bm, "sphere", (0.46, 0.2, 0.12), T(L((0, 0.2, 0.9))), 1, cuts=2)     # hood lining shadow
    for s in (1, -1):                                                         # drawstrings with aglets
        pts = []
        for z in (0.80, 0.72, 0.64):
            p, n = surf(torso, (0.07 * s, -1.5, z), (0, 1, 0)); pts.append(L(p + n * 0.012))
        tube(bm, pts, 0.012, 2, sides=6)
        blob(bm, "cyl", (0.03, 0.03, 0.05), T(pts[-1] + Vector((0, 0, -0.03))), 2, cuts=1)
    p, n = surf(torso, (0, -1.5, 0.45), (0, 1, 0))                            # kangaroo pocket
    blob(bm, "box", (0.36, 0.05, 0.15), T(L(p + n * 0.012)) @ align(n), 1, cuts=2)
    p, n = surf(torso, (-0.16, -1.5, 0.66), (0, 1, 0))                        # little chest patch
    blob(bm, "cyl", (0.07, 0.07, 0.02), T(L(p + n * 0.008)) @ along(n), 3, cuts=1)
append_to(torso, hoodie)

# ---------- head: oversized Funko block, eyes, brows, smirk, ears, big fluffy hair ----------
HM = ["skin", "eye", "white", "hair", "mouth", "hair2"]
bm = bmesh.new()
blob(bm, "box", (0.76, 0.66, 0.64), T((0, -0.01, 0.33)), 0, soft=0.18, taper=0.04)
head = make_obj("Head", bm, HM, NECK, torso, "head")
def face(bm):
    L = lambda v: Vector(v) - NECK
    def hit(x, z): return surf(head, (x, -1.5, z), (0, 1, 0))
    for s in (1, -1):
        p, n = hit(0.16 * s, 1.07)                                            # big solid black oval eyes
        blob(bm, "sphere", (0.125, 0.04, 0.155), T(L(p - n * 0.006)) @ align(n), 1, cuts=2)
        blob(bm, "sphere", (0.03, 0.02, 0.035), T(L(p + n * 0.016 + Vector((0.022 * s, 0, 0.038)))) @ align(n), 2, cuts=1)
        p, n = hit(0.16 * s, 1.225)                                           # thick confident brows
        blob(bm, "box", (0.15, 0.05, 0.05), T(L(p + n * 0.004)) @ align(n) @ Rot(-0.12 * s, "Y"), 3, cuts=2)
        p, n = surf(head, (1.5 * s, 0.0, 1.06), (-s, 0, 0))                   # ears
        blob(bm, "sphere", (0.06, 0.1, 0.13), T(L(p + n * 0.01)), 0, cuts=2)
    p, n = hit(0.0, 0.995)                                                    # button nose
    blob(bm, "sphere", (0.07, 0.05, 0.05), T(L(p + n * 0.004)), 0, cuts=2)
    smirk = []
    for k in range(7):
        u = -1 + 2 * k / 6
        q, m = hit(0.045 * u + 0.02, 0.925 + 0.014 * u * u + 0.012 * u)       # one-sided confident smirk
        smirk.append(L(q + m * 0.003))
    tube(bm, smirk, 0.011, 4)
    # Big fluffy hair: overlapping soft clumps over the top, a front swoop and sideburns.
    clumps = [((0, 0.02, 1.52), .27, 3), ((0.19, 0.05, 1.50), .21, 3), ((-0.19, 0.05, 1.50), .21, 3), ((0.08, -0.15, 1.49), .19, 5),
              ((-0.12, -0.16, 1.48), .18, 3), ((0.28, -0.05, 1.42), .17, 3), ((-0.28, -0.04, 1.43), .17, 5), ((0.31, 0.13, 1.36), .18, 3),
              ((-0.31, 0.13, 1.36), .18, 3), ((0, 0.26, 1.40), .23, 3), ((0.16, 0.25, 1.33), .18, 5), ((-0.16, 0.25, 1.33), .18, 3),
              ((0.16, -0.28, 1.39), .15, 3), ((0.02, -0.29, 1.41), .14, 5), ((-0.12, -0.27, 1.40), .13, 3), ((0.0, 0.0, 1.60), .2, 5),
              ((0, 0.31, 1.26), .2, 3), ((0.2, 0.29, 1.23), .17, 5), ((-0.2, 0.29, 1.23), .17, 3), ((0.33, 0.17, 1.25), .15, 3),   # back + sides
              ((-0.33, 0.17, 1.25), .15, 5), ((0.34, -0.04, 1.32), .13, 3), ((-0.34, -0.04, 1.32), .13, 3)]
    for c, r, mat in clumps:
        blob(bm, "sphere", (r * 2, r * 2, r * 1.6), T(L(c)), mat, cuts=2)
    for s in (1, -1):                                                         # sideburns
        blob(bm, "sphere", (0.05, 0.08, 0.12), T(L((0.37 * s, -0.08, 1.24))), 3, cuts=2)
append_to(head, face)

# ---------- arms (standard length): hoodie sleeves + oversized boxing gloves ----------
for s in (1, -1):
    d = (WR[s] - SH[s]).normalized(); Ln = (WR[s] - SH[s]).length
    bm = bmesh.new()
    blob(bm, "cyl", (0.16, 0.16, Ln + 0.08), T(d * Ln / 2) @ along(d), 0)
    blob(bm, "cyl", (0.18, 0.18, 0.06), T(d * (Ln - 0.02)) @ along(d), 1, cuts=2)    # sleeve cuff
    arm = make_obj("Arm_" + SIDE[s], bm, ["hoodie", "hoodiedk"], SH[s], torso, "upper_arm")
    bm = bmesh.new(); inward = Vector((-s, 0, 0)); fwd = Vector((0, -1, 0))
    blob(bm, "sphere", (0.36, 0.34, 0.38), T(d * 0.21) @ along(d), 0, bulge=0.05)
    blob(bm, "sphere", (0.12, 0.13, 0.19), T(d * 0.17 + fwd * 0.15 + inward * 0.05) @ along(d), 0, cuts=2)
    blob(bm, "cyl", (0.23, 0.23, 0.1), T(d * 0.02) @ along(d), 1, cuts=2)                 # white glove cuff
    make_obj("Hand_" + SIDE[s], bm, ["gloves", "string"], WR[s], arm, "hand")

# ---------- short legs + chunky sneakers ----------
for s in (1, -1):
    bm = bmesh.new()
    blob(bm, "cyl", (0.16, 0.16, 0.24), T((0, 0, -0.1)), 0, bulge=0.08)
    leg = make_obj("Leg_" + SIDE[s], bm, ["jogger"], HIP[s], torso, "leg")
    bm = bmesh.new(); F = lambda v: T(Vector(v) - ANK[s])
    blob(bm, "box", (0.21, 0.33, 0.12), F((0.15 * s, -0.05, 0.085)), 0)
    blob(bm, "box", (0.23, 0.35, 0.05), F((0.15 * s, -0.05, 0.03)), 1, cuts=2)
    make_obj("Foot_" + SIDE[s], bm, ["shoe", "sole"], ANK[s], leg, "foot")

# ---------- attitude: a little cocky head tilt ----------
head.rotation_euler = (0.0, math.radians(5), math.radians(-4))

bpy.context.view_layer.update()
check_arms()
present((0.56, 0.58, 0.66))
print("built:", sorted(o.name for o in coll.objects))
if globals().get("REPO"):
    save_and_export(REPO, "nik")
