"""Builds Crank (Wobble Boxing) in its own Blender scene. Re-runnable: rebuilds from scratch.

Run from Blender's Python console / MCP:
    exec(open(p).read(), {"__name__": "__main__", "__file__": p})                    # build only
    exec(open(p).read(), {"__name__": "__main__", "__file__": p, "REPO": repo})      # build + save + export

A nervous hermit-crab fighter: squat coral body, tiny legs, a big patched shell on his back,
one oversized pincer glove (the punching +X side) and one small sandy mitt.
"""
import os
from mathutils import Vector

SCENE, PFX, ROOT_NAME = "Crank", "CR_", "Crank"
MAT_SPEC = {
    "coral":   ("Coral", (255, 122, 86), 0.6),
    "claw":    ("ClawRed", (232, 80, 56), 0.5),
    "teal":    ("ShellTeal", (58, 150, 146), 0.55),
    "tealdk":  ("ShellTealDark", (36, 106, 108), 0.6),
    "sand":    ("Sand", (236, 210, 162), 0.75),
    "mustard": ("Mustard", (244, 184, 58), 0.5),
    "white":   ("EyeWhite", (255, 255, 255), 0.3),
    "pupil":   ("Pupil", (36, 30, 44), 0.35),
    "sweat":   ("Sweat", (170, 222, 246), 0.15),
    "blush":   ("Blush", (255, 150, 150), 0.8),
}
KIT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "wobble_kit.py")
exec(compile(open(KIT, encoding="utf-8").read(), KIT, "exec"), globals())

# ---------- skeleton pivots (world) ----------
TORSO = Vector((0, 0, 0.30)); NECK = Vector((0, -0.06, 0.82)); SHELL = Vector((0, 0.22, 0.62))
SH = {s: Vector((0.37 * s, -0.02, 0.70)) for s in (1, -1)}
WR = {s: wrist(SH[s], s) for s in (1, -1)}                                   # standard arm length
HIP = {s: Vector((0.15 * s, -0.02, 0.32)) for s in (1, -1)}
ANK = {s: Vector((0.16 * s, -0.03, 0.09)) for s in (1, -1)}

# ---------- torso: squat coral body with a sandy belly ----------
TM = ["coral", "sand", "mustard"]
bm = bmesh.new()
blob(bm, "cyl", (0.72, 0.60, 0.56), T((0, -0.02, 0.28)), 0, bulge=0.08, soft=0.35)
torso = make_obj("Torso", bm, TM, TORSO, root, "torso")
def belly(bm):
    p, n = surf(torso, (0, -1.5, 0.55), (0, 1, 0))
    blob(bm, "sphere", (0.40, 0.06, 0.30), T(p - n * 0.012 - TORSO) @ align(n), 1)
append_to(torso, belly)

# ---------- head: eye stalks, mismatched eyes, worried brows, wobbly mouth, sweat drop ----------
HM = ["coral", "white", "pupil", "sweat", "blush"]
bm = bmesh.new()
blob(bm, "sphere", (0.50, 0.44, 0.36), T((0, -0.02, 0.16)), 0, flat=0.7)
head = make_obj("Head", bm, HM, NECK, torso, "head")
GLANCE = Vector((0.3, -1, 0.05)).normalized()                                  # nervous side-eye
def face(bm):
    L = lambda v: Vector(v) - NECK
    for s, tip, r in ((1, (0.17, -0.15, 1.36), 0.105), (-1, (-0.14, -0.14, 1.29), 0.09)):
        base, tip = Vector((0.10 * s, -0.10, 1.08)), Vector(tip)
        mid = base.lerp(tip, 0.5) + Vector((0.02 * s, -0.02, 0))
        tube(bm, [L(base), L(mid), L(tip)], 0.038, 0, sides=8)                 # stalk
        c = tip + Vector((0, 0, r * 0.7))
        blob(bm, "sphere", (2 * r, 2 * r, 2 * r * 1.05), T(L(c)), 1, cuts=3)   # eyeball
        pp = c + GLANCE * (r - 0.012)
        blob(bm, "sphere", (r * 0.95, 0.05, r * 1.05), T(L(pp)) @ align(GLANCE), 2, cuts=2)
        blob(bm, "sphere", (0.03, 0.02, 0.03), T(L(pp + GLANCE * 0.02 + Vector((0.015, 0, 0.025)))) @ align(GLANCE), 1, cuts=1)
        bc = c + Vector((0, -0.05, r + 0.035))                                  # worried brow: inner end up
        blob(bm, "box", (0.12, 0.035, 0.03), T(L(bc)) @ Rot(0.42 * s, "Y"), 2, cuts=2)
    pts = []                                                                   # wobbly nervous mouth
    for k in range(9):
        u = -1 + 2 * k / 8
        p, n = surf(head, (0.075 * u, -1.5, 0.925 + 0.01 * math.sin(u * 3 * math.pi)), (0, 1, 0))
        pts.append(L(p + n * 0.003))
    tube(bm, pts, 0.011, 2)
    for s in (1, -1):
        p, n = surf(head, (0.17 * s, -1.5, 0.95), (0, 1, 0))
        blob(bm, "sphere", (0.07, 0.02, 0.045), T(L(p - n * 0.004)) @ align(n), 4, cuts=2)
    p, n = surf(head, (1.5, -0.12, 1.02), (-1, 0, 0))                          # sweat drop
    blob(bm, "sphere", (0.055, 0.045, 0.09), T(L(p + n * 0.03)) @ Rot(-0.3, "Y"), 3, cuts=2, taper=-0.65)
append_to(head, face)

# ---------- shell: big cobbled-together dome, patched plates, spiral top, chimney, straps ----------
SM = ["teal", "tealdk", "sand", "mustard"]
bm = bmesh.new()
DOME_C = Vector((0.04, 0.42, 0.95))
blob(bm, "sphere", (1.0, 0.72, 1.06), T(DOME_C - SHELL), 0, cuts=4)
shell = make_obj("Shell", bm, SM, SHELL, torso, "shell")
def patches(bm):
    L = lambda v: Vector(v) - SHELL
    def on_dome(d):
        d = Vector(d).normalized()
        return surf(shell, DOME_C + d * 2.0, -d)
    for d, dims, mat in (((0.35, 1, 0.25), (0.42, 0.42, 0.07), 2), ((-0.55, 0.8, -0.15), (0.36, 0.36, 0.07), 1),
                         ((0.8, 0.45, -0.35), (0.24, 0.24, 0.06), 3), ((-0.85, 0.2, 0.25), (0.28, 0.28, 0.06), 1)):
        p, n = on_dome(d)
        blob(bm, "cyl", dims, T(L(p + n * 0.01)) @ along(n), mat, cuts=2)
    p, n = on_dome((-0.2, 0.85, 0.75))                                         # bolted square patch
    M = T(L(p + n * 0.012)) @ along(n)
    blob(bm, "box", (0.28, 0.24, 0.06), M, 2, cuts=2)
    for x, y in ((-0.1, -0.08), (0.1, -0.08), (-0.1, 0.08), (0.1, 0.08)):
        blob(bm, "sphere", (0.04, 0.04, 0.04), M @ T((x, y, 0.035)), 3, cuts=1)
    top = DOME_C + Vector((0.10, 0.05, 0.50))                                   # off-centre spiral
    for i, (dx, dz, w, h) in enumerate(((0, 0, 0.36, 0.20), (0.06, 0.12, 0.26, 0.16), (0.11, 0.22, 0.17, 0.13), (0.14, 0.30, 0.09, 0.09))):
        blob(bm, "sphere", (w, w * 0.9, h), T(L(top + Vector((dx, 0.02 * i, dz)))), 2 if i % 2 else 0, cuts=2)
    p, n = on_dome((-0.75, 0.35, 0.55))                                        # little chimney vent
    blob(bm, "cyl", (0.09, 0.09, 0.24), T(L(p + n * 0.08)) @ along(n), 3, cuts=2)
    blob(bm, "cyl", (0.13, 0.13, 0.04), T(L(p + n * 0.2)) @ along(n), 1, cuts=2)
append_to(shell, patches)

def straps(bm):                                                                # backpack straps hold the shell on
    L = lambda v: Vector(v) - TORSO
    for s in (1, -1):
        pts = [Vector((0.24 * s, 0.30, 0.90)), Vector((0.25 * s, 0.08, 0.90))]
        for z in (0.82, 0.70, 0.58, 0.47):
            q, m = surf(torso, (0.24 * s, -1.5, z), (0, 1, 0)); pts.append(q + m * 0.022)
        tube(bm, [L(v) for v in pts], 0.03, 2, sides=6)
        q, m = surf(torso, (0.24 * s, -1.5, 0.66), (0, 1, 0))
        blob(bm, "box", (0.09, 0.03, 0.08), T(L(q + m * 0.045)) @ align(m), 1, cuts=1)  # buckle
append_to(torso, straps)

# ---------- arms (standard length): oversized pincer glove + small sandy mitt ----------
for s in (1, -1):
    d = (WR[s] - SH[s]).normalized(); Ln = (WR[s] - SH[s]).length
    bm = bmesh.new()
    blob(bm, "cyl", (0.14 if s == 1 else 0.12,) * 2 + (Ln + 0.08,), T(d * Ln / 2) @ along(d), 0)
    arm = make_obj("Arm_" + SIDE[s], bm, ["coral"], SH[s], torso, "upper_arm")
    bm = bmesh.new()
    if s == 1:
        palm = d * 0.15
        blob(bm, "sphere", (0.37, 0.34, 0.35), T(palm) @ along(d), 0)
        up, lo = Vector((0.08, -1, 0.35)).normalized(), Vector((0.04, -1, -0.45)).normalized()
        blob(bm, "sphere", (0.22, 0.20, 0.42), T(palm + up * 0.24 + Vector((0, 0, 0.04))) @ along(up), 0, taper=-0.35)
        blob(bm, "sphere", (0.17, 0.16, 0.28), T(palm + lo * 0.19 - Vector((0, 0, 0.06))) @ along(lo), 0, taper=-0.3)
        blob(bm, "cyl", (0.30, 0.30, 0.06), T(d * 0.07) @ along(d), 1, cuts=2)  # taped-on band
        blob(bm, "cyl", (0.18, 0.18, 0.08), T(d * -0.01) @ along(d), 2, cuts=2)
        hm = ["claw", "sand", "teal"]
    else:
        blob(bm, "sphere", (0.16, 0.15, 0.18), T(d * 0.09) @ along(d), 0)
        blob(bm, "sphere", (0.06, 0.06, 0.08), T(d * 0.07 + Vector((0, -0.07, 0)) + Vector((0.03, 0, 0))) @ along(d), 0, cuts=2)
        blob(bm, "cyl", (0.14, 0.14, 0.06), T(d * -0.005) @ along(d), 1, cuts=2)
        hm = ["sand", "teal"]
    make_obj("Hand_" + SIDE[s], bm, hm, WR[s], arm, "hand")

# ---------- tiny legs ----------
for s in (1, -1):
    bm = bmesh.new()
    blob(bm, "cyl", (0.145, 0.145, 0.24), T((0, 0, -0.11)), 0, bulge=0.12)
    leg = make_obj("Leg_" + SIDE[s], bm, ["coral"], HIP[s], torso, "leg")
    bm = bmesh.new()
    blob(bm, "sphere", (0.15, 0.21, 0.13), T(Vector((0.165 * s, -0.07, 0.04)) - ANK[s]), 0, flat=0.6)
    make_obj("Foot_" + SIDE[s], bm, ["claw"], ANK[s], leg, "foot").rotation_euler.z = -0.3 * s  # pigeon-toed

# ---------- attitude: nervous head tilt, shell slumped back and to one side ----------
head.rotation_euler = (0.0, math.radians(7), 0.0)
shell.rotation_euler = (math.radians(-7), math.radians(-6), 0.0)

bpy.context.view_layer.update()
check_arms()
present((0.50, 0.60, 0.62))
print("built:", sorted(o.name for o in coll.objects))
if globals().get("REPO"):
    save_and_export(REPO, "crank")
