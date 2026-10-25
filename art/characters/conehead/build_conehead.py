"""Builds Conehead (Two-Body Brawl) in its own Blender scene. Re-runnable: rebuilds from scratch.

Run from Blender's Python console / MCP:
    exec(open(p).read(), {"__name__": "__main__", "__file__": p})                    # build only
    exec(open(p).read(), {"__name__": "__main__", "__file__": p, "REPO": repo})      # build + save + export

A stocky little construction worker wearing a traffic cone as a helmet, and the cone is taller than he is: lime
hi-vis vest with reflective stripes, tool belt, jeans, steel-toe boots, bushy moustache, work gloves (team
coloured in game, CH_Gloves). His eyes only just peek out under the cone's black rubber brim. The cone is its own
part tagged ragdoll_part="cone" so the game can bounce and tilt it on punches and hits.
"""
import os
from mathutils import Vector

SCENE, PFX, ROOT_NAME = "Conehead", "CH_", "Conehead"
MAT_SPEC = {
    "vest":    ("Vest", (196, 232, 44), 0.6),
    "reflect": ("Reflective", (214, 220, 226), 0.25, 0.0, 0.0, 0.15),
    "shirt":   ("Shirt", (44, 58, 92), 0.85),
    "skin":    ("Skin", (226, 168, 128), 0.6, 0.0, 0.08),
    "white":   ("EyeWhite", (255, 255, 250), 0.3, 0.0, 0.0, 0.5),
    "pupil":   ("Pupil", (20, 16, 14), 0.3),
    "stache":  ("Moustache", (96, 58, 34), 0.8),
    "cone":    ("Cone", (255, 106, 18), 0.4),
    "band":    ("ConeBand", (246, 246, 240), 0.3, 0.0, 0.0, 0.1),
    "rubber":  ("ConeBase", (36, 36, 40), 0.8),
    "belt":    ("ToolBelt", (120, 76, 40), 0.75),
    "jeans":   ("Jeans", (62, 92, 142), 0.85),
    "boot":    ("Boot", (128, 82, 44), 0.7),
    "sole":    ("Sole", (52, 42, 36), 0.8),
    "gloves":  ("Gloves", (240, 182, 44), 0.7),
}
KIT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "wobble_kit.py")
exec(compile(open(KIT, encoding="utf-8").read(), KIT, "exec"), globals())

# ---------- skeleton pivots (world) ----------
TORSO = Vector((0, 0, 0.32)); NECK = Vector((0, 0, 0.80)); CONE = Vector((0, -0.01, 1.0))
SH = {s: Vector((0.33 * s, 0, 0.70)) for s in (1, -1)}
WR = {s: wrist(SH[s], s) for s in (1, -1)}                                   # standard arm length
HIP = {s: Vector((0.15 * s, 0, 0.33)) for s in (1, -1)}
ANK = {s: Vector((0.16 * s, -0.01, 0.11)) for s in (1, -1)}

# ---------- torso: barrel chest in a hi-vis vest, reflective stripes, tool belt ----------
TM = ["vest", "reflect", "shirt", "belt", "pupil"]
bm = bmesh.new()
blob(bm, "box", (0.6, 0.44, 0.5), T((0, 0, 0.24)), 0, bulge=0.1, soft=0.3)
torso = make_obj("Torso", bm, TM, TORSO, root, "torso")
def vest(bm):
    L = lambda v: Vector(v) - TORSO
    def hit(x, z, side=-1): return surf(torso, (x, 1.5 * side, z), (0, -side, 0))
    for side in (-1, 1):                                                      # two reflective bands, front + back
        for z in (0.5, 0.66):
            for x in (-0.17, 0.0, 0.17):
                p, n = hit(x, z, side)
                blob(bm, "box", (0.19, 0.03, 0.055), T(L(p + n * 0.008)) @ align(n), 1, cuts=2)
    for s in (1, -1):                                                         # braces over the shoulders
        pts = []
        for a in range(10, 171, 20):                                          # sweep front -> over the top -> back
            d = Vector((0, -math.cos(math.radians(a)), math.sin(math.radians(a))))
            p, n = surf(torso, Vector((0.16 * s, 0, 0.5)) + d * 2, -d); pts.append(L(p + n * 0.014))
        tube(bm, pts, 0.026, 1, sides=6)
    p, n = hit(0, 0.56)                                                       # zip line + shirt collar
    blob(bm, "box", (0.03, 0.03, 0.34), T(L(p + n * 0.006)) @ align(n), 4, cuts=2)
    blob(bm, "cyl", (0.26, 0.24, 0.07), T(L((0, 0, 0.8))), 2, cuts=2)
    blob(bm, "cyl", (0.58, 0.46, 0.08), T(L((0, 0, 0.36))), 3, cuts=2)        # tool belt + pouch
    p, n = hit(0.22, 0.38)
    blob(bm, "box", (0.12, 0.08, 0.13), T(L(p + n * 0.04)) @ align(n), 3, cuts=2)
append_to(torso, vest)

# ---------- head: round face, big nose, bushy moustache, eyes just under the brim ----------
HM = ["skin", "white", "pupil", "stache"]
bm = bmesh.new()
blob(bm, "sphere", (0.44, 0.42, 0.4), T((0, -0.01, 0.18)), 0)
head = make_obj("Head", bm, HM, NECK, torso, "head")
def face(bm):
    L = lambda v: Vector(v) - NECK
    def hit(x, z): return surf(head, (x, -1.5, z), (0, 1, 0))
    for s in (1, -1):
        p, n = hit(0.085 * s, 0.995)                                          # little eyes peeking out
        blob(bm, "sphere", (0.075, 0.03, 0.06), T(L(p)) @ align(n), 1, cuts=2)
        blob(bm, "sphere", (0.04, 0.02, 0.04), T(L(p + n * 0.012 + Vector((0, 0, -0.006)))) @ align(n), 2, cuts=1)
        p, n = surf(head, (1.5 * s, 0, 0.98), (-s, 0, 0))                     # ears
        blob(bm, "sphere", (0.05, 0.08, 0.1), T(L(p + n * 0.01)), 0, cuts=2)
    p, n = hit(0, 0.95)                                                       # big round nose
    blob(bm, "sphere", (0.11, 0.09, 0.09), T(L(p + n * 0.025)), 0, cuts=2)
    for s in (1, -1):                                                         # bushy moustache, two lobes
        p, n = hit(0.06 * s, 0.885)
        blob(bm, "sphere", (0.16, 0.07, 0.07), T(L(p + n * 0.02)) @ align(n) @ Rot(0.25 * s, "Y"), 3, cuts=2)
append_to(head, face)

# ---------- the cone: taller than he is, black rubber brim, two reflective bands ----------
H0, H1, R0, R1 = 0.08, 1.78, 0.5, 0.04                                     # cone body: base/tip height + radius
r = lambda h: R0 + (R1 - R0) * (h - H0) / (H1 - H0)
bm = bmesh.new()
blob(bm, "box", (1.16, 1.16, 0.09), T((0, 0, 0.045)), 2, cuts=3, soft=0.05)
blob(bm, "cyl", (R0 + R1, R0 + R1, H1 - H0), T((0, 0, (H0 + H1) / 2)), 0, cuts=5, taper=(R1 - R0) / (R0 + R1))
for hc, hh in ((0.78, 0.2), (1.16, 0.14)):
    blob(bm, "cyl", (2 * r(hc) + 0.05, 2 * r(hc) + 0.05, hh), T((0, 0, hc)), 1, cuts=3,
         taper=(r(hc + hh / 2) - r(hc)) / (r(hc) + 0.025))
cone = make_obj("Cone", bm, ["cone", "band", "rubber"], CONE, head, "cone")
cone.rotation_euler = (math.radians(-5), math.radians(6), 0)                  # jaunty, front just lifted

# ---------- arms (standard length): short sleeves, forearms, chunky work gloves ----------
for s in (1, -1):
    d = (WR[s] - SH[s]).normalized(); Ln = (WR[s] - SH[s]).length
    bm = bmesh.new()
    blob(bm, "cyl", (0.17, 0.17, 0.15), T(d * 0.06) @ along(d), 1, cuts=2)              # t-shirt sleeve
    blob(bm, "cyl", (0.12, 0.12, Ln + 0.04), T(d * Ln / 2) @ along(d), 0, bulge=0.25)   # forearm
    arm = make_obj("Arm_" + SIDE[s], bm, ["skin", "shirt"], SH[s], torso, "upper_arm")
    bm = bmesh.new(); inward = Vector((-s, 0, 0)); fwd = Vector((0, -1, 0))
    blob(bm, "sphere", (0.27, 0.25, 0.28), T(d * 0.15) @ along(d), 0, bulge=0.05)
    blob(bm, "sphere", (0.09, 0.1, 0.13), T(d * 0.12 + fwd * 0.11 + inward * 0.04) @ along(d), 0, cuts=2)
    blob(bm, "cyl", (0.2, 0.2, 0.09), T(d * 0.0) @ along(d), 1, cuts=2)                # cuff
    make_obj("Hand_" + SIDE[s], bm, ["gloves", "belt"], WR[s], arm, "hand")

# ---------- stubby legs + steel-toe boots ----------
for s in (1, -1):
    bm = bmesh.new()
    blob(bm, "cyl", (0.17, 0.17, 0.25), T((0, 0, -0.1)), 0, bulge=0.06)
    leg = make_obj("Leg_" + SIDE[s], bm, ["jeans"], HIP[s], torso, "leg")
    bm = bmesh.new(); F = lambda v: T(Vector(v) - ANK[s])
    blob(bm, "box", (0.2, 0.3, 0.14), F((0.16 * s, -0.04, 0.09)), 0)
    blob(bm, "sphere", (0.2, 0.14, 0.12), F((0.16 * s, -0.16, 0.08)), 0, cuts=2)       # steel toe cap
    blob(bm, "box", (0.22, 0.34, 0.05), F((0.16 * s, -0.05, 0.025)), 1, cuts=2)
    make_obj("Foot_" + SIDE[s], bm, ["boot", "sole"], ANK[s], leg, "foot")

bpy.context.view_layer.update()
check_arms()
present((0.6, 0.62, 0.66))
print("built:", sorted(o.name for o in coll.objects))
if globals().get("REPO"):
    save_and_export(REPO, "conehead")
