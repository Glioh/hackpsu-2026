"""Builds Captain Bubbles (Limb-Possible) in its own Blender scene. Re-runnable: rebuilds from scratch.

Run from Blender's Python console / MCP:
    exec(open(p).read(), {"__name__": "__main__", "__file__": p})                    # build only
    exec(open(p).read(), {"__name__": "__main__", "__file__": p, "REPO": repo})      # build + save + export

A tiny goldfish in a captain's hat piloting an oversized humanoid diving suit: teal suit with brass trim, chest
pressure gauge, air tank, heavy brass-soled boots and big gloves (team coloured in game, CB_Gloves). The head is a
transparent round fishbowl. Inside it the water (ragdoll_part "water") and the fish (ragdoll_part "fish", tail
"fishtail") are separate parts the game animates (host/src/fishbowl.js): the water sloshes as he moves and the fish
swims laps, panicking when he falls or gets hit. Both pivot at the bowl centre: the water is a cut sphere, so
tilting it about its own centre keeps it inside the glass, and the fish sits off-centre so yawing its pivot swims
it in a circle.
"""
import os
from mathutils import Vector

SCENE, PFX, ROOT_NAME = "CaptainBubbles", "CB_", "CaptainBubbles"
MAT_SPEC = {
    "suit":    ("Suit", (34, 128, 142), 0.55),
    "suitdk":  ("SuitDark", (22, 90, 104), 0.6),
    "brass":   ("Brass", (214, 162, 64), 0.35, 0.45),
    "glass":   ("Glass", (226, 244, 255), 0.04),
    "water":   ("Water", (70, 168, 232), 0.08),
    "fish":    ("Goldfish", (255, 120, 22), 0.4),
    "belly":   ("FishBelly", (255, 200, 100), 0.45),
    "white":   ("White", (252, 252, 248), 0.4),
    "pupil":   ("Pupil", (16, 16, 22), 0.25),
    "cap":     ("CapBlack", (28, 30, 42), 0.5),
    "gloves":  ("Gloves", (240, 92, 60), 0.5),
    "needle":  ("Needle", (220, 40, 40), 0.4),
    "sole":    ("Sole", (58, 48, 40), 0.8),
}
KIT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "wobble_kit.py")
exec(compile(open(KIT, encoding="utf-8").read(), KIT, "exec"), globals())

for key, alpha in (("glass", 0.14), ("water", 0.32)):                          # see-through bowl and water
    m = MATS[key]; b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Alpha"].default_value = alpha
    for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
        try: setattr(m, attr, val)
        except Exception: pass

# ---------- skeleton pivots (world) ----------
TORSO = Vector((0, 0, 0.32)); NECK = Vector((0, 0, 0.86)); BOWL = Vector((0, 0, 1.2))
SH = {s: Vector((0.41 * s, 0, 0.74)) for s in (1, -1)}
WR = {s: wrist(SH[s], s) for s in (1, -1)}                                   # standard arm length
HIP = {s: Vector((0.17 * s, 0, 0.33)) for s in (1, -1)}
ANK = {s: Vector((0.18 * s, -0.01, 0.11)) for s in (1, -1)}

# ---------- torso: barrel diving suit, brass trim, gauge, belt, air tank ----------
TM = ["suit", "suitdk", "brass", "white", "needle", "pupil"]
bm = bmesh.new()
blob(bm, "box", (0.72, 0.52, 0.56), T((0, 0, 0.26)), 0, bulge=0.12, soft=0.3)
torso = make_obj("Torso", bm, TM, TORSO, root, "torso")
def suit(bm):
    L = lambda v: Vector(v) - TORSO
    def hit(x, z, side=-1): return surf(torso, (x, 1.5 * side, z), (0, -side, 0))
    blob(bm, "cyl", (0.66, 0.5, 0.08), T(L((0, 0, 0.36))), 1, cuts=2)                    # belt
    p, n = hit(0, 0.37)
    blob(bm, "box", (0.11, 0.05, 0.09), T(L(p + n * 0.02)) @ align(n), 2, cuts=2)        # buckle
    p, n = hit(0.0, 0.62)                                                                # pressure gauge
    blob(bm, "cyl", (0.2, 0.2, 0.05), T(L(p + n * 0.012)) @ along(n), 2, cuts=2)
    blob(bm, "cyl", (0.16, 0.16, 0.03), T(L(p + n * 0.032)) @ along(n), 3, cuts=2)
    blob(bm, "box", (0.012, 0.012, 0.07), T(L(p + n * 0.05)) @ align(n) @ Rot(-0.7, "Y") @ T((0, 0, 0.025)), 4, cuts=1)
    blob(bm, "sphere", (0.025, 0.02, 0.025), T(L(p + n * 0.05)), 5, cuts=1)
    for x in (-0.25, 0.25):                                                              # rivets
        for z in (0.5, 0.62, 0.74):
            p, n = hit(x, z)
            blob(bm, "sphere", (0.035, 0.02, 0.035), T(L(p + n * 0.006)) @ align(n), 2, cuts=1)
    p, n = hit(0, 0.6, 1)                                                                # air tank on the back
    blob(bm, "cyl", (0.2, 0.2, 0.42), T(L(p + n * 0.1)), 2, cuts=3, soft=0.2)
    for s in (1, -1):                                                                    # hoses tank -> collar
        tube(bm, [L(p + n * 0.1 + Vector((0.07 * s, 0, 0.2))), L((0.16 * s, 0.26, 0.92)), L((0.17 * s, 0.12, 0.88))], 0.022, 1)
append_to(torso, suit)

# ---------- head: brass collar + the transparent fishbowl ----------
bm = bmesh.new()
blob(bm, "cyl", (0.46, 0.46, 0.09), T((0, 0, 0.03)), 0, cuts=2)                         # collar ring
for a in range(8):                                                                       # collar bolts
    d = Vector((math.cos(a * math.pi / 4), math.sin(a * math.pi / 4), 0))
    blob(bm, "sphere", (0.04, 0.04, 0.04), T(d * 0.23 + Vector((0, 0, 0.03))), 0, cuts=1)
BR = 0.34                                                                                # bowl radius
blob(bm, "sphere", (2 * BR, 2 * BR, 2 * BR * 0.94), T(BOWL - NECK), 1, cuts=4)
lip = BOWL - NECK + Vector((0, 0, BR * 0.94 - 0.03))
tube(bm, [lip + Vector((0.13 * math.cos(t), 0.13 * math.sin(t), 0)) for t in [2 * math.pi * k / 24 for k in range(25)]], 0.018, 1, sides=8)
head = make_obj("Head", bm, ["brass", "glass"], NECK, torso, "head")

# ---------- water: cut sphere, flat surface on top, pivot at the bowl centre ----------
bm = bmesh.new()
blob(bm, "sphere", (2 * BR * 0.9, 2 * BR * 0.9, 2 * BR * 0.84), Rot(math.pi, "X"), 0, cuts=4, flat=0.3)
make_obj("Water", bm, ["water"], BOWL, head, "water")

# ---------- the captain: tiny goldfish in a captain's hat, swimming a lap around the bowl centre ----------
FISH = Vector((0.12, 0, -0.05))                                                          # off the pivot -> swims a circle
F = lambda v: T(FISH) @ Matrix.Scale(1.35, 4) @ T(Vector(v))                           # local to the fish body, facing +Y
bm = bmesh.new()
blob(bm, "sphere", (0.085, 0.15, 0.11), F((0, 0, 0)), 0, cuts=3)
blob(bm, "sphere", (0.07, 0.1, 0.05), F((0, 0.01, -0.03)), 1, cuts=2)                    # pale belly
for s in (1, -1):
    blob(bm, "sphere", (0.03, 0.042, 0.042), F((0.035 * s, 0.04, 0.018)), 2, cuts=2)     # big googly eyes
    blob(bm, "sphere", (0.012, 0.02, 0.02), F((0.05 * s, 0.05, 0.016)), 3, cuts=1)
    blob(bm, "sphere", (0.05, 0.04, 0.012), F((0.04 * s, 0.0, -0.035)) @ Rot(0.5 * s, "Y"), 0, cuts=1)  # side fins
blob(bm, "sphere", (0.012, 0.07, 0.05), F((0, -0.01, 0.06)), 0, cuts=1)                  # dorsal fin
blob(bm, "sphere", (0.03, 0.025, 0.02), F((0, 0.072, -0.012)), 3, cuts=1)                # little "o" mouth
blob(bm, "cyl", (0.06, 0.06, 0.035), F((0, 0.02, 0.07)), 4, cuts=1)                      # captain's hat
blob(bm, "cyl", (0.075, 0.075, 0.01), F((0, 0.03, 0.055)), 5, cuts=1)
blob(bm, "sphere", (0.015, 0.008, 0.015), F((0, 0.05, 0.072)), 6, cuts=1)
fish = make_obj("Fish", bm, ["fish", "belly", "white", "pupil", "white", "cap", "brass"], BOWL, head, "fish")
bm = bmesh.new()                                                                         # fan tail, wags in game
for r in (0.45, -0.45):
    blob(bm, "sphere", (0.016, 0.11, 0.07), T((0, -0.045, 0)) @ Rot(r, "X") @ T((0, -0.025, 0)), 0, cuts=1)
make_obj("FishTail", bm, ["fish"], BOWL + FISH + Vector((0, -0.065 * 1.35, 0)), fish, "fishtail")

# ---------- arms (standard length): chunky suit sleeves, brass cuffs, big gloves ----------
for s in (1, -1):
    d = (WR[s] - SH[s]).normalized(); Ln = (WR[s] - SH[s]).length
    bm = bmesh.new()
    blob(bm, "sphere", (0.24, 0.24, 0.24), T((0, 0, 0)), 1, cuts=2)                                  # shoulder joint
    blob(bm, "cyl", (0.19, 0.19, Ln + 0.06), T(d * Ln / 2) @ along(d), 0, bulge=0.15)
    blob(bm, "cyl", (0.21, 0.21, 0.07), T(d * (Ln - 0.03)) @ along(d), 2, cuts=2)                    # brass cuff
    arm = make_obj("Arm_" + SIDE[s], bm, ["suit", "suitdk", "brass"], SH[s], torso, "upper_arm")
    bm = bmesh.new(); inward = Vector((-s, 0, 0)); fwd = Vector((0, -1, 0))
    blob(bm, "sphere", (0.34, 0.32, 0.36), T(d * 0.2) @ along(d), 0, bulge=0.05)
    blob(bm, "sphere", (0.12, 0.12, 0.17), T(d * 0.16 + fwd * 0.14 + inward * 0.05) @ along(d), 0, cuts=2)
    make_obj("Hand_" + SIDE[s], bm, ["gloves"], WR[s], arm, "hand")

# ---------- legs + heavy brass-soled diving boots ----------
for s in (1, -1):
    bm = bmesh.new()
    blob(bm, "cyl", (0.2, 0.2, 0.25), T((0, 0, -0.1)), 0, bulge=0.1)
    leg = make_obj("Leg_" + SIDE[s], bm, ["suit"], HIP[s], torso, "leg")
    bm = bmesh.new(); Fb = lambda v: T(Vector(v) - ANK[s])
    blob(bm, "box", (0.23, 0.34, 0.15), Fb((0.18 * s, -0.05, 0.1)), 0, soft=0.1)
    blob(bm, "box", (0.26, 0.38, 0.06), Fb((0.18 * s, -0.05, 0.03)), 1, cuts=2)
    make_obj("Foot_" + SIDE[s], bm, ["suitdk", "brass"], ANK[s], leg, "foot")

bpy.context.view_layer.update()
check_arms()
present((0.5, 0.62, 0.68))
print("built:", sorted(o.name for o in coll.objects))
if globals().get("REPO"):
    save_and_export(REPO, "captain_bubbles")
