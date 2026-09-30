# Track B1: the render bridge. Blender emits files the game's existing
# loader already expects -- there is no 3D runtime and no .glb anywhere in
# this project, so "bridging the models into the game" is a render-and-name
# job, not an engine job.
#
# Naming grammar is Doc 2 Sec.1 / Doc 4 Sec.4: S{n}_{R}_{TYPE}[_{TARGET}].{ext},
# which is what data/scenes.json references by filename.
#
# This writes into a STAGING root (blender/renders/_game/), never straight
# into ninety-nine/assets/. Staging is what ninety-nine/tools/stage_assets.py
# then verifies and copies in, backing up whatever it replaces -- the live
# assets/ tree is the single source of truth for the game (CLAUDE.md) and
# the AI stills are not recoverable once overwritten.
#
# Run it from Blender (MCP or the Text editor):
#     exec(open(r"C:\Users\utopi\The New Intern\blender\export_game_assets.py").read())
#     export(["S1_C_IMG_IN", "S1_C_IMG_OUT"])     # named slots
#     export_scene("S1_C_WaitingRoom")            # every slot from one scene
#     print(slot_report())                        # what maps to what
#
# Every render restores the scene's own output settings afterwards, so the
# .blend's saved state is left exactly as found. That also sidesteps the
# stale render-output-path follow-up in blender/Blender Pipeline.md: this
# script never reads those paths, it sets its own per render.

import bpy
import os

PROJECT_ROOT = r"C:\Users\utopi\The New Intern"
STAGING_ROOT = os.path.join(PROJECT_ROOT, "blender", "renders", "_game")

# Stills at the .blend's native 16:9. The delivered AI stills are 2688x1520
# (1.768) and the Kling clips 1912x1080 -- both odd sizes inherited from the
# generators, neither worth reproducing. The game scales either way.
STILL_RES = (1920, 1080)

# Video is deliberately cheaper than stills. Measured on S1_C_WaitingRoom:
# 1920x1080 @64 = 18.2s/frame, 1280x720 @32 = 4.4s/frame. A full-range
# video pass at full res is 15-20 hours of rendering; at 720p/32 it is under
# four. The game plays video in a small window and the delivered Kling clips
# were 1912x1080 anyway, so the drop is not visible at PS1-prop scale.
# Stills stay at full res -- they are one frame each and cost nothing.
VIDEO_RES = (1280, 720)
VIDEO_SAMPLES = 32

# Doc 4 Sec.8.3: every source file is stripped of audio, and
# test/cases/video.audiotrack.js asserts it. The drone is the only sound
# that survives a scene change (C7), so a clip carrying its own audio track
# would fight it.
VIDEO_AUDIO_CODEC = "NONE"

# Proof pass (motion pass, Phase 5): a cheap first/last-frame spot check for
# every VIDEO slot, so a bad move or a dead-freeze range shows up as a wrong
# still in ~10s instead of at the end of a multi-hour full pass. Never
# touches the real staging tree -- separate root, separate filenames.
PROOF_ROOT = os.path.join(PROJECT_ROOT, "blender", "renders", "_proof")
PROOF_RES = (640, 360)
PROOF_SAMPLES = 8

# game slot -> where it comes from.
#   scene:  Blender scene name
#   frame:  "start" | "end" | int, for stills
#   kind:   "still" | "video"
#   hide:   object names to hide for this render only (restored afterwards)
SLOTS = {
    # S0 prologue (branchless). Doc 1 calls it S0_C_*; Doc 2 and the shipped
    # files use S0_X_*, and scenes.json follows the files.
    "S0_X_IMG_IN":  {"scene": "S0X_Apartment", "frame": "start", "kind": "still"},
    "S0_X_IMG_OUT": {"scene": "S0X_Street",    "frame": "end",   "kind": "still"},

    "S1_C_IMG_IN":  {"scene": "S1_C_WaitingRoom", "frame": "start", "kind": "still"},
    "S1_C_IMG_OUT": {"scene": "S1_C_WaitingRoom", "frame": "end",   "kind": "still"},
    "S1_C_VID":     {"scene": "S1_C_WaitingRoom", "kind": "video"},

    "S3_C_IMG_IN":  {"scene": "S3C_Threshold",    "frame": "start", "kind": "still"},
    "S3_C_IMG_OUT": {"scene": "S3C_Threshold",    "frame": "end",   "kind": "still"},
    "S3_C_VID":     {"scene": "S3C_Threshold",    "kind": "video"},
    "S3_H_IMG_IN":  {"scene": "S3_H_LobbyDoors",  "frame": "start", "kind": "still"},
    "S3_H_IMG_OUT": {"scene": "S3_H_LobbyDoors",  "frame": "end",   "kind": "still"},
    "S3_H_VID":     {"scene": "S3_H_LobbyDoors",  "kind": "video"},

    # S4_C's figure-free dolly: the manager is composited over it as a
    # billboard (mg03-corridor.js), because S4_C_VID's Kling walk cycle was
    # rejected -- see MANIFEST.csv.
    "S4_C_IMG_IN":  {"scene": "S4C_Cubicles", "frame": "start", "kind": "still"},
    "S4_C_IMG_OUT": {"scene": "S4C_Cubicles", "frame": "end",   "kind": "still"},
    # The game's S4_C clip is the PLATE (figure-free): mg03-corridor.js
    # composites the manager over it as a billboard, so he must not also be
    # standing in the plate itself -- he is a collection instance in this
    # scene (CB_Manager_Inst -> Character_Standing), hidden for these three.
    # The IMG_IN/IMG_OUT stills above keep him: they are the sprite source.
    "S4_C_VID_PLATE":  {"scene": "S4C_Cubicles", "kind": "video", "hide": ["CB_Manager_Inst"]},
    "S4_C_PLATE_IN":   {"scene": "S4C_Cubicles", "frame": "start", "kind": "still", "hide": ["CB_Manager_Inst"]},
    "S4_C_PLATE_OUT":  {"scene": "S4C_Cubicles", "frame": "end",   "kind": "still", "hide": ["CB_Manager_Inst"]},
    "S4_H_IMG_IN":  {"scene": "S4H_Utility",  "frame": "start", "kind": "still"},
    "S4_H_IMG_OUT": {"scene": "S4H_Utility",  "frame": "end",   "kind": "still"},
    "S4_H_VID":     {"scene": "S4H_Utility",  "kind": "video"},

    "S5_C_IMG_IN":  {"scene": "S5C_DeskVoid",         "frame": "start", "kind": "still"},
    "S5_C_IMG_OUT": {"scene": "S5C_DeskVoid",         "frame": "end",   "kind": "still"},
    "S5_C_VID":     {"scene": "S5C_DeskVoid",         "kind": "video"},
    "S5_H_IMG_IN":  {"scene": "S5_H_ParkingGarage",   "frame": "start", "kind": "still"},
    "S5_H_IMG_OUT": {"scene": "S5_H_ParkingGarage",   "frame": "end",   "kind": "still"},
    "S5_H_VID":     {"scene": "S5_H_ParkingGarage",   "kind": "video"},

    "S7_C_IMG_IN":  {"scene": "S7C_Elevator", "frame": "start", "kind": "still"},
    "S7_C_IMG_OUT": {"scene": "S7C_Elevator", "frame": "end",   "kind": "still"},
    "S7_C_VID":     {"scene": "S7C_Elevator", "kind": "video"},
    "S7_H_IMG_IN":  {"scene": "S7H_Pool",     "frame": "start", "kind": "still"},
    "S7_H_IMG_OUT": {"scene": "S7H_Pool",     "frame": "end",   "kind": "still"},
    "S7_H_VID":     {"scene": "S7H_Pool",     "kind": "video"},

    # S8 is two rooms per branch in one scene entry (Doc 1 Sec.5 S8):
    # mailroom -> boardroom, and the dive -> the store.
    "S8_C_IMG_IN":  {"scene": "S8C_Mailroom",       "frame": "start", "kind": "still"},
    "S8_C_IMG_OUT": {"scene": "SE_ASSIM_Boardroom", "frame": "end",   "kind": "still"},
    "S8_C_VID":           {"scene": "S8C_Mailroom",       "kind": "video"},
    "S8_C_VID_BOARDROOM": {"scene": "SE_ASSIM_Boardroom", "kind": "video"},
    "S8_H_IMG_IN":  {"scene": "S8H_Underwater",     "frame": "start", "kind": "still"},
    "S8_H_IMG_OUT": {"scene": "S8H_Store",          "frame": "end",   "kind": "still"},
    "S8_H_VID":       {"scene": "S8H_Underwater", "kind": "video"},
    "S8_H_VID_STORE": {"scene": "S8H_Store",      "kind": "video"},
}

# Slots with no Blender scene yet -- Track B2 builds these as redresses and
# new cameras on existing sets, not as new environments. Listed here so the
# gap is visible from inside the pipeline rather than only in the plan.
MISSING_SLOTS = {
    "S0_X_VID": "one clip spanning apartment -> commute -> street (scenes.json's "
                "ambienceSecondary fades in at the 'commute' beat), so it needs a two-part "
                "edit rather than one scene's frame range",
    "SE_*_VID": "the ending ROOMS, separate from the S8_*_TRN_SE_* clips that get the player "
                "there; SE_ASSIM would need its own camera in the boardroom scene",
    "*_TRN_*":  "every transition, including the 15 swap clips Track A's pickTransition() is "
                "waiting on -- each needs a camera move authored between two set states",
    "S1_H_*":   "redress of S1_C_WaitingRoom: two stops hot, chairs scattered, dispenser ribbon",
    "S2_C/H_*": "new camera tight on the reception glass in the S1 set; jaw as 4 stills for flipbook.js",
    "S6_C_*":   "monitor bezel + keyed green region, derived from S5C_DeskVoid",
    "S6_H_*":   "camera move down S5_H_ParkingGarage to a broken edge over the S7H_Pool water",
    "SE_EXPUL": "from S8H_Store",
    "SE_PEND":  "from S1_C_WaitingRoom, seated camera",
    "SE_RETAINED": "still",
}


def _resolve_frame(scene, spec):
    frame = spec.get("frame", "start")
    if frame == "start":
        return scene.frame_start
    if frame == "end":
        return scene.frame_end
    return int(frame)


def _staging_path(slot, kind):
    sub = "img" if kind == "still" else "vid"
    ext = ".png" if kind == "still" else ".mp4"
    folder = os.path.join(STAGING_ROOT, sub)
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, slot + ext)


class _SceneRenderState:
    """Save/restore everything a render touches, so the .blend is left as found."""

    def __init__(self, scene):
        self.scene = scene
        r = scene.render
        self.saved = {
            "filepath": r.filepath,
            "file_format": r.image_settings.file_format,
            "color_mode": r.image_settings.color_mode,
            "resolution_x": r.resolution_x,
            "resolution_y": r.resolution_y,
            "resolution_percentage": r.resolution_percentage,
            "frame_current": scene.frame_current,
            "ffmpeg_format": r.ffmpeg.format,
            "ffmpeg_codec": r.ffmpeg.codec,
            "ffmpeg_audio_codec": r.ffmpeg.audio_codec,
            "taa_render_samples": getattr(scene.eevee, "taa_render_samples", None),
            "media_type": getattr(r.image_settings, "media_type", None),
        }

    def restore(self):
        r = self.scene.render
        s = self.saved
        r.filepath = s["filepath"]
        # media_type gates which file_format values are even legal, so it has
        # to go back first (Blender 5.x).
        if s["media_type"] is not None:
            r.image_settings.media_type = s["media_type"]
        r.image_settings.file_format = s["file_format"]
        r.image_settings.color_mode = s["color_mode"]
        r.resolution_x = s["resolution_x"]
        r.resolution_y = s["resolution_y"]
        r.resolution_percentage = s["resolution_percentage"]
        self.scene.frame_set(s["frame_current"])
        r.ffmpeg.format = s["ffmpeg_format"]
        r.ffmpeg.codec = s["ffmpeg_codec"]
        r.ffmpeg.audio_codec = s["ffmpeg_audio_codec"]
        if s["taa_render_samples"] is not None:
            self.scene.eevee.taa_render_samples = s["taa_render_samples"]


def export_slot(slot):
    """Render one game slot into the staging root. Returns its path."""
    spec = SLOTS.get(slot)
    if spec is None:
        raise KeyError("unknown slot %r (see SLOTS / MISSING_SLOTS)" % slot)

    scene = bpy.data.scenes.get(spec["scene"])
    if scene is None:
        raise KeyError("scene %r not in this .blend" % spec["scene"])
    if scene.camera is None:
        raise ValueError("scene %r has no active camera" % scene.name)

    # Set the active scene FIRST: view_layer.update() only refreshes the
    # active one, so anything reading transforms off a non-active scene
    # reads stale values. Same trap as the camera-clearance checks.
    prev_scene = bpy.context.window.scene
    bpy.context.window.scene = scene
    state = _SceneRenderState(scene)
    out = _staging_path(slot, spec["kind"])

    hidden = []
    for obj_name in spec.get("hide", []):
        obj = scene.objects.get(obj_name)
        if obj is None:
            raise KeyError("slot %r wants to hide %r, which is not in scene %r"
                           % (slot, obj_name, scene.name))
        hidden.append((obj, obj.hide_render))
        obj.hide_render = True

    try:
        r = scene.render
        if spec["kind"] == "still":
            r.resolution_x, r.resolution_y = STILL_RES
            r.resolution_percentage = 100
            if hasattr(r.image_settings, "media_type"):
                r.image_settings.media_type = "IMAGE"
            r.image_settings.file_format = "PNG"
            r.image_settings.color_mode = "RGBA" if r.film_transparent else "RGB"
            scene.frame_set(_resolve_frame(scene, spec))
            r.filepath = out
            bpy.ops.render.render(write_still=True)
        else:
            r.resolution_x, r.resolution_y = VIDEO_RES
            r.resolution_percentage = 100
            if hasattr(scene.eevee, "taa_render_samples"):
                scene.eevee.taa_render_samples = VIDEO_SAMPLES
            # Blender 5.x: FFMPEG is not in file_format's enum until
            # media_type is VIDEO. Setting file_format first fails with
            # 'enum "FFMPEG" not found', which lists only image formats and
            # reads like a build without ffmpeg support.
            if hasattr(r.image_settings, "media_type"):
                r.image_settings.media_type = "VIDEO"
            r.image_settings.file_format = "FFMPEG"
            r.ffmpeg.format = "MPEG4"
            r.ffmpeg.codec = "H264"
            r.ffmpeg.audio_codec = VIDEO_AUDIO_CODEC
            # Blender appends the frame range to an FFMPEG output path, so
            # hand it the stem and rename the result to the exact slot name
            # the loader asks for.
            stem = out[:-4]
            r.filepath = stem
            bpy.ops.render.render(animation=True)
            produced = "%s%04d-%04d.mp4" % (stem, scene.frame_start, scene.frame_end)
            if os.path.exists(produced):
                if os.path.exists(out):
                    os.remove(out)
                os.rename(produced, out)
    finally:
        for obj, was_hidden in hidden:
            obj.hide_render = was_hidden
        state.restore()
        bpy.context.window.scene = prev_scene

    return out


def _proof_path(slot, tag):
    os.makedirs(PROOF_ROOT, exist_ok=True)
    return os.path.join(PROOF_ROOT, "%s_%s.png" % (slot, tag))


def export_slot_proof(slot):
    """Render just frame_start and frame_end of a VIDEO slot as small stills,
    routed through the same _SceneRenderState save/restore as export_slot so
    it never leaves the .blend's render settings touched. Returns (start_path,
    end_path). Stills-kind slots aren't proofed -- a single still has no
    range to spot-check."""
    spec = SLOTS.get(slot)
    if spec is None:
        raise KeyError("unknown slot %r (see SLOTS / MISSING_SLOTS)" % slot)
    if spec["kind"] != "video":
        raise ValueError("slot %r is a still, not a video -- nothing to proof" % slot)

    scene = bpy.data.scenes.get(spec["scene"])
    if scene is None:
        raise KeyError("scene %r not in this .blend" % spec["scene"])
    if scene.camera is None:
        raise ValueError("scene %r has no active camera" % scene.name)

    prev_scene = bpy.context.window.scene
    bpy.context.window.scene = scene
    state = _SceneRenderState(scene)

    hidden = []
    for obj_name in spec.get("hide", []):
        obj = scene.objects.get(obj_name)
        if obj is None:
            raise KeyError("slot %r wants to hide %r, which is not in scene %r"
                           % (slot, obj_name, scene.name))
        hidden.append((obj, obj.hide_render))
        obj.hide_render = True

    try:
        r = scene.render
        r.resolution_x, r.resolution_y = PROOF_RES
        r.resolution_percentage = 100
        if hasattr(r.image_settings, "media_type"):
            r.image_settings.media_type = "IMAGE"
        r.image_settings.file_format = "PNG"
        r.image_settings.color_mode = "RGBA" if r.film_transparent else "RGB"
        if hasattr(scene.eevee, "taa_render_samples"):
            scene.eevee.taa_render_samples = PROOF_SAMPLES

        out_paths = []
        for tag, frame in (("start", scene.frame_start), ("end", scene.frame_end)):
            scene.frame_set(frame)
            out = _proof_path(slot, tag)
            r.filepath = out
            bpy.ops.render.render(write_still=True)
            out_paths.append(out)
    finally:
        for obj, was_hidden in hidden:
            obj.hide_render = was_hidden
        state.restore()
        bpy.context.window.scene = prev_scene

    return tuple(out_paths)


def export(slots):
    """Render a list of slots. Keep batches small -- 5 full renders in one
    MCP call has timed out before, and the boardroom is the slowest scene."""
    done = []
    for slot in slots:
        done.append((slot, export_slot(slot)))
    return done


def export_scene(scene_name):
    return export([s for s, spec in SLOTS.items() if spec["scene"] == scene_name])


def _cli():
    """Headless entry point, so a long pass doesn't lock the Blender UI:

        blender.exe -b "...\\ninety-nine_pilots.blend" \\
            -P "...\\export_game_assets.py" -- --stills
        ... -- --videos
        ... -- --slots S1_C_VID S4_C_VID_PLATE

    Headless runs the SAVED .blend, not whatever is unsaved in an open
    session. Each slot prints as it finishes so the log shows progress.

        ... -- --proof                 every VIDEO slot's first+last frame
        ... -- --proof --slots S1_C_VID S5_H_VID
    """
    import sys
    import time

    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

    if "--proof" in argv:
        wanted = (argv[argv.index("--slots") + 1:] if "--slots" in argv
                  else [s for s, spec in SLOTS.items() if spec["kind"] == "video"])
        print("proofing %d video slot(s) to %s" % (len(wanted), PROOF_ROOT), flush=True)
        started = time.time()
        failed = []
        for i, slot in enumerate(wanted, 1):
            t = time.time()
            try:
                paths = export_slot_proof(slot)
                print("[%d/%d] %-20s %5.1fs  %s" % (i, len(wanted), slot, time.time() - t, paths), flush=True)
            except Exception as exc:
                failed.append((slot, str(exc)))
                print("[%d/%d] %-20s FAILED: %s" % (i, len(wanted), slot, exc), flush=True)
        print("proof done in %.1fs; %d ok, %d failed" % (time.time() - started, len(wanted) - len(failed), len(failed)), flush=True)
        for slot, why in failed:
            print("  FAILED %s: %s" % (slot, why), flush=True)
        return

    wanted = []
    if "--stills" in argv:
        wanted += [s for s, spec in SLOTS.items() if spec["kind"] == "still"]
    if "--videos" in argv:
        wanted += [s for s, spec in SLOTS.items() if spec["kind"] == "video"]
    if "--slots" in argv:
        wanted += argv[argv.index("--slots") + 1:]
    if not wanted:
        print(slot_report())
        return

    print("exporting %d slot(s) to %s" % (len(wanted), STAGING_ROOT), flush=True)
    started = time.time()
    failed = []
    for i, slot in enumerate(wanted, 1):
        t = time.time()
        try:
            path = export_slot(slot)
            print("[%d/%d] %-20s %6.1fs  %s" % (i, len(wanted), slot, time.time() - t, path), flush=True)
        except Exception as exc:  # keep going: one bad slot shouldn't lose the batch
            failed.append((slot, str(exc)))
            print("[%d/%d] %-20s FAILED: %s" % (i, len(wanted), slot, exc), flush=True)
    print("done in %.1f min; %d ok, %d failed" % ((time.time() - started) / 60, len(wanted) - len(failed), len(failed)), flush=True)
    for slot, why in failed:
        print("  FAILED %s: %s" % (slot, why), flush=True)


def slot_report():
    lines = ["%-14s %-22s %s" % ("SLOT", "BLENDER SCENE", "KIND")]
    for slot in sorted(SLOTS):
        spec = SLOTS[slot]
        lines.append("%-14s %-22s %s" % (slot, spec["scene"], spec["kind"]))
    lines.append("")
    lines.append("not yet buildable (Track B2):")
    for slot, why in MISSING_SLOTS.items():
        lines.append("  %-13s %s" % (slot, why))
    return "\n".join(lines)


# Only fires under `blender -b -P this_file`; an exec() from the MCP session
# or the Text editor leaves __name__ alone and just defines the functions.
if __name__ == "__main__":
    _cli()
