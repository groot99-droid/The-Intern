# Track C, families 4 and 5: the two motifs that had no asset in the file yet.
#
#   4. Three handprints. Exactly three, chest height, never four.
#      S3_H on the lobby glass -> S7_C inside the elevator on the quilted
#      steel, from the inside -> S8_H on the storefront glass from the
#      OUTSIDE, matching the reflection's position.
#   5. The V&A monogram, a serpent swallowing a lion. Never centred, never
#      lit, never readable except in S1 (where the floor emblem already
#      carries it). S3_C woven into the curtain, visible only in a fold ->
#      S7_C etched beside the one lit button -> SE_ASSIM etched in the glass
#      table under the package's stain.
#
# Both are built flat in the XZ plane facing -Y, so an instance with no
# rotation presses against a surface that faces the camera down +Y; rotate
# 90 about Z for a side wall, -90 about X to lie flat on a table.
#
# Geometry is deliberately crude -- at the distances involved these read as
# a few pixels, and C1 keeps company-owned things low-poly anyway. The
# handprint is a mark left ON the building's glass, so it takes a photoreal
# material (C1: the building is photoreal), not the toon ramp.
#
# Run headless, Blender CLOSED:
#     blender.exe -b <blend> -P atmosphere_assets.py -- --apply

import bpy
import sys
from math import radians, cos, sin

SMUDGE_MAT = "PhotorealArch_Smudge"
ETCH_MAT = "PhotorealArch_Etch"


def _exec_text(name):
    """Run one of the .blend's own Text datablocks and return its globals.

    The factories live inside the file (the on-disk .py files are exported
    mirrors, not the authority), so reuse them rather than hand-rolling a
    second shading pipeline that would drift from the first.
    """
    txt = bpy.data.texts.get(name)
    if txt is None:
        raise KeyError("Text datablock %r not found in this .blend" % name)
    ns = {}
    exec(txt.as_string(), ns)
    return ns


def _quad(verts, faces, corners):
    base = len(verts)
    verts.extend(corners)
    faces.append([base, base + 1, base + 2, base + 3])


def _rect(verts, faces, x0, z0, x1, z1, y=0.0):
    _quad(verts, faces, [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)])


def build_handprint_mesh():
    """Palm, four fingers, one thumb -- flat, about 19cm tall."""
    verts, faces = [], []
    _rect(verts, faces, -0.042, 0.0, 0.042, 0.095)            # palm
    finger_z = 0.095
    for i, length in enumerate([0.050, 0.058, 0.054, 0.044]):  # index..little
        x0 = -0.040 + i * 0.021
        _rect(verts, faces, x0, finger_z, x0 + 0.016, finger_z + length)
    # Thumb, angled off the palm's left edge.
    ang = radians(38)
    ox, oz = -0.042, 0.030
    w, l = 0.017, 0.050
    dx, dz = cos(ang), sin(ang)
    px, pz = -dz, dx
    _quad(verts, faces, [
        (ox, 0.0, oz),
        (ox - dx * l, 0.0, oz + dz * l),
        (ox - dx * l + px * w, 0.0, oz + dz * l + pz * w),
        (ox + px * w, 0.0, oz + pz * w),
    ])
    mesh = bpy.data.meshes.new("Handprint_Smudge")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    return mesh


def build_monogram_mesh():
    """A ring that closes on itself -- the serpent -- around a blunt shape.

    Not legible as a serpent swallowing a lion at any size it appears in,
    which is the point: 'never readable except in S1'.
    """
    verts, faces = [], []
    segments, r_out, r_in = 14, 0.062, 0.040
    ring_base = len(verts)
    for i in range(segments):
        a = (i / segments) * 6.283185
        verts.append((r_out * cos(a), 0.0, r_out * sin(a)))
        verts.append((r_in * cos(a), 0.0, r_in * sin(a)))
    for i in range(segments):
        a0 = ring_base + i * 2
        a1 = ring_base + ((i + 1) % segments) * 2
        faces.append([a0, a1, a1 + 1, a0 + 1])
    # The swallowed shape: a squat wedge inside the ring, off-centre.
    _quad(verts, faces, [
        (-0.022, 0.0, -0.014), (0.020, 0.0, -0.020),
        (0.024, 0.0, 0.016), (-0.018, 0.0, 0.012),
    ])
    mesh = bpy.data.meshes.new("Monogram_VA")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    return mesh


def _translucent(mat, alpha):
    """Alpha on the Principled node + whatever the build calls blending."""
    for node in mat.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED" and "Alpha" in node.inputs:
            node.inputs["Alpha"].default_value = alpha
    if hasattr(mat, "surface_render_method"):      # Blender 4.2+/5.x EEVEE Next
        mat.surface_render_method = "BLENDED"
    elif hasattr(mat, "blend_method"):
        mat.blend_method = "BLEND"
    mat.use_backface_culling = False
    return mat


def ensure_assets():
    factories = _exec_text("material_factories.py")
    make_photoreal = factories["make_photoreal_material"]

    if SMUDGE_MAT not in bpy.data.materials:
        _translucent(make_photoreal(SMUDGE_MAT, (0.62, 0.62, 0.60), roughness=0.92,
                                    use_normal_proc=True, noise_scale=180.0,
                                    bump_strength=0.04), 0.30)
    if ETCH_MAT not in bpy.data.materials:
        _translucent(make_photoreal(ETCH_MAT, (0.42, 0.40, 0.36), roughness=0.35,
                                    use_normal_proc=False), 0.55)

    made = []
    for coll_name, obj_name, builder, mat_name in [
        ("Handprint", "Handprint_Smudge", build_handprint_mesh, SMUDGE_MAT),
        ("Monogram", "Monogram_VA", build_monogram_mesh, ETCH_MAT),
    ]:
        if coll_name in bpy.data.collections and bpy.data.collections[coll_name].objects:
            made.append((coll_name, "exists"))
            continue
        coll = bpy.data.collections.get(coll_name) or bpy.data.collections.new(coll_name)
        obj = bpy.data.objects.new(obj_name, builder())
        obj.data.materials.append(bpy.data.materials[mat_name])
        coll.objects.link(obj)
        # Keep the source geometry out of every render: it exists to be
        # instanced, exactly like the Clock and PaperSlip collections, which
        # also live outside the scene collections.
        made.append((coll_name, "built"))
    return made


# scene, instance name, collection, location, rotation(deg)
PLACEMENTS = [
    # --- Family 4: exactly three handprints, chest height. ---
    # Pressed on the inside of the locked lobby glass.
    ("S3_H_LobbyDoors", "S3H_Handprint_Inst", "Handprint", (-0.45, 0.06, 1.28), (0, 0, 0)),
    # Inside the cab, on the quilted steel -- left by someone in here, not by
    # someone trying to get in. On the back wall rather than a side wall:
    # the 16mm lens is turned 10 degrees off axis and the side walls fall
    # outside the frame near the camera.
    ("S7C_Elevator", "EL_Handprint_Inst", "Handprint", (-0.98, 1.96, 1.30), (0, 0, 0)),
    # On the storefront glass from the OUTSIDE.
    ("S8H_Store", "ST_Handprint_Inst", "Handprint", (-0.80, -0.07, 1.28), (0, 0, 180)),

    # --- Family 5: the monogram. Never centred, never lit. ---
    ("S3C_Threshold", "TH_Monogram_Inst", "Monogram", (0.62, 4.33, 1.25), (0, 0, 0)),
    # Beside the one lit button on the panel.
    ("S7C_Elevator", "EL_Monogram_Inst", "Monogram", (0.60, 1.96, 1.05), (0, 0, 0)),
    # Etched into the glass table, half under the package's stain.
    ("SE_ASSIM_Boardroom", "BR_Monogram_Inst", "Monogram", (0.14, 5.86, 0.80), (-90, 0, 0)),
]


def place(apply, replace):
    out = []
    for scene_name, name, coll_name, loc, rot in PLACEMENTS:
        scene = bpy.data.scenes.get(scene_name)
        if scene is None:
            out.append((scene_name, name, "NO SCENE"))
            continue
        existing = scene.objects.get(name)
        if existing is not None and not replace:
            out.append((scene_name, name, "exists"))
            continue
        if not apply:
            out.append((scene_name, name, "would add"))
            continue
        coll = bpy.data.collections.get(coll_name)
        if coll is None:
            out.append((scene_name, name, "NO COLLECTION"))
            continue
        obj = existing
        if obj is None:
            obj = bpy.data.objects.new(name, None)
            obj.instance_type = "COLLECTION"
            obj.instance_collection = coll
            obj.empty_display_size = 0.12
            scene.collection.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = [radians(a) for a in rot]
        out.append((scene_name, name, "placed"))
    return out


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    apply = "--apply" in argv
    if apply:
        for coll_name, state in ensure_assets():
            print("asset  %-22s %s" % (coll_name, state))
    for scene_name, name, state in place(apply, "--replace" in argv):
        print("place  %-22s %-22s %s" % (scene_name, name, state))
    if apply:
        bpy.ops.wm.save_mainfile()
        print("SAVED %s" % bpy.data.filepath)
    else:
        print("DRY RUN -- nothing written. Re-run with -- --apply")
