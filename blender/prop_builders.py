# Exported read-only mirror of the `prop_builders.py` Text datablock stored inside
# ninety-nine_pilots.blend (exported 2026-09-17). The .blend copy is authoritative --
# this file exists so the pipeline code has an on-disk, reviewable, version-able
# copy instead of living only inside a Text datablock. If you edit inside Blender,
# re-export to keep this in sync.
#
# Procedural geometry helpers built on bmesh: primitive builders (box/pyramid/
# prism/ring), then higher-level archetype builders (hand, chair, shelving bay,
# door, desk drawer, monitor stand, car detailing) used across the pilot scenes.

import bpy, bmesh, math
from mathutils import Vector

def bm_add_box(bm, minc, maxc, material_index=0):
    """Add an axis-aligned box to bmesh bm. Coordinates auto-sorted so min/max order doesn't matter."""
    x0, x1 = sorted((minc[0], maxc[0]))
    y0, y1 = sorted((minc[1], maxc[1]))
    z0, z1 = sorted((minc[2], maxc[2]))
    v = [bm.verts.new((x, y, z)) for x, y, z in [
        (x0, y0, z0), (x0, y0, z1), (x0, y1, z0), (x0, y1, z1),
        (x1, y0, z0), (x1, y0, z1), (x1, y1, z0), (x1, y1, z1)]]
    faces_idx = [(0,1,3,2), (4,6,7,5), (0,4,5,1), (2,3,7,6), (0,2,6,4), (1,5,7,3)]
    new_faces = []
    for idx in faces_idx:
        f = bm.faces.new([v[i] for i in idx])
        f.material_index = material_index
        new_faces.append(f)
    return new_faces

def bm_add_pyramid(bm, base_center, base_half_x, base_half_y, height, material_index=0, up_axis='Z'):
    """Add a 4-sided pyramid (no base cap) with apex offset `height` along up_axis from base_center."""
    cx, cy, cz = base_center
    if up_axis == 'Z':
        corners = [(cx-base_half_x, cy-base_half_y, cz), (cx+base_half_x, cy-base_half_y, cz),
                   (cx+base_half_x, cy+base_half_y, cz), (cx-base_half_x, cy+base_half_y, cz)]
        apex = (cx, cy, cz + height)
    elif up_axis == 'Y':
        corners = [(cx-base_half_x, cy, cz-base_half_y), (cx+base_half_x, cy, cz-base_half_y),
                   (cx+base_half_x, cy, cz+base_half_y), (cx-base_half_x, cy, cz+base_half_y)]
        apex = (cx, cy + height, cz)
    else:  # X
        corners = [(cx, cy-base_half_x, cz-base_half_y), (cx, cy+base_half_x, cz-base_half_y),
                   (cx, cy+base_half_x, cz+base_half_y), (cx, cy-base_half_x, cz+base_half_y)]
        apex = (cx + height, cy, cz)
    cv = [bm.verts.new(c) for c in corners]
    av = bm.verts.new(apex)
    faces = []
    for i in range(4):
        f = bm.faces.new((cv[i], cv[(i+1) % 4], av))
        f.material_index = material_index
        faces.append(f)
    return faces

def bm_add_ngon_prism(bm, center, radius, z0, z1, n_sides=8, material_index=0, cap_bottom=True, cap_top=True, start_angle=0.0):
    """Add an n-sided prism (regular polygon extruded along Z). Returns (bottom_verts, top_verts)."""
    bverts, tverts = [], []
    for i in range(n_sides):
        ang = start_angle + 2 * math.pi * i / n_sides
        x, y = center[0] + radius * math.cos(ang), center[1] + radius * math.sin(ang)
        bverts.append(bm.verts.new((x, y, z0)))
        tverts.append(bm.verts.new((x, y, z1)))
    for i in range(n_sides):
        j = (i + 1) % n_sides
        f = bm.faces.new((bverts[i], bverts[j], tverts[j], tverts[i]))
        f.material_index = material_index
    if cap_bottom:
        f = bm.faces.new(list(reversed(bverts)))
        f.material_index = material_index
    if cap_top:
        f = bm.faces.new(tverts)
        f.material_index = material_index
    return bverts, tverts

def bm_add_ring_band(bm, center, r_inner, r_outer, z0, z1, n_sides=8, material_index=0, start_angle=0.0,
                      cap_bottom=False, cap_top=True):
    """Add an annular ring band (like a bezel lip) between r_inner and r_outer, from z0 to z1."""
    inner_b, inner_t, outer_b, outer_t = [], [], [], []
    for i in range(n_sides):
        ang = start_angle + 2 * math.pi * i / n_sides
        c, s = math.cos(ang), math.sin(ang)
        inner_b.append(bm.verts.new((center[0]+r_inner*c, center[1]+r_inner*s, z0)))
        inner_t.append(bm.verts.new((center[0]+r_inner*c, center[1]+r_inner*s, z1)))
        outer_b.append(bm.verts.new((center[0]+r_outer*c, center[1]+r_outer*s, z0)))
        outer_t.append(bm.verts.new((center[0]+r_outer*c, center[1]+r_outer*s, z1)))
    for i in range(n_sides):
        j = (i + 1) % n_sides
        # outer wall
        f = bm.faces.new((outer_b[i], outer_b[j], outer_t[j], outer_t[i])); f.material_index = material_index
        # inner wall
        f = bm.faces.new((inner_b[j], inner_b[i], inner_t[i], inner_t[j])); f.material_index = material_index
        if cap_top:
            f = bm.faces.new((inner_t[i], inner_t[j], outer_t[j], outer_t[i])); f.material_index = material_index
        if cap_bottom:
            f = bm.faces.new((outer_b[i], outer_b[j], inner_b[j], inner_b[i])); f.material_index = material_index

def finalize(bm, obj, flat=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    if flat:
        for p in obj.data.polygons:
            p.use_smooth = False

def rebuild_mesh(obj, build_fn, material_names=None):
    """build_fn(bm) populates geometry on a fresh bmesh; material list is preserved/set on obj.data."""
    me = obj.data
    if material_names:
        me.materials.clear()
        for mn in material_names:
            me.materials.append(bpy.data.materials[mn])
    bm = bmesh.new()
    build_fn(bm)
    finalize(bm, obj)
    return obj


def build_hand(bm, is_left=True, material_index=0):
    """Rebuild a stylized hand: tapered palm, 4 fingers with real gaps (proximal+distal, knuckle bend),
    2-segment thumb. Local space matches the original UW_HandL/R layout (fingers along +Z, thumb toward -X
    for the left hand). For the right hand, all X coordinates are mirrored."""
    s = -1.0 if is_left else 1.0
    def X(x):
        return s * x

    M = material_index
    # palm: tapered, wider at wrist (z=0) than at knuckles (z=0.155)
    bm_add_box(bm, (X(-0.065), -0.034, 0.0), (X(0.065), 0.034, 0.08), M)
    bm_add_box(bm, (X(-0.058), -0.027, 0.08), (X(0.045), 0.027, 0.155), M)

    # 4 fingers, evenly spaced across the same span as the original (-0.06 to 0.03), real gaps, 2 segments each
    span0, span1 = -0.06, 0.03
    n_fingers = 4
    gap = 0.0008
    fw = ((span1 - span0) - gap * (n_fingers - 1)) / n_fingers
    for i in range(n_fingers):
        fx0 = span0 + i * (fw + gap)
        fx1 = fx0 + fw
        bm_add_box(bm, (X(fx0), -0.021, 0.155), (X(fx1), 0.021, 0.21), M)             # proximal
        bm_add_box(bm, (X(fx0+0.002), -0.017, 0.21), (X(fx1-0.002), 0.017+0.008, 0.252), M)  # distal, curled fwd

    # thumb: 2 segments, base + tip bent outward/forward
    bm_add_box(bm, (X(-0.06), -0.018, 0.018), (X(-0.086), 0.018, 0.066), M)
    bm_add_box(bm, (X(-0.082), -0.014, 0.060), (X(-0.108), 0.014+0.012, 0.104), M)


def build_chair(bm, material_index=0):
    """Rebuild the chair archetype: seat w/ cushion-lip perimeter, rail-frame backrest w/ gapped slats,
    2-segment tapered legs. Local space matches the original S1_Chair_*/BR_Chair_* layout
    (back rest faces local +X, seat top at z=0.465, floor at z=0)."""
    M = material_index
    hw = 0.225  # seat half-width (Y) / half-depth (X)

    # seat: base slab + perimeter cushion lip
    bm_add_box(bm, (-hw, -hw, 0.405), (hw, hw, 0.435), M)
    bm_add_box(bm, (-hw, 0.195, 0.435), (hw, hw, 0.465), M)     # front lip
    bm_add_box(bm, (-hw, -hw, 0.435), (hw, -0.195, 0.465), M)   # back lip
    bm_add_box(bm, (-hw, -0.195, 0.435), (-0.195, 0.195, 0.465), M)  # left lip
    bm_add_box(bm, (0.195, -0.195, 0.435), (hw, 0.195, 0.465), M)    # right lip

    # backrest: 2 posts + top rail + 2 slats with gaps
    bm_add_box(bm, (0.165, -hw, 0.465), (0.225, -0.195, 0.9), M)   # post -Y
    bm_add_box(bm, (0.165, 0.195, 0.465), (0.225, hw, 0.9), M)     # post +Y
    bm_add_box(bm, (0.165, -hw, 0.84), (0.225, hw, 0.9), M)        # top rail
    bm_add_box(bm, (0.18, -0.15, 0.55), (0.225, -0.03, 0.80), M)   # slat 1
    bm_add_box(bm, (0.18, 0.03, 0.55), (0.225, 0.15, 0.80), M)     # slat 2

    # legs: 2-segment taper at 4 corners
    for lx in (-0.18, 0.18):
        for ly in (-0.18, 0.18):
            bm_add_box(bm, (lx-0.018, ly-0.018, 0.20), (lx+0.018, ly+0.018, 0.405), M)  # upper (thicker)
            bm_add_box(bm, (lx-0.012, ly-0.012, 0.0), (lx+0.012, ly+0.012, 0.20), M)    # lower (thinner)


def build_shelving_bay(bm, x0, x1, y0, y1, shelf_zs, height, shelf_th=0.06, post_w=0.05, material_index=0):
    """One shelving bay: 2 angle-iron L-profile uprights (at x0,x1) + N shelf tiers, each with a raised
    lip tray on 3 edges (front + 2 sides, open at the back/wall side y0)."""
    M = material_index
    flange_len = min(0.36, (x1 - x0) * 0.18)
    # uprights: L-profile = back flange (thin-X, full depth) + side flange (thin-Y, partial depth) at each bay edge
    bm_add_box(bm, (x0, y0, 0.0), (x0 + post_w, y1, height), M)
    bm_add_box(bm, (x0, y0, 0.0), (x0 + flange_len, y0 + post_w, height), M)
    bm_add_box(bm, (x1 - post_w, y0, 0.0), (x1, y1, height), M)
    bm_add_box(bm, (x1 - flange_len, y0, 0.0), (x1, y0 + post_w, height), M)
    # shelf tiers: plate + raised lip on front + 2 side edges (open at the back, y0, against the wall)
    lip_h = 0.03
    lip_w = 0.025
    for z0 in shelf_zs:
        z1 = z0 + shelf_th
        bm_add_box(bm, (x0, y0, z0), (x1, y1, z1), M)
        bm_add_box(bm, (x0, y1 - lip_w, z1), (x1, y1, z1 + lip_h), M)        # front lip
        bm_add_box(bm, (x0, y0, z1), (x0 + lip_w, y1, z1 + lip_h), M)        # left lip
        bm_add_box(bm, (x1 - lip_w, y0, z1), (x1, y1, z1 + lip_h), M)        # right lip


def build_door(bm, w, h, thickness, has_handle=True, material_index=0):
    """Split a flat door slab into a perimeter frame + recessed, mullion-split inner panel + handle bar.
    Local space: x centered on 0 (width w), y from -thickness to 0, z from 0 (floor) to h."""
    M = material_index
    hw = w / 2.0
    fb = min(0.15, hw * 0.15)   # frame border width
    fb_v = min(0.15, h * 0.07)  # frame border height (top/bottom)
    t = thickness
    recess = t * 0.5

    # perimeter frame
    bm_add_box(bm, (-hw, -t, 0), (-hw + fb, 0, h), M)          # left
    bm_add_box(bm, (hw - fb, -t, 0), (hw, 0, h), M)            # right
    bm_add_box(bm, (-hw + fb, -t, h - fb_v), (hw - fb, 0, h), M)   # top
    bm_add_box(bm, (-hw + fb, -t, 0), (hw - fb, 0, fb_v), M)       # bottom / kick plate

    # recessed inner panel, split by a center mullion
    mw = min(0.06, hw * 0.06)
    bm_add_box(bm, (-hw + fb, -recess, fb_v), (-mw, 0, h - fb_v), M)  # left panel
    bm_add_box(bm, (mw, -recess, fb_v), (hw - fb, 0, h - fb_v), M)    # right panel
    bm_add_box(bm, (-mw, -recess, fb_v), (mw, 0, h - fb_v), M)        # center mullion

    if has_handle:
        hx = hw - fb - 0.12
        hz0, hz1 = h * 0.42, h * 0.58
        bm_add_box(bm, (hx - 0.015, -t - 0.05, hz0), (hx + 0.015, -t, hz1), M)         # vertical grab bar
        bm_add_box(bm, (hx - 0.02, -t - 0.05, hz0 - 0.03), (hx + 0.02, -t, hz0), M)    # lower bracket
        bm_add_box(bm, (hx - 0.02, -t - 0.05, hz1), (hx + 0.02, -t, hz1 + 0.03), M)    # upper bracket


def add_desk_drawer(bm, x0, x1, y_outer, y_inner, z0, z1, material_index=0, pull_out=0.018):
    """Add a recessed drawer-front detail (frame lip + inset panel + pull nub) between two desk legs.
    y_outer is the leg-front plane; the drawer panel sits recessed toward y_inner."""
    M = material_index
    y_panel = y_inner if abs(y_inner - y_outer) < 0.001 else (y_outer + (y_inner - y_outer) * 0.35)
    lip = 0.02
    # thin frame lip (top + bottom edges) flush with the leg-front plane
    bm_add_box(bm, (x0, y_outer, z1 - lip), (x1, y_panel, z1), M)
    bm_add_box(bm, (x0, y_outer, z0), (x1, y_panel, z0 + lip), M)
    # recessed drawer-front panel
    bm_add_box(bm, (x0 + lip, y_panel, z0 + lip), (x1 - lip, y_panel + (y_outer - y_panel) * 0.5, z1 - lip), M)
    # pull nub, centered, protruding slightly past the leg-front plane
    cx, cz = (x0 + x1) / 2.0, (z0 + z1) / 2.0
    sign = 1.0 if y_outer < y_inner else -1.0
    bm_add_box(bm, (cx - 0.05, y_outer - sign * pull_out, cz - 0.012), (cx + 0.05, y_outer, cz + 0.012), M)


def add_monitor_stand(bm, x0, x1, y_back, z_desk, post_z1, base_pad=0.03, material_index=0):
    """Add a base-plate (foot on the desk) and a stand-post (rear neck) to an existing monitor housing,
    without moving the housing or the separate screen object."""
    M = material_index
    bm_add_box(bm, (x0 - base_pad, y_back - 0.10, z_desk), (x1 + base_pad, y_back + 0.01, z_desk + 0.008), M)
    cx = (x0 + x1) / 2.0
    bm_add_box(bm, (cx - 0.035, y_back - 0.02, z_desk), (cx + 0.035, y_back, post_z1), M)


def _mesh_boxes(bm):
    """Group an all-quad-box bmesh's verts into per-box bounding boxes, assuming it was authored via
    bm_add_box calls (each box = 8 sequentially-created verts)."""
    verts = list(bm.verts)
    boxes = []
    for i in range(0, len(verts) - 7, 8):
        chunk = verts[i:i+8]
        xs = [v.co.x for v in chunk]; ys = [v.co.y for v in chunk]; zs = [v.co.z for v in chunk]
        boxes.append(((min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))))
    return boxes

def add_car_details(bm, material_index=0, hero=False, wheel_pairs=None):
    """Read the existing body/cabin/wheel boxes off `bm` (body=box0, cabin=box1, wheels=remaining pairs)
    and add: inset cabin glass, front/rear bumpers, 2 mirrors, door-seam insets, and hub-detail wheels.
    If hero, also splits the body into fender/mid-body/rear bands for extra silhouette (garage cars)."""
    M = material_index
    boxes = _mesh_boxes(bm)
    (bx0, bx1), (by0, by1), (bz0, bz1) = boxes[0]
    (cx0, cx1), (cy0, cy1), (cz0, cz1) = boxes[1]
    wheel_boxes = boxes[2:]
    if wheel_pairs is None:
        wheel_pairs = [(i, i+1) for i in range(0, len(wheel_boxes) - 1, 2)]
    wheels = []
    for i, j in wheel_pairs:
        wb0, wb1 = wheel_boxes[i], wheel_boxes[j]
        wx0 = min(wb0[0][0], wb1[0][0]); wx1 = max(wb0[0][1], wb1[0][1])
        wy0 = min(wb0[1][0], wb1[1][0]); wy1 = max(wb0[1][1], wb1[1][1])
        wz0 = min(wb0[2][0], wb1[2][0]); wz1 = max(wb0[2][1], wb1[2][1])
        wheels.append(((wx0+wx1)/2, (wy0, wy1), (wz0+wz1)/2, (wz1-wz0)/2))

    # inset cabin glass: front + rear + 2 side flush panels, recessed 2cm into the cabin box
    gz0, gz1 = cz0 + (cz1-cz0)*0.18, cz1 - (cz1-cz0)*0.08
    rec = 0.02
    bm_add_box(bm, (cx1-rec, cy0+0.05, gz0), (cx1, cy1-0.05, gz1), M)   # front glass
    bm_add_box(bm, (cx0, cy0+0.05, gz0), (cx0+rec, cy1-0.05, gz1), M)  # rear glass
    bm_add_box(bm, (cx0+0.15, cy1-rec, gz0), (cx1-0.15, cy1, gz1), M)  # +Y side glass
    bm_add_box(bm, (cx0+0.15, cy0, gz0), (cx1-0.15, cy0+rec, gz1), M)  # -Y side glass

    # front/rear bumpers
    bump_h0, bump_h1 = bz0 + (bz1-bz0)*0.15, bz0 + (bz1-bz0)*0.55
    bm_add_box(bm, (bx1-0.06, by0+0.08, bump_h0), (bx1+0.08, by1-0.08, bump_h1), M)
    bm_add_box(bm, (bx0-0.08, by0+0.08, bump_h0), (bx0+0.06, by1-0.08, bump_h1), M)

    # 2 side mirrors near the cabin's front corners
    mz = cz0 + (cz1-cz0)*0.55
    bm_add_box(bm, (cx1-0.28, by1-0.02, mz), (cx1-0.16, by1+0.10, mz+0.06), M)
    bm_add_box(bm, (cx1-0.28, by0-0.10, mz), (cx1-0.16, by0+0.02, mz+0.06), M)

    # cosmetic door-seam insets (2 thin recessed vertical lines per side)
    seam_w, seam_rec = 0.015, 0.008
    for sx in (bx0 + (bx1-bx0)*0.42, bx0 + (bx1-bx0)*0.68):
        bm_add_box(bm, (sx-seam_w, by1-seam_rec, bz0+0.05), (sx+seam_w, by1, bz1-0.05), M)
        bm_add_box(bm, (sx-seam_w, by0, bz0+0.05), (sx+seam_w, by0+seam_rec, bz1-0.05), M)

    # hub-detail wheels: small raised hub cylinder (disc in the X-Z plane) on each wheel's outer faces
    N_HUB = 8
    for wx, (wy0, wy1), wz, wr in wheels:
        hub_r = wr * 0.45
        for oy, sign in ((wy1, 1.0), (wy0, -1.0)):
            inner, outer = [], []
            for i in range(N_HUB):
                ang = 2 * math.pi * i / N_HUB
                dx, dz = hub_r * math.cos(ang), hub_r * math.sin(ang)
                inner.append(bm.verts.new((wx + dx, oy, wz + dz)))
                outer.append(bm.verts.new((wx + dx, oy + sign * 0.03, wz + dz)))
            for i in range(N_HUB):
                j = (i + 1) % N_HUB
                fw = bm.faces.new((inner[i], inner[j], outer[j], outer[i])); fw.material_index = M
            fcap = bm.faces.new(outer if sign > 0 else list(reversed(outer))); fcap.material_index = M

    if hero:
        # beltline trim frame running the body's perimeter (fender/mid-body/rear read)
        belt_z = bz0 + (bz1 - bz0) * 0.62
        bm_add_box(bm, (bx0, by0, belt_z), (bx1, by1, belt_z + 0.02), M)
        bm_add_box(bm, (bx0+0.15, by1-0.015, bz0+0.05), (bx1-0.15, by1, bz1-0.05), M)
        bm_add_box(bm, (bx0+0.15, by0, bz0+0.05), (bx1-0.15, by0+0.015, bz1-0.05), M)
        # 2 door handles per side
        for sx in (bx0 + (bx1-bx0)*0.35, bx0 + (bx1-bx0)*0.62):
            hz = bz0 + (bz1-bz0)*0.72
            bm_add_box(bm, (sx-0.05, by1-0.02, hz), (sx+0.05, by1+0.015, hz+0.025), M)
            bm_add_box(bm, (sx-0.05, by0-0.015, hz), (sx+0.05, by0+0.02, hz+0.025), M)
        # fender flares + wheel-arch trim frame over each wheel
        for wx, (wy0, wy1), wz, wr in wheels:
            for oy, sign in ((wy1, 1.0), (wy0, -1.0)):
                fw0, fw1 = wx - wr*0.9, wx + wr*0.9
                bm_add_box(bm, (fw0, oy, wz - wr*0.2), (fw1, oy + sign*0.05, wz + wr*1.05), M)  # fender flare
                aw = wr * 1.15
                at = 0.03
                bm_add_box(bm, (wx-aw, oy, wz+wr*0.85), (wx+aw, oy+sign*0.01, wz+wr*0.85+at), M)   # arch top
                bm_add_box(bm, (wx-aw, oy, wz-wr*0.15), (wx-aw+at, oy+sign*0.01, wz+wr*0.85), M)   # arch front
                bm_add_box(bm, (wx+aw-at, oy, wz-wr*0.15), (wx+aw, oy+sign*0.01, wz+wr*0.85), M)   # arch rear
