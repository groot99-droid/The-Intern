---
tags: [blender-pipeline]
---

# Blender Pipeline

← [[README|Router]]

A secondary, parallel pipeline to the Higgsfield/Kling generation in [[docs/Design Docs|docs/02_GENERATION_HIGGSFIELD.md]]: hand-built 3D environments for the same scenes, modeled against the same reference stills.

## Files
- **[[blender/export_game_assets.py|export_game_assets.py]]** — the Blender→game render bridge (see below). Unlike the three mirrors listed further down, this one lives on disk only; it is not a Text datablock inside the `.blend`.
- **[[blender/atmosphere_pass.py|atmosphere_pass.py]]** — Track C, families 1–2: places the clock and the paper slips as collection instances. Idempotent (`--apply`, `--replace`).
- **[[blender/atmosphere_assets.py|atmosphere_assets.py]]** — Track C, families 4–5: builds the `Handprint` and `Monogram` collections (reusing the `.blend`'s own `material_factories.py`) and places them.
- **[[blender/build_s4c_furniture.py|build_s4c_furniture.py]]** — furnishes the S4_C cubicle grid with 12 desk/monitor/chair workstations built from existing meshes (see below).
- **[[blender/verify_placements.py|verify_placements.py]]** — projects every collection instance into its scene camera and reports normalized screen position, depth and on-screen size. **Use this instead of rendering to check placement** — it caught nine off-frame motifs in one 15-second run that would each have cost a render to find.
- **`ninety-nine_pilots_backup_pre_atmosphere.blend`** — snapshot taken before the Track C pass.
- **`ninety-nine_pilots.blend`** — the working file. One Scene per environment plus a shared `_SharedAssetLibrary`; materials come from a two-tier `material_factories.py` pipeline (`PhotorealArch_*` / `LowPolyProp_*` factories) stashed as a Text datablock inside the file.
- **`ninety-nine_pilots.blend1`** — Blender's own automatic one-generation-back save backup. Normal, regenerated on every save — not something to clean up.
- **`PLAN_remaining_scenes.md`** — the environment-by-environment build plan (phases, shared-asset needs, process notes). Its status section has been refreshed to match current progress — see [[blender/renders/Scene Renders|Scene Renders]] for the authoritative per-scene file inventory.

### On-disk mirrors of the in-.blend pipeline code
The `.blend` carries 3 Python Text datablocks that the pilot scenes were built with. They previously existed *only* inside the file (unreviewable, unversioned outside it); these are exported, read-only copies for continuity — the in-`.blend` copies remain authoritative, re-export after editing there:
- **[[blender/material_factories.py|material_factories.py]]** — the two-tier shading pipeline: `make_photoreal_material()` (PhotorealArch_\*) and `make_lowpoly_material()` (LowPolyProp_\*, flat-shaded N-band toon ramp), plus `apply_vertex_snap()`.
- **[[blender/prop_builders.py|prop_builders.py]]** — bmesh geometry helpers: primitives (`bm_add_box`/`bm_add_pyramid`/`bm_add_ngon_prism`/`bm_add_ring_band`) and archetype builders (`build_hand`, `build_chair`, `build_shelving_bay`, `build_door`, `add_desk_drawer`, `add_monitor_stand`, `add_car_details`).
- **[[blender/helpers.py|helpers.py]]** — `check_camera_clearance()` (the bounding-box clearance check called for in PLAN_remaining_scenes.md's "process changes" section) and `point_obj_at()`.

## The scene-builder copies (Higgsfield)
Every set in `ninety-nine/data/rooms.json` is also a Blender 5.2 scene in the Higgsfield 3D scene builder, built from the same data by [[ninety-nine/tools/higgsfield_scene.py|ninety-nine/tools/higgsfield_scene.py]]: architecture, box props, the catalog props, lights and the ShotCam keyed with every camera move. [[blender/higgsfield/README|blender/higgsfield/README.md]] lists the 18 projects, their revisions and the proof renders (`in`/`out` stills, `leave`/`arrive` move proofs) that live beside it; `projects.json` there is the id table. The game plays the same moves live, so those proofs are the shoot's record, not assets the game loads.

## The render bridge (Track B1/B3)
[[blender/export_game_assets.py|export_game_assets.py]] maps each Blender scene+frame to a game asset slot in the Doc 2 §1 naming grammar and renders into a **staging** root, `renders/_game/{img,vid}/`. Nothing here writes into the game's `assets/` tree directly — [[ninety-nine/tools/stage_assets.py|ninety-nine/tools/stage_assets.py]] copies staged files in, verifies the byte size, rewrites the `MANIFEST.csv` row from the new file, and moves whatever it replaced into `assets/_retired_ai/` (the AI stills have no seeds and can't be regenerated). `--restore` puts them back.

This is the replacement for the `copy_assets.py` the plan assumed: that file went with the consolidated-away `FINAL_NINETY-NINE_*` delivery folders, so there was nothing left to extend.

- Stills render at 1920×1080 @64 samples; video at **1280×720 @32**, measured at 4.4 s/frame against 18.2 s/frame for full-res — a full-range video pass is under 4 hours instead of 15–20.
- Long passes run headless so they don't lock the Blender UI: `blender.exe -b <file>.blend -P export_game_assets.py -- --stills` (or `--videos`, or `--slots A B C`). **Headless renders the *saved* file**, so save first if a session has unsaved edits.
- Every render saves and restores the scene's own output settings, so the `.blend` is left as found — which is also why the stale output paths in the follow-up table below don't affect it.
- `slot_report()` prints the mapping plus the slots that aren't buildable yet (all transitions, including the 15 swap clips Track A's `pickTransition()` is waiting on).

## Atmospheric motifs (Track C)
Six motif families, each a fixed count with a placement rule, instanced from a single collection so one mesh edit cascades. Placement is verified with [[blender/verify_placements.py|verify_placements.py]], not by eye.

| # | Motif | State |
|---|---|---|
| 1 | The clock (canon C8, "it is the same clock") | **Done** — 6 visible: S1_C wall, S4_C far wall, S5_C floating at the light pool's edge, S7_C inside the cab, S8_C hanging in fog, SE_ASSIM boardroom. Never two in frame. The boardroom one has `visible_glossy` off, so it is the one object the glass table does not reflect. |
| 2 | The count, 99 → 100 | **Done** — exactly one slip per scene after S1 (11 new), plus the hundredth already on the boardroom's empty chair. |
| 3 | Harlowe, absence only | **Partial** — the S6_C manifest row ("whatever is in the box, do not sign for it") already ships in `text/manifest.json`, and S4_C now has desks and chairs (below), so there is finally a chair to push back. Still to build: the HARLOWE nameplate, S4_H's labelled door ajar, S5_C's resignation file + mug ring, S5_H's one clean car. |
| 4 | Three handprints, chest height, never four | **Done** — S3_H lobby glass, S7_C cab (back wall: the side walls fall outside that 16mm frame), S8_H storefront glass from outside. |
| 5 | The V&A monogram | **Done** — S1_C floor emblem already existed; added to the S3_C curtain, beside the S7_C button panel, and etched in the boardroom table beside the package. |
| 6 | Wrong counts | **Already satisfied** — `EL_ButtonPanel` is 528 verts = **66 buttons**, the S0_X tower has no top, and `MR_BoxTowers` is the grid that never resolves in the fog. |

**The boardroom's empty chair moved to the head of the table.** It and the hundredth slip used to sit at y=1.5, *behind* `BR_Cam` (y=1.9, looking away down the table), so the payoff of motif 2 never rendered. The chair is now at y=10.75 turned to face back down the table at the twelve figures. The slip is on the glass in front of it, **not on the seat**: from this camera the sight line to a seat at the head passes under the table top around y=10, so a slip there is in frame and invisible. It is also offset to x=0.45, because the soggy package sits dead centre at y=6.0 and blocks anything behind it on the centre line.

## S4_C cubicle furniture
[[blender/build_s4c_furniture.py|build_s4c_furniture.py]] furnishes `S4C_Cubicles`, which shipped as a cubicle maze with nothing in the cubicles. 12 workstations (both banks × 6 rows), built by **reusing existing meshes** rather than modelling new ones — `DV_Desk`, `DV_Monitor` and `S1_Chair_L0` are all centred local-space meshes, so the new objects share those datablocks and one edit to the S5_C desk changes every desk on the floor. Desk + monitor are instanced from a `CubicleDesk` collection; chairs are separate objects so a single one can be moved (Harlowe's).

Grid read off `CB_Partitions`: banks at x[-3.10,-1.10] and x[1.10,3.10], six rows with back panels at y = 1.50, 3.90, 6.30, 8.70, 11.10, 13.50, aisle 2.2 m. Desk 0.40 m out from each back panel, chair 0.75 m beyond it, rotated +90° about Z so the occupant faces the desk (the chair mesh's backrest is on +X, so it faces −X by default).

**None of it is visible in the current S4_C shot, and that is geometry, not a bug.** The partitions are 1.30 m; the tallest piece is the monitor at 0.95 m. `CB_Cam` sits in the aisle at 1.60 m with a 1.3° downward tilt, so every sight line into a cubicle is intercepted by that cubicle's own panel. Verified: all 24 pieces sit at z 0.00–0.95, inside their banks. The furniture pays off when S4_C gets the camera move it still needs (Track B2) — or immediately, if Harlowe's chair is pushed out into the aisle, which is exactly what family 3 asks for.

One thing the atmosphere pass surfaced that is *not* a placement bug:
- **The clock's cover reads as an opaque white plate.** Fine at 8.7m in S1_C; at 1.4m in the elevator it is a large blank disc that dominates the cab, which fights "never lit specially." Fixing it means editing the shared `Clock_Handless` asset, which cascades to all six instances — not done unilaterally.

## Subsections
- [[blender/refs/Reference Images|refs/]] — the reference stills used for visual matching
- [[blender/renders/Scene Renders|renders/]] — one folder per environment, final stills + (for the 3 pilots) walkthrough animations

## Known follow-up: render output paths
The 11 renamed `renders/` folders (see [[blender/renders/Scene Renders|Scene Renders]] for the full before/after) still have their *old* names saved as each Scene's render output path inside `ninety-nine_pilots.blend` (Output Properties → Output path, per Scene). Blender was connected via MCP at reorg time but had a different, unrelated file open (`quit.blend`, a temp file) rather than this one, so the paths couldn't be safely updated without switching out whatever was live in the user's Blender session. Next time this file is open in Blender, update each affected Scene's output path to match its renamed folder:

| Scene | Old output path | New output path |
|---|---|---|
| S0X_Apartment | `//renders/S0X_Apartment/` | `//renders/S0_X_Apartment/` |
| S0X_Street | `//renders/S0X_Street/` | `//renders/S0_X_Street/` |
| S3C | `//renders/S3C/` | `//renders/S3_C/` |
| S4C | `//renders/S4C/` | `//renders/S4_C/` |
| S4H | `//renders/S4H/` | `//renders/S4_H/` |
| S5C | `//renders/S5C/` | `//renders/S5_C/` |
| S7C | `//renders/S7C/` | `//renders/S7_C/` |
| S7H | `//renders/S7H/` | `//renders/S7_H/` |
| S8C | `//renders/S8C/` | `//renders/S8_C/` |
| S8H | `//renders/S8H/` | `//renders/S8_H/` |
| S8H_Store | `//renders/S8H_Store/` | `//renders/S8_H_Store/` |

(S1_C, S3_H, S5_H, SE_ASSIM were already named consistently and don't need a path change.)
