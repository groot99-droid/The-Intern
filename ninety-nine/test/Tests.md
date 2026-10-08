---
tags: [game-code]
---

# Tests

← [[ninety-nine/App Overview|App Overview]]

In-browser test suite (no Node on this machine, so it's a fetch-and-assert harness, not a CI script).

> **Stale since 2026-10-03.** The suite still tests the cinematic build that the continuous walk replaced. Until it is ported, several cases will not load or will fail:
> - `index.html` still lists `minigame.leak.js` and `minigame.hold.js`, which were deleted with the mini-games.
> - `logic.spine.js`, `rooms.validate.js` and `stage.shots.js` import the removed `src/router.js` (`planTransition`, `roomOfEntry`, `choiceEntryIndex`…), so they fail to load.
> - `manifest.validate.js` and `rooms.validate.js` check the old data model: per-scene sequence entries and choice blocks, mini-game modules, every key a scene+render / ending / `SET_*` (`CN_*` keys fail), and in/out/loop/leave/arrive shots in every room (connectors have only `in`).
>
> The pure checks (`canon.text.js`, `audio.drone.js`, `audio.mix.js`, and the `state.js` parts of `logic.spine.js`) still hold. What a port should test now: thresholds and zones (`src/spine.js`, `director._debug()`), the attach maths (`src/world/anchors.js` is pure), and `build_rooms.py`'s `check_room()` rules. The `?autopilot=` walkthrough (`src/dev/autopilot.js`) drives the real game end to end.

- **`harness.js`** — tiny browser-based test runner; every assertion expressible as "run this pure function and check the output" or "fetch a URL and check it" runs here.
- **`index.html`** — the page that loads the harness and all cases.
- **`rooms.html`** — not a test: a dev preview that plays a shot of any room from `data/rooms.json`, or walks it alone (`?room=S5_H`, `&shot=in`, `&walk=1`), connectors included.

## `cases/` (7 files)
- **`logic.spine.js`** — Doc 4 §11.1 acceptance tests, Doc 1 §7.2's four worked runs and the full 256-path sweep: pure `state.js` logic. It also has transition checks against the removed `router.js` (see above).
- **`canon.text.js`** — Doc 4 §11.2: the C4 check ("the word 'you' appears exactly once in the entire game"), plus the S0 form's three WILLING / NOT WILLING pairs.
- **`manifest.validate.js`** — Doc 4 §4.2's validator: "file exists" becomes `fetch(url, {method:'HEAD'})` returning 200 (no Node `fs`). Still written against the sequence-entry `scenes.json`.
- **`audio.drone.js`** — Doc 4 §11.3 drone-continuity check (`osc.start()` called exactly once); the real by-ear gate still has to happen manually.
- **`audio.mix.js`** — the mix pass: bed trims pull the 17 dB loudness spread into a window, one-shot trims go the right way, every `music` mood in `scenes.json` exists, nothing plays before the gesture.
- **`rooms.validate.js`** — `data/rooms.json`: keys map to real scene+render, aliases resolve, prop types have builders, spawns sit inside the shell, C3 (no open sides without fog/box), C8 (one clock per room), one 99 slip per room after S1; plus the removed `choiceEntryIndex()`.
- **`stage.shots.js`** — the stage against the real data: every room builds (with box fallbacks when the prop library is absent), every shot plays to its end on a stubbed clock, and `screenRect()` finds the terminal. It runs headless as a smoke test of the data and the shot maths. It still imports `router.js`.

The mini-game cases (`minigame.leak.js`, `minigame.hold.js`) were deleted with the mini-games. `video.audiotrack.js`, `video.faststart.js` and `renderer.softloop.js` went earlier, with the clips.

Headless: `python tools/dev_server.py 8000`, then drive `/test/` with Playwright (this repo has no Node CI, but any machine with Chromium can run the page).
