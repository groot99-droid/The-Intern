---
tags: [router]
---

# CLAUDE.md

← [[README|Router]]

Persistent context for working in this repo. Start at [[README|README.md]]'s Map section (or the vault graph if you have this open in Obsidian) for a per-folder file index — this file is conventions/guardrails, not a file listing.

## What this is

**ninety-nine**: a static-web narrative game (no build step). The player is an intern at a company that is fake (rendered low-poly PS1) inside a building that is real (rendered photoreal) — see Canon below. [[docs/Design Docs|docs/]] holds the 4 source-of-truth specs (Doc 1 logic, Doc 2 asset generation, Doc 3 minigame UX, Doc 4 technical build); [[ninety-nine/src/Source Code|ninety-nine/src/]] implements them. **The game is 3D-only**: every scene is a live three.js set from `ninety-nine/data/rooms.json` played through `src/stage/` as camera shots; Doc 2's generated stills and clips and Doc 4 §5's video pool no longer exist (the docs describe what they replaced). A parallel [[blender/Blender Pipeline|blender/]] pipeline hand-builds 3D versions of the same environments, and `ninety-nine/tools/higgsfield_scene.py` rebuilds every set in the Higgsfield 3D scene builder (Blender 5.2) with the open-source catalog props and the same camera moves.

## Naming scheme

Sets, audio and scene folders follow `S{n}_{C|H}` (Doc 2 §1 / Doc 4 §4; the old `_{IMG_IN|IMG_OUT|VID|TRN}` suffixes named the removed stills and clips -- their roles are now the set's `in` / `out` poses and its `loop` / `leave` + `arrive` shots). `C` = compliant/succumb render, `H` = hostile/resist render. `S0_X` is the branchless prologue. Endings are `SE_{ASSIM|EXPUL|PEND|RETAINED}`; extra sets are `SET_{STREET|DIVE}`.

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
- Run tests: open `ninety-nine/test/index.html` through that same dev server (fetches are same-origin). No Node/CI on this machine — see [[ninety-nine/test/Tests|Tests]]. Preview a walkable room without playing to it: `ninety-nine/test/rooms.html?room=S5_H`.
- Sets are data: edit `ninety-nine/tools/build_rooms.py` and re-run it, never `data/rooms.json` by hand. A scene's camera moves are that set's `shots`; `scenes.json` only names a `room` and a `shot` per sequence entry.
- The Blender copies of the sets live in Higgsfield 3D scene-builder projects (`blender/higgsfield/projects.json`); `python ninety-nine/tools/higgsfield_scene.py <ROOM> build|imports|place|proof` prints what the scene-builder MCP tools take. Rebuild a project after changing a set in `build_rooms.py`.
- Music is generated (`ninety-nine/src/music.js`), not a file — nothing under `assets/aud` is music, and nothing there needs a licence.

## Docs-as-vault

This folder doubles as an Obsidian vault (`.obsidian/graph.json` sets graph color groups by tag: `router`, `game-code`, `generated-asset`, `design-doc`, `blender-pipeline`, `raw-source`). When adding a new file that belongs in the knowledge graph, add it as a bullet with a real `[[wikilink]]` (not a backtick mention) to the relevant section note, and vice versa — a mention without a wikilink is invisible to the graph and shows up as an orphan.
