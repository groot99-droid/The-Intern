"""Builds a data/rooms.json set inside the Higgsfield 3D scene builder.

The scene builder runs Blender 5.2 headless (its `scene_builder_3d_run_python`
tool executes bpy code against a project). This script turns one room record
into that code, so every set the game plays live in three.js also exists as a
Blender scene in the same style -- the same shell, the same box props, the
same lights, the same camera shots as keyframed camera animation -- with the
company's props coming from the builder's open-source GLB catalog where
build_rooms.py placed one (`glb` props).

It never talks to the service itself (no key, no network): it prints what the
tools need, and the session that drives the MCP tools pastes it in.

    python tools/higgsfield_scene.py S1_C build     bpy code: shell, props, lights, camera + shots
    python tools/higgsfield_scene.py S1_C imports   JSON: one catalog import per distinct model
    python tools/higgsfield_scene.py S1_C place     bpy code: duplicates each imported model to its other placements
    python tools/higgsfield_scene.py S1_C proof     bpy code (query): renders the in/out stills + a Workbench
                                                    proof clip of leave/arrive to artifacts

Coordinates: the game is Y-up with +z toward the entrance; Blender is Z-up.
game (x, y, z) -> blender (x, -z, y). The glTF exporter maps Blender +Y to
glTF -Z, so a GLB exported from one of these projects lands back in game
coordinates unchanged.

Since the game became one continuous walk, a room record also carries what
only the running game reads (threshold zones, join anchors, the entry door,
connector metadata); `build` strips those from the JSON it embeds. A prop
type this port has no p_* builder for is skipped with a `# WARNING` comment
at the top of the output (and a `skipped` list in the run's result) rather
than failing. Doorways are NOT cut out of the walls yet, `floorY`, `pitch`
and `hidden` are not honoured, and the projects in blender/higgsfield/ are
stale: blender/higgsfield/REBUILD_NOTE.md says what to port and in what order.
"""

import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOMS = os.path.join(HERE, "..", "data", "rooms.json")

# Record keys only the running game reads (src/director.js, src/world/):
# never geometry, so never embedded in the bpy code.
RUNTIME_ONLY = ("_note", "zones", "anchors", "entry", "holdEntry", "swim", "connector", "drop")

# ---------------------------------------------------------------------------
# The bpy template. Everything between the markers runs inside Blender; the
# PROPS/MATERIALS port mirrors src/walk/props.js and materials.js.
# ---------------------------------------------------------------------------
TEMPLATE = r'''
import bpy, bmesh, math, json
from mathutils import Vector, Quaternion, Euler

ROOM = json.loads(ROOM_JSON)
FPS = 24

# ---- materials -------------------------------------------------------------
RECIPES = {
 "marble": ("#26241f", "#5a564c", 0.22, "veins"), "marble_light": ("#9a958a", "#dcd7cb", 0.28, "veins"),
 "plaster": ("#87847a", "#a9a599", 0.92, "plaster"), "plaster_blown": ("#d6d3ca", "#f1efe9", 0.95, "plaster"), "plaster_dark": ("#46433e", "#5e5a53", 0.92, "plaster"),
 "concrete": ("#5a5852", "#7b7872", 0.86, "concrete"), "concrete_wet": ("#36352f", "#585651", 0.3, "stains"), "garage_floor": ("#413f3a", "#615e58", 0.45, "parking"),
 "paint_green": ("#2f4a3c", "#3f5e4d", 0.6, "concrete"), "carpet": ("#3a3b42", "#4e4f58", 1.0, "weave"), "carpet_red": ("#471d1d", "#622c2c", 1.0, "weave"),
 "cinderblock": ("#6a6864", "#8a877f", 0.9, "blocks"), "linoleum": ("#b3ae9e", "#d4cfc1", 0.32, "tiles"), "ceiling_tile": ("#c4c1b8", "#e0ddd5", 0.95, "ceiling"),
 "pool_tile": ("#7d8f8e", "#b5c3c0", 0.18, "tiles"), "water": ("#06232b", "#0e4a56", 0.04, "water"), "cardboard": ("#8a6a44", "#a68355", 0.95, "cardboard"),
 "rust": ("#46291a", "#7c4c2b", 0.8, "stains"), "grate": ("#2a2927", "#57544f", 0.6, "grate"), "void": ("#050505", "#0a0a0a", 1.0, "none"),
 "asphalt": ("#2a2928", "#3f3e3c", 0.9, "concrete"), "glass": ("#9fb2b8", "#c8d6da", 0.05, "glass"), "glass_dark": ("#1a2224", "#25302f", 0.05, "glass"),
}
LOWPOLY = {
 "lp_red": "#7a2634", "lp_wood": "#8c6a3f", "lp_grey": "#8a8a86", "lp_dark": "#2b2b2b", "lp_black": "#101010", "lp_beige": "#b9ad93", "lp_paper": "#e8e2d0",
 "lp_skin": "#c9a887", "lp_suit": "#3a3a44", "lp_rust": "#6b3f26", "lp_car": "#5a3f2e", "lp_car2": "#3f4a52", "lp_car3": "#6a5a2a", "lp_car4": "#2e2e30",
 "lp_car5": "#5a2a26", "lp_car6": "#7a7566", "lp_blue": "#2e4a6b", "lp_curtain": "#6a1420", "lp_brass": "#a8863c", "lp_chrome": "#9a9a96", "lp_glass": "#8fb0b8",
 "lp_sign": "#1e7a3a", "lp_screen": "#0a0a0a", "lp_screen_off": "#0a0a0a", "lp_fluoro": "#e8e8e0", "lp_sodium": "#e0a040", "lp_taillight": "#6a1a10",
 "lp_headlight": "#d8d0b0", "lp_white": "#e6e6e0",
}
EMISSIVE = {"lp_sign": ("#22ff66", 6), "lp_screen": ("#7ad9a0", 4), "lp_screen_off": ("#111111", 0.3), "lp_fluoro": ("#f4f2e8", 8), "lp_sodium": ("#ffb04a", 9),
            "lp_taillight": ("#ff5a2a", 2), "lp_headlight": ("#fff4d0", 1)}
GLOWS = {"glow_sodium": "#ff9a3a", "glow_fluoro": "#e8f0ff", "glow_water": "#3ab8d0", "glow_green": "#33ff77"}

def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))
def srgb_to_linear(c):
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)

_mats = {}
def material(slot):
    if slot in _mats: return _mats[slot]
    m = bpy.data.materials.new(("LowPolyProp_" if slot in LOWPOLY else "Glow_" if slot in GLOWS else "PhotorealArch_") + slot)
    m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes.get("Principled BSDF"); out = nt.nodes.get("Material Output")
    if slot in LOWPOLY:
        bsdf.inputs["Base Color"].default_value = (*srgb_to_linear(hexrgb(LOWPOLY[slot])), 1)
        bsdf.inputs["Roughness"].default_value = 0.75
        if slot in EMISSIVE:
            col, strength = EMISSIVE[slot]
            bsdf.inputs["Emission Color"].default_value = (*srgb_to_linear(hexrgb(col)), 1)
            bsdf.inputs["Emission Strength"].default_value = strength
        if slot == "lp_glass":
            bsdf.inputs["Alpha"].default_value = 0.35; m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
        m["flat_shaded"] = True
    elif slot in GLOWS:
        bsdf.inputs["Base Color"].default_value = (0, 0, 0, 1)
        bsdf.inputs["Emission Color"].default_value = (*srgb_to_linear(hexrgb(GLOWS[slot])), 1)
        bsdf.inputs["Emission Strength"].default_value = 2.0
        bsdf.inputs["Alpha"].default_value = 0.3
        try: m.blend_method = 'BLEND'
        except Exception: pass
    else:
        a, b, rough, pattern = RECIPES.get(slot, RECIPES["plaster"])
        noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 3.0 if pattern != "concrete" else 1.4
        noise.inputs["Detail"].default_value = 6.0; noise.inputs["Roughness"].default_value = 0.6
        coord = nt.nodes.new("ShaderNodeTexCoord"); nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (*srgb_to_linear(hexrgb(a)), 1); ramp.color_ramp.elements[1].color = (*srgb_to_linear(hexrgb(b)), 1)
        nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
        bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.25
        nt.links.new(noise.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
        bsdf.inputs["Roughness"].default_value = rough
        if pattern == "glass":
            bsdf.inputs["Alpha"].default_value = 0.3 if slot == "glass" else 0.6; bsdf.inputs["Metallic"].default_value = 0.2
            try: m.blend_method = 'BLEND'
            except Exception: pass
        if slot == "water":
            bsdf.inputs["Metallic"].default_value = 0.15
    _mats[slot] = m
    return m

# ---- geometry ---------------------------------------------------------------
# A box is a shared unit cube mesh scaled by the object; a cylinder a shared
# unit mesh per segment count. Shared data keeps a 900-prop floor light.
_unit = {}
def unit_box():
    if "box" not in _unit:
        me = bpy.data.meshes.new("unit_box"); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free(); _unit["box"] = me
    return _unit["box"]
def unit_cyl(seg):
    k = "cyl%d" % seg
    if k not in _unit:
        me = bpy.data.meshes.new("unit_" + k); bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=1.0, radius2=1.0, depth=1.0); bm.to_mesh(me); bm.free(); _unit[k] = me
    return _unit[k]

def to_bl(x, y, z):
    return (x, -z, y)

ALL = []
def place(name, me, slot, loc, scale, parent=None, rot=None, flat=None):
    """loc/scale/rot are in GAME axes (y up)."""
    ob = bpy.data.objects.new(name, me)
    ob.location = to_bl(*loc)
    ob.scale = (scale[0], scale[2], scale[1])
    if rot is not None:
        ob.rotation_euler = rot
    ob.data = me
    if slot:
        mat = material(slot)
        if ob.data.materials: pass
    bpy.context.scene.collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    ob["slot"] = slot
    ALL.append((ob, slot))
    return ob

def box(parent, slot, w, h, d, x=0, y=0, z=0, **kw):
    return place("box", unit_box(), slot, (x, y + h / 2.0, z), (w, h, d), parent)

def cylinder(parent, slot, r, h, x=0, y=0, z=0, seg=8, axis="y", **kw):
    ob = place("cyl", unit_cyl(seg), slot, (x, y + h / 2.0, z), (r, h, r), parent)
    if axis == "z":   # game z axis = blender -y: lay the cylinder along it
        ob.rotation_euler = (math.radians(90), 0, 0); ob.location = to_bl(x, y, z); ob.scale = (r, r, h)
    elif axis == "x":
        ob.rotation_euler = (0, math.radians(90), 0); ob.location = to_bl(x, y, z); ob.scale = (h, r, r)
    return ob

def empty(name, pos, rot_deg, parent=None):
    e = bpy.data.objects.new(name, None); e.empty_display_size = 0.2
    e.location = to_bl(*pos); e.rotation_euler = (0, 0, math.radians(rot_deg))
    bpy.context.scene.collection.objects.link(e)
    if parent is not None: e.parent = parent
    return e

# ---- the props.js port --------------------------------------------------------
def p_chair(g, o):
    m = o.get("mat", "lp_red")
    box(g, m, 0.5, 0.08, 0.5, 0, 0.42, 0); box(g, m, 0.5, 0.03, 0.06, 0, 0.5, -0.22)
    for x, z in ((-0.21, -0.21), (0.21, -0.21), (-0.21, 0.21), (0.21, 0.21)): box(g, "lp_dark", 0.04, 0.42, 0.04, x, 0, z)
    box(g, m, 0.04, 0.5, 0.04, -0.23, 0.5, -0.23); box(g, m, 0.04, 0.5, 0.04, 0.23, 0.5, -0.23)
    for i in range(3): box(g, m, 0.46, 0.07, 0.03, 0, 0.58 + i * 0.13, -0.235)
def p_desk(g, o):
    w, d, m = o.get("w", 1.6), o.get("d", 0.8), o.get("mat", "lp_wood")
    box(g, m, w, 0.05, d, 0, 0.72, 0)
    for x, z in ((-w/2+0.05, -d/2+0.05), (w/2-0.05, -d/2+0.05), (-w/2+0.05, d/2-0.05), (w/2-0.05, d/2-0.05)): box(g, m, 0.06, 0.72, 0.06, x, 0, z)
    box(g, m, 0.42, 0.14, 0.02, w/2-0.3, 0.55, d/2-0.02); box(g, "lp_dark", 0.08, 0.02, 0.01, w/2-0.3, 0.61, d/2)
def p_monitor(g, o):
    box(g, "lp_beige", 0.42, 0.34, 0.36, 0, 0.1, 0); box(g, "lp_screen" if o.get("on") else "lp_screen_off", 0.32, 0.24, 0.02, 0, 0.15, 0.18)
    box(g, "lp_beige", 0.24, 0.1, 0.24, 0, 0, 0); box(g, "lp_beige", 0.3, 0.02, 0.3, 0, -0.02, 0)
def p_stapler(g, o):
    box(g, "lp_dark", 0.06, 0.03, 0.18, 0, 0, 0); box(g, "lp_dark", 0.05, 0.03, 0.17, 0, 0.035, -0.01)
def p_papers(g, o): box(g, o.get("mat", "lp_paper"), 0.21, o.get("h", 0.04), 0.3, 0, 0, 0)
def p_slip(g, o): box(g, "lp_paper", 0.08, 0.004, 0.05, 0, 0, 0)
def p_clock(g, o):
    cylinder(g, "lp_white", 0.22, 0.03, 0, 0, 0, 16, axis="z"); cylinder(g, "lp_dark", 0.24, 0.02, 0, 0, -0.01, 16, axis="z")
def p_partition(g, o):
    L, h = o.get("len", 2.0), o.get("h", 1.3)
    box(g, o.get("mat", "lp_grey"), L, h, 0.06, 0, 0, 0); box(g, "lp_dark", L, 0.05, 0.08, 0, 0, 0); box(g, "lp_dark", L, 0.03, 0.08, 0, h - 0.03, 0)
def p_door(g, o):
    w, h, m = o.get("w", 0.9), o.get("h", 2.1), o.get("mat", "lp_beige")
    box(g, "lp_dark", w + 0.12, h + 0.06, 0.1, 0, 0, 0); box(g, m, w, h, 0.05, 0, 0, 0.04); box(g, "lp_dark", w - 0.2, h * 0.4, 0.015, 0, h * 0.5, 0.07)
    box(g, "lp_brass", 0.03, 0.03, 0.1, w/2 - 0.1, h * 0.47, 0.08)
def p_glassdoors(g, o):
    w, h = o.get("w", 2.4), o.get("h", 2.8)
    box(g, "lp_dark", w + 0.2, h + 0.1, 0.12, 0, 0, 0)
    for s in (-1, 1):
        box(g, "lp_glass", w/2 - 0.08, h - 0.1, 0.03, s * w/4, 0.05, 0); box(g, "lp_dark", 0.05, h, 0.14, s * (w/2 - 0.03), 0, 0); box(g, "lp_brass", w/2 - 0.3, 0.04, 0.06, s * w/4, 1.0, 0.1)
    box(g, "lp_dark", 0.05, h, 0.14, 0, 0, 0)
def p_curtain(g, o):
    w, h = o.get("w", 3.0), o.get("h", 3.0); folds = max(4, round(w / 0.25))
    for i in range(folds):
        x = -w/2 + (i + 0.5) * (w / folds); box(g, "lp_curtain", w / folds, h, 0.08 + (i % 2) * 0.06, x, 0, 0)
    box(g, "lp_brass", w + 0.2, 0.06, 0.12, 0, h, 0)
def p_sign(g, o):
    box(g, "lp_dark", o.get("w", 0.9) + 0.06, o.get("h", 0.3) + 0.06, 0.12, 0, 0, 0); box(g, "lp_sign", o.get("w", 0.9), o.get("h", 0.3), 0.02, 0, 0.03, 0.06)
def p_badgereader(g, o): box(g, "lp_grey", 0.16, 0.24, 0.05, 0, 0, 0); box(g, "lp_red", 0.1, 0.01, 0.02, 0, 0.1, 0.04)
def p_counter(g, o):
    w, d, h = o.get("w", 4.0), o.get("d", 0.8), o.get("h", 1.1)
    box(g, o.get("mat", "lp_dark"), w, h, d, 0, 0, 0); box(g, "lp_beige", w + 0.1, 0.06, d + 0.1, 0, h, 0)
    if o.get("glass", True): box(g, "lp_glass", w, 1.4, 0.03, 0, h + 0.06, -d/2 + 0.1)
def p_dispenser(g, o): box(g, "lp_dark", 0.06, 1.1, 0.06, 0, 0, 0); box(g, "lp_red", 0.22, 0.28, 0.18, 0, 1.1, 0); box(g, "lp_paper", 0.06, 0.01, 0.06, 0, 1.2, 0.1)
def p_figure(g, o):
    suit = o.get("suit", "lp_suit"); dy = -0.45 if o.get("seated") else 0.0
    box(g, suit, 0.44, 0.6, 0.24, 0, 0.9 + dy, 0); box(g, suit, 0.56, 0.1, 0.26, 0, 1.44 + dy, 0); box(g, "lp_skin", 0.1, 0.06, 0.1, 0, 1.5 + dy, 0)
    box(g, "lp_grey" if o.get("face") == "blur" else "lp_skin", 0.22, 0.24, 0.22, 0, 1.56 + dy, 0); box(g, "lp_dark", 0.24, 0.08, 0.24, 0, 1.78 + dy, 0)
    for s in (-1, 1):
        box(g, suit, 0.12, 0.58, 0.12, s * 0.3, 0.92 + dy, 0); box(g, "lp_skin", 0.1, 0.12, 0.1, s * 0.3, 0.8 + dy, 0); box(g, "lp_dark", 0.16, 0.9, 0.16, s * 0.12, dy, 0)
    if o.get("tie"): box(g, "lp_red", 0.06, 0.4, 0.01, 0, 1.05 + dy, 0.125)
def p_car(g, o):
    m = o.get("mat", "lp_car"); L, W = o.get("len", 4.4), o.get("w", 1.8); sill = 0.32
    box(g, m, W, 0.5, L * 0.98, 0, sill, 0); box(g, m, W - 0.1, 0.16, L * 0.3, 0, sill + 0.5, L * 0.32); box(g, m, W - 0.1, 0.2, L * 0.24, 0, sill + 0.5, -L * 0.36)
    box(g, m, W - 0.28, 0.14, L * 0.44, 0, sill + 0.94, -L * 0.03); box(g, "lp_glass", W - 0.34, 0.34, L * 0.44 + 0.02, 0, sill + 0.6, -L * 0.03)
    box(g, "lp_chrome", W + 0.04, 0.12, 0.1, 0, sill - 0.02, L/2 - 0.02); box(g, "lp_chrome", W + 0.04, 0.12, 0.1, 0, sill - 0.02, -L/2 + 0.02)
    for s in (-1, 1):
        box(g, "lp_taillight", 0.28, 0.1, 0.03, s * (W/2 - 0.25), sill + 0.3, -L/2 - 0.005); box(g, "lp_headlight", 0.24, 0.12, 0.03, s * (W/2 - 0.25), sill + 0.28, L/2 - 0.005)
    for x, z in ((-W/2 + 0.08, L * 0.32), (W/2 - 0.08, L * 0.32), (-W/2 + 0.08, -L * 0.32), (W/2 - 0.08, -L * 0.32)):
        cylinder(g, "lp_black", 0.32, 0.22, x, 0.32, z, 8, axis="x"); box(g, m, 0.1, 0.36, 0.8, x + (0.02 if x < 0 else -0.02), sill + 0.2, z)
def p_panel(g, o):
    box(g, "lp_grey", 0.42, 1.2, 0.04, 0, 0, 0); lit = o.get("lit", 41)
    for i in range(66):
        c, r = i % 6, i // 6; box(g, "lp_sign" if i == lit else "lp_dark", 0.04, 0.04, 0.02, -0.15 + c * 0.06, 0.1 + r * 0.095, 0.03)
def p_shelf(g, o):
    w, d, tiers, h = o.get("w", 2.0), o.get("d", 0.6), o.get("tiers", 4), o.get("h", 1.8)
    for x in (-w/2, w/2):
        for z in (-d/2, d/2): box(g, "lp_grey", 0.05, h, 0.05, x, 0, z)
    for t in range(tiers):
        y = 0.15 + t * ((h - 0.2) / (tiers - 1)); box(g, "lp_grey", w, 0.03, d, 0, y, 0)
        for k in range(4): box(g, "lp_red" if k % 3 == 0 else "lp_beige", 0.28, 0.22, 0.25, -w/2 + 0.3 + k * (w / 4.2), y + 0.03, 0)
def p_cooler(g, o):
    w = o.get("w", 4.0); box(g, "lp_grey", w, 2.2, 0.8, 0, 0, 0); n = round(w / 0.9)
    for i in range(n): box(g, "lp_screen", 0.75, 1.8, 0.02, -w/2 + 0.45 + i * (w / n), 0.2, 0.41)
def p_boxtower(g, o):
    y = 0
    for i in range(o.get("n", 6)):
        s = 0.7 + ((i * 37) % 5) * 0.06; box(g, "cardboard", s, 0.5, s, ((i * 13) % 3 - 1) * 0.06, y, ((i * 7) % 3 - 1) * 0.06); y += 0.5
def p_package(g, o): box(g, "cardboard", 0.5, 0.32, 0.36, 0, 0.01, 0); box(g, "lp_black", 0.62, 0.005, 0.46, 0, 0, 0)
def p_mopsink(g, o): box(g, "lp_grey", 0.7, 0.3, 0.7, 0, 0, 0); box(g, "lp_dark", 0.6, 0.02, 0.6, 0, 0.3, 0); box(g, "lp_grey", 0.04, 0.5, 0.04, -0.2, 0.3, -0.3)
def p_drain(g, o): cylinder(g, "lp_black", 0.18, 0.01, 0, 0, 0, 8)
def p_pillar(g, o):
    m, w, h = o.get("mat", "concrete"), o.get("w", 0.6), o.get("h", 3.2)
    box(g, m, w, h, w, 0, 0, 0); box(g, m, w + 0.12, 0.12, w + 0.12, 0, 0, 0)
    if o.get("cap", True): box(g, m, w + 0.3, 0.3, w + 0.3, 0, h - 0.3, 0)
    if o.get("band"): box(g, o["band"], w + 0.02, o.get("bandH", 1.0), w + 0.02, 0, 0.12, 0)
def p_fluoro(g, o):
    w, d = o.get("w", 1.2), o.get("d", 0.3); box(g, "lp_grey", w + 0.08, 0.05, d + 0.08, 0, 0.02, 0); box(g, "lp_fluoro", w, 0.04, d, 0, 0, 0)
def p_sodium(g, o): box(g, "lp_dark", 0.06, 0.25, 0.06, 0, 0.12, 0); box(g, "lp_dark", 0.7, 0.1, 0.32, 0, 0.02, 0); box(g, "lp_sodium", 0.56, 0.06, 0.16, 0, -0.03, 0)
def p_pendant(g, o):
    drop = o.get("drop", 0.6); box(g, "lp_black", 0.02, drop, 0.02, 0, -drop, 0); cylinder(g, "lp_dark", 0.22, 0.16, 0, -drop - 0.16, 0, 10); box(g, "lp_fluoro", 0.1, 0.08, 0.1, 0, -drop - 0.2, 0)
def p_wallplate(g, o): box(g, o.get("mat", "lp_red"), o.get("w", 1.2), o.get("h", 0.5), 0.03, 0, 0, 0)
def p_pipe(g, o):
    L, r = o.get("len", 6), o.get("r", 0.08); cylinder(g, o.get("mat", "lp_grey"), r, L, 0, 0, 0, 8, axis="x")
    x = -L/2 + 0.5
    while x < L/2: box(g, "lp_dark", 0.06, 0.25, 0.06, x, 0, 0); x += 2.0
def p_emblem(g, o): r = o.get("r", 1.4); cylinder(g, "lp_brass", r, 0.01, 0, 0, 0, 24); cylinder(g, "lp_dark", r * 0.72, 0.012, 0, 0, 0, 24)
def p_placard(g, o): box(g, "lp_beige", 0.6, 0.18, 0.02, 0, 0, 0)
def p_keyboard(g, o):
    box(g, "lp_beige", 0.46, 0.025, 0.16, 0, 0, 0)
    for r in range(4):
        for c in range(12): box(g, "lp_dark", 0.028, 0.012, 0.028, -0.2 + c * 0.036, 0.025, -0.055 + r * 0.036)
def p_hands(g, o):
    for s in (-1, 1):
        hx = s * 0.11; box(g, "lp_skin", 0.09, 0.035, 0.11, hx, 0, 0)
        for f in range(4): box(g, "lp_skin", 0.018, 0.022, 0.07, hx - 0.032 + f * 0.021, 0.004, -0.08)
        box(g, "lp_skin", 0.02, 0.022, 0.05, hx + s * 0.055, 0.004, -0.01); box(g, "lp_suit", 0.1, 0.05, 0.1, hx, -0.008, 0.09)
    if o.get("slip"): box(g, "lp_paper", 0.08, 0.003, 0.05, 0, 0.03, -0.06)
def p_mug(g, o): cylinder(g, "lp_white", 0.04, 0.09, 0, 0, 0, 8); box(g, "lp_white", 0.015, 0.05, 0.03, 0.05, 0.02, 0)
def p_lamp(g, o):
    cylinder(g, "lp_dark", 0.08, 0.02, 0, 0, 0, 8); box(g, "lp_dark", 0.02, 0.36, 0.02, 0, 0.02, 0); cylinder(g, "lp_brass", 0.1, 0.12, 0, 0.3, 0, 8); box(g, "lp_fluoro", 0.08, 0.01, 0.08, 0, 0.3, 0)
def p_building(g, o):
    w, h, d = o.get("w", 10), o.get("h", 16), o.get("d", 9); box(g, o.get("mat", "plaster_dark"), w, h, d, 0, 0, 0)
    y = 3.0
    while y < h - 1.0: box(g, "glass_dark", w + 0.04, 1.3, d + 0.04, 0, y, 0); y += 3.4
def p_lamppost(g, o): cylinder(g, "lp_dark", 0.08, 5.0, 0, 0, 0, 8); box(g, "lp_dark", 0.08, 0.08, 1.2, 0, 4.9, -0.6); box(g, "lp_fluoro", 0.3, 0.12, 0.5, 0, 4.82, -1.1)
def p_table(g, o):
    w, d = o.get("w", 2.0), o.get("d", 10.0); box(g, "glass_dark", w, 0.05, d, 0, 0.74, 0); box(g, "lp_dark", w - 0.6, 0.72, 0.5, 0, 0, -d/2 + 1.2); box(g, "lp_dark", w - 0.6, 0.72, 0.5, 0, 0, d/2 - 1.2)

BUILDERS = {k[2:]: v for k, v in dict(globals()).items() if k.startswith("p_")}
SKIPPED = []

def build_prop(spec):
    t = spec["type"]
    if t == "glb":
        return None  # placed by the catalog import (imports / place commands)
    fn = BUILDERS.get(t)
    if fn is None:
        print("skipped prop with no p_ builder:", t, spec.get("name") or "")
        SKIPPED.append(t)
        return None
    pos = spec.get("pos", [0, 0, 0])
    g = empty(spec.get("name") or t, pos, spec.get("rot", 0))
    if spec.get("scale"): g.scale = (spec["scale"],) * 3
    fn(g, spec)
    return g

# ---- the room --------------------------------------------------------------
def archbox(slot, mn, mx):
    w, h, d = mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]
    return place("arch", unit_box(), slot, (mn[0] + w/2, mn[1] + h/2, mn[2] + d/2), (w, h, d))

def build_room(rec):
    sc = bpy.context.scene
    W, H, D = rec["size"]; T = 0.3; FT = 0.2
    openside = set(rec.get("open", []))
    archbox(rec.get("floor", "concrete"), [-W/2, -FT, -D/2], [W/2, 0, D/2])
    if not rec.get("noCeiling"): archbox(rec.get("ceiling", rec.get("wall", "plaster")), [-W/2, H, -D/2], [W/2, H + FT, D/2])
    wall = rec.get("wall", "plaster")
    shell = {"N": ([-W/2 - T, 0, -D/2 - T], [W/2 + T, H, -D/2]), "S": ([-W/2 - T, 0, D/2], [W/2 + T, H, D/2 + T]),
             "E": ([W/2, 0, -D/2], [W/2 + T, H, D/2]), "W": ([-W/2 - T, 0, -D/2], [-W/2, H, D/2])}
    if not rec.get("noWalls"):
        for side, (a, b) in shell.items():
            if side in openside: continue
            archbox(wall, a, b)
            sk = rec.get("skirt")
            if sk:
                t = sk.get("t", 0.03); hh = sk.get("h", 0.9)
                inner = {"N": ([-W/2, 0, -D/2], [W/2, hh, -D/2 + t]), "S": ([-W/2, 0, D/2 - t], [W/2, hh, D/2]), "E": ([W/2 - t, 0, -D/2], [W/2, hh, D/2]), "W": ([-W/2, 0, -D/2], [-W/2 + t, hh, D/2])}[side]
                archbox(sk.get("mat", "plaster_dark"), *inner)
    bm = rec.get("beams")
    if bm and not rec.get("noCeiling"):
        bw, bh, every, off = bm.get("w", 0.5), bm.get("h", 0.6), bm.get("every", 8), bm.get("offset", 0); mat = bm.get("mat", rec.get("ceiling", "concrete"))
        if bm.get("axis") == "z":
            x = -W/2 + off
            while x <= W/2 + 1e-6: archbox(mat, [x - bw/2, H - bh, -D/2], [x + bw/2, H, D/2]); x += every
        else:
            z = -D/2 + off
            while z <= D/2 + 1e-6: archbox(mat, [-W/2, H - bh, z - bw/2], [W/2, H, z + bw/2]); z += every
    for b in rec.get("boxes", []):
        if b.get("invisible"): continue
        archbox(b.get("mat", "concrete"), b["min"], b["max"])
    for p in rec.get("props", []):
        build_prop(p)
    # materials: assign (one per object), flat shading for the company's things
    for ob, slot in ALL:
        if ob.type != 'MESH': continue
        if ob.data.materials and ob.data.materials[0] == material(slot): continue
        # shared mesh data gets per-object material via material slots linked to OBJECT
        if not ob.data.materials: ob.data.materials.append(None)
        ob.material_slots[0].link = 'OBJECT'; ob.material_slots[0].material = material(slot)
    # lights
    amb = rec.get("ambient", {"color": "#ffffff", "intensity": 0.3})
    world = bpy.data.worlds.new("World") if sc.world is None else sc.world
    sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (*srgb_to_linear(hexrgb(amb.get("color", "#ffffff"))), 1); bg.inputs["Strength"].default_value = amb.get("intensity", 0.3) * 0.6
    sun = rec.get("sun", {"intensity": 0.9, "color": "#ffffff"})
    if sun.get("intensity", 0) > 0:
        core = rec.get("core", [0, 0, -D/2]); frm = sun.get("from", [W * 0.15, H * 1.6, D * 0.6])
        L = bpy.data.lights.new("Sun_C2", 'SUN'); L.energy = sun.get("intensity", 0.9) * 4.0; L.color = srgb_to_linear(hexrgb(sun.get("color", "#ffffff"))); L.angle = math.radians(4)
        ob = bpy.data.objects.new("Sun_C2", L); ob.location = to_bl(*frm); sc.collection.objects.link(ob)
        d = Vector(to_bl(*core)) - Vector(to_bl(*frm)); ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    for i, l in enumerate(rec.get("lights", [])):
        col = srgb_to_linear(hexrgb(l.get("color", "#ffffff")))
        if l.get("type") == "spot":
            L = bpy.data.lights.new("Spot_%d" % i, 'SPOT'); L.energy = l.get("intensity", 20) * 30; L.spot_size = math.radians(l.get("angle", 40) * 2); L.spot_blend = l.get("penumbra", 0.5)
            ob = bpy.data.objects.new("Spot_%d" % i, L); ob.location = to_bl(*l["pos"]); sc.collection.objects.link(ob)
            t = l.get("target", [l["pos"][0], 0, l["pos"][2]]); d = Vector(to_bl(*t)) - Vector(to_bl(*l["pos"])); ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        else:
            L = bpy.data.lights.new("Point_%d" % i, 'POINT'); L.energy = l.get("intensity", 10) * 30; L.shadow_soft_size = 0.35
            ob = bpy.data.objects.new("Point_%d" % i, L); ob.location = to_bl(*l["pos"]); sc.collection.objects.link(ob)
        L.color = col
        if l.get("flicker"): ob["flicker"] = l["flicker"]
    # camera + shots
    cam_data = bpy.data.cameras.new("ShotCam"); cam_data.sensor_fit = 'HORIZONTAL'
    cam = bpy.data.objects.new("ShotCam", cam_data); sc.collection.objects.link(cam); sc.camera = cam
    cam.rotation_mode = 'QUATERNION'
    shots = rec.get("shots", {})
    def pose_of(p): return shots[p] if isinstance(p, str) else p
    def key(frame, pose):
        pos = Vector(to_bl(*pose["pos"])); look = Vector(to_bl(*pose["look"]))
        cam.location = pos; cam.rotation_quaternion = (look - pos).to_track_quat('-Z', 'Y')
        # fov is the game's VERTICAL fov at 16:9; the lens is keyed (angle is not animatable)
        hfov = 2 * math.atan(math.tan(math.radians(pose.get("fov", 62)) / 2) * 16 / 9)
        cam_data.lens = cam_data.sensor_width / (2 * math.tan(hfov / 2))
        cam.keyframe_insert("location", frame=frame); cam.keyframe_insert("rotation_quaternion", frame=frame); cam_data.keyframe_insert("lens", frame=frame)
    frame = 1; markers = {}
    for name, s in shots.items():
        if "pos" in s:
            key(frame, s); markers[name] = (frame, frame); sc.timeline_markers.new(name, frame=frame); frame += 2
        else:
            n = max(2, int(round(s.get("seconds", 4) * FPS)))
            key(frame, pose_of(s["from"])); key(frame + n - 1, pose_of(s["to"]))
            sc.timeline_markers.new(name, frame=frame); markers[name] = (frame, frame + n - 1); frame += n + 1
    sc.frame_start = 1; sc.frame_end = max(2, frame - 1); sc.render.fps = FPS
    # Blender 5 layered actions: the f-curves live in a channelbag per slot.
    try:
        act = cam.animation_data.action
        curves = []
        for layer in act.layers:
            for strip in layer.strips:
                for cb in strip.channelbags: curves.extend(cb.fcurves)
        for fc in curves:
            for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'; kp.easing = 'EASE_IN_OUT'
    except Exception as e:
        print("easing skipped:", e)
    cam["shots"] = json.dumps(markers)
    sc["room"] = rec.get("id", ""); sc["shots"] = json.dumps(markers)
    sc.render.engine = 'BLENDER_EEVEE'
    return markers

markers = build_room(ROOM)
result = {"room": ROOM.get("id"), "objects": len(bpy.data.objects), "materials": len(bpy.data.materials), "shots": markers, "frame_end": bpy.context.scene.frame_end, "skipped": SKIPPED}
'''

PLACE_TEMPLATE = r'''
import bpy, json, math
from mathutils import Quaternion, Vector
PLACEMENTS = json.loads(PLACEMENTS_JSON)   # node -> [[x, y, z, rotDeg, scale], ...] (game axes), first one is the import itself
sc = bpy.context.scene
made = {}
def to_bl(x, y, z): return (x, -z, y)
for node, places in PLACEMENTS.items():
    src = bpy.data.objects.get(node)
    if src is None:
        made[node] = "missing"; continue
    # the imported entity is a parent (Empty) with mesh children; mirror that
    first = places[0]
    src.rotation_mode = 'XYZ'; src.location = to_bl(first[0], first[1], first[2]); src.rotation_euler = (0, 0, math.radians(first[3])); src.scale = (first[4],) * 3
    children = [c for c in bpy.data.objects if c.parent == src]
    n = 0
    for x, y, z, rot, scale in places[1:]:
        dup = src.copy(); dup.name = "%s.%03d" % (node, n); sc.collection.objects.link(dup)
        for k in ("hf_id", "hf_asset"):   # a copy must not repeat the import's entity id in the scene manifest
            if k in dup: del dup[k]
        dup.location = to_bl(x, y, z); dup.rotation_euler = (0, 0, math.radians(rot)); dup.scale = (scale,) * 3
        for c in children:
            cc = c.copy(); cc.parent = dup; cc.matrix_parent_inverse = c.matrix_parent_inverse.copy(); sc.collection.objects.link(cc)
            for k in ("hf_id", "hf_asset", "hf_asset_child"):
                if k in cc: del cc[k]
        n += 1
    made[node] = n + 1
result = {"placed": made, "objects": len(bpy.data.objects)}
'''

PROOF_TEMPLATE = r'''
import bpy, os, json, time
sc = bpy.context.scene
markers = json.loads(sc["shots"]) if "shots" in sc else {}
cam = sc.camera
t0 = time.time()
out = {}
sc.render.resolution_x, sc.render.resolution_y = 960, 540; sc.render.resolution_percentage = 100
# two Eevee stills: the in and out poses
sc.render.engine = 'BLENDER_EEVEE'; sc.eevee.taa_render_samples = 6
sc.render.image_settings.media_type = 'IMAGE'; sc.render.image_settings.file_format = 'PNG'
for name in ("in", "out"):
    if name not in markers: continue
    sc.frame_set(markers[name][0])
    tgt = artifacts.file(name="%s_%s.png" % (ROOM_KEY, name), media_type="image/png")
    sc.render.filepath = tgt.path; bpy.ops.render.render(write_still=True); tgt.publish(); out[name] = os.path.getsize(tgt.path)
# the transitions: a fast Workbench proof of the leave + arrive camera moves
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
sc.render.resolution_x, sc.render.resolution_y = 640, 360
sc.render.image_settings.media_type = 'VIDEO'; sc.render.image_settings.file_format = 'FFMPEG'; sc.render.ffmpeg.format = 'MPEG4'; sc.render.ffmpeg.codec = 'H264'
for name in PROOF_SHOTS:
    if name not in markers: continue
    a, b = markers[name]; sc.frame_start, sc.frame_end = a, b; sc.frame_step = 2
    tgt = artifacts.file(name="%s_%s.mp4" % (ROOM_KEY, name), media_type="video/mp4")
    sc.render.filepath = tgt.path; bpy.ops.render.render(animation=True)
    d = os.path.dirname(tgt.path)
    if not os.path.exists(tgt.path):
        c = [f for f in os.listdir(d) if f.endswith(".mp4") and f != os.path.basename(tgt.path)]
        if c: os.replace(os.path.join(d, c[0]), tgt.path)
    if os.path.exists(tgt.path): tgt.publish(); out[name] = os.path.getsize(tgt.path)
result = {"room": ROOM_KEY, "rendered": out, "seconds": round(time.time() - t0, 1)}
'''


def prune(template, rec):
    """The template minus the prop builders this room never uses (and minus
    comments): the scene builder caps code at 256 KiB and every byte is
    pasted through a tool call."""
    import ast
    used = {p["type"] for p in rec.get("props", [])} | {p.get("fallback") for p in rec.get("props", []) if p.get("fallback")}
    tree = ast.parse(template)
    body = [n for n in tree.body if not (isinstance(n, ast.FunctionDef) and n.name.startswith("p_") and n.name[2:] not in used)]
    tree.body = body
    return ast.unparse(tree)


def load_room(key):
    doc = json.load(open(ROOMS, encoding="utf-8"))
    rec = doc["rooms"][key]
    if "alias" in rec:
        base = doc["rooms"][rec["alias"]]
        rec = {**base, **rec, "id": key}
    return doc, rec


def placements(rec):
    """node -> [[x, y, z, rotDeg, scale], ...] in game axes."""
    out = {}
    for p in rec.get("props", []):
        if p["type"] != "glb":
            continue
        x, y, z = (p.get("pos") or [0, 0, 0])
        out.setdefault(p["node"], []).append([x, y, z, p.get("rot", 0), p.get("scale", 1)])
    return out


def quat_y(deg):
    h = math.radians(deg) / 2
    return [0, round(math.sin(h), 6), 0, round(math.cos(h), 6)]


def unbuilt_types(rec):
    """Prop types in the room this port has no p_* builder for: type -> count."""
    known = set(re.findall(r"^def p_(\w+)\(", TEMPLATE, flags=re.M))
    out = {}
    for p in rec.get("props", []):
        t = p["type"]
        if t != "glb" and t not in known:
            out[t] = out.get(t, 0) + 1
    return out


def main():
    key, cmd = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "build")
    doc, rec = load_room(key)
    if cmd == "build":
        slim = {k: v for k, v in rec.items() if k not in RUNTIME_ONLY}
        for t, n in sorted(unbuilt_types(rec).items()):
            msg = "%s: no p_%s builder, %d prop(s) skipped (see blender/higgsfield/REBUILD_NOTE.md)" % (key, t, n)
            print("# WARNING: " + msg)
            print("higgsfield_scene.py: warning: " + msg, file=sys.stderr)
        print("ROOM_JSON = %s\n%s" % (json.dumps(json.dumps(slim)), prune(TEMPLATE, rec)))
    elif cmd == "imports":
        cat = doc["catalog"]
        items = []
        for node, pl in placements(rec).items():
            c = cat[node]
            x, y, z, rot, scale = pl[0]
            items.append({"node": node, "assetId": c["assetId"], "catalogSearch": c["search"], "name": node,
                          "transform": {"position": [x, y, z], "rotation": quat_y(rot), "scale": [scale] * 3}, "count": len(pl)})
        print(json.dumps(items, indent=1))
    elif cmd == "place":
        print("PLACEMENTS_JSON = %s\n%s" % (json.dumps(json.dumps(placements(rec))), PLACE_TEMPLATE))
    elif cmd == "proof":
        shots = [s for s in ("leave", "arrive") if s in rec.get("shots", {})]
        print("ROOM_KEY = %s\nPROOF_SHOTS = %s\n%s" % (json.dumps(key), json.dumps(shots), PROOF_TEMPLATE))
    else:
        raise SystemExit("unknown command " + cmd)


if __name__ == "__main__":
    main()
