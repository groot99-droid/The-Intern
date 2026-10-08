---
tags: [router]
---

# CLAUDE.md

← [[README|Router]]

Persistent context for working in this repo. Start at [[README|README.md]]'s Map section (or the vault graph if you have this open in Obsidian) for a per-folder file index — this file is conventions/guardrails, not a file listing.

## What this is

**ninety-nine**: a static-web narrative game (no build step). The player is an intern at a company that is fake (rendered low-poly PS1) inside a building that is real (rendered photoreal) — see Canon below. [[docs/Design Docs|docs/]] holds the 4 source-of-truth specs: Doc 1 logic, Doc 2 asset generation, Doc 3 mini-game UX (**retired** 2026-10-03), Doc 4 technical build. [[ninety-nine/src/Source Code|ninety-nine/src/]] implements them; where the build has moved on, a dated amendment note sits at the top of the spec's section.

**The game is one continuous first-person walk.** The player spawns in the apartment and walks, without a cut, through one building of live three.js rooms from `ninety-nine/data/rooms.json`:

- [[ninety-nine/src/world/World|src/world/]] places each room in one world space. When a choice is made, it joins the next room behind a doorway through a `CN_*` connector; the door seals behind him and the room he left is dropped.
- Each scene's two choices are **threshold zones** in its room. Walking into one commits the choice (`src/director.js`). Friction comes from how he moves (hesitation, doubling back).
- There are no mini-games, no choice buttons and no fades to black between rooms. The camera is taken from him only for carried moments: sitting at the computer, the call, the cab's descent, the fall into the pool, the chute, the endings' pull-backs.

Doc 2's generated stills and clips, Doc 4 §5's video pool and Doc 3's mini-games no longer exist (the docs describe what they replaced). A parallel [[blender/Blender Pipeline|blender/]] pipeline hand-builds 3D versions of the same environments, and `ninety-nine/tools/higgsfield_scene.py` rebuilds every set in the Higgsfield 3D scene builder (Blender 5.2) with the open-source catalog props and the same camera moves. Those projects predate the continuous building and are stale until rebuilt ([[blender/higgsfield/REBUILD_NOTE|REBUILD_NOTE]]).

## Naming scheme

Sets, audio and scene folders follow `S{n}_{C|H}` (Doc 2 §1 / Doc 4 §4; the old `_{IMG_IN|IMG_OUT|VID|TRN}` suffixes named the removed stills and clips -- their roles are now the set's `in` / `out` poses and its `loop` / `leave` + `arrive` shots). `C` = compliant/succumb render, `H` = hostile/resist render. `S0_X` is the branchless prologue. Endings are `SE_{ASSIM|EXPUL|PEND|RETAINED}`; extra sets are `SET_{STREET|DIVE}`.

Connectors, the passages the continuous building joins rooms with, are `CN_{NAME}`: `CN_STAIRS_APT`, `CN_VESTIBULE`, `CN_CORRIDOR_OFFICE`, `CN_CORRIDOR_SERVICE`, `CN_STAIRS_CONCRETE`, `CN_CORRIDOR_DOWN`, `CN_RAMP_DOWN`, `CN_CHUTE`. They have no scene, no render, no clock and no slip, and they only run level or down (C3).

Several keys are **aliases** of one room, so the scene changes where the player stands: `S2_*` is `S1_*`, `S6_C` is `S5_C` (the desk room carries S5's and S6's thresholds), `S7_H` is `S6_H`, `SE_RETAINED` is `SE_ASSIM` and `SE_EXPUL` is `S8_H`. S8 H's scene is played in `SET_DIVE`; `S8_H` is the store the chute lets out into.

The spine (Doc 1 §4) — scene number → name → what C/H actually mean there:

| # | Scene | Compliant (C) | Hostile (H) |
|---|---|---|---|
| S0 | THE UPLOAD | — no branch — | |
| S1 | THE WAITING ROOM | Sterile, ordered | Scattered, over-lit |
| S2 | THE CALL | "Ninety-nine." | "Shaun." |
| S3 | THE THRESHOLD | Red curtain, green ENTER | Locked glass doors |
| S4 | THE FLOOR | Cubicle maze, the manager | Janitorial labyrinth |
| S5 | THE DESK | Unmarked desk, stapler | Parking garage, rusted cars |
| S6 | THE REQUISITION | Spreadsheet of items | The run that does not end |
| S7 | THE DESCENT | Damaged freight elevator | Concrete edge over the pool |
| S8 | THE DELIVERY | Mailroom → boardroom | Grate → chute → store |
| E | ENDING | ASSIMILATION / RETAINED | EXPULSION / PENDING REVIEW |

A file/folder named e.g. `S5_H` is always "the parking garage," `S4_C` is always "the cubicle maze" — decode any asset name against this table before assuming what it contains.

## Canon (Doc 1 §3) — never violate these when adding/generating anything

- **C1** Company-owned things (people, furniture, vehicles, signage, clothing, paper) render low-poly PS1. The building itself (floors, walls, glass, water, fog, light) renders photoreal.
- **C2** Shadows fall toward the building's core, regardless of light position.
- **C3** No windows, no sky, no ascent after the lobby doors close. Elevators/stairs only descend.
- **C4** Company text never says "you" — "the candidate" / "the applicant" / "personnel." "You" appears exactly once, ever: the final ending card.
- **C5** No NPC blinks or looks up; faces are static or 4-frame jaw loops.
- **C6** Shaun's hands are low-poly from the very first shot, before he's even hired.
- **C7** One continuous 48Hz drone from lobby-doors-closed to the final card; never restarts; detunes ~4 cents/scene.
- **C8** Every clock in every render is the same clock, no hands.

## Don't touch without asking

- `blender/refs/*.png` — the last copies of the AI reference stills (the game's `assets/img` is gone) and may be loaded into `ninety-nine_pilots.blend` by relative path; deleting risks breaking a live reference-image link.
- `ninety-nine_pilots.blend` render output paths — 11 scenes' saved output paths still point at pre-rename folder names (see [[blender/Blender Pipeline|blender/Blender Pipeline.md]] for the exact old→new table). Fixing this needs Blender open with the MCP addon connected *to this specific file* — check `get_blendfile_summary_path_info` reports this file, not a different one, before writing to it.
- `ninety-nine/assets/aud` — the single source of truth for generated audio (the old duplicate `FINAL_NINETY-NINE_*` delivery folders were consolidated away). Don't regenerate/overwrite without checking `MANIFEST.csv` first. `assets/img` and `assets/vid` were removed deliberately (the game is 3D-only); do not bring them back.
- [[blender/material_factories.py|blender/material_factories.py]], [[blender/prop_builders.py|prop_builders.py]], [[blender/helpers.py|helpers.py]] — exported *mirrors* of Text datablocks that live inside the `.blend`. The `.blend` copies are authoritative; editing only the `.py` files here has no effect in Blender.

## Workflow

- Run the game: `.claude/launch.json` → `ninety-nine` config (`python ninety-nine/tools/dev_server.py 8000`). Plain `python -m http.server` won't work (no-cache headers + HTTP Range support are required — see [[ninety-nine/App Overview|App Overview]]).
- Run tests: open `ninety-nine/test/index.html` through that same dev server (fetches are same-origin). No Node/CI on this machine — see [[ninety-nine/test/Tests|Tests]].
- Preview a room without playing to it: `ninety-nine/test/rooms.html?room=S5_H` plays a shot (`&shot=in`), and `&walk=1` walks it alone (connectors too).
- Start the game part-way (dev only): `ninety-nine/index.html?start=S5&render=H` puts the candidate just inside that scene's room, with a score that gives that render, and starts the drone. `?autopilot=SSRRSSRR` walks him through by himself (`src/dev/autopilot.js`): one letter per scene S1–S8, S to succumb, R to resist. It follows a navgrid built from the rooms' colliders, with A*. Extra options are `&seed=H` (answer the form NOT WILLING), `&bail=S4` and `&speed=2.5`, and it combines with `?start=`. It logs `[autopilot]` lines to the console.
- Sets are data: edit `ninety-nine/tools/build_rooms.py` and re-run it, never `data/rooms.json` by hand.
  - A room's doorways are `door()` calls: a wall, an offset along it, a size, and a kind (`door` / `glass` / `curtain` / `shutter` / `slide` / `open`).
  - Its threshold zones are `zone()` calls, and extra join points are `anchor()` calls. `entry` names the doorway a connector arrives through. Connectors are the `cn_*` builders.
  - `check_room()` fails the build when a door runs off or overlaps on its wall, a zone is off the floor or inside a solid box, a room has no entry, an alias changes more than `ALIAS_KEYS` (spawn, name, shots, notes), or hands appear anywhere but `S0_X` / `SE_PEND`.
  - A set's `shots` are now the carried moments, the endings' pull-backs, and the `in` / `out` / `leave` / `arrive` poses the Higgsfield proofs render.
- Choices are data too: `ninety-nine/data/scenes.json` (hand-edited) names, per scene and render, the room, `next`, the ambience, music and captions, the `onEnter` beats, and the two `thresholds`.
  - A threshold (succumb / resist) gives its label, its zone(s) in that room, the `exit` door and the `via` connector it opens, `setFlag`, `sfxCue`, `beat` and `approach`. `beatZones` are non-choice moments, and `bumpCount` counts pushes on a locked door.
  - Keep its zone and door names in step with `build_rooms.py`; the director only warns in the console when one is missing.
  - `data/endings.json` gives each ending's room, zone, `autoSeconds`, pull-back shot and `routes`. [[ninety-nine/assets/Scene Flow|Scene Flow]] walks all of it in order.
- The Blender copies of the sets live in Higgsfield 3D scene-builder projects (`blender/higgsfield/projects.json`); `python ninety-nine/tools/higgsfield_scene.py <ROOM> build|imports|place|proof` prints what the scene-builder MCP tools take. Rebuild a project after changing a set in `build_rooms.py`. All of them are stale since the continuous building: the tool must first learn doorways, `floorY`, pitched boxes, hidden props and the new prop builders, as listed in [[blender/higgsfield/REBUILD_NOTE|REBUILD_NOTE]]. Until then it strips the runtime-only keys and warns about props it cannot build.
- Music is generated (`ninety-nine/src/music.js`), not a file — nothing under `assets/aud` is music, and nothing there needs a licence.

## Docs-as-vault

This folder doubles as an Obsidian vault (`.obsidian/graph.json` sets graph color groups by tag: `router`, `game-code`, `generated-asset`, `design-doc`, `blender-pipeline`, `raw-source`). When adding a new file that belongs in the knowledge graph, add it as a bullet with a real `[[wikilink]]` (not a backtick mention) to the relevant section note, and vice versa — a mention without a wikilink is invisible to the graph and shows up as an orphan.
