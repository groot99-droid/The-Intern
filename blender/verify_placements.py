# Track C support: where does each placed motif actually land in frame?
#
# Renders are slow and eyeballing a 1920x1080 PNG for a 9cm paper slip is
# unreliable, so this projects every collection-instance empty into its
# scene camera's view and reports normalized screen coordinates:
#
#   u,v in 0..1 are inside the frame (v measured from the bottom).
#   depth is metres in front of the camera; negative means behind it.
#   size% is the instance's bounding sphere as a fraction of frame height,
#   which is what tells you whether a slip is a legible object or one pixel.
#
# It also ray-casts from the camera to each instance: being inside the frame
# is not the same as being visible. A slip on a chair seat at the far end of
# the boardroom projects perfectly and is still completely hidden behind the
# table top.
#
# The cast aims at the instance's ORIGIN, so read OCCLUDED with judgement on
# a tall object: a seated figure whose origin is on the floor reports as
# occluded by the table it is sitting at, while its head and shoulders are
# plainly visible. It is exact for the flat, small motifs it exists for --
# slips, handprints, the monogram.
#
# Run: blender.exe -b <blend> -P verify_placements.py
#      blender.exe -b <blend> -P verify_placements.py -- --only Clock

import bpy
import sys
from bpy_extras.object_utils import world_to_camera_view


def collection_radius(coll):
    """Rough bounding-sphere radius of a collection's contents, in metres."""
    best = 0.0
    for o in coll.objects:
        if o.type != "MESH":
            continue
        for corner in o.bound_box:
            v = o.matrix_world @ __import__("mathutils").Vector(corner)
            best = max(best, v.length)
    return best or 0.2


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    only = argv[argv.index("--only") + 1] if "--only" in argv else None

    print("%-22s %-20s %-16s %7s %7s %8s %7s  %s" % (
        "SCENE", "INSTANCE", "COLLECTION", "u", "v", "depth", "size%", "VERDICT"))

    for sc in sorted(bpy.data.scenes, key=lambda s: s.name):
        cam = sc.camera
        if cam is None:
            continue
        # Transforms are evaluated per view layer, and only the ACTIVE scene's
        # layer gets refreshed -- without this, matrix_world reads stale and
        # every instance projects from the origin.
        bpy.context.window.scene = sc
        bpy.context.view_layer.update()

        for o in sc.objects:
            if o.type != "EMPTY" or not o.instance_collection:
                continue
            if only and o.instance_collection.name != only:
                continue

            target = o.matrix_world.translation
            co = world_to_camera_view(sc, cam, target)

            # Line of sight: anything solid between the camera and the motif
            # means "in frame" is worthless.
            blocker = ""
            if co.z > 0:
                origin = cam.matrix_world.translation
                delta = target - origin
                dist = delta.length
                dg = bpy.context.evaluated_depsgraph_get()
                hit, loc, _, _, hit_obj, _ = sc.ray_cast(dg, origin, delta.normalized())
                if hit and (loc - origin).length < dist - 0.05:
                    # A ray aimed at an instance hits the instance's own
                    # geometry first; that is not an obstruction.
                    own = {ob.name for ob in o.instance_collection.objects}
                    name = hit_obj.name if hit_obj else "?"
                    # Haze volumes, water and glass are surfaces you see
                    # THROUGH -- a ray stops at them, an audience does not.
                    see_through = any(k in name.lower() for k in ("haze", "water", "glass"))
                    if name not in own and not see_through:
                        blocker = name

            radius = collection_radius(o.instance_collection)
            # Vertical half-extent of the frustum at this depth, from the
            # camera's sensor-height FOV.
            if co.z > 0:
                half_h = co.z * (cam.data.sensor_height / 2.0) / cam.data.lens
                size_pct = (radius / half_h) * 50.0 if half_h else 0.0
            else:
                size_pct = 0.0

            margin = 0.04
            if co.z <= 0:
                verdict = "BEHIND CAMERA"
            elif not (0 <= co.x <= 1 and 0 <= co.y <= 1):
                verdict = "OFF FRAME"
            elif not (margin <= co.x <= 1 - margin and margin <= co.y <= 1 - margin):
                verdict = "CLIPPED AT EDGE"
            elif blocker:
                verdict = "OCCLUDED by %s" % blocker
            elif size_pct < 0.8:
                verdict = "tiny (<0.8% of height)"
            else:
                verdict = "ok"

            print("%-22s %-20s %-16s %7.3f %7.3f %7.2fm %6.1f%%  %s" % (
                sc.name, o.name, o.instance_collection.name,
                co.x, co.y, co.z, size_pct, verdict))


main()
