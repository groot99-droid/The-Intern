---
tags: [router]
---

# The New Intern — NINETY-NINE

Project home for **ninety-nine**, a browser game, plus the pipeline and design material that produced it.

## Layout

- **`ninety-nine/`** — the game itself: a static web app (`index.html`, `style.css`, `src/`, `data/`, `text/`, `vendor/` for three.js) with its audio in `ninety-nine/assets/aud` (tracked in `ninety-nine/assets/MANIFEST.csv`) and the optional open-source prop library in `ninety-nine/assets/glb`. The game is one continuous first-person walk through live 3D rooms (`data/rooms.json`, joined into one building by `src/world/`, drawn by `src/stage/`, played by `src/director.js`). Choices are places to walk to; there are no mini-games, and the AI-generated stills and clips are gone. See [`ninety-nine/assets/README.md`](ninety-nine/assets/README.md). Run it locally via the `ninety-nine` config in `.claude/launch.json` (`python ninety-nine/tools/dev_server.py 8000`). Tests live in `ninety-nine/test/`.
- **`docs/`** — design/spec documents referenced throughout the pipeline as "Doc 1"–"Doc 4": game logic, the Higgsfield generation pipeline, mini-game UX (retired 2026-10-03), and the technical build. Dated amendment notes mark where the build has moved on.
- **`blender/`** — the hand-built Blender pipeline (scene file, reference images, per-scene renders) with its own plan in `blender/PLAN_remaining_scenes.md`. The sets the game plays are also rebuilt as Blender scenes in the Higgsfield 3D scene builder by `ninety-nine/tools/higgsfield_scene.py`; `blender/higgsfield/` lists the projects and their proof renders. The projects are stale until rebuilt for the continuous building (see [[blender/higgsfield/REBUILD_NOTE]]).
- **`sfx-raw/`** — raw, human-named sound effect sources; 10 of the 12 are already integrated into the manifest-tracked pipeline in `ninety-nine/assets/aud` (see [[sfx-raw/Raw SFX Library]] for which two aren't yet).
- **`.claude/`** — Claude Code harness config (dev server launch config, scheduled tasks).

## Map

A router into the per-folder index notes — each one lists every file in that folder with a one-line description, so you (or an agent) can jump straight to the relevant "bit" instead of reading everything. Open this folder as an Obsidian vault to browse it as a linked graph.

- [[CLAUDE|CLAUDE.md]] — persistent AI-assistant context: naming scheme, canon rules, don't-touch list
- **[[ninety-nine/App Overview|ninety-nine/]]** — the game
  - [[ninety-nine/src/Source Code|src/]] → [[ninety-nine/src/world/World|world/]] · [[ninety-nine/src/walk/Walk Mode|walk/]]
  - [[ninety-nine/assets/Generated Assets|assets/]]
  - [[ninety-nine/test/Tests|test/]]
- [[docs/Design Docs|docs/]] — design & spec docs (Doc 1–4)
- **[[blender/Blender Pipeline|blender/]]**
  - [[blender/higgsfield/README|higgsfield/]] → [[blender/higgsfield/REBUILD_NOTE|REBUILD_NOTE]]
  - [[blender/refs/Reference Images|refs/]]
  - [[blender/renders/Scene Renders|renders/]]
- [[sfx-raw/Raw SFX Library|sfx-raw/]] — raw sound sources
