"""Builds Wukong (Two-Body Brawl) in its own Blender scene. Re-runnable: rebuilds from scratch.

Run from Blender's Python console / MCP:
    exec(open(p).read(), {"__name__": "__main__", "__file__": p})                    # build only
    exec(open(p).read(), {"__name__": "__main__", "__file__": p, "REPO": repo})      # build + save + export

Sun Wukong from Journey to the West as a goofy chibi monkey warrior: oversized furry head with a heart-shaped face,
fluffy cheeks and huge eyebrows, tiny muscular body, red-and-gold vest, baggy pants, a team-coloured sash
(WK_Sash), a curly tail and a golden headband (WK_Crown, ragdoll_part "crown": the game slides it over his eyes when
he is knocked out). His Ruyi Jingu Bang staff (WK_Staff, ragdoll_part "staff") hangs off the right arm at the wrist,
not the hand, so his fist's hit sphere stays the standard size; the game swings it with momentum.
"""
import os
from mathutils import Vector

SCENE, PFX, ROOT_NAME = "Wukong", "WK_", "Wukong"
MAT_SPEC = {
    "fur":     ("Fur", (150, 92, 48), 0.85),
    "furlt":   ("FurLight", (196, 132, 74), 0.85),
    "face":    ("Face", (242, 196, 150), 0.6, 0.0, 0.08),
    "white":   ("EyeWhite", (255, 253, 246), 0.3),
    "pupil":   ("Pupil", (24, 16, 12), 0.25),
    "brow":    ("Brow", (92, 52, 26), 0.8),
    "mouth":   ("Mouth", (110, 40, 34), 0.6),
    "vest":    ("Vest", (204, 34, 34), 0.55),
    "gold":    ("Gold", (240, 186, 50), 0.3, 0.45),
    "pants":   ("Pants", (236, 176, 52), 0.75),
    "wrap":    ("Wrap", (40, 30, 30), 0.7),
    "boot":    ("Boot", (30, 28, 34), 0.6),
    "sash":    ("Sash", (60, 140, 220), 0.6),
    "staff":   ("StaffRed", (190, 24, 24), 0.4),
}
KIT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "wobble_kit.py")
exec(compile(open(KIT, encoding="utf-8").read(), KIT, "exec"), globals())

# ---------- skeleton pivots (world) ----------
TORSO = Vector((0, 0, 0.32)); NECK = Vector((0, 0, 0.74))
SH = {s: Vector((0.30 * s, 0, 0.66)) for s in (1, -1)}
WR = {s: wrist(SH[s], s) for s in (1, -1)}                                   # standard arm length
HIP = {s: Vector((0.13 * s, 0, 0.33)) for s in (1, -1)}
ANK = {s: Vector((0.17 * s, -0.01, 0.1)) for s in (1, -1)}

# ---------- torso: tiny muscular body, open red vest with gold trim, sash, tail ----------
TM = ["furlt", "vest", "gold", "sash", "fur"]
bm = bmesh.new()
blob(bm, "box", (0.5, 0.36, 0.46), T((0, 0, 0.22)), 0, bulge=0.15, soft=0.3)
torso = make_obj("Torso", bm, TM, TORSO, root, "torso")
def body(bm):
    L = lambda v: Vector(v) - TORSO
    def hit(x, z, side=-1): return surf(torso, (x, 1.5 * side, z), (0, -side, 0))
    for s in (1, -1):                                                         # pecs + abs on the bare chest
        p, n = hit(0.09 * s, 0.6)
        blob(bm, "sphere", (0.16, 0.05, 0.11), T(L(p)) @ align(n), 0, cuts=2)
    for z in (0.47, 0.41):
        for s in (1, -1):
            p, n = hit(0.045 * s, z)
            blob(bm, "sphere", (0.07, 0.03, 0.05), T(L(p)) @ align(n), 0, cuts=1)
    for s in (1, -1):                                                         # open vest panels
        for side in (-1, 1):
            p, n = hit(0.17 * s, 0.56, side)
            w = 0.16 if side < 0 else 0.4
            blob(bm, "box", (w, 0.04, 0.42), T(L(p + n * 0.012)) @ align(n), 1, cuts=2, soft=0.1)
        p, n = hit(0.095 * s, 0.56)                                           # gold trim on the opening
        blob(bm, "box", (0.03, 0.05, 0.42), T(L(p + n * 0.03)) @ align(n), 2, cuts=2)
    blob(bm, "cyl", (0.56, 0.42, 0.1), T(L((0, 0, 0.36))), 3, cuts=2)        # team sash
    p, n = hit(0.14, 0.34)
    blob(bm, "sphere", (0.1, 0.06, 0.12), T(L(p + n * 0.03)), 3, cuts=2)     # knot
    blob(bm, "box", (0.06, 0.03, 0.2), T(L(p + n * 0.03 + Vector((0.03, 0, -0.12)))) @ Rot(0.2, "Y"), 3, cuts=2)
    pts = [Vector((0, 0.2, 0.36)), Vector((0, 0.36, 0.3)), Vector((0.05, 0.5, 0.42)), Vector((0.02, 0.52, 0.62)),
           Vector((-0.08, 0.44, 0.7)), Vector((-0.1, 0.36, 0.6))]                  # curly tail
    tube(bm, [L(v) for v in pts], 0.035, 4, sides=8)
append_to(torso, body)

# ---------- head: oversized furry monkey head ----------
HM = ["fur", "face", "white", "pupil", "brow", "mouth", "furlt"]
bm = bmesh.new()
blob(bm, "sphere", (0.84, 0.74, 0.74), T((0, 0, 0.37)), 0, cuts=4)
head = make_obj("Head", bm, HM, NECK, torso, "head")
def face(bm):
    L = lambda v: Vector(v) - NECK
    def hit(x, z): return surf(head, (x, -1.5, z), (0, 1, 0))
    for s in (1, -1):                                                         # heart-shaped face: two eye lobes
        p, n = hit(0.12 * s, 1.1)
        blob(bm, "sphere", (0.26, 0.08, 0.26), T(L(p - n * 0.02)) @ align(n), 1, cuts=2)
    p, n = hit(0, 0.94)                                                       # muzzle
    MZ = p - n * 0.01
    blob(bm, "sphere", (0.36, 0.16, 0.24), T(L(MZ)) @ align(n), 1, cuts=2)
    for s in (1, -1):
        p, n = hit(0.115 * s, 1.1)                                            # big eyes
        blob(bm, "sphere", (0.14, 0.05, 0.16), T(L(p + n * 0.03)) @ align(n), 2, cuts=2)
        blob(bm, "sphere", (0.07, 0.03, 0.08), T(L(p + n * 0.055 + Vector((-0.012 * s, 0, -0.01)))) @ align(n), 3, cuts=1)
        brow = []                                                             # huge bushy eyebrows, arched up and out
        for k in range(7):
            u = k / 6; q, m = hit((0.04 + 0.21 * u) * s, 1.235 + 0.055 * math.sin(u * math.pi) - 0.025 * u)
            brow.append(L(q + m * 0.045))
        tube(bm, brow, 0.042, 4, sides=8)
        p, n = surf(head, (1.5 * s, -0.05, 1.0), (-s, 0, 0))                  # fluffy cheeks
        blob(bm, "sphere", (0.2, 0.26, 0.26), T(L(p + n * 0.02)), 6, cuts=2)
        for k, z in enumerate((0.9, 1.0, 1.1)):
            blob(bm, "sphere", (0.12, 0.1, 0.1), T(L(p + n * 0.08 + Vector((0, 0.03, z - 1.0)))) @ Rot(0.3 * s * (k - 1), "Y"), 6, cuts=1)
        p, n = surf(head, (1.5 * s, 0.05, 1.18), (-s, 0, 0))                  # round ears
        blob(bm, "sphere", (0.07, 0.15, 0.16), T(L(p + n * 0.03)), 0, cuts=2)
        blob(bm, "sphere", (0.04, 0.1, 0.11), T(L(p + n * 0.055 + Vector((0, -0.01, 0)))), 1, cuts=1)
    p, n = hit(0, 1.0)                                                        # nostrils
    for s in (1, -1):
        blob(bm, "sphere", (0.025, 0.02, 0.02), T(L(p + n * 0.012 + Vector((0.025 * s, 0, 0)))), 3, cuts=1)
    grin = []                                                                 # goofy wide grin across the muzzle
    for k in range(9):
        u = -1 + 2 * k / 8; x, dz = 0.12 * u, -0.045 - 0.03 * (1 - u * u)
        depth = 0.08 * math.sqrt(max(0.0, 1 - (x / 0.18) ** 2 - (dz / 0.12) ** 2))
        grin.append(L(MZ + Vector((x, -depth - 0.008, dz))))
    tube(bm, grin, 0.016, 5)
    for k in range(12):                                                       # tufty fur on top
        a = k / 12 * 2 * math.pi
        blob(bm, "sphere", (0.13, 0.13, 0.16), T(L(Vector((math.cos(a) * 0.2, math.sin(a) * 0.18 + 0.04, 1.36)))) @ Rot(0.3, "X"), 0, cuts=1)
append_to(head, face)

# ---------- golden headband (slides over his eyes when he goes down) ----------
CROWN = NECK + Vector((0, 0, 0.58))
bm = bmesh.new()
ring = [Vector((0.42 * math.cos(t), 0.375 * math.sin(t), -0.02 * math.cos(2 * t))) for t in [2 * math.pi * k / 32 for k in range(33)]]
tube(bm, ring, 0.03, 0, sides=8)
blob(bm, "sphere", (0.13, 0.06, 0.13), T((0, -0.385, 0.02)), 0, cuts=2)                   # front ornament
for s in (1, -1):                                                                        # curled ends
    blob(bm, "sphere", (0.07, 0.05, 0.07), T((0.07 * s, -0.37, 0.07)), 0, cuts=1)
make_obj("Crown", bm, ["gold"], CROWN, head, "crown")

# ---------- arms (standard length): furry, gold wrist cuffs; the staff rides the right arm ----------
for s in (1, -1):
    d = (WR[s] - SH[s]).normalized(); Ln = (WR[s] - SH[s]).length
    bm = bmesh.new()
    blob(bm, "cyl", (0.14, 0.14, Ln + 0.06), T(d * Ln / 2) @ along(d), 0, bulge=0.4)                   # little muscles
    blob(bm, "cyl", (0.16, 0.16, 0.06), T(d * (Ln - 0.02)) @ along(d), 1, cuts=2)                       # gold cuff
    arm = make_obj("Arm_" + SIDE[s], bm, ["fur", "gold"], SH[s], torso, "upper_arm")
    bm = bmesh.new(); inward = Vector((-s, 0, 0)); fwd = Vector((0, -1, 0))
    blob(bm, "sphere", (0.2, 0.19, 0.21), T(d * 0.11) @ along(d), 0)
    blob(bm, "sphere", (0.07, 0.08, 0.1), T(d * 0.09 + fwd * 0.08 + inward * 0.03) @ along(d), 0, cuts=2)
    make_obj("Hand_" + SIDE[s], bm, ["face"], WR[s], arm, "hand")
    if s == -1:                                                               # Ruyi Jingu Bang, gripped mid-shaft
        axis = Vector((0, -1, 0.3)).normalized(); grip = WR[s] + d * 0.1
        bm = bmesh.new()
        blob(bm, "cyl", (0.09, 0.09, 2.0), T(grip - WR[s]) @ along(axis), 0, cuts=3)
        for e in (1, -1):                                                     # gold end caps with rims
            blob(bm, "cyl", (0.13, 0.13, 0.24), T(grip - WR[s] + axis * 0.9 * e) @ along(axis), 1, cuts=2)
            for r in (0.76, 1.02):
                blob(bm, "cyl", (0.15, 0.15, 0.03), T(grip - WR[s] + axis * r * e) @ along(axis), 1, cuts=1)
        make_obj("Staff", bm, ["staff", "gold"], WR[s], arm, "staff")

# ---------- baggy pants + black boots with upturned toes ----------
for s in (1, -1):
    bm = bmesh.new()
    blob(bm, "cyl", (0.24, 0.24, 0.26), T((0, 0, -0.09)), 0, bulge=0.35)
    blob(bm, "cyl", (0.15, 0.15, 0.05), T((0, 0, -0.2)), 1, cuts=2)                         # ankle wrap
    leg = make_obj("Leg_" + SIDE[s], bm, ["pants", "wrap"], HIP[s], torso, "leg")
    bm = bmesh.new(); F = lambda v: T(Vector(v) - ANK[s])
    blob(bm, "box", (0.16, 0.26, 0.12), F((0.17 * s, -0.04, 0.07)), 0, soft=0.1)
    blob(bm, "sphere", (0.09, 0.1, 0.08), F((0.17 * s, -0.19, 0.1)) @ Rot(0.6, "X"), 0, cuts=2)  # curled toe
    make_obj("Foot_" + SIDE[s], bm, ["boot"], ANK[s], leg, "foot")

head.rotation_euler = (0.0, math.radians(-4), math.radians(5))                # cheeky head tilt
bpy.context.view_layer.update()
check_arms()
present((0.62, 0.55, 0.5))
print("built:", sorted(o.name for o in coll.objects))
if globals().get("REPO"):
    save_and_export(REPO, "wukong")
