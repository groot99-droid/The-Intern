# Track C: atmospheric curation. Six motif families, each with a fixed count
# and a placement rule -- curated, not scattered. Objects are placed as
# collection-instance empties so one mesh edit cascades everywhere, the same
# pattern the 12 boardroom figures already use.
#
# Run headless (Blender must be CLOSED, or its unsaved state will be lost):
#     blender.exe -b <blend> -P atmosphere_pass.py -- --apply
#     blender.exe -b <blend> -P atmosphere_pass.py            # dry run
#
# Idempotent: every instance is keyed by name, so a second run reports
# "exists" instead of stacking duplicates. --replace repositions existing
# ones to the coordinates below (for tuning after a spot render).
#
# Canon this serves:
#   C8 "It is the same clock" -- one Clock collection, six instances, never
#      two in frame, never lit specially, each placement less architecturally
#      plausible than the last.
#   Doc 1's count: 99 slips issued, exactly one per scene after S1, always
#      face-up, and the hundredth waits on the empty chair in the boardroom.
#
# Placement coordinates were read off world-space bounding boxes of the
# world-baked geometry (walls, floors, glass, counters). Cars and chairs
# carry real object transforms, so anything anchored to them is offset from
# the object's location instead of its bound box.

import bpy
import sys

# family -> list of (scene, instance_name, collection, location, rotation_deg)
CLOCKS = [
    # S1_C already has S1_Clock_Inst on the back wall at (0, 8.95, 2.60) --
    # the one correct, unremarkable placement. S3_H reuses the S1 set, so it
    # shows the same clock from the other side; that is not a 7th placement.
    # From here each one is harder to justify architecturally, and nobody
    # ever remarks on it.
    # 1. Correct: far wall of the cubicle floor, above the grid.
    ("S4C_Cubicles", "CB_Clock_Inst", "Clock", (0.0, 15.90, 2.35), (90, 0, 0)),
    # 2. Wrong: at the edge of the light pool, with no wall behind it.
    ("S5C_DeskVoid", "DV_Clock_Inst", "Clock", (1.50, 2.40, 1.05), (90, 0, 0)),
    # 3. Wrong: inside the elevator cab, opposite the button panel.
    ("S7C_Elevator", "EL_Clock_Inst", "Clock", (-0.55, 1.97, 1.20), (90, 0, 0)),
    # 4. Impossible: hanging in the mailroom fog, no wall for forty metres.
    ("S8C_Mailroom", "MR_Clock_Inst", "Clock", (1.40, 9.50, 2.40), (90, 0, 0)),
    # 5. The boardroom, where it is the only object the glass table does not
    #    reflect (see NO_REFLECTION below).
    ("SE_ASSIM_Boardroom", "BR_Clock_Inst", "Clock", (0.0, 11.90, 2.45), (90, 0, 0)),
]

# The hundredth slip, and the chair that holds it. Both used to sit at
# y=1.5 -- BEHIND BR_Cam (y=1.9, looking away down the table), so the empty
# chair and the payoff of the whole 99->100 motif never appeared in the
# boardroom shot at all. Moved to the head of the table, facing back down it
# at the twelve seated figures and the camera.
#
# The slip does NOT go on the seat: from this camera the sight line to a
# seat at the head passes under the table top (z=0.79) around y=10, so a
# slip there is perfectly in frame and completely invisible. It goes on the
# glass directly in front of the chair instead -- the place set for someone
# who is not there, which is the same beat and can actually be seen.
HEAD_OF_TABLE = [
    # scene, object name, location, rotation(deg). These are real mesh/empty
    # objects that already exist, so this moves them rather than adding.
    ("SE_ASSIM_Boardroom", "BR_EmptyChair",     (0.0, 10.75, 0.0),  (0, 0, -90)),
    # Off the centre line: the soggy package sits dead centre at y=6.0 and
    # blocks the sight line to anything behind it at x=0.
    ("SE_ASSIM_Boardroom", "BR_PaperSlip_Inst", (0.45, 9.62, 0.80), (0, 0, 6)),
]

# Exactly one slip per scene after S1. Face-up (rotation flat), legible.
SLIPS = [
    # The threshold camera is tilted slightly UP and never sees its own
    # floor, so "at the curtain's foot" cannot read -- this one is caught in
    # a fold of the pooling fabric instead, at the lowest height that is
    # actually in frame.
    ("S3C_Threshold",      "TH_Slip_Inst",   "PaperSlip", (0.42, 4.30, 0.62), (0, 0, 24)),
    ("S3_H_LobbyDoors",    "S3H_Slip_Inst",  "PaperSlip", (-0.60, 0.55, 0.02), (0, 0, -37)),
    ("S4C_Cubicles",       "CB_Slip_Inst",   "PaperSlip", (0.55, 6.00, 0.02), (0, 0, 12)),
    ("S4H_Utility",        "UT_Slip_Inst",   "PaperSlip", (0.50, 4.90, 0.02), (0, 0, -61)),
    # On the desk, beside the stapler -- the only one at hand height.
    ("S5C_DeskVoid",       "DV_Slip_Inst",   "PaperSlip", (-0.38, 0.05, 0.735), (0, 0, 8)),
    # Wet, at the edge of the nearest car (G_Car_Sedan sits at x=-2.2, y=7.2).
    ("S5_H_ParkingGarage", "G_Slip_Inst",    "PaperSlip", (-3.40, 6.10, 0.02), (0, 0, 74)),
    # The cab is only 2m deep and the camera is a 16mm tilted well down, so
    # the visible floor is the strip from about y=1.2 to the back wall.
    ("S7C_Elevator",       "EL_Slip_Inst",   "PaperSlip", (0.45, 1.60, 0.02), (0, 0, -15)),
    # On the concrete edge over the water, at the far lip -- the near lip is
    # below the frame under that 13mm lens.
    ("S7H_Pool",           "PL_Slip_Inst",   "PaperSlip", (0.55, -0.25, 0.015), (0, 0, 40)),
    ("S8C_Mailroom",       "MR_Slip_Inst",   "PaperSlip", (0.75, 3.75, 1.015), (0, 0, -22)),
    ("S8H_Store",          "ST_Slip_Inst",   "PaperSlip", (-1.20, 2.40, 0.02), (0, 0, 53)),
    # Suspended in the water, not sinking. The only slip that is not lying
    # on something.
    ("S8H_Underwater",     "UW_Slip_Inst",   "PaperSlip", (0.40, 0.90, 0.62), (14, 0, 31)),
]

# Doc 1 §3 C8's last turn of the screw: in the boardroom the clock is the one
# object the glass table does not reflect. EEVEE honours per-object ray
# visibility, so this is a real render behaviour, not a note in a file.
NO_REFLECTION = ["BR_Clock_Inst"]


def _ensure_instance(scene, name, collection_name, loc, rot_deg, replace):
    from math import radians
    coll = bpy.data.collections.get(collection_name)
    if coll is None:
        return "NO COLLECTION %r" % collection_name

    obj = scene.objects.get(name)
    if obj is not None:
        if not replace:
            return "exists"
        obj.location = loc
        obj.rotation_euler = [radians(a) for a in rot_deg]
        return "moved"

    obj = bpy.data.objects.new(name, None)
    obj.instance_type = "COLLECTION"
    obj.instance_collection = coll
    obj.empty_display_size = 0.25
    obj.location = loc
    obj.rotation_euler = [radians(a) for a in rot_deg]
    scene.collection.objects.link(obj)
    return "added"


def run(apply=False, replace=False):
    changes = []
    for family, rows in (("clock", CLOCKS), ("slip", SLIPS)):
        for scene_name, name, coll_name, loc, rot in rows:
            scene = bpy.data.scenes.get(scene_name)
            if scene is None:
                changes.append((family, scene_name, name, "NO SCENE"))
                continue
            if not apply:
                state = "exists" if scene.objects.get(name) else "would add"
                changes.append((family, scene_name, name, state))
                continue
            changes.append((family, scene_name, name, _ensure_instance(scene, name, coll_name, loc, rot, replace)))

    if apply:
        from math import radians
        for scene_name, obj_name, loc, rot in HEAD_OF_TABLE:
            scene = bpy.data.scenes.get(scene_name)
            obj = scene.objects.get(obj_name) if scene else None
            if obj is None:
                changes.append(("head", scene_name, obj_name, "NOT FOUND"))
                continue
            obj.location = loc
            obj.rotation_euler = [radians(a) for a in rot]
            changes.append(("head", scene_name, obj_name, "moved to head of table"))

        for name in NO_REFLECTION:
            for scene in bpy.data.scenes:
                obj = scene.objects.get(name)
                if obj is None:
                    continue
                for attr in ("visible_glossy", "visible_transmission"):
                    if hasattr(obj, attr):
                        setattr(obj, attr, False)
                changes.append(("clock", scene.name, name, "no-reflection flags set"))

    for family, scene_name, name, state in changes:
        print("%-6s %-22s %-18s %s" % (family, scene_name, name, state))

    counts = {}
    for family, _, _, state in changes:
        counts[state] = counts.get(state, 0) + 1
    print("SUMMARY " + ", ".join("%s=%d" % kv for kv in sorted(counts.items())))

    # Canon check: the clock is one collection, instanced, never duplicated
    # into separate meshes.
    total_clocks = sum(
        1 for sc in bpy.data.scenes for o in sc.objects
        if o.type == "EMPTY" and o.instance_collection and o.instance_collection.name == "Clock"
    )
    print("CLOCK INSTANCES IN FILE: %d (S1_C + S3_H share the S1 set)" % total_clocks)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    apply = "--apply" in argv
    run(apply=apply, replace="--replace" in argv)
    if apply:
        bpy.ops.wm.save_mainfile()
        print("SAVED %s" % bpy.data.filepath)
    else:
        print("DRY RUN -- nothing written. Re-run with -- --apply")
