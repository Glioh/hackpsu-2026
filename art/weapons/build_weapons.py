"""Builds the weapon pickups (Two-Body Brawl) in their own Blender scene. Re-runnable: rebuilds from scratch.

Run from Blender's Python console / MCP:
    exec(open(p).read(), {"__name__": "__main__", "__file__": p})                    # build only
    exec(open(p).read(), {"__name__": "__main__", "__file__": p, "REPO": repo})      # build + save + export

Three props in the fighters' chunky toy style (same wobble kit, same metres; the game draws them at fighter scale),
one GLB each in host/assets/weapons/, origin where the fighter's hand holds it:
- spring_glove: hazard-striped launcher with a coiled spring and a red boxing glove. The spring (WP_Spring, along
  +Z in glTF = forward) and the glove (WP_Glove) are separate so the game can shoot the glove out on the spring.
- sword: chunky cartoon broadsword, blade along +Y (up), grip at the origin.
- grenade: green pineapple grenade with lever and pin ring, centred on the origin.
- squeaky_hammer: giant red-and-yellow toy mallet, handle along +Y (up), grip at the origin, head across X.
- frying_pan: cast-iron pan, handle along +Y (up), grip at the origin, pan face pointing sideways (+-X) so the
  flat of the pan leads the swing.
- rubber_chicken: held by the feet at the origin, body up +Y. The neck (WP_ChickenNeck) and head (WP_ChickenHead,
  child of the neck) are separate nodes pivoting at their bases so the game can whip the neck about when swung.
"""
import os
from mathutils import Vector

SCENE, PFX, ROOT_NAME = "Weapons", "WP_", "Weapons"
MAT_SPEC = {
    "hazard":  ("Hazard", (255, 204, 40), 0.5),
    "black":   ("Black", (30, 30, 36), 0.6),
    "steel":   ("Steel", (196, 204, 214), 0.3, 0.45),
    "glove":   ("GloveRed", (226, 46, 46), 0.45),
    "lace":    ("Lace", (250, 248, 240), 0.6),
    "blade":   ("Blade", (226, 234, 242), 0.2, 0.45),
    "fuller":  ("Fuller", (150, 164, 182), 0.3, 0.45),
    "gold":    ("Gold", (238, 182, 52), 0.3, 0.45),
    "leather": ("Leather", (122, 52, 36), 0.7),
    "gem":     ("Gem", (60, 140, 255), 0.15, 0.0, 0.0, 0.6),
    "green":   ("GrenadeGreen", (92, 132, 52), 0.55),
    "greendk": ("GrenadeDark", (58, 88, 34), 0.6),
    "grey":    ("Grey", (130, 136, 142), 0.4, 0.3),
    "rubber":  ("RubberRed", (236, 54, 74), 0.35),
    "toyyel":  ("ToyYellow", (255, 214, 60), 0.4),
    "toyblue": ("ToyBlue", (60, 130, 240), 0.4),
    "iron":    ("CastIron", (44, 44, 50), 0.45, 0.6),
    "ironin":  ("PanInside", (74, 76, 84), 0.35, 0.7),
    "wood":    ("Wood", (150, 98, 54), 0.7),
    "chick":   ("ChickenYellow", (250, 226, 120), 0.5, 0.0, 0.1),
    "beak":    ("Beak", (255, 140, 30), 0.5),
    "comb":    ("Comb", (226, 40, 46), 0.5),
    "eye":     ("Eye", (20, 20, 24), 0.2),
}
KIT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "characters", "wobble_kit.py")
exec(compile(open(KIT, encoding="utf-8").read(), KIT, "exec"), globals())

def holder(name, x):
    """Empty each weapon hangs off, spread out along X for presentation (moved to the origin to export)."""
    e = bpy.data.objects.new(PFX + name, None); e.empty_display_size = 0.15
    coll.objects.link(e); e.parent = root; e.location = (x, 0, 0); PIV[e.name] = Vector((x, 0, 0))
    return e
FWD = Rot(math.pi / 2, "X")                                                  # local +Z -> -Y (forward)

# ---------- spring glove: launcher + spring + glove ----------
OX = -0.9; L0 = 0.26                                                         # spring rest length
sg = holder("SpringGlove", OX)
bm = bmesh.new()
blob(bm, "cyl", (0.09, 0.09, 0.16), T((0, 0.02, -0.06)), 1, cuts=2)                       # grip
blob(bm, "box", (0.18, 0.24, 0.16), T((0, -0.1, 0.05)), 0, soft=0.1, cuts=3)              # hazard housing
for k in range(4):                                                                        # black stripes
    for s in (1, -1):
        blob(bm, "box", (0.012, 0.028, 0.15), T((0.09 * s, -0.19 + k * 0.058, 0.05)) @ Rot(0.6, "X"), 1, cuts=1)
blob(bm, "cyl", (0.14, 0.14, 0.04), T((0, -0.225, 0.05)) @ FWD, 2, cuts=2)                 # muzzle ring
blob(bm, "box", (0.03, 0.06, 0.05), T((0, -0.06, -0.01)), 2, cuts=1)                      # trigger
make_obj("SpringBase", bm, ["hazard", "black", "steel"], Vector((OX, 0, 0)), sg, "spring_base")
MZ = Vector((OX, -0.245, 0.05))                                                           # spring starts here
bm = bmesh.new()
helix(bm, FWD, 0.045, L0, 6, 0.011, 0)
make_obj("Spring", bm, ["steel"], MZ, sg, "spring", subsurf=0)
bm = bmesh.new()
blob(bm, "sphere", (0.2, 0.22, 0.2), T((0, -0.13, 0)), 0, bulge=0.05)                      # glove
blob(bm, "sphere", (0.07, 0.09, 0.11), T((0.085, -0.1, -0.02)), 0, cuts=2)                 # thumb
blob(bm, "cyl", (0.13, 0.13, 0.05), T((0, -0.02, 0)) @ FWD, 1, cuts=2)                     # white cuff
for z in (-0.03, 0.0, 0.03):
    blob(bm, "box", (0.07, 0.012, 0.01), T((0, -0.03, 0.065 + z * 0.3)) @ Rot(0, "X") @ T((0, 0, z)), 1, cuts=1)
make_obj("Glove", bm, ["glove", "lace"], MZ + Vector((0, -L0, 0)), sg, "glove")

# ---------- sword: grip at the origin, blade straight up ----------
sw = holder("Sword", 0.0)
bm = bmesh.new()
blob(bm, "cyl", (0.06, 0.06, 0.18), T((0, 0, 0)), 3, cuts=2)                              # leather grip
for z in (-0.06, -0.02, 0.02, 0.06):
    blob(bm, "cyl", (0.066, 0.066, 0.012), T((0, 0, z)), 3, cuts=1)                        # wrap ridges
blob(bm, "sphere", (0.09, 0.09, 0.09), T((0, 0, -0.12)), 2, cuts=2)                        # pommel
blob(bm, "sphere", (0.04, 0.03, 0.04), T((0, -0.042, -0.12)), 4, cuts=1)                   # gem
blob(bm, "box", (0.34, 0.07, 0.06), T((0, 0, 0.11)), 2, cuts=2, bulge=0.3)                # crossguard
for s in (1, -1):
    blob(bm, "sphere", (0.07, 0.07, 0.07), T((0.17 * s, 0, 0.11)), 2, cuts=1)
blob(bm, "box", (0.13, 0.03, 0.74), T((0, 0, 0.51)), 0, cuts=3, taper=-0.12)              # blade
blob(bm, "box", (0.03, 0.034, 0.6), T((0, 0, 0.47)), 1, cuts=2, taper=-0.2)               # fuller
blob(bm, "sphere", (0.12, 0.03, 0.18), T((0, 0, 0.9)), 0, cuts=2, taper=-0.6)              # point
make_obj("SwordBody", bm, ["blade", "fuller", "gold", "leather", "gem"], Vector((0, 0, 0)), sw, "sword")

# ---------- grenade: pineapple body, cap, lever, pin ring ----------
GX = 0.9
gr = holder("Grenade", GX)
bm = bmesh.new()
blob(bm, "sphere", (0.2, 0.2, 0.24), T((0, 0, 0)), 0, cuts=3)
for k in range(5):                                                                        # pineapple segments
    z = -0.08 + k * 0.04; rr = 0.1 * math.sqrt(max(0.05, 1 - (z / 0.12) ** 2))
    for a in range(10):
        t = 2 * math.pi * (a + 0.5 * (k % 2)) / 10; d = Vector((math.cos(t), math.sin(t), 0))
        blob(bm, "box", (0.045, 0.02, 0.032), T(d * rr + Vector((0, 0, z))) @ along(d) @ Rot(math.pi / 2, "X"), 1, cuts=1, soft=0.2)
blob(bm, "cyl", (0.09, 0.09, 0.06), T((0, 0, 0.13)), 2, cuts=2)                            # fuse cap
blob(bm, "cyl", (0.05, 0.05, 0.04), T((0, 0, 0.17)), 2, cuts=1)
tube(bm, [Vector((0, -0.03, 0.17)), Vector((0, -0.08, 0.15)), Vector((0, -0.11, 0.08)), Vector((0, -0.11, 0.0))], 0.014, 2)  # lever
tube(bm, [Vector((0.03 + 0.035 * (1 + math.cos(t)), 0.0, 0.17 + 0.035 * math.sin(t))) for t in [2 * math.pi * k / 16 for k in range(17)]], 0.008, 2)  # pin ring
make_obj("GrenadeBody", bm, ["green", "greendk", "grey"], Vector((GX, 0, 0)), gr, "grenade")

# ---------- squeaky hammer: giant toy mallet, grip at the origin, handle up ----------
HX = 1.9
hm = holder("SqueakyHammer", HX)
bm = bmesh.new()
blob(bm, "cyl", (0.09, 0.09, 1.0), T((0, 0, 0.4)), 1, cuts=3)                               # yellow handle
for z in (-0.06, 0.06):
    blob(bm, "cyl", (0.11, 0.11, 0.05), T((0, 0, z)), 2, cuts=1)                            # blue grip bands
blob(bm, "sphere", (0.13, 0.13, 0.1), T((0, 0, -0.12)), 2, cuts=2)                          # end knob
blob(bm, "cyl", (0.42, 0.42, 0.56), T((0, 0, 0.98)) @ Rot(math.pi / 2, "Y"), 0, cuts=3, bulge=0.12)  # red head
for s in (1, -1):
    blob(bm, "cyl", (0.44, 0.44, 0.07), T((0.29 * s, 0, 0.98)) @ Rot(math.pi / 2, "Y"), 1, cuts=2)    # yellow faces
    blob(bm, "cyl", (0.2, 0.2, 0.03), T((0.33 * s, 0, 0.98)) @ Rot(math.pi / 2, "Y"), 2, cuts=1)      # squeaker caps
make_obj("HammerBody", bm, ["rubber", "toyyel", "toyblue"], Vector((HX, 0, 0)), hm, "squeaky_hammer")

# ---------- frying pan: grip at the origin, handle up, flat face sideways ----------
PX = -1.8
fp = holder("FryingPan", PX)
bm = bmesh.new()
blob(bm, "cyl", (0.06, 0.07, 0.3), T((0, 0, 0.02)), 2, cuts=2, taper=-0.15)                # wooden handle
blob(bm, "cyl", (0.035, 0.035, 0.16), T((0, 0, 0.22)), 0, cuts=1)                           # iron neck
blob(bm, "cyl", (0.44, 0.44, 0.07), T((0, 0, 0.52)) @ Rot(math.pi / 2, "Y"), 0, cuts=3, soft=0.2)   # pan body
for s in (1, -1):
    blob(bm, "cyl", (0.37, 0.37, 0.012), T((0.034 * s, 0, 0.52)) @ Rot(math.pi / 2, "Y"), 1, cuts=2)  # cooking faces
make_obj("PanBody", bm, ["iron", "ironin", "wood"], Vector((PX, 0, 0)), fp, "frying_pan")

# ---------- rubber chicken: feet at the origin, floppy neck + head on their own pivots ----------
CX = 2.8
ch = holder("RubberChicken", CX)
bm = bmesh.new()
for s in (1, -1):
    blob(bm, "cyl", (0.03, 0.03, 0.14), T((0.04 * s, 0, 0.05)), 1, cuts=1)                  # legs
    for a in (-0.5, 0, 0.5):
        blob(bm, "box", (0.018, 0.08, 0.018), T((0.04 * s, 0, -0.03)) @ Rot(a, "Z") @ T((0, -0.03, 0)), 1, cuts=1)  # toes
blob(bm, "sphere", (0.24, 0.22, 0.38), T((0, 0, 0.32)), 0, cuts=3, taper=-0.18)             # plucked body
for s in (1, -1):
    blob(bm, "sphere", (0.05, 0.14, 0.2), T((0.12 * s, 0.01, 0.34)) @ Rot(0.25 * s, "Y"), 0, cuts=2)   # wings
make_obj("ChickenBody", bm, ["chick", "beak"], Vector((CX, 0, 0)), ch, "rubber_chicken")
NECK = Vector((CX, 0, 0.48))
bm = bmesh.new()
blob(bm, "cyl", (0.075, 0.075, 0.26), T((0, 0, 0.12)), 0, cuts=3, taper=-0.2)               # long rubber neck
neck = make_obj("ChickenNeck", bm, ["chick"], NECK, ch, "chicken_neck")
HEAD = NECK + Vector((0, 0, 0.24))
bm = bmesh.new()
blob(bm, "sphere", (0.12, 0.13, 0.13), T((0, 0, 0.05)), 0, cuts=2)                           # head
blob(bm, "sphere", (0.05, 0.12, 0.05), T((0, -0.1, 0.04)) @ Rot(0.1, "X"), 1, cuts=1, taper=-0.6)   # beak (forward)
for k in range(3):
    blob(bm, "sphere", (0.025, 0.055, 0.06), T((0, -0.03 + k * 0.035, 0.12 + 0.012 * (k % 2))), 2, cuts=1)  # comb
blob(bm, "sphere", (0.03, 0.03, 0.05), T((0, -0.07, -0.02)), 2, cuts=1)                       # wattle
for s in (1, -1):
    blob(bm, "sphere", (0.028, 0.028, 0.034), T((0.052 * s, -0.05, 0.08)), 3, cuts=1)        # dot eyes
make_obj("ChickenHead", bm, ["chick", "beak", "comb", "eye"], HEAD, neck, "chicken_head")

bpy.context.view_layer.update()
present((0.55, 0.58, 0.64))
print("built:", sorted(o.name for o in coll.objects))

def export_weapon(repo, holder_ob, slug):
    """Exports one weapon with its holder moved to the origin, then puts it back."""
    out = os.path.join(repo, "host", "assets", "weapons"); os.makedirs(out, exist_ok=True)
    keep = holder_ob.location.copy(); holder_ob.location = (0, 0, 0); bpy.context.view_layer.update()
    for o in sc.objects: o.select_set(o == holder_ob or o in holder_ob.children_recursive)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, slug + ".glb"), export_format="GLB", use_selection=True,
                              use_active_scene=True, export_apply=True, export_extras=True, export_yup=True)
    holder_ob.location = keep; bpy.context.view_layer.update()

if globals().get("REPO"):
    os.makedirs(os.path.join(REPO, "art", "weapons"), exist_ok=True)
    bpy.data.libraries.write(os.path.join(REPO, "art", "weapons", "weapons.blend"), {sc}, compress=True)
    bpy.context.window.scene = sc
    for ob, slug in ((sg, "spring_glove"), (sw, "sword"), (gr, "grenade"), (hm, "squeaky_hammer"), (fp, "frying_pan"),
                     (ch, "rubber_chicken")):
        export_weapon(REPO, ob, slug)
    print("saved + exported weapons")
