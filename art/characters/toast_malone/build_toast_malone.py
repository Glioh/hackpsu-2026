"""Builds Toast Malone (Two-Body Brawl) in its own Blender scene. Re-runnable: rebuilds from scratch.

Run from Blender's Python console / MCP:
    exec(open(p).read(), {"__name__": "__main__", "__file__": p})                    # build only
    exec(open(p).read(), {"__name__": "__main__", "__file__": p, "REPO": repo})      # build + save + export

A sentient slice of toast who takes boxing way too seriously: thick slice body with a golden crust and burnt
edges, an over-serious scowl, tiny bulging muscular arms with small boxing gloves (team coloured in game,
TM_Gloves) and a butter-pat hat. The butter is its own part tagged ragdoll_part="butter" so the game can
jiggle it; crumbs on heavy impacts are a game effect (impactFx: 'crumbs' in host/src/fighter-model.js).
There is no separate head: the face is on the slice.
"""
import os
from mathutils import Vector

SCENE, PFX, ROOT_NAME = "ToastMalone", "TM_", "ToastMalone"
MAT_SPEC = {
    "crust":  ("Crust", (178, 104, 46), 0.75),
    "toast":  ("Toast", (232, 186, 112), 0.85),
    "burnt":  ("Burnt", (104, 58, 30), 0.9),
    "scorch": ("Scorch", (200, 138, 72), 0.85),
    "butter": ("Butter", (255, 214, 92), 0.22),
    "gloves": ("Gloves", (220, 50, 50), 0.45),
    "white":  ("White", (250, 248, 240), 0.5),
    "pupil":  ("Pupil", (24, 18, 16), 0.3),
    "brow":   ("Brow", (60, 34, 20), 0.7),
    "tape":   ("Tape", (236, 226, 204), 0.8),
    "shoe":   ("Sneaker", (244, 242, 236), 0.6),
    "sole":   ("Sole", (60, 60, 70), 0.7),
}
KIT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "wobble_kit.py")
exec(compile(open(KIT, encoding="utf-8").read(), KIT, "exec"), globals())

# ---------- skeleton pivots (world) ----------
TORSO = Vector((0, 0, 0.32))
SH = {s: Vector((0.44 * s, 0, 0.80)) for s in (1, -1)}
WR = {s: wrist(SH[s], s) for s in (1, -1)}                                   # standard arm length
HIP = {s: Vector((0.18 * s, 0, 0.33)) for s in (1, -1)}
ANK = {s: Vector((0.19 * s, -0.01, 0.10)) for s in (1, -1)}
SLICE = lambda m: Rot(math.pi / 2, "X")                                      # 'cyl' axis Z -> slice thickness along Y

# ---------- torso: compact bread core + the visible slice attached to it ----------
# The game sizes body contact from the main torso mesh (host/src/combat-rig.js), assuming a roundish body. A slice is
# wide but thin, so TM_Torso is a compact core hidden inside the slice; the slice itself (TM_Slice) is attached
# decoration: it looks the same and stays fully hittable, but doesn't push opponents out of his tiny arms' reach.
TM = ["crust", "toast", "burnt", "scorch", "white", "pupil", "brow", "tape"]
bm = bmesh.new()
blob(bm, "box", (0.46, 0.28, 0.84), T((0, 0, 0.5)), 0)
torso = make_obj("Torso", bm, ["crust"], TORSO, root, "torso")
bm = bmesh.new()
blob(bm, "box", (0.84, 0.32, 0.74), T((0, 0, 0.37)), 0, soft=0.1)                      # lower slice
blob(bm, "cyl", (1.0, 0.64, 0.32), T((0, 0, 0.74)) @ Rot(math.pi / 2, "X"), 0)          # domed bread top
slice_ = make_obj("Slice", bm, TM, TORSO, torso, "torso_shell")
def faces(bm):
    L = lambda v: Vector(v) - TORSO
    for side in (-1, 1):                                                      # toasted inner faces, front + back
        y = 0.162 * side
        blob(bm, "box", (0.72, 0.03, 0.66), T(L((0, y, 0.67))), 1, soft=0.1, cuts=3)
        blob(bm, "cyl", (0.86, 0.52, 0.03), T(L((0, y, 1.06))) @ Rot(math.pi / 2, "X"), 1, cuts=3)
        for x, z, w in ((-0.3, 0.42, .14), (0.31, 0.5, .12), (-0.33, 0.95, .13), (0.28, 1.2, .12), (0.34, 0.85, .1), (-0.08, 1.27, .12), (0.08, 0.36, .1)):
            blob(bm, "sphere", (w * 1.8, 0.02, w * 1.1), T(L((x, y + 0.012 * side, z))), 3, cuts=2)   # soft toasting marks near the edge
    for a in (0.15, 0.6, 1.1, 1.6, 2.1, 2.55, 3.0, 3.6, 4.2, 5.0, 5.6):        # burnt patches on the crust rim
        d = Vector((math.cos(a), 0, math.sin(a)))
        p, n = surf(slice_, Vector((0, -0.05, 0.85)) + d * 2, -d)
        blob(bm, "sphere", (0.26, 0.34, 0.06), T(L(p + n * 0.006)) @ align(n) @ Rot(math.pi / 2, "X"), 2, cuts=2)
    def hit(x, z): return surf(slice_, (x, -1.5, z), (0, 1, 0))
    for s in (1, -1):                                                         # fierce little eyes
        p, n = hit(0.18 * s, 1.0)
        blob(bm, "sphere", (0.2, 0.04, 0.15), T(L(p)) @ align(n), 4, cuts=2)
        blob(bm, "sphere", (0.095, 0.03, 0.095), T(L(p + n * 0.016 + Vector((-0.02 * s, 0, -0.01)))) @ align(n), 5, cuts=2)
        p, n = hit(0.19 * s, 1.15)                                            # angry brows, inner ends down
        blob(bm, "box", (0.24, 0.06, 0.065), T(L(p + n * 0.01)) @ align(n) @ Rot(-0.45 * s, "Y"), 6, cuts=2)
    p, n = hit(0.0, 0.8)                                                      # gritted teeth
    M = T(L(p)) @ align(n)
    blob(bm, "box", (0.36, 0.03, 0.15), M, 5, cuts=2)
    blob(bm, "box", (0.31, 0.03, 0.1), M @ T((0, -0.012, 0)), 4, cuts=2)
    for x in (-0.078, 0.0, 0.078):
        blob(bm, "box", (0.012, 0.02, 0.1), M @ T((x, -0.03, 0)), 5, cuts=1)
    p, n = hit(-0.29, 0.84)                                                   # tape cross on the cheek
    for r in (0.6, -0.6):
        blob(bm, "box", (0.2, 0.02, 0.055), T(L(p + n * 0.012)) @ align(n) @ Rot(r, "Y"), 7, cuts=1)
append_to(slice_, faces)

# ---------- butter-pat hat (own part so the game can jiggle it) ----------
top, _ = surf(slice_, (0.04, -0.02, 3.0), (0, 0, -1))
bm = bmesh.new()
blob(bm, "box", (0.36, 0.26, 0.11), T((0, 0, 0.045)), 0, soft=0.25, cuts=3)
for x, l in ((-0.09, 0.13), (0.07, 0.09)):                                      # melting drips down the front
    blob(bm, "sphere", (0.06, 0.05, l), T((x, -0.13, 0.0 - l * 0.25)), 0, cuts=2, taper=-0.3)
butter = make_obj("Butter", bm, ["butter"], top - Vector((0, 0, 0.012)), torso, "butter")
butter.rotation_euler = (math.radians(-4), math.radians(-7), math.radians(12))

# ---------- tiny muscular arms (standard length) + small boxing gloves ----------
for s in (1, -1):
    d = (WR[s] - SH[s]).normalized(); Ln = (WR[s] - SH[s]).length
    bm = bmesh.new()
    blob(bm, "cyl", (0.11, 0.11, Ln + 0.06), T(d * Ln / 2) @ along(d), 0, bulge=0.9)           # bulging bicep
    blob(bm, "sphere", (0.12, 0.1, 0.11), T(d * Ln * 0.45 + Vector((0.03 * s, -0.04, 0.04))), 0, cuts=2)  # bicep peak
    arm = make_obj("Arm_" + SIDE[s], bm, ["crust"], SH[s], torso, "upper_arm")
    bm = bmesh.new(); inward = Vector((-s, 0, 0)); fwd = Vector((0, -1, 0))
    blob(bm, "sphere", (0.27, 0.25, 0.29), T(d * 0.16) @ along(d), 0, bulge=0.05)
    blob(bm, "sphere", (0.09, 0.1, 0.14), T(d * 0.13 + fwd * 0.11 + inward * 0.04) @ along(d), 0, cuts=2)
    blob(bm, "cyl", (0.17, 0.17, 0.07), T(d * 0.01) @ along(d), 1, cuts=2)
    make_obj("Hand_" + SIDE[s], bm, ["gloves", "white"], WR[s], arm, "hand")

# ---------- little legs + sneakers ----------
for s in (1, -1):
    bm = bmesh.new()
    blob(bm, "cyl", (0.1, 0.1, 0.25), T((0, 0, -0.11)), 0)
    leg = make_obj("Leg_" + SIDE[s], bm, ["crust"], HIP[s], torso, "leg")
    bm = bmesh.new(); F = lambda v: T(Vector(v) - ANK[s])
    blob(bm, "box", (0.17, 0.27, 0.11), F((0.19 * s, -0.04, 0.075)), 0)
    blob(bm, "box", (0.19, 0.29, 0.045), F((0.19 * s, -0.04, 0.025)), 1, cuts=2)
    make_obj("Foot_" + SIDE[s], bm, ["shoe", "sole"], ANK[s], leg, "foot")

bpy.context.view_layer.update()
check_arms()
present((0.62, 0.56, 0.5))
print("built:", sorted(o.name for o in coll.objects))
if globals().get("REPO"):
    save_and_export(REPO, "toast_malone")
