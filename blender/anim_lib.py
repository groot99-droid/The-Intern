# Shared keying primitives for the motion pass (camera_moves.py, scene_motion.py).
# Disk-only -- deliberately NOT mirrored as a Text datablock inside the .blend,
# unlike helpers.py/material_factories.py/prop_builders.py, so there is no
# fourth copy to drift out of sync (see CLAUDE.md's "Don't touch without
# asking" list).
#
# Blender 5.x's slotted-action API: action.fcurves raises directly on a
# slotted action, so every ID owner needs one bootstrap keyframe_insert before
# its channelbag exists. After that, curves are authored directly through the
# channelbag, bypassing keyframe_insert entirely for speed and control over
# interpolation/extrapolation.

import bpy


def channelbag_for(id_owner, bootstrap_path, bootstrap_index=0):
    """Return the animation channelbag for id_owner, creating its action/slot
    via one throwaway keyframe_insert if animation_data doesn't exist yet."""
    ad = id_owner.animation_data
    if ad is None or ad.action is None:
        id_owner.keyframe_insert(data_path=bootstrap_path, index=bootstrap_index, frame=1)
        ad = id_owner.animation_data
    return ad.action.layers[0].strips[0].channelbag(ad.action_slot)


def set_curve(cb, data_path, index, keys, interp="BEZIER", extrapolation="CONSTANT"):
    """(Re)author one fcurve on channelbag `cb`. `keys` is [(frame, value), ...].
    Removes any existing curve at this data_path/index first -- own the channel
    outright rather than merging into whatever was there."""
    fc = cb.fcurves.find(data_path, index=index)
    if fc:
        cb.fcurves.remove(fc)
    fc = cb.fcurves.new(data_path, index=index)
    for frame, value in keys:
        kp = fc.keyframe_points.insert(float(frame), float(value))
        kp.interpolation = interp
    fc.extrapolation = extrapolation
    fc.update()
    return fc


def key_location(obj, keys_xyz, interp="BEZIER"):
    """keys_xyz: [(frame, (x, y, z)), ...]. Keys all three location channels,
    even axes that don't change -- matches the three shipped pilot curves."""
    cb = channelbag_for(obj, "location", 0)
    for axis in range(3):
        axis_keys = [(f, v[axis]) for f, v in keys_xyz]
        set_curve(cb, "location", axis, axis_keys, interp=interp)


def key_rotation_euler_axis(obj, axis_index, keys, interp="BEZIER"):
    """keys: [(frame, radians), ...] for a single rotation_euler axis."""
    cb = channelbag_for(obj, "rotation_euler", axis_index)
    set_curve(cb, "rotation_euler", axis_index, keys, interp=interp)


def generate_ramp_keys(frame_start, ramp_frames, value_from, value_to):
    """A single hard ramp: value_from at frame_start, value_to at
    frame_start+ramp_frames. Pair with interp='LINEAR' for a CRT-style wake
    with no ease curve -- the extrapolation (CONSTANT) holds value_to for
    the rest of the range with no further keys needed."""
    return [(frame_start, value_from), (frame_start + ramp_frames, value_to)]


def generate_cycle_keys(frame_start, frame_end, period_frames, value_lo, value_hi):
    """A regular pulse alternating lo/hi every half period, covering
    [frame_start, frame_end]. For a periodic flicker like a sign ballast,
    not a random one -- pair with interp='BEZIER' for a smooth breathing
    cycle, distinct from light_flicker's hard random snaps."""
    keys = []
    f = frame_start
    half = period_frames / 2.0
    hi = True
    keys.append((f, value_hi if hi else value_lo))
    while f < frame_end:
        f = min(f + half, frame_end)
        hi = not hi
        keys.append((f, value_hi if hi else value_lo))
    return keys


def generate_flicker_keys(seed, frame_start, frame_end, base_value, low_frac=0.15,
                           period_range=(40, 70), dip_width=2):
    """Seeded-RNG irregular flicker: holds at base_value, snaps down to
    base_value*low_frac for `dip_width` frames, snaps back, at irregular
    intervals drawn from period_range. Deterministic for a given seed, so
    re-running with --apply is idempotent. Pair with interp='CONSTANT' --
    a hard on/off snap, not a fade, matching how fluorescent/sodium fixtures
    actually flicker.
    """
    import random
    rng = random.Random(seed)
    keys = [(frame_start, base_value)]
    f = frame_start
    while f < frame_end:
        interval = rng.randint(*period_range)
        f = min(f + interval, frame_end)
        dip_at = f
        keys.append((max(frame_start, dip_at - 1), base_value))
        keys.append((dip_at, base_value * low_frac))
        keys.append((min(frame_end, dip_at + dip_width), base_value))
    return keys


def generate_damped_sine_keys(frame_start, frame_end, amplitude, decay_per_frame,
                               period_frames, samples=20):
    """A damped sinusoid as explicit sample keys (F-curves have no native
    damped-sine primitive): amplitude decays by decay_per_frame's rate every
    frame, oscillating at period_frames. Returns OFFSETS from a base value,
    zero by frame_end (\"swings ... and settles\"). Pair with interp='BEZIER'.
    """
    import math
    span = frame_end - frame_start
    keys = []
    for i in range(samples + 1):
        t = span * i / samples
        f = frame_start + t
        env = amplitude * math.exp(-decay_per_frame * t)
        val = env * math.sin(2 * math.pi * t / period_frames)
        keys.append((f, val))
    keys.append((frame_end, 0.0))
    return keys


def mirrored_location_keys(base_loc, cam_keys_xyz):
    """The pin rule: an aim target (or any object) that must not change the
    camera's framing keeps constant projected size AND position iff it moves
    by the camera's exact location delta, frame-for-frame. Given the camera's
    own (frame, (x,y,z)) keys, return the same frames for `base_loc` offset by
    each key's delta from the camera's first key. No lens/depth term needed --
    exact at every frame because rotation is held constant by this same trick
    at the TRACK_TO level (or is simply not orbiting the target).
    """
    if not cam_keys_xyz:
        return []
    f0, v0 = cam_keys_xyz[0]
    out = []
    for f, v in cam_keys_xyz:
        dx, dy, dz = v[0] - v0[0], v[1] - v0[1], v[2] - v0[2]
        out.append((f, (base_loc[0] + dx, base_loc[1] + dy, base_loc[2] + dz)))
    return out
