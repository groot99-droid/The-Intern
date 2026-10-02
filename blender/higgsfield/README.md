---
tags: [blender-pipeline]
---

# Higgsfield scene-builder projects

← [[blender/Blender Pipeline|Blender Pipeline]] · [[README|Router]]

Every set the game plays from `ninety-nine/data/rooms.json` also exists as a Blender 5.2 scene in the Higgsfield 3D scene builder ("3D Jutsu"), built by [[ninety-nine/tools/higgsfield_scene.py|ninety-nine/tools/higgsfield_scene.py]] from the same data, with the same open-source catalog props and the same camera moves. `projects.json` next to this note maps each room key to its project, the committed revision that holds the finished set, and the proof-render operation; each `<ROOM>/` folder holds that project's proof renders.

## What one project holds

1. **build** — the room's architecture (floor, walls, ceiling, beams, skirting, the `boxes`), every box-built prop (`p_*` builders mirrored from `src/walk/props.js`), the lights (sun toward the core, canon C2; points and spots at the game's positions) and the **ShotCam**, keyed with the room's `shots`: `in` and `out` poses as single frames, every move (`loop`, `leave`, `arrive`, `call`, `push`, `descend`, `lean`, `ending`, `retained`) as a Bezier ease between its two poses at 24 fps, with a timeline marker per shot and the frame table stored on the scene as `shots`.
2. **imports** — each distinct catalog model the room places, imported once through the scene builder's catalog (`scene_builder_3d_import_asset`) at its first placement.
3. **place** — the remaining placements as copies of the imported entity (position, yaw, scale in the game's axes, converted to Blender's).
4. **proof** — a query that renders the `in` and `out` poses with Eevee and the `leave` and `arrive` moves with Workbench, published as artifacts and downloaded here.

Game axes are `(x, y up, z toward the entrance)`; the builder maps them to Blender's `(x, -z, y)`, so a glTF export of a project lands back in the game's frame.

## The shoot

The user-facing transitions are the `leave` + `arrive` camera moves. The Blender worker renders Eevee at roughly ten seconds a frame on its software GPU, so the full clips are **not** rendered there: the game plays the identical moves live through `src/stage/stage.js` (`ninety-nine/src/stage/`), and what sits in each `<ROOM>/` folder is the shoot's proof:

| File | What |
|---|---|
| `<ROOM>_in.png`, `<ROOM>_out.png` | Eevee stills of the two poses (960×540 at 6 samples; 640×360 at 2–3 samples for the four heaviest sets: the street, the dive, the edge and the cubicle floor, whose full-size pass ran past the worker's five-minute deadline) |
| `<ROOM>_leave.mp4`, `<ROOM>_arrive.mp4` | Workbench proofs of the two transition moves (640×360, every second frame; 480×270, every fourth frame for the same four sets) |

A full-quality clip of any move is one more query away: raise the resolution and samples in `higgsfield_scene.py`'s `PROOF_TEMPLATE` and render the marker range with Eevee, splitting a long move across several queries to stay inside the worker deadline.

## Projects

Open any project at `https://higgsfield.ai/3d-jutsu/<id>`; the ids and revisions are in `projects.json`.

| Room | Set | Catalog props | Proof |
|---|---|---|---|
| S0_X | the apartment | table lamp, book stack, wooden chair | `S0_X/` |
| SET_STREET | the commute | brownstones, apartment blocks, the tower, street lamps, traffic light, hydrant, trash bin, four cars | `SET_STREET/` |
| S1_C | the waiting room (sterile) | accent chairs | `S1_C/` |
| S1_H | the waiting room (scattered) | accent chairs | `S1_H/` |
| S3_C | the threshold corridor | security camera | `S3_C/` |
| S3_H | the lobby doors | accent chairs, payphone | `S3_H/` |
| S4_C | the cubicle floor | 84 desks, CRT terminals, wooden chairs | `S4_C/` |
| S4_H | the janitorial labyrinth | wash basins, breaker panel | `S4_H/` |
| S5_C | the desk in the void | wooden chair | `S5_C/` |
| S5_H | the parking garage | six cars | `S5_H/` |
| S6_C | the requisition terminal | wooden chair | `S6_C/` |
| S6_H | the concrete edge | three cars | `S6_H/` |
| S7_C | the freight elevator | cage lamp | `S7_C/` |
| SET_DIVE | the pool | the lift | `SET_DIVE/` |
| S8_C | the mailroom | pallet stacks, guard desk, mail sacks | `S8_C/` |
| S8_H | the convenience store | shelf racks | `S8_H/` |
| SE_ASSIM | the boardroom | accent chairs | `SE_ASSIM/` |
| SE_PEND | pending review | accent chairs | `SE_PEND/` |

`S2_C`/`S2_H` play in the waiting rooms, `S7_H` on the edge, `SE_RETAINED` in the boardroom and `SE_EXPUL` in the store, so those keys are aliases in `projects.json` rather than projects.

## Rebuilding after a set changes

Edit `ninety-nine/tools/build_rooms.py`, re-run it, then for the room: create a fresh project (or start from revision 0 of the old one), run `python ninety-nine/tools/higgsfield_scene.py <ROOM> build` and paste its code into `scene_builder_3d_run_python`, then `imports` (one `scene_builder_3d_import_asset` per line), `place` (one more `run_python`) and `proof` (a `scene_builder_3d_query_python`), and record the new id and revision in `projects.json`. A copied import must not carry the catalog entity's `hf_id`/`hf_asset` custom properties, which is why `place` strips them.
