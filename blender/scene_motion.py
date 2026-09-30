# Motion pass, part 2 of 3: non-camera motion that needs no new assets --
# light flicker, emission cycles/ramps, a swinging bulb, and two hard-linear
# translates (the S4_C manager, the S8_C package). Everything here targets
# objects/materials that already exist in the .blend; motion that needs a
# new asset first (curtain shape key, S4_H figure, S7_H/S8_H grate, mailroom
# wet ring, haze noise chains) is motion_assets.py's job (Phase 4), not this
# file's.
#
# Run headless (Blender must be CLOSED, or its unsaved state will be lost):
#     blender.exe -b <blend> -P scene_motion.py -- --apply
#     blender.exe -b <blend> -P scene_motion.py            # dry run
#
# Idempotent: every fcurve this script owns is fully replaced from the ROWS
# tables below (same pattern as camera_moves.py / anim_lib.set_curve).
#
# Source: docs/02_GENERATION_HIGGSFIELD.md section 5, crossed against the
# live .blend (2026-09-18 inspection) for real object/material names. Where
# the doc describes motion this pass explicitly does NOT cover -- dust,
# haze drift, the curtain parting, the S3_H handprint fade (no handprint
# object exists yet, not just no shape key), the boardroom stain spreading,
# S4_H's steam, S7_H's falling concrete grains, S7_C's indicator digits (a
# multi-character display, not a strength toggle) -- it's called out below
# rather than silently skipped.

import bpy
import sys
import math

sys.path.insert(0, __file__.rsplit("\\", 1)[0] if "\\" in __file__ else __file__.rsplit("/", 1)[0])
from anim_lib import (
    key_location, channelbag_for, set_curve,
    generate_ramp_keys, generate_cycle_keys, generate_flicker_keys, generate_damped_sine_keys,
)

# --- translate: hard linear (C1 forbids easing low-poly props), matching
# the KLING prompt's own language ("no gait, no bob", "is slid").
TRANSLATES = [
    dict(scene="S4C_Cubicles", obj="CB_Manager_Inst", frame_end=72,
         # Doc: "translates toward camera on a hard linear path... figure
         # now close to camera, papers extended toward lens." Camera ends
         # its own dolly at y=1.3 (camera_moves.py); the figure closes much
         # faster, ending 0.9m past it in y, which is the "close to camera"
         # beat, not a clearance bug -- CB_Manager_Inst is a collection
         # instance (EMPTY), so helpers.min_clearance's mesh-only scan
         # never sees it.
         keys=[(1, (0.0, 7.5, 0.0)), (72, (0.0, 2.2, 0.0))]),
    dict(scene="S8C_Mailroom", obj="MR_Package_Inst", frame_end=120,
         # Doc: "package is slid across the counter toward camera." Camera
         # sits at y=0.8; slides from near the clerk (y=3.7) to within
         # reach of the counter edge (y=1.6). x/z held (counter surface).
         keys=[(1, (0.3, 3.7, 1.1)), (120, (0.3, 1.6, 1.1))]),
]

# --- pin: S8_H's hands must hold their fixed pose in frame while the camera
# descends (doc: "remain in one fixed pose, do not animate... do not add
# swimming motion"). Mirrors UW_Cam's location delta from camera_moves.py
# exactly (the same operation as the two C3 target pins, applied to props
# instead of a TRACK_TO target).
PINS = [
    dict(scene="S8H_Underwater", obj="UW_HandL", base=(-0.15, -0.639027, 0.573356), cam="UW_Cam"),
    dict(scene="S8H_Underwater", obj="UW_HandR", base=(0.15, -0.639027, 0.573356), cam="UW_Cam"),
]
# The camera keys to mirror -- duplicated from camera_moves.py's S8H_Underwater
# row rather than imported, so this file has no load-order dependency on it.
UW_CAM_KEYS = [(1, (0.0, -1.6, 0.9)), (192, (0.0, -1.0, 0.3))]

# --- emission_ramp: a single hard LINEAR ramp, then CONSTANT-extrapolation
# holds the end value. "hard, no fade curve, like a CRT" (doc) is the reason
# for LINEAR instead of the cycle's BEZIER.
EMISSION_RAMPS = [
    dict(scene="S5C_DeskVoid", mat="Emission_DV_Screen", frame_end=96,
         # 0.4s wake, black to its authored strength (4.0), at 24fps = ~10 frames.
         ramp_frames=10, value_from=0.0, value_to=4.0),
]

# --- emission_cycle: a regular (not random) pulse, BEZIER for a smooth
# breathing flicker -- the sign's own doc language is "flickers on a 2.3
# second cycle", a period, not an irregular strobe.
EMISSION_CYCLES = [
    dict(scene="S3C_Threshold", mat="Emission_TH_EnterSign", frame_end=144,
         period_frames=int(2.3 * 24), value_lo=0.0, value_hi=3.5),
]

# --- light_flicker: seeded RNG, hard CONSTANT snaps. Two independent seeds
# for S4_C's two "independent irregular cycles" (doc), split by row parity
# so the two halves of the grid visibly desync.
CB_FLUOR_GROUP_A = ["CB_Fluor_0_0", "CB_Fluor_0_1", "CB_Fluor_0_2",
                     "CB_Fluor_2_0", "CB_Fluor_2_1", "CB_Fluor_2_2"]
CB_FLUOR_GROUP_B = ["CB_Fluor_1_0", "CB_Fluor_1_1", "CB_Fluor_1_2",
                     "CB_Fluor_3_0", "CB_Fluor_3_1", "CB_Fluor_3_2"]

LIGHT_FLICKERS = [
    # (scene, [light names], frame_end, base_energy, seed, period_range)
    dict(scene="S4C_Cubicles", lights=CB_FLUOR_GROUP_A, frame_end=72, base=40.0,
         seed=401, period_range=(15, 35)),
    dict(scene="S4C_Cubicles", lights=CB_FLUOR_GROUP_B, frame_end=72, base=40.0,
         seed=402, period_range=(15, 35)),
    # "one at the far end strobes irregularly" -- G_Sodium_2 (y=11.5) is the
    # farthest of the three sodium points from the camera's y<=−0.8 travel.
    dict(scene="S5_H_ParkingGarage", lights=["G_Sodium_2"], frame_end=168, base=260.0,
         seed=501, period_range=(30, 60)),
    # "flickers twice, irregularly" -- explicit two-event list below
    # (LIGHT_FLICKERS_EXPLICIT), not the periodic generator.
]

# Explicit, non-periodic flicker: an exact event count ("twice"), not a
# generated cycle -- hardcoded frames rather than dressing up a fixed count
# as if it were randomly generated.
LIGHT_FLICKERS_EXPLICIT = [
    dict(scene="S8H_Store", lights=["ST_Fluor_-2.0", "ST_Fluor_0.0", "ST_Fluor_2.0"],
         base=60.0, low_frac=0.1, events_frames=[45, 95], dip_width=2, frame_end=144),
]

# --- swing: damped sinusoid on the elevator's caged bulb after door-close
# impact (doc: "swings a few centimetres from the impact and settles").
# Offsets the light's existing X location; Y/Z untouched.
SWINGS = [
    dict(scene="S7C_Elevator", obj="EL_Overhead", axis=0, frame_end=144,
         amplitude=0.06, decay_per_frame=0.035, period_frames=14),
]


def _apply_translate(row, changes):
    sc = bpy.data.scenes.get(row["scene"])
    obj = sc.objects.get(row["obj"]) if sc else None
    if obj is None:
        changes.append((row["scene"], "translate", row["obj"], "NOT FOUND"))
        return
    key_location(obj, row["keys"], interp="LINEAR")
    changes.append((row["scene"], "translate", row["obj"], "keyed (LINEAR)"))


def _apply_pin(row, changes):
    from anim_lib import mirrored_location_keys
    sc = bpy.data.scenes.get(row["scene"])
    obj = sc.objects.get(row["obj"]) if sc else None
    if obj is None:
        changes.append((row["scene"], "pin", row["obj"], "NOT FOUND"))
        return
    keys = mirrored_location_keys(row["base"], UW_CAM_KEYS)
    key_location(obj, keys, interp="BEZIER")
    changes.append((row["scene"], "pin", row["obj"], "keyed (mirrors %s)" % row["cam"]))


def _apply_emission_ramp(row, changes):
    mat = bpy.data.materials.get(row["mat"])
    if not mat or not mat.node_tree:
        changes.append((row["scene"], "emission_ramp", row["mat"], "NOT FOUND"))
        return
    keys = generate_ramp_keys(1, row["ramp_frames"], row["value_from"], row["value_to"])
    # bootstrap_index=-1: Strength is a scalar float input, not an array --
    # Blender's keyframe_insert requires -1 for non-array properties, even
    # though the resulting fcurve is still addressed at array_index 0.
    cb = channelbag_for(mat.node_tree, 'nodes["Emission"].inputs[1].default_value', -1)
    set_curve(cb, 'nodes["Emission"].inputs[1].default_value', 0, keys, interp="LINEAR")
    changes.append((row["scene"], "emission_ramp", row["mat"], "keyed (LINEAR, %d frames)" % row["ramp_frames"]))


def _apply_emission_cycle(row, changes):
    mat = bpy.data.materials.get(row["mat"])
    if not mat or not mat.node_tree:
        changes.append((row["scene"], "emission_cycle", row["mat"], "NOT FOUND"))
        return
    keys = generate_cycle_keys(1, row["frame_end"], row["period_frames"], row["value_lo"], row["value_hi"])
    cb = channelbag_for(mat.node_tree, 'nodes["Emission"].inputs[1].default_value', -1)
    set_curve(cb, 'nodes["Emission"].inputs[1].default_value', 0, keys, interp="BEZIER")
    changes.append((row["scene"], "emission_cycle", row["mat"], "keyed (%d keys)" % len(keys)))


def _apply_light_flicker(scene_name, light_name, keys, changes):
    sc = bpy.data.scenes.get(scene_name)
    light = sc.objects.get(light_name) if sc else None
    if light is None or light.type != 'LIGHT':
        changes.append((scene_name, "light_flicker", light_name, "NOT FOUND"))
        return
    cb = channelbag_for(light.data, "energy", -1)
    set_curve(cb, "energy", 0, keys, interp="CONSTANT")
    changes.append((scene_name, "light_flicker", light_name, "keyed (%d keys)" % len(keys)))


def _apply_swing(row, changes):
    sc = bpy.data.scenes.get(row["scene"])
    obj = sc.objects.get(row["obj"]) if sc else None
    if obj is None:
        changes.append((row["scene"], "swing", row["obj"], "NOT FOUND"))
        return
    base = obj.location[row["axis"]]
    offsets = generate_damped_sine_keys(1, row["frame_end"], row["amplitude"],
                                         row["decay_per_frame"], row["period_frames"])
    keys = [(f, base + off) for f, off in offsets]
    cb = channelbag_for(obj, "location", row["axis"])
    set_curve(cb, "location", row["axis"], keys, interp="BEZIER")
    changes.append((row["scene"], "swing", row["obj"], "keyed (%d keys, settles by f%d)" % (len(keys), row["frame_end"])))


def run(apply=False):
    changes = []

    for row in TRANSLATES:
        if not apply:
            changes.append((row["scene"], "translate", row["obj"], "would key (LINEAR)"))
            continue
        _apply_translate(row, changes)

    for row in PINS:
        if not apply:
            changes.append((row["scene"], "pin", row["obj"], "would key (mirrors %s)" % row["cam"]))
            continue
        _apply_pin(row, changes)

    for row in EMISSION_RAMPS:
        if not apply:
            changes.append((row["scene"], "emission_ramp", row["mat"], "would key"))
            continue
        _apply_emission_ramp(row, changes)

    for row in EMISSION_CYCLES:
        if not apply:
            changes.append((row["scene"], "emission_cycle", row["mat"], "would key"))
            continue
        _apply_emission_cycle(row, changes)

    for row in LIGHT_FLICKERS:
        for light_name in row["lights"]:
            if not apply:
                changes.append((row["scene"], "light_flicker", light_name, "would key (seed=%d)" % row["seed"]))
                continue
            keys = generate_flicker_keys(row["seed"], 1, row["frame_end"], row["base"],
                                          period_range=row["period_range"])
            _apply_light_flicker(row["scene"], light_name, keys, changes)

    for row in LIGHT_FLICKERS_EXPLICIT:
        for light_name in row["lights"]:
            if not apply:
                changes.append((row["scene"], "light_flicker", light_name, "would key (explicit events)"))
                continue
            base = row["base"]
            keys = [(1, base)]
            for f in row["events_frames"]:
                keys.append((max(1, f - 1), base))
                keys.append((f, base * row["low_frac"]))
                keys.append((min(row["frame_end"], f + row["dip_width"]), base))
            _apply_light_flicker(row["scene"], light_name, keys, changes)

    for row in SWINGS:
        if not apply:
            changes.append((row["scene"], "swing", row["obj"], "would key"))
            continue
        _apply_swing(row, changes)

    for scene_name, label, name, state in changes:
        print("%-14s %-24s %-24s %s" % (label, scene_name, name, state))

    counts = {}
    for _, label, _, _ in changes:
        key = ("would " + label) if not apply else label
        counts[key] = counts.get(key, 0) + 1
    print("SUMMARY " + ", ".join("%s=%d" % kv for kv in sorted(counts.items())))
    print("DESCOPED (needs a new asset -- see motion_assets.py / Phase 4, or flagged as a gap): "
          "S3_C curtain parting, S3_H handprint fade (no handprint object exists), "
          "S4_H steam, S4/S5/S8_C dust, S5_H haze drift, S7_C indicator digits, "
          "S7_H falling concrete grains, S8_C wet-ring spread, S8_C boardroom stain spread.")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    apply = "--apply" in argv
    run(apply=apply)
    if apply:
        bpy.ops.wm.save_mainfile()
        print("SAVED %s" % bpy.data.filepath)
    else:
        print("DRY RUN -- nothing written. Re-run with -- --apply")
