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

bpy.context.view_layer.update()
present((0.55, 0.58, 0.64))
print("built:", sorted(o.name for o in coll.objects))

def export_weapon(repo, holder_ob, slug):
    """Exports one weapon with its holder moved to the origin, then puts it back."""
    out = os.path.join(repo, "host", "assets", "weapons"); os.makedirs(out, exist_ok=True)
    keep = holder_ob.location.copy(); holder_ob.location = (0, 0, 0); bpy.context.view_layer.update()
    for o in sc.objects: o.select_set(o == holder_ob or o.parent == holder_ob)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, slug + ".glb"), export_format="GLB", use_selection=True,
                              use_active_scene=True, export_apply=True, export_extras=True, export_yup=True)
    holder_ob.location = keep; bpy.context.view_layer.update()

if globals().get("REPO"):
    os.makedirs(os.path.join(REPO, "art", "weapons"), exist_ok=True)
    bpy.data.libraries.write(os.path.join(REPO, "art", "weapons", "weapons.blend"), {sc}, compress=True)
    bpy.context.window.scene = sc
    for ob, slug in ((sg, "spring_glove"), (sw, "sword"), (gr, "grenade")):
        export_weapon(REPO, ob, slug)
    print("saved + exported weapons")
