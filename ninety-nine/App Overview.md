---
tags: [game-code]
---

# App Overview

← [[README|Router]]

The game: a static web app, no build step, served as-is by [[ninety-nine/tools/dev_server.py|tools/dev_server.py]].

## Entry points
- **[[ninety-nine/index.html|index.html]]** — the single page: two pooled `<video>` elements + one `<img>` for the scene layer, plus layers for minigames, choices, and the ending card. Loads [[ninety-nine/src/main.js|src/main.js]] as a module.
- **[[ninety-nine/style.css|style.css]]** — all styling; diegetic UI treated as "an object in the room" per Doc 4 §14.

## Subsections
- [[ninety-nine/src/Source Code|src/]] — the engine modules (state, router, renderer, audio, minigame host, etc.)
- [[ninety-nine/assets/Generated Assets|assets/]] — generated img/aud/vid, tracked by manifest
- [[ninety-nine/test/Tests|test/]] — the in-browser test harness and cases

## `data/` — spine & ending logic (2 files)
- **[[ninety-nine/data/scenes.json|data/scenes.json]]** — single source of truth linking Doc 1 logic, Doc 2 filenames, and Doc 3 minigame IDs (Doc 4 §15). Walked in full in [[ninety-nine/assets/Scene Flow|Scene Flow]].
- **[[ninety-nine/data/endings.json|data/endings.json]]** — Doc 1 §2.4 `resolveEnding()` output map; drives which ending card renders.

Note: `data/endings.json` is a different file from `text/endings.json` below (structure/routing vs. display copy for the same endings) — don't confuse the two when following a link.

## `text/` — player-facing copy (4 files)
- **[[ninety-nine/text/endings.json|text/endings.json]]** — Doc 1 §6.4 ending-card copy. Rule C4 ("never say 'you'") deliberately breaks here, exactly once per card, in the signoff.
- **[[ninety-nine/text/form.json|text/form.json]]** — S0 application copy: 3 fields, each a WILLING / NOT WILLING pair, read by [[ninety-nine/src/application.js|application.js]]. Two or more refusals seed the hostile render (render only, never score). Replaced Doc 1 §6.2's ten typed fields and their ghost-text degradation.
- **[[ninety-nine/text/manifest.json|text/manifest.json]]** — Doc 1 §6.3 / Doc 3 MG-05 (mode C) requisition item list; mundane/impossible items interleave, ~60% mundane.
- **[[ninety-nine/text/system.json|text/system.json]]** — Doc 1 §6.1 company/system copy; obeys C4 without exception.

## `tools/` — dev-only (2 files)
- **[[ninety-nine/tools/stage_assets.py|tools/stage_assets.py]]** — copies Blender renders staged in `blender/renders/_game/` into `assets/{img,vid}`, verifies the byte size, rewrites the `MANIFEST.csv` row from the new file, and retires whatever it replaced into `assets/_retired_ai/`. Dry run by default; `--apply` to write, `--restore` to undo. Pairs with [[blender/export_game_assets.py|blender/export_game_assets.py]].
- **[[ninety-nine/tools/dev_server.py|tools/dev_server.py]]** — local static server with `Cache-Control: no-store` (plain `http.server` caches ES modules too aggressively) and real HTTP Range support (required for `<video>`/`<audio>` seeking; Python's default handler doesn't send 206 Partial Content). Not part of the shipped game.
