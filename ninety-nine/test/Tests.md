---
tags: [game-code]
---

# Tests

← [[ninety-nine/App Overview|App Overview]]

In-browser test suite (no Node on this machine, so it's a fetch-and-assert harness, not a CI script).

- **`harness.js`** — tiny browser-based test runner; every assertion expressible as "run this pure function and check the output" or "fetch a URL and check it" runs here.
- **`index.html`** — the page that loads the harness and all cases.
- **`rooms.html`** — not a test: a dev preview that walks any room from `data/rooms.json` without playing to it (`?room=S5_H`).

## `cases/` (8 files)
- **`logic.spine.js`** — Doc 4 §11.1 acceptance tests + Doc 1 §7.2's four worked runs + the full 256-path sweep. Pure `state.js` logic.
- **`canon.text.js`** — Doc 4 §11.2: C4 check ("the word 'you' appears exactly once in the entire game").
- **`manifest.validate.js`** — Doc 4 §4.2's validator: "file exists" becomes `fetch(url, {method:'HEAD'})` returning 200 (no Node `fs`).
- **`minigame.leak.js`** — mounts/unmounts every minigame 50x, asserts listener/timer counts return to baseline.
- **`audio.drone.js`** — Doc 4 §11.3 drone-continuity check (`osc.start()` called exactly once); the real by-ear gate still has to happen manually.
- **`video.audiotrack.js`** — asserts every video file has no audio track (audio is engine-side only, Doc 4 §7/§8.3). Reads as a failure in a Chromium build without H.264 (headless shells); that is the codec, not the files.
- **`audio.mix.js`** — the mix pass: bed trims pull the 17 dB loudness spread into a window, one-shot trims go the right way, every `music` mood in `scenes.json` exists, nothing plays before the gesture.
- **`rooms.validate.js`** — `data/rooms.json`: keys map to real scene+render, aliases resolve, prop types have builders, spawns sit inside the shell, C3 (no open sides without fog/box), C8 (one clock per room), one 99 slip per room after S1; plus `choiceEntryIndex()`.

Headless: `python tools/dev_server.py 8000`, then drive `/test/` with Playwright (this repo has no Node CI, but any machine with Chromium can run the page).
