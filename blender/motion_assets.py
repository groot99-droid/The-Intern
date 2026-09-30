# Motion pass, part 3 of 3: builds the props/shape-keys/shader chains that
# scene_motion.py's non-camera motion needed but didn't have yet, then keys
# their motion in the same script (unlike camera_moves.py/scene_motion.py,
# splitting "build" from "animate" here would just be two files that have to
# agree on names neither owns yet).
#
# Covers, in order: the S4_H distant figure (turns out to need NO new mesh --
# it's another instance of the existing Character_Standing collection), the
# S3_H handprint (atmosphere_assets.py wrote the asset but never got applied,
# and its shared material can't be keyed per-scene -- see below), the S7_H/
# S8_H grate, the mailroom wet ring, TH_Curtain's "Parted" shape key, and a
# noise chain on G_Haze/MR_Haze.
#
# Run headless (Blender must be CLOSED, or its unsaved state will be lost):
#     blender.exe -b <blend> -P motion_assets.py -- --apply
#     blender.exe -b <blend> -P motion_assets.py            # dry run
#
# Depends on atmosphere_assets.py having been applied first (this script
# applies it itself if the Handprint/Monogram collections are missing).

import bpy
import bmesh
import sys
import math

_HERE = __file__.rsplit("\\", 1)[0] if "\\" in __file__ else __file__.rsplit("/", 1)[0]
sys.path.insert(0, _HERE)
from anim_lib import channelbag_for, set_curve, key_location, mirrored_location_keys, generate_ramp_keys
import atmosphere_assets as aa


def _exec_text(name):
    """Run one of the .blend's own Text datablocks and return its globals --
    those copies are authoritative (CLAUDE.md), the on-disk .py files here
    are exported mirrors. Same helper as atmosphere_assets.py's, duplicated
    rather than imported so this file has no load-order dependency on it."""
    txt = bpy.data.texts.get(name)
    if txt is None:
        raise KeyError("Text datablock %r not found in this .blend" % name)
    ns = {}
    exec(txt.as_string(), ns)
    return ns


_prop_builders = _exec_text("prop_builders.py")
bm_add_box = _prop_builders["bm_add_box"]
bm_add_ring_band = _prop_builders["bm_add_ring_band"]
finalize = _prop_builders["finalize"]


def make_emission_material(name, color, strength=0.0):
    """A dedicated (never shared) blue-glow material -- the two grates need
    independent emission timing, so each gets its own material rather than
    an instanced/shared one (see the grate section below for why)."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    output = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.name = "Emission"
    em.inputs["Color"].default_value = (*color, 1.0)
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs["Emission"], output.inputs["Surface"])
    return mat


# =====================================================================
# S4_H: the distant figure. No new geometry -- Character_Standing already
# exists (CB_Manager_Inst / S1_Receptionist_Inst / MR_Clerk_Inst all use it).
# Doc: "very small, one standing male figure in a suit, facing away... does
# not change size and does not change position in frame" -- so it gets
# placed once, then pinned to UT_Cam's exact delta (camera_moves.py) rather
# than left static, which is the only way "does not change size" survives a
# camera that itself moves.
# =====================================================================
UT_CAM_KEYS = [(1, (-0.15, 0.5, 1.5)), (144, (-0.15, 1.8, 1.5))]
UT_FIGURE_BASE = (0.0, 7.6, 0.0)


def ensure_ut_figure(apply, changes):
    sc = bpy.data.scenes.get("S4H_Utility")
    if sc is None:
        changes.append(("S4H_Utility", "figure", "NO SCENE"))
        return
    existing = sc.objects.get("UT_Figure_Inst")
    if not apply:
        changes.append(("S4H_Utility", "figure", "exists" if existing else "would add + pin"))
        return
    obj = existing
    if obj is None:
        coll = bpy.data.collections.get("Character_Standing")
        if coll is None:
            changes.append(("S4H_Utility", "figure", "NO Character_Standing collection"))
            return
        obj = bpy.data.objects.new("UT_Figure_Inst", None)
        obj.instance_type = "COLLECTION"
        obj.instance_collection = coll
        obj.empty_display_size = 0.3
        sc.collection.objects.link(obj)
    # facing away from camera. Empirically checked via --proof (not
    # assumed): rotation (0,0,180) rendered the figure's FRONT toward
    # UT_Cam, the opposite of the doc's "facing away" -- so the
    # Character_Standing collection's identity rotation must itself
    # face away from -Y, unlike what its other instances' shared (0,0,0)
    # placements suggested. No rotation needed here. Set unconditionally
    # (not just on first creation) so a fix like this one actually applies
    # on a re-run against an already-placed object.
    obj.rotation_euler = (0.0, 0.0, 0.0)
    keys = mirrored_location_keys(UT_FIGURE_BASE, UT_CAM_KEYS)
    key_location(obj, keys, interp="BEZIER")
    changes.append(("S4H_Utility", "figure", "placed + pinned (mirrors UT_Cam)"))


# =====================================================================
# S3_H handprint. atmosphere_assets.py already wrote the asset builder and
# a placement for it (S3H_Handprint_Inst), but never got applied -- that's
# the actual reason "no handprint object exists yet" (Phase 3's note), not
# a missing design. Running it is step one, below.
#
# But its material (SMUDGE_MAT) is shared with the S7_C and S8_H handprints
# (CLAUDE.md's own warning: several materials and every SharedAssetKit
# collection are shared, and keying them bleeds across scenes). S3_H is the
# only one of the three that needs to fade in (decision #5); S7_C and S8_H
# stay static. So: apply atmosphere_assets.py for all three as designed,
# then swap JUST the S3_H instance for a private, non-instanced copy with
# its own material, and animate that copy instead. S7_C/S8_H keep the
# shared static instance untouched.
# =====================================================================
S3H_HANDPRINT_LOC = (-0.45, 0.06, 1.28)
S3H_HANDPRINT_ROT = (0.0, 0.0, 0.0)
S3H_FADE_IN = (40, 52)  # frame range for the 0.5s fade (doc), mid-clip


def ensure_atmosphere_assets(apply, changes):
    if "Handprint" in bpy.data.collections and "Monogram" in bpy.data.collections:
        changes.append(("(all)", "atmosphere_assets", "already applied"))
        return
    if not apply:
        changes.append(("(all)", "atmosphere_assets", "would apply (Handprint/Monogram missing)"))
        return
    for coll_name, state in aa.ensure_assets():
        changes.append((coll_name, "atmosphere_assets/asset", state))
    for scene_name, name, state in aa.place(True, False):
        changes.append((scene_name, "atmosphere_assets/place", "%s: %s" % (name, state)))


def ensure_s3h_handprint(apply, changes):
    sc = bpy.data.scenes.get("S3_H_LobbyDoors")
    if sc is None:
        changes.append(("S3_H_LobbyDoors", "handprint", "NO SCENE"))
        return
    if not apply:
        changes.append(("S3_H_LobbyDoors", "handprint", "would swap shared instance for private animated copy"))
        return

    shared = sc.objects.get("S3H_Handprint_Inst")
    if shared is not None:
        bpy.data.objects.remove(shared, do_unlink=True)

    obj = sc.objects.get("S3H_Handprint")
    if obj is None:
        mesh = aa.build_handprint_mesh()
        obj = bpy.data.objects.new("S3H_Handprint", mesh)
        sc.collection.objects.link(obj)
    obj.location = S3H_HANDPRINT_LOC
    obj.rotation_euler = S3H_HANDPRINT_ROT

    mat_name = "PhotorealArch_Smudge_S3H"
    if mat_name not in bpy.data.materials:
        base = bpy.data.materials.get(aa.SMUDGE_MAT)
        if base is None:
            changes.append(("S3_H_LobbyDoors", "handprint", "SMUDGE_MAT missing -- run atmosphere_assets first"))
            return
        mat = base.copy()
        mat.name = mat_name
    else:
        mat = bpy.data.materials[mat_name]
    obj.data.materials.clear()
    obj.data.materials.append(mat)

    target_alpha = 0.30  # matches atmosphere_assets._translucent's value for SMUDGE_MAT
    keys = generate_ramp_keys(S3H_FADE_IN[0], S3H_FADE_IN[1] - S3H_FADE_IN[0], 0.0, target_alpha)
    cb = channelbag_for(mat.node_tree, 'nodes["Principled BSDF"].inputs["Alpha"].default_value', -1)
    set_curve(cb, 'nodes["Principled BSDF"].inputs["Alpha"].default_value', 0, keys, interp="LINEAR")
    changes.append(("S3_H_LobbyDoors", "handprint", "private copy placed, fades in f%d-%d" % S3H_FADE_IN))


# =====================================================================
# S7_H / S8_H grate. Shared geometry (one mesh, instanced via two real
# objects -- not a collection-instance, because the two scenes need
# independent emission timing and a collection-instance's child mesh
# can't take a per-instance material override the way an object can).
# Rust body is photoreal architecture (C1: floor grates are the building,
# not something the company owns), shared and never keyed -- safe. Each
# scene's blue glow is its own material via a per-OBJECT material-slot
# link, so keying one never touches the other.
# =====================================================================
GRATE_RUST_MAT = "PhotorealArch_GrateRust"


def build_grate_mesh():
    bm = bmesh.new()
    n_bars, bar_w, gap = 5, 0.07, 0.10
    total_w = n_bars * bar_w + (n_bars - 1) * gap
    x0 = -total_w / 2.0
    bar_h = 0.03
    for i in range(n_bars):
        bx0 = x0 + i * (bar_w + gap)
        bm_add_box(bm, (bx0, -0.35, 0.0), (bx0 + bar_w, 0.35, bar_h), material_index=0)
    # backing glow panel, recessed slightly below the bars
    bm_add_box(bm, (x0 - 0.02, -0.37, -0.025), (x0 + total_w + 0.02, 0.37, -0.005), material_index=1)
    mesh = bpy.data.meshes.new("GrateMesh")
    finalize(bm, type("_o", (), {"data": mesh})())  # finalize() only needs .data
    return mesh


def ensure_grate_asset(changes):
    factories = _exec_text("material_factories.py")
    make_photoreal = factories["make_photoreal_material"]
    if GRATE_RUST_MAT not in bpy.data.materials:
        make_photoreal(GRATE_RUST_MAT, (0.32, 0.20, 0.14), roughness=0.85,
                        use_normal_proc=True, noise_scale=55.0, bump_strength=0.10)
        changes.append(("(all)", "grate asset", "rust material built"))
    if "GrateMesh" not in bpy.data.meshes:
        build_grate_mesh()
        changes.append(("(all)", "grate asset", "mesh built"))


def _place_grate(scene_name, obj_name, loc, scale, emission_mat_name, emission_color, changes):
    sc = bpy.data.scenes.get(scene_name)
    if sc is None:
        changes.append((scene_name, "grate", "NO SCENE"))
        return None
    obj = sc.objects.get(obj_name)
    if obj is None:
        mesh = bpy.data.meshes["GrateMesh"]
        obj = bpy.data.objects.new(obj_name, mesh)
        obj.data.materials.clear()
        obj.data.materials.append(bpy.data.materials[GRATE_RUST_MAT])
        obj.data.materials.append(None)  # slot 1, overridden per-object below
        sc.collection.objects.link(obj)
    obj.location = loc
    obj.scale = (scale, scale, scale)
    glow = make_emission_material(emission_mat_name, emission_color, strength=0.0)
    slot = obj.material_slots[1]
    slot.link = 'OBJECT'
    slot.material = glow
    changes.append((scene_name, "grate", "placed (glow=%s)" % emission_mat_name))
    return glow


GRATE_BLUE = (0.10, 0.55, 0.95)


def ensure_grates(apply, changes):
    if not apply:
        changes.append(("S7H_Pool", "grate", "would build + place + ramp"))
        changes.append(("S8H_Underwater", "grate", "would build + place + ramp"))
        return
    ensure_grate_asset(changes)

    # S7H_Pool: deep in the water, forward of the edge. "glowing sick blue,
    # becomes visible in the last two seconds" of the 144-frame (6s) range.
    # Placed along PL_Cam's OWN forward vector at frame_end (dist=8), the
    # moment it actually starts being visible -- PL_Cam only rotates (its
    # location is fixed), so a naive guess landed 0.26 below the frame
    # entirely; empirically re-derived via world_to_camera_view.
    glow = _place_grate("S7H_Pool", "PL_Grate", (0.0, 4.745, -3.28), 2.0,
                         "Emission_PL_Grate", GRATE_BLUE, changes)
    if glow is not None:
        keys = generate_ramp_keys(96, 48, 0.0, 6.0)  # frames 96-144 = last 2s
        cb = channelbag_for(glow.node_tree, 'nodes["Emission"].inputs[1].default_value', -1)
        set_curve(cb, 'nodes["Emission"].inputs[1].default_value', 0, keys, interp="LINEAR")

    # S8H_Underwater: along UW_Cam's forward vector at frame_end, distance 5
    # (empirically checked with world_to_camera_view -- the first guess,
    # extrapolated blindly from the camera's location delta rather than its
    # actual view direction, landed off the bottom of frame at both ends).
    # "Blue grate light grows" across the whole 192-frame (8s) descent.
    glow2 = _place_grate("S8H_Underwater", "UW_Grate", (0.0, 3.805, -1.083), 1.5,
                          "Emission_UW_Grate", GRATE_BLUE, changes)
    if glow2 is not None:
        keys = generate_ramp_keys(1, 191, 0.0, 8.0)
        cb = channelbag_for(glow2.node_tree, 'nodes["Emission"].inputs[1].default_value', -1)
        set_curve(cb, 'nodes["Emission"].inputs[1].default_value', 0, keys, interp="LINEAR")


# =====================================================================
# Mailroom wet ring. Doc: "a laminate counter surface with a dark wet ring
# on it... spreads by a few millimetres" over the 120-frame (5s) range.
# A thin annular band, scaled up slightly over time -- simpler and more
# honest about the "few millimetres" magnitude than a shape key.
# =====================================================================
WETRING_MAT = "PhotorealArch_WetRing"
WETRING_LOC = (0.3, 3.75, 1.001)  # on MR_Counter's top (z=1.0) near where the package sits


def build_wetring_mesh():
    bm = bmesh.new()
    bm_add_ring_band(bm, (0.0, 0.0, 0.0), r_inner=0.045, r_outer=0.06, z0=0.0, z1=0.002,
                      n_sides=20, material_index=0, cap_top=True, cap_bottom=False)
    mesh = bpy.data.meshes.new("WetRingMesh")
    finalize(bm, type("_o", (), {"data": mesh})())
    return mesh


def ensure_wetring(apply, changes):
    sc = bpy.data.scenes.get("S8C_Mailroom")
    if sc is None:
        changes.append(("S8C_Mailroom", "wetring", "NO SCENE"))
        return
    if not apply:
        changes.append(("S8C_Mailroom", "wetring", "would build + place + scale"))
        return
    if WETRING_MAT not in bpy.data.materials:
        factories = _exec_text("material_factories.py")
        mat = factories["make_photoreal_material"](WETRING_MAT, (0.10, 0.09, 0.07), roughness=0.15,
                                                     use_normal_proc=False)
        aa._translucent(mat, 0.5)
    obj = sc.objects.get("MR_WetRing")
    if obj is None:
        mesh = bpy.data.meshes.get("WetRingMesh") or build_wetring_mesh()
        obj = bpy.data.objects.new("MR_WetRing", mesh)
        obj.data.materials.clear()
        obj.data.materials.append(bpy.data.materials[WETRING_MAT])
        sc.collection.objects.link(obj)
    obj.location = WETRING_LOC
    cb_x = channelbag_for(obj, "scale", 0)
    for i in range(3):
        set_curve(cb_x, "scale", i, [(1, 1.0), (120, 1.15)], interp="LINEAR")
    changes.append(("S8C_Mailroom", "wetring", "placed, spreads f1-120"))


# =====================================================================
# TH_Curtain's "Parted" shape key. The mesh is a flat 64-vert strip (16 X
# columns x [2 Y x 2 Z]), pleated only by alternating panel/fold-seam
# widths -- there's no real fold geometry to hinge, so "parts" is modeled
# as the two halves (split at x=0) sliding apart by 0.075m each, six
# inches (0.15m) total, matching the doc's "parted six inches" IMG_OUT.
#
# The curtain is "fabric of the building" in the GLOBAL STYLE BLOCK
# (docs/02 section 3 lists it under the PHOTOREAL layer, not low-poly
# company property), so this gets natural BEZIER easing -- C1's hard-linear
# rule is for low-poly owned props, not architectural fabric.
# =====================================================================
PART_OFFSET = 0.075
PART_RANGE = (1, 130)  # ramps open across most of the 144-frame (6s) range


def ensure_curtain_shapekey(apply, changes):
    sc = bpy.data.scenes.get("S3C_Threshold")
    if sc is None:
        changes.append(("S3C_Threshold", "curtain", "NO SCENE"))
        return
    obj = sc.objects.get("TH_Curtain")
    if obj is None:
        changes.append(("S3C_Threshold", "curtain", "NO TH_Curtain"))
        return
    if not apply:
        has_key = obj.data.shape_keys and "Parted" in obj.data.shape_keys.key_blocks
        changes.append(("S3C_Threshold", "curtain", "exists" if has_key else "would add Parted shape key + ramp"))
        return

    me = obj.data
    if me.shape_keys is None:
        obj.shape_key_add(name="Basis")
    if "Parted" not in me.shape_keys.key_blocks:
        sk = obj.shape_key_add(name="Parted", from_mix=False)
        for i, v in enumerate(me.vertices):
            dx = -PART_OFFSET if v.co.x < 0.0 else PART_OFFSET
            sk.data[i].co.x = v.co.x + dx
        sk.value = 0.0

    key = me.shape_keys
    cb = channelbag_for(key, 'key_blocks["Parted"].value', -1)
    keys = generate_ramp_keys(PART_RANGE[0], PART_RANGE[1] - PART_RANGE[0], 0.0, 1.0)
    set_curve(cb, 'key_blocks["Parted"].value', 0, keys, interp="BEZIER")
    changes.append(("S3C_Threshold", "curtain", "Parted shape key keyed f%d-%d" % PART_RANGE))


# =====================================================================
# Haze noise chains. The problem (per the plan): every haze material is a
# bare uniform-density Volume Scatter, so translating the object -- the
# obvious first move -- renders no visible change at all. The actual fix
# is inside the shader: a Mapping->Noise->MapRange chain feeding Density,
# with the Mapping's Location animated so the sampled noise pattern
# evolves over time. Only G_Haze and MR_Haze are in scope (the two named
# in the plan / called for by their scenes' KLING blocks); SR_Haze and
# PL_Haze are left alone.
# =====================================================================
HAZE_CHAINS = [
    # scene, material, base_density, drift_axis (0=X "left to right", 1=Y ambient), drift_units
    dict(scene="S5_H_ParkingGarage", mat="G_Haze", base_density=0.06, drift_axis=0, frame_end=168, drift_units=4.0),
    dict(scene="S8C_Mailroom", mat="MR_Haze", base_density=0.035, drift_axis=1, frame_end=120, drift_units=3.0),
]


def ensure_haze_chain(row, apply, changes):
    mat = bpy.data.materials.get(row["mat"])
    if mat is None or not mat.node_tree:
        changes.append((row["scene"], "haze", "NOT FOUND"))
        return
    if not apply:
        already = any(n.type == "TEX_NOISE" for n in mat.node_tree.nodes)
        changes.append((row["scene"], "haze", "exists" if already else "would add noise chain + drift"))
        return
    nt = mat.node_tree
    vs = next((n for n in nt.nodes if n.type == "VOLUME_SCATTER"), None)
    if vs is None:
        changes.append((row["scene"], "haze", "NO Volume Scatter node"))
        return
    if any(n.type == "TEX_NOISE" for n in nt.nodes):
        changes.append((row["scene"], "haze", "already has a noise chain"))
        return

    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.name = "HazeDrift"
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.5
    noise.inputs["Detail"].default_value = 2.0
    maprange = nt.nodes.new("ShaderNodeMapRange")
    maprange.inputs["From Min"].default_value = 0.0
    maprange.inputs["From Max"].default_value = 1.0
    maprange.inputs["To Min"].default_value = row["base_density"] * 0.4
    maprange.inputs["To Max"].default_value = row["base_density"] * 1.6
    maprange.clamp = True

    nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], maprange.inputs["Value"])
    nt.links.new(maprange.outputs["Result"], vs.inputs["Density"])

    axis = row["drift_axis"]
    keys = [(1, 0.0), (row["frame_end"], row["drift_units"])]
    path = 'nodes["%s"].inputs["Location"].default_value' % mapping.name
    cb = channelbag_for(nt, path, axis)
    set_curve(cb, path, axis, keys, interp="LINEAR")
    changes.append((row["scene"], "haze", "noise chain added, drifts axis=%d f1-%d" % (axis, row["frame_end"])))


def run(apply=False):
    changes = []

    ensure_atmosphere_assets(apply, changes)
    ensure_ut_figure(apply, changes)
    ensure_s3h_handprint(apply, changes)
    ensure_grates(apply, changes)
    ensure_wetring(apply, changes)
    ensure_curtain_shapekey(apply, changes)
    for row in HAZE_CHAINS:
        ensure_haze_chain(row, apply, changes)

    for scene_name, label, state in changes:
        print("%-10s %-24s %s" % (label, scene_name, state))

    counts = {}
    for _, label, _ in changes:
        counts[label] = counts.get(label, 0) + 1
    print("SUMMARY " + ", ".join("%s=%d" % kv for kv in sorted(counts.items())))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    apply = "--apply" in argv
    run(apply=apply)
    if apply:
        bpy.ops.wm.save_mainfile()
        print("SAVED %s" % bpy.data.filepath)
    else:
        print("DRY RUN -- nothing written. Re-run with -- --apply")
