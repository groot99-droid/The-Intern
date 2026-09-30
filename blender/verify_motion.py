# Motion pass gate: C3, clearance, pin accuracy, non-empty motion. Seconds,
# no rendering -- run this before every full render pass, not after.
#
# Run: blender.exe -b <blend> -P verify_motion.py
#      blender.exe -b <blend> -P verify_motion.py -- --scenes S1_C_WaitingRoom,S5_H_ParkingGarage
#
# Exits non-zero on any failure, so it composes as a CI-style gate.

import bpy
import sys
import math
import mathutils

# scene -> animated camera. Anything not in this dict is assumed static and
# is not swept for C3/pin (there is nothing to violate), but IS still swept
# for the non-empty-motion check in reverse: it must NOT have picked up
# accidental keys.
ANIMATED_CAMERAS = {
    "S0X_Street":         "SR_Cam",
    "S4C_Cubicles":       "CB_Cam",
    "S4H_Utility":        "UT_Cam",
    "S7H_Pool":           "PL_Cam",
    "S8H_Underwater":     "UW_Cam",
    "S1_C_WaitingRoom":   "S1_Cam",
    "S5_H_ParkingGarage": "G_Cam",
    "SE_ASSIM_Boardroom": "BR_Cam",
}

STATIC_SCENES = [
    "S0X_Apartment", "S3C_Threshold", "S3_H_LobbyDoors", "S5C_DeskVoid",
    "S7C_Elevator", "S8C_Mailroom", "S8H_Store",
]

# scene -> [target object names] that must hold constant projected framing
# (the "pin rule": q = R^-1(P - C) constant across the whole animation).
# Covers both C3-fix TRACK_TO targets (camera_moves.py) and the prop pins
# added later (scene_motion.py's S8_H hands, motion_assets.py's S4_H figure).
PINNED_TARGETS = {
    "S1_C_WaitingRoom":   ["S1_CamTarget"],
    "SE_ASSIM_Boardroom": ["BR_CamTarget"],
    "S8H_Underwater":     ["UW_HandL", "UW_HandR"],
    "S4H_Utility":        ["UT_Figure_Inst"],
}

# scene -> objects to exclude from the clearance sweep, because they are
# deliberately close to the lens by design, not a collision.
CLEARANCE_EXCLUDE = {
    "S8H_Underwater": ["UW_HandL", "UW_HandR"],
}

# Any C3 exemption must be a visible entry here, never a hidden tolerance.
# Empty on purpose: both known violations were fixed, not exempted.
ALLOW_PITCH_UP_DEG = {}

MIN_CLEARANCE = 1.5
PIN_TOLERANCE = 1e-4
C3_TOLERANCE_DEG = 0.05   # float/interpolation jitter allowance, not headroom
C3_TOLERANCE_M = 0.001
ROLL_TOLERANCE_DEG = 0.5
MOTION_EPSILON = 1e-3     # min combined location+rotation delta to count as "moved"


def load_helpers():
    text = bpy.data.texts.get("helpers.py")
    if text is None:
        raise RuntimeError("helpers.py Text datablock not found in .blend -- "
                            "the .blend copy is authoritative, re-export if missing")
    ns = {}
    exec(compile(text.as_string(), "helpers.py", "exec"), ns)
    return ns["check_camera_clearance"]


def evaluated_state(cam, dg):
    mw = cam.evaluated_get(dg).matrix_world
    loc = mw.translation
    fwd = (mw.to_3x3() @ mathutils.Vector((0.0, 0.0, -1.0))).normalized()
    right = (mw.to_3x3() @ mathutils.Vector((1.0, 0.0, 0.0))).normalized()
    pitch_deg = math.degrees(math.asin(max(-1.0, min(1.0, fwd.z))))
    roll_deg = math.degrees(math.asin(max(-1.0, min(1.0, right.z))))
    return loc, pitch_deg, roll_deg


def compute_q(cam, target, dg):
    cam_mw = cam.evaluated_get(dg).matrix_world
    C = cam_mw.translation
    R = cam_mw.to_3x3()
    P = target.evaluated_get(dg).matrix_world.translation
    return R.inverted() @ (P - C)


def check_scene(scname, cam_name, check_camera_clearance, dg, failures):
    sc = bpy.data.scenes.get(scname)
    if sc is None:
        failures.append("%s: SCENE NOT FOUND" % scname)
        return
    cam = sc.objects.get(cam_name)
    if cam is None:
        failures.append("%s: CAMERA %r NOT FOUND" % (scname, cam_name))
        return

    bpy.context.window.scene = sc
    exclude = CLEARANCE_EXCLUDE.get(scname, [])
    pinned = [sc.objects.get(n) for n in PINNED_TARGETS.get(scname, [])]
    allow_up = ALLOW_PITCH_UP_DEG.get(scname, 0.0)

    prev_loc = prev_pitch = None
    first_loc = first_pitch = None
    first_q = {t.name: None for t in pinned if t}
    worst_clearance = (float("inf"), None, None)
    frame0_state = None
    frame_last_state = None

    for f in range(sc.frame_start, sc.frame_end + 1):
        sc.frame_set(f)
        dg.update()

        loc, pitch, roll = evaluated_state(cam, dg)
        if first_loc is None:
            first_loc, first_pitch = loc.copy(), pitch
        if prev_loc is not None:
            dz = loc.z - prev_loc.z
            if dz > C3_TOLERANCE_M:
                failures.append("%s f%d: C3 z rose by %.4fm frame-over-frame" % (scname, f, dz))
            dpitch = pitch - prev_pitch
            if dpitch > (C3_TOLERANCE_DEG + allow_up):
                failures.append("%s f%d: C3 pitch rose by %.3fdeg frame-over-frame" % (scname, f, dpitch))
        if pitch - first_pitch > (C3_TOLERANCE_DEG + allow_up):
            failures.append("%s f%d: C3 pitch %.3fdeg exceeds start %.3fdeg" % (scname, f, pitch, first_pitch))
        if loc.z - first_loc.z > C3_TOLERANCE_M:
            failures.append("%s f%d: C3 z %.4fm exceeds start %.4fm" % (scname, f, loc.z, first_loc.z))
        if abs(roll) > ROLL_TOLERANCE_DEG:
            failures.append("%s f%d: C3 roll %.3fdeg (expected ~0)" % (scname, f, roll))
        prev_loc, prev_pitch = loc, pitch

        ok, dist, name = check_camera_clearance(sc, loc, min_required=MIN_CLEARANCE, exclude=exclude)
        if dist < worst_clearance[0]:
            worst_clearance = (dist, name, f)
        if not ok:
            failures.append("%s f%d: clearance %.2fm to %s (min %.2fm)" % (scname, f, dist, name, MIN_CLEARANCE))

        for t in pinned:
            if t is None:
                continue
            q = compute_q(cam, t, dg)
            if first_q[t.name] is None:
                first_q[t.name] = q
            else:
                dev = (q - first_q[t.name]).length
                if dev > PIN_TOLERANCE:
                    failures.append("%s f%d: pin %s deviates %.6f (tol %.6f)" % (scname, f, t.name, dev, PIN_TOLERANCE))

        if f == sc.frame_start:
            frame0_state = (loc.copy(), pitch, roll)
        if f == sc.frame_end:
            frame_last_state = (loc.copy(), pitch, roll)

    if frame0_state and frame_last_state:
        (l0, p0, r0), (l1, p1, r1) = frame0_state, frame_last_state
        delta = (l1 - l0).length + abs(p1 - p0) + abs(r1 - r0)
        if delta < MOTION_EPSILON:
            failures.append("%s: NO MOTION -- frame_start and frame_end are identical "
                             "(keys authored entirely beyond the render range?)" % scname)

    print("%-24s cam=%-10s worst clearance %.2fm to %-20s at f%s" % (
        scname, cam_name, worst_clearance[0], worst_clearance[1], worst_clearance[2]))


def check_static_scene(scname, failures):
    sc = bpy.data.scenes.get(scname)
    if sc is None:
        failures.append("%s: SCENE NOT FOUND" % scname)
        return
    cam = sc.camera
    if cam is None:
        return
    ad = cam.animation_data
    if ad and ad.action:
        failures.append("%s: expected static, camera %r has action %r" % (scname, cam.name, ad.action.name))
    print("%-24s static, no camera action (ok)" % scname)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    only = None
    if "--scenes" in argv:
        only = set(argv[argv.index("--scenes") + 1].split(","))

    check_camera_clearance = load_helpers()
    dg = bpy.context.evaluated_depsgraph_get()
    failures = []

    for scname, cam_name in ANIMATED_CAMERAS.items():
        if only and scname not in only:
            continue
        check_scene(scname, cam_name, check_camera_clearance, dg, failures)

    for scname in STATIC_SCENES:
        if only and scname not in only:
            continue
        check_static_scene(scname, failures)

    print()
    if failures:
        print("FAIL: %d issue(s)" % len(failures))
        for f in failures:
            print("  -", f)
        return 1
    print("PASS: all checks clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
