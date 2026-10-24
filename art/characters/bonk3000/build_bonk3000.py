"""Builds Bonk-3000 (Wobble Boxing) in its own Blender scene. Re-runnable: rebuilds from scratch.

Run from Blender's Python console / MCP:
    exec(open(p).read(), {"__name__": "__main__", "__file__": p})                    # build only
    exec(open(p).read(), {"__name__": "__main__", "__file__": p, "REPO": repo})      # build + save + export

A clumsy homemade robot: washing-machine chest with a wind-up key, an old-radio head on a
spring neck with a crooked glowing face, one dryer-hose boxing arm, one plunger support arm,
spring legs and chunky toe-capped boots.
"""
import os
from mathutils import Vector

SCENE, PFX, ROOT_NAME = "Bonk3000", "BK_", "Bonk3000"
MAT_SPEC = {
    "cream":  ("Cream", (240, 230, 206), 0.6),
    "gray":   ("WarmGray", (156, 148, 140), 0.55),
    "graydk": ("SteelDark", (92, 90, 98), 0.45, 0.4),
    "yellow": ("FadedYellow", (240, 204, 104), 0.55),
    "sky":    ("SkyBlue", (128, 196, 236), 0.45),
    "red":    ("Red", (226, 82, 70), 0.5),
    "screen": ("Screen", (38, 42, 54), 0.3),
    "glow":   ("Glow", (150, 230, 255), 0.4, 0.0, 0.0, 1.5),
}
KIT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "wobble_kit.py")
exec(compile(open(KIT, encoding="utf-8").read(), KIT, "exec"), globals())

# ---------- skeleton pivots (world) ----------
TORSO = Vector((0, 0, 0.36)); NECK = Vector((0, 0, 0.97))
SH = {s: Vector((0.40 * s, 0, 0.84)) for s in (1, -1)}
WR = {s: wrist(SH[s], s) for s in (1, -1)}                                   # standard arm length
HIP = {s: Vector((0.17 * s, 0, 0.38)) for s in (1, -1)}
ANK = {s: Vector((0.19 * s, -0.01, 0.13)) for s in (1, -1)}

# ---------- torso: washing-machine chest ----------
TM = ["cream", "gray", "graydk", "yellow", "sky", "red"]
bm = bmesh.new()
blob(bm, "box", (0.72, 0.56, 0.62), T((0, 0, 0.31)), 0, bulge=0.04)
torso = make_obj("Torso", bm, TM, TORSO, root, "torso")
def chest(bm):
    L = lambda v: Vector(v) - TORSO
    def front(x, z): return surf(torso, (x, -1.5, z), (0, 1, 0))
    p, n = front(0, 0.64)                                                      # porthole
    rim = [p + n * 0.012 + Vector((0.15 * math.cos(a), 0, 0.15 * math.sin(a))) for a in (2 * math.pi * k / 24 for k in range(25))]
    tube(bm, [L(v) for v in rim], 0.03, 2, sides=8)
    blob(bm, "sphere", (0.29, 0.05, 0.29), T(L(p - n * 0.004)) @ align(n), 4)
    blob(bm, "sphere", (0.08, 0.02, 0.03), T(L(p + n * 0.022 + Vector((-0.05, 0, 0.07)))) @ align(n) @ Rot(0.5, "Y"), 0, cuts=1)
    p, n = front(0.22, 0.86)                                                   # dial + buttons
    blob(bm, "cyl", (0.10, 0.10, 0.05), T(L(p + n * 0.02)) @ along(n), 3, cuts=2)
    blob(bm, "box", (0.014, 0.02, 0.04), T(L(p + n * 0.05 + Vector((0, 0, 0.022)))) @ align(n), 2, cuts=1)
    for x, mat in ((-0.22, 5), (-0.13, 4)):
        p, n = front(x, 0.86); blob(bm, "sphere", (0.055, 0.055, 0.055), T(L(p + n * 0.008)), mat, cuts=1)
    for z in (0.47, 0.43, 0.39):                                               # front vent
        p, n = front(0, z); blob(bm, "box", (0.26, 0.025, 0.018), T(L(p + n * 0.004)) @ align(n), 2, cuts=1)
    p, n = surf(torso, (1.5, 0, 0.70), (-1, 0, 0))                             # bolted side patch
    M = T(L(p + n * 0.012)) @ align(n)
    blob(bm, "box", (0.24, 0.03, 0.22), M, 3, cuts=2)
    for x, z in ((-0.09, -0.08), (0.09, -0.08), (-0.09, 0.08), (0.09, 0.08)):
        blob(bm, "sphere", (0.035, 0.035, 0.035), M @ T((x, -0.02, z)), 1, cuts=1)
    for z in (0.76, 0.70, 0.64):                                               # side vent
        p, n = surf(torso, (-1.5, 0, z), (1, 0, 0)); blob(bm, "box", (0.22, 0.025, 0.02), T(L(p + n * 0.004)) @ align(n), 2, cuts=1)
    seam = []                                                                  # lid seam
    for k in range(25):
        th = 2 * math.pi * k / 24
        q, m = surf(torso, (math.sin(th) * 1.5, -math.cos(th) * 1.5, 0.92), (-math.sin(th), math.cos(th), 0))
        seam.append(L(q + m * 0.004))
    tube(bm, seam, 0.009, 2, sides=5)
    p, n = surf(torso, (0, 1.5, 0.70), (0, -1, 0))                             # wind-up key
    blob(bm, "cyl", (0.05, 0.05, 0.20), T(L(p + n * 0.09)) @ along(n), 2, cuts=2)
    for dz in (0.085, -0.085):
        blob(bm, "sphere", (0.045, 0.15, 0.17), T(L(p + n * 0.21 + Vector((0, 0, dz)))), 3, cuts=2)
append_to(torso, chest)

# ---------- head: old radio on a spring neck, crooked glowing face ----------
HM = ["yellow", "graydk", "screen", "glow", "red"]
bm = bmesh.new()
helix(bm, T((0, 0, -0.01)), 0.07, 0.18, 4, 0.018, 1)                          # spring neck
blob(bm, "box", (0.55, 0.42, 0.40), T((0, -0.01, 0.35)), 0)
head = make_obj("Head", bm, HM, NECK, torso, "head")
def face(bm):
    L = lambda v: Vector(v) - NECK
    p, n = surf(head, (0, -1.5, 1.33), (0, 1, 0))
    blob(bm, "box", (0.41, 0.05, 0.27), T(L(p)) @ align(n), 2, cuts=2)        # screen
    q = p + n * 0.028
    blob(bm, "sphere", (0.11, 0.02, 0.11), T(L(q + Vector((0.095, 0, 0.04)))) @ align(n), 3, cuts=2)   # big round eye
    blob(bm, "box", (0.08, 0.02, 0.026), T(L(q + Vector((-0.095, 0, 0.055)))) @ align(n) @ Rot(0.18, "Y"), 3, cuts=1)  # squint
    smile = []
    for k in range(9):
        u = -1 + 2 * k / 8
        smile.append(L(q + Vector((0.065 * u + 0.005, 0, -0.075 + 0.022 * u * u + 0.01 * u))))
    tube(bm, smile, 0.012, 3)
    for x, z in ((-0.235, 1.48), (0.235, 1.48), (-0.235, 1.18), (0.235, 1.18)):  # bolts
        b, m = surf(head, (x, -1.5, z), (0, 1, 0)); blob(bm, "sphere", (0.04, 0.04, 0.04), T(L(b)), 1, cuts=1)
    b, m = surf(head, (0.09, -0.02, 2.0), (0, 0, -1))                          # bent antenna
    blob(bm, "cyl", (0.08, 0.08, 0.04), T(L(b)), 1, cuts=2)
    rod = [b, b + Vector((0.005, 0, 0.10)), b + Vector((0.03, 0, 0.19)), b + Vector((0.08, 0, 0.25))]
    tube(bm, [L(v) for v in rod], 0.014, 1)
    blob(bm, "sphere", (0.08, 0.08, 0.08), T(L(rod[-1])), 4, cuts=2)
    for s, dia, depth in ((1, 0.14, 0.07), (-1, 0.09, 0.05)):                  # mismatched ear bolts
        b, m = surf(head, (1.5 * s, -0.01, 1.32), (-s, 0, 0))
        blob(bm, "cyl", (dia, dia, depth), T(L(b + m * 0.02)) @ along(m), 1, cuts=2)
    b, m = surf(head, (-1.5, -0.01, 1.32), (1, 0, 0))
    blob(bm, "sphere", (0.04, 0.04, 0.04), T(L(b + m * 0.06)), 4, cuts=1)
append_to(head, face)

# ---------- arms (standard length): dryer-hose boxing arm + plunger support arm ----------
for s in (1, -1):
    d = (WR[s] - SH[s]).normalized(); Ln = (WR[s] - SH[s]).length
    bm = bmesh.new()
    if s == 1:
        blob(bm, "sphere", (0.18, 0.18, 0.18), Matrix(), 0)                    # toy ball joint
        blob(bm, "cyl", (0.11, 0.11, Ln), T(d * Ln / 2) @ along(d), 0)
        for k in range(5):
            blob(bm, "cyl", (0.17, 0.17, 0.045), T(d * Ln * (k + 0.5) / 5) @ along(d), 1, cuts=2)
        am = ["graydk", "sky"]
    else:
        blob(bm, "sphere", (0.13, 0.13, 0.13), Matrix(), 1)
        blob(bm, "cyl", (0.06, 0.06, Ln), T(d * Ln / 2) @ along(d), 0, cuts=2)
        am = ["graydk", "gray"]
    arm = make_obj("Arm_" + SIDE[s], bm, am, SH[s], torso, "upper_arm")
    bm = bmesh.new(); inward = Vector((-s, 0, 0)); fwd = Vector((0, -1, 0))
    if s == 1:   # oversized red boxing glove
        blob(bm, "sphere", (0.40, 0.38, 0.42), T(d * 0.23) @ along(d), 0, bulge=0.05)
        blob(bm, "sphere", (0.13, 0.14, 0.20), T(d * 0.18 + fwd * 0.17 + inward * 0.05) @ along(d), 0, cuts=2)
        blob(bm, "cyl", (0.26, 0.26, 0.11), T(d * 0.02) @ along(d), 1, cuts=2)
        blob(bm, "cyl", (0.27, 0.27, 0.03), T(d * 0.03) @ along(d), 2, cuts=2)
        hm = ["red", "cream", "yellow"]
    else:        # plunger
        blob(bm, "cyl", (0.05, 0.05, 0.14), T(d * 0.07) @ along(d), 0, cuts=2)
        blob(bm, "cyl", (0.20, 0.20, 0.08), T(d * 0.17) @ along(d), 1, cuts=2, taper=0.5)
        hm = ["graydk", "sky"]
    make_obj("Hand_" + SIDE[s], bm, hm, WR[s], arm, "hand")

# ---------- spring legs + chunky toe-capped boots ----------
for s in (1, -1):
    bm = bmesh.new()
    blob(bm, "sphere", (0.15, 0.15, 0.15), Matrix(), 1)                        # hip ball joint
    blob(bm, "cyl", (0.05, 0.05, 0.26), T((0, 0, -0.12)), 0, cuts=2)
    helix(bm, T((0, 0, -0.245)), 0.075, 0.22, 4, 0.019, 0)
    leg = make_obj("Leg_" + SIDE[s], bm, ["graydk", "gray"], HIP[s], torso, "leg")
    bm = bmesh.new(); F = lambda v: T(Vector(v) - ANK[s])
    blob(bm, "box", (0.25, 0.36, 0.15), F((0.19 * s, -0.05, 0.115)), 0)
    blob(bm, "box", (0.27, 0.38, 0.05), F((0.19 * s, -0.05, 0.03)), 2, cuts=2)
    blob(bm, "sphere", (0.25, 0.17, 0.15), F((0.19 * s, -0.19, 0.10)), 1, cuts=2)
    make_obj("Foot_" + SIDE[s], bm, ["gray", "yellow", "graydk"], ANK[s], leg, "foot")

# ---------- attitude: loose, crooked head ----------
head.rotation_euler = (0.0, math.radians(-8), math.radians(7))

bpy.context.view_layer.update()
check_arms()
present((0.58, 0.60, 0.66))
print("built:", sorted(o.name for o in coll.objects))
if globals().get("REPO"):
    save_and_export(REPO, "bonk3000")
