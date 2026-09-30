# Motion pass, part 1 of 3 (camera_moves.py / scene_motion.py / motion_assets.py):
# frame ranges, camera moves, and the two C3 fixes for the 15 built scenes.
# The only script in the pass that can violate C3, since it is the only one
# that moves a camera. Land this alone and gate on verify_motion.py before
# touching scene_motion.py or motion_assets.py.
#
# Run headless (Blender must be CLOSED, or its unsaved state will be lost):
#     blender.exe -b <blend> -P camera_moves.py -- --apply
#     blender.exe -b <blend> -P camera_moves.py            # dry run
#
# Idempotent: every fcurve this script owns is fully replaced (remove then
# recreate) from the ROWS table below, so re-running with --apply always
# converges on the same result instead of stacking keys.
#
# Source: docs/02_GENERATION_HIGGSFIELD.md section 5 (per-scene KLING blocks
# give the doc-specified duration in seconds -> frame_end at 24fps) crossed
# against the live .blend (blender/anim_lib.py inspection, 2026-09-17): only
# S1_C_WaitingRoom, S5_H_ParkingGarage and SE_ASSIM_Boardroom carry existing
# camera animation, and all three aim via a TRACK_TO constraint to a static
# empty -- so translating the camera also rotates it, which is how both C3
# violations below happened in the first place.
#
# House timing convention (read off the three shipped curves before any fix):
# each one's last key sits PAST its render range, at a fairly consistent
# ~1.45x multiple (90->120, 90->130, 100->150). That means every rendered
# clip cuts while still easing in and never reaches the decelerating tail of
# the Bezier curve. Preserved here as KEY_SPAN_FACTOR for the two scenes that
# need their key span rescaled onto a new range (S5_H, SE_ASSIM). New moves
# authored from scratch in this pass (the five under MOVES) are one-shot,
# non-looping dollies per docs/02 and are keyed to land exactly on the
# doc-specified duration instead -- there is no "next loop iteration" for a
# hard cut to hide a decelerating tail from.

import bpy
import sys
import math

sys.path.insert(0, __file__.rsplit("\\", 1)[0] if "\\" in __file__ else __file__.rsplit("/", 1)[0])
from anim_lib import key_location, key_rotation_euler_axis, mirrored_location_keys

KEY_SPAN_FACTOR = 1.45

# --- Ranges only: doc-specified duration (seconds x 24fps), no new motion
# authored here. S5_H is listed here too even though its existing truck move
# gets its key span rescaled below -- "range only" describes camera_moves.py
# authoring no NEW shape for it, not that its file is untouched.
STATIC_RANGES = {
    "S3C_Threshold":   144,  # 6s, doc: "Static camera, 6 seconds."
    "S3_H_LobbyDoors": 144,  # 6s, doc: "Static camera, 6 seconds."
    "S5C_DeskVoid":     96,  # 4s, doc: "Static camera, 4 seconds."
    "S7C_Elevator":    144,  # 6s, doc: "6 seconds. ... Camera does not move."
    "S8C_Mailroom":    120,  # 5s, doc: "5 seconds." (mailroom half of S8_C)
    "S8H_Store":       144,  # 6s, doc: "6 seconds. Static camera on the storefront glass."
    # S0X_Apartment: doc gives no standalone duration -- it's the first half
    # of a two-part S0_X_VID edit with S0X_Street, deferred per the plan's
    # "S0_X_VID still needs a two-part edit" note. Left at its current range.
}

# --- New camera moves, authored from scratch. Every one keys all three
# location channels explicitly (even the axes that don't move) to match the
# three shipped pilot curves, and ends its last key exactly at frame_end --
# these are one-shot dollies with a real arrival, not loops keyed past their
# render range.
MOVES = [
    # 8s forward dolly toward the tower (doc: "Ends holding on the tower
    # base"). Y is the only axis that moves. Capped at y=+1.2 rather than the
    # y=+2.0 the doc's framing would suggest: clearance to SR_TrafficLight
    # falls to 1.70m by y=+2.0, uncomfortably close to the 1.5m floor once
    # the TrafficLight's own bounding-box corners (not just its origin) are
    # in play -- 1.2 keeps a real margin without shortening the shot enough
    # to read as a stall.
    dict(scene="S0X_Street", cam="SR_Cam", frame_end=192,
         loc_keys=[(1, (0.0, -3.335, 1.6)), (192, (0.0, 1.2, 1.6))]),

    # 3s dolly forward, independent of the low-poly figure's own translate
    # (scene_motion.py). Small, conservative travel -- verify_motion.py's
    # clearance sweep is the gate, not a hand measurement of the cubicle grid.
    dict(scene="S4C_Cubicles", cam="CB_Cam", frame_end=72,
         loc_keys=[(1, (0.0, 0.6, 1.6)), (72, (0.0, 1.3, 1.6))]),

    # 6s dolly forward down the corridor. The distant figure that must NOT
    # grow with the dolly gets pinned in motion_assets.py once it exists
    # (Phase 4) -- it isn't built yet, so it isn't handled here.
    #
    # x=-0.15 instead of 0.0: UT_Doors' nearest bbox corner sits at world
    # y=1.5, squarely on a centerline path (x=1.37, z=2.1 vs cam z=1.5 gives
    # a fixed sqrt(1.37^2+0.6^2)=1.496m floor at that y regardless of travel
    # distance -- shortening the dolly doesn't clear it, since the y-term is
    # ~0 right where it matters). A 0.15m sidestep away from the door wall
    # clears it to 1.63m with the full 6s of forward travel intact.
    dict(scene="S4H_Utility", cam="UT_Cam", frame_end=144,
         loc_keys=[(1, (-0.15, 0.5, 1.5)), (144, (-0.15, 1.8, 1.5))]),

    # 6s forward TIP, not a translate: "as if leaning" (doc). Location is
    # untouched; only the pitch (rotation_euler.x) increases its downward
    # tilt, from 57.11 deg to 48 deg. Downward is explicitly legal under C3
    # ("Elevators/stairs only descend") -- this is the inverse of the two
    # violations below, so it needs no target pin.
    dict(scene="S7H_Pool", cam="PL_Cam", frame_end=144,
         rot_keys=[(0, [(1, math.radians(57.11)), (144, math.radians(48.0))])]),

    # 8s descent toward the grate. Z decreases (legal: C3 forbids ascent, not
    # descent) with a small forward creep in Y toward the grate. UW_HandL/R
    # sit 0.2-0.5m off the lens and are excluded from the verify_motion.py
    # clearance sweep for this scene, not from the move itself.
    dict(scene="S8H_Underwater", cam="UW_Cam", frame_end=192,
         loc_keys=[(1, (0.0, -1.6, 0.9)), (192, (0.0, -1.0, 0.3))]),
]

# --- C3 fixes. Both are the same operation applied at the TRACK_TO target:
# give it the camera's exact location delta, frame-for-frame, which freezes
# the rotation the constraint would otherwise introduce (anim_lib.py's
# mirrored_location_keys -- the "pin rule").
C3_FIXES = [
    dict(
        scene="S1_C_WaitingRoom", cam="S1_Cam", frame_end=120,
        # S1_Cam's own keys are untouched: they already end at f120, which is
        # exactly the doc's 5s duration (docs/02: "Static camera, 5 second
        # loop" -- S1_C's dolly is a deliberate, approved departure from that,
        # not something this pass corrects).
        cam_keys_for_pin=[(1, (0.0, 0.2, 1.55)), (120, (0.0, 3.2, 1.5))],
        target="S1_CamTarget", target_base=(0.0, 8.5, 1.5),
    ),
    dict(
        scene="SE_ASSIM_Boardroom", cam="BR_Cam", frame_end=192,
        # Z flattened to a constant 1.15 (was 1.15 -> 1.371, a +0.22m rise --
        # the C3 violation). Y keeps its original -3.5m "dolly back" delta,
        # stretched onto the new, doc-specified 8s key span (see
        # KEY_SPAN_FACTOR below) so the boardroom's render range doesn't run
        # past where the dolly finishes moving.
        loc_keys=[(1, (0.0, 1.9, 1.15)), (278, (0.0, -1.6, 1.15))],
        cam_keys_for_pin=[(1, (0.0, 1.9, 1.15)), (278, (0.0, -1.6, 1.15))],
        target="BR_CamTarget", target_base=(0.0, 6.0, 0.87),
    ),
]

# --- Retime only: existing move kept exactly as shipped (no C3 issue, no
# shape change), key span rescaled onto the new range so the render doesn't
# run past the last authored key into a dead freeze. S5_H's keys currently
# end at f130 against this scene's old 90-frame range (ratio 1.444, in line
# with KEY_SPAN_FACTOR); rescaled onto the new 168-frame (7s) range that
# becomes round(168 * 1.45) = 244.
RETIME_ONLY = [
    dict(scene="S5_H_ParkingGarage", cam="G_Cam", frame_end=168,
         loc_keys=[(1, (-5.2, -2.5, 1.6)), (244, (-0.8, -2.5, 1.6))]),
]


def _set_frame_end(scene, new_end, changes, label):
    old = scene.frame_end
    if old == new_end:
        changes.append((scene.name, label, "range unchanged (%d)" % old))
    else:
        scene.frame_end = new_end
        changes.append((scene.name, label, "range %d -> %d" % (old, new_end)))


def run(apply=False):
    changes = []

    for scene_name, new_end in STATIC_RANGES.items():
        sc = bpy.data.scenes.get(scene_name)
        if sc is None:
            changes.append((scene_name, "range", "NO SCENE"))
            continue
        if not apply:
            changes.append((scene_name, "range", "would set range -> %d (currently %d)" % (new_end, sc.frame_end)))
            continue
        _set_frame_end(sc, new_end, changes, "range")

    for row in MOVES:
        sc = bpy.data.scenes.get(row["scene"])
        if sc is None:
            changes.append((row["scene"], "move", "NO SCENE"))
            continue
        cam = sc.objects.get(row["cam"])
        if cam is None:
            changes.append((row["scene"], "move", "NO CAMERA %r" % row["cam"]))
            continue
        if not apply:
            kind = "location" if "loc_keys" in row else "rotation"
            changes.append((row["scene"], "move", "would key %s, range -> %d" % (kind, row["frame_end"])))
            continue
        if "loc_keys" in row:
            key_location(cam, row["loc_keys"])
        if "rot_keys" in row:
            for axis, keys in row["rot_keys"]:
                key_rotation_euler_axis(cam, axis, keys)
        _set_frame_end(sc, row["frame_end"], changes, "move")

    for row in RETIME_ONLY:
        sc = bpy.data.scenes.get(row["scene"])
        if sc is None:
            changes.append((row["scene"], "retime", "NO SCENE"))
            continue
        cam = sc.objects.get(row["cam"])
        if cam is None:
            changes.append((row["scene"], "retime", "NO CAMERA %r" % row["cam"]))
            continue
        if not apply:
            changes.append((row["scene"], "retime", "would rescale key span, range -> %d" % row["frame_end"]))
            continue
        key_location(cam, row["loc_keys"])
        _set_frame_end(sc, row["frame_end"], changes, "retime")

    for row in C3_FIXES:
        sc = bpy.data.scenes.get(row["scene"])
        if sc is None:
            changes.append((row["scene"], "C3 fix", "NO SCENE"))
            continue
        cam = sc.objects.get(row["cam"])
        target = sc.objects.get(row["target"])
        if cam is None or target is None:
            changes.append((row["scene"], "C3 fix", "NO CAMERA/TARGET (%s/%s)" % (cam, target)))
            continue
        if not apply:
            changes.append((row["scene"], "C3 fix", "would pin %s, range -> %d" % (row["target"], row["frame_end"])))
            continue
        if "loc_keys" in row:
            key_location(cam, row["loc_keys"])
        target_keys = mirrored_location_keys(row["target_base"], row["cam_keys_for_pin"])
        key_location(target, target_keys)
        _set_frame_end(sc, row["frame_end"], changes, "C3 fix")

    for scene_name, label, state in changes:
        print("%-10s %-24s %s" % (label, scene_name, state))

    counts = {}
    for _, label, state in changes:
        key = "would " + label if not apply else label
        counts[key] = counts.get(key, 0) + 1
    print("SUMMARY " + ", ".join("%s=%d" % kv for kv in sorted(counts.items())))
    print("ROWS: %d static ranges, %d moves, %d retime-only, %d C3 fixes"
          % (len(STATIC_RANGES), len(MOVES), len(RETIME_ONLY), len(C3_FIXES)))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    apply = "--apply" in argv
    run(apply=apply)
    if apply:
        bpy.ops.wm.save_mainfile()
        print("SAVED %s" % bpy.data.filepath)
    else:
        print("DRY RUN -- nothing written. Re-run with -- --apply")
