# S4_C THE FLOOR: desks, monitors and chairs for the cubicle grid.
#
# S4C_Cubicles shipped as floor, ceiling, walls, partitions and lights --
# a cubicle maze with nothing in the cubicles. This furnishes it, which is
# also what Track C family 3 needs: Harlowe's beat is "one cubicle nameplate
# reads HARLOWE and it is the only chair pushed back", and there were no
# chairs to push back.
#
# Nothing is modelled from scratch. The desk, monitor and chair meshes
# already exist and are all centred local-space meshes, so new objects share
# the same mesh datablocks: one edit to the desk in S5_C changes every desk
# on the floor, which is the point (identical company furniture, C1).
#
#   DV_Desk     1.20 x 0.69 x 0.72   LowPolyProp_DV_Desk
#   DV_Monitor  0.42 x 0.28, sits at z 0.72..0.95 (baked, so z=0 is correct)
#   S1_Chair_L0 0.44 x 0.44 x 0.90   LowPolyProp_S1_Maroon
#
# The grid, read off CB_Partitions (24 panels, 8 verts each): two banks,
# left x[-3.10,-1.10] and right x[1.10,3.10], six rows whose back panels
# start at y = 1.50, 3.90, 6.30, 8.70, 11.10, 13.50, with a 2.2m aisle
# between them. Desks go against the back panel; the chair sits on the open
# side facing it. The chair mesh's backrest is on +X, so the occupant faces
# -X by default and +90 degrees about Z turns them to face -Y, into the desk.
#
# Run headless, Blender CLOSED:
#     blender.exe -b <blend> -P build_s4c_furniture.py -- --apply
#     ... -- --apply --replace     (reposition existing)

import bpy
import sys
from math import radians

SCENE = "S4C_Cubicles"
DESK_COLLECTION = "CubicleDesk"

ROW_BACKS = [1.54, 3.96, 6.34, 8.76, 11.14, 13.54]  # inner face of each row's back panel
BANKS = {"L": -2.10, "R": 2.10}                      # centre of each bank of cubicles

DESK_FROM_BACK = 0.40   # desk centre, measured out from the back panel
CHAIR_FROM_DESK = 0.75  # chair centre, measured out from the desk centre
MONITOR_BACKSET = 0.12  # monitor sits toward the back of the desk


def _source(scene_name, obj_name):
    ob = bpy.data.scenes[scene_name].objects.get(obj_name)
    if ob is None:
        raise KeyError("source object %r not found in %r" % (obj_name, scene_name))
    return ob


def ensure_desk_collection():
    """A desk + its monitor, as one instanceable unit."""
    coll = bpy.data.collections.get(DESK_COLLECTION)
    if coll is not None and coll.objects:
        return coll, "exists"
    coll = coll or bpy.data.collections.new(DESK_COLLECTION)

    desk = bpy.data.objects.new("CubicleDesk_Surface", _source("S5C_DeskVoid", "DV_Desk").data)
    monitor = bpy.data.objects.new("CubicleDesk_Monitor", _source("S5C_DeskVoid", "DV_Monitor").data)
    monitor.location = (0.0, -MONITOR_BACKSET, 0.0)
    coll.objects.link(desk)
    coll.objects.link(monitor)
    # Deliberately not linked into any scene collection -- it exists to be
    # instanced, exactly like Clock and PaperSlip.
    return coll, "built"


def stations():
    """(instance_name, chair_name, desk_loc, chair_loc) for all 12 cubicles."""
    for bank, cx in BANKS.items():
        for row, back in enumerate(ROW_BACKS):
            desk_y = back + DESK_FROM_BACK
            yield (
                "CB_Desk_%s%d" % (bank, row),
                "CB_Chair_%s%d" % (bank, row),
                (cx, desk_y, 0.0),
                (cx, desk_y + CHAIR_FROM_DESK, 0.0),
            )


def build(apply, replace):
    scene = bpy.data.scenes[SCENE]
    chair_mesh = _source("S1_C_WaitingRoom", "S1_Chair_L0").data
    coll = bpy.data.collections.get(DESK_COLLECTION)
    rows = []

    for desk_name, chair_name, desk_loc, chair_loc in stations():
        desk = scene.objects.get(desk_name)
        chair = scene.objects.get(chair_name)

        if not apply:
            rows.append((desk_name, "exists" if desk else "would add",
                         chair_name, "exists" if chair else "would add"))
            continue

        if desk is None:
            desk = bpy.data.objects.new(desk_name, None)
            desk.instance_type = "COLLECTION"
            desk.instance_collection = coll
            desk.empty_display_size = 0.3
            scene.collection.objects.link(desk)
            desk_state = "added"
        else:
            desk_state = "moved" if replace else "exists"
        if desk_state != "exists":
            desk.location = desk_loc

        if chair is None:
            chair = bpy.data.objects.new(chair_name, chair_mesh)
            scene.collection.objects.link(chair)
            chair_state = "added"
        else:
            chair_state = "moved" if replace else "exists"
        if chair_state != "exists":
            chair.location = chair_loc
            # Backrest is on +X, so the occupant faces -X; +90 about Z turns
            # them to face -Y, into the desk against the back panel.
            chair.rotation_euler = (0.0, 0.0, radians(90))

        rows.append((desk_name, desk_state, chair_name, chair_state))

    return rows


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    apply = "--apply" in argv
    if apply:
        _, state = ensure_desk_collection()
        print("collection %-16s %s" % (DESK_COLLECTION, state))
    for desk_name, desk_state, chair_name, chair_state in build(apply, "--replace" in argv):
        print("%-14s %-8s   %-14s %s" % (desk_name, desk_state, chair_name, chair_state))
    if apply:
        bpy.ops.wm.save_mainfile()
        print("SAVED %s" % bpy.data.filepath)
    else:
        print("DRY RUN -- nothing written. Re-run with -- --apply")
