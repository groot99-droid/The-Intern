# Exported read-only mirror of the `helpers.py` Text datablock stored inside
# ninety-nine_pilots.blend (exported 2026-09-17). The .blend copy is authoritative --
# this file exists so the pipeline code has an on-disk, reviewable, version-able
# copy instead of living only inside a Text datablock. If you edit inside Blender,
# re-export to keep this in sync.

import bpy, mathutils

def min_clearance(scene, cam_location, exclude=()):
    """Return (min_distance, object_name) from cam_location to the nearest
    mesh bounding-box corner in the scene, excluding names in `exclude`."""
    loc = mathutils.Vector(cam_location)
    best = (float("inf"), None)
    for o in scene.collection.objects:
        if o.type != 'MESH' or o.name in exclude:
            continue
        mat = o.matrix_world
        for c in o.bound_box:
            d = (mat @ mathutils.Vector(c) - loc).length
            if d < best[0]:
                best = (d, o.name)
    return best

def check_camera_clearance(scene, cam_location, min_required=1.5, exclude=()):
    dist, name = min_clearance(scene, cam_location, exclude=exclude)
    ok = dist >= min_required
    print(f"clearance check: {dist:.2f}m to {name} -> {'OK' if ok else 'TOO CLOSE'}")
    return ok, dist, name

def point_obj_at(obj, target):
    direction = mathutils.Vector(target) - mathutils.Vector(obj.location)
    rot_quat = direction.to_track_quat('-Z', 'Y')
    obj.rotation_euler = rot_quat.to_euler()
