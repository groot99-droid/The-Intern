---
tags: [game-code]
---

# Source Code

← [[ninety-nine/App Overview|App Overview]]

Engine modules in `ninety-nine/src/`. All conform to Doc 4's technical build spec.

- **[[ninety-nine/src/main.js|main.js]]** — Doc 4 §2: boot, preflight, kicks off S0.
- **[[ninety-nine/src/state.js|state.js]]** — Doc 4 §3: state module (conformance, dissonance, friction, flags). Only `commitChoice()` writes conformance/dissonance; minigames only write `friction`.
- **[[ninety-nine/src/router.js|router.js]]** — Doc 4 §4/§10 Phase 1: the spine walker. Sequence never forks, only the render does. Owns scene sequencing, minigame mount lifecycle, ending resolution. A sequence entry is a shot in a set (`roomOfEntry()`); `planTransition()` joins two sets through black (the first's `leave`, the second's `arrive`), which is why a render flip can never walk the player into the wrong room: the destination is decided at the join.
- **`stage/stage.js`** — the stage: every scene is a live three.js set with a scripted camera. `playShot(room, shot)` runs a camera move from `data/rooms.json` (a pingpong loop resolves at once, a finite move when it ends); `holdPose()` parks; `pause()` / `resume()` / `setRate()` are the narrow handle mini-games get (as `services.scene`, via router.js) — MG-05 H runs the garage only while the player holds and parks on the dead-flat `out` pose; `screenRect()` projects the terminal's glass for MG-05 C's sheet; `actor()` walks MG-03 C's manager; `walk()` is WALK THE ROOM over the same set. The composite pass (ACES, vignette, grain, the fade the black-joins use) is here. Replaces the video pool.
- **`stage/library.js`** — the open-source prop library (`assets/glb/library.glb`, from the Higgsfield scene builder's catalog): clones a model by name and gives it the company's low-poly treatment (C1). Optional: box fallbacks stand in without it.
- **[[ninety-nine/src/fracture.js|fracture.js]]** — Doc 4 §5.2: three visual-wrongness layers driven by `fracture()` (Doc 1 §2.3); capped so it reads as smooth wrongness, never a glitch. The bleed is the opposite render's palette (its room's fog / ambient / sun colours), not a still.
- **[[ninety-nine/src/choice.js|choice.js]]** — renders the two branch-invariant choice buttons (Doc 1 §4 spine table) and records dwell timing (Doc 1 §2.1).
- **[[ninety-nine/src/audio.js|audio.js]]** — Doc 4 §7: the drone is a single `OscillatorNode`, created once on S0's SUBMIT click and never stopped until the game ends; also owns the bus (ambience / sfx / voice / music → master → limiter), per-file loudness trims, equal-power ambience crossfade, tracked one-shots, ducking, and the ending fade.
- **[[ninety-nine/src/music.js|music.js]]** — the liminal music bed: generative Web Audio (an 8-bar muzak loop for the lobby, slow detuned pads after the doors close; colder voicings in the hostile render). No licensed tracks; optional `{file}` slot for one. Mood per scene from `data/scenes.json`'s `music`.
- **[[ninety-nine/src/sfx.js|sfx.js]]** — Doc 4 §10 Phase 6: one-shot mechanical/VO SFX playback (see [[sfx-raw/Raw SFX Library]] for the raw sources these were built from).
- **[[ninety-nine/src/preload.js|preload.js]]** — Doc 4 §8.1: while scene N plays, build both renders of scene N+1 (the stage's rooms, the prop library) and warm their beds. Fire-and-forget, not awaited by router.js.
- **[[ninety-nine/src/text.js|text.js]]** — resolves text keys against `/text`; throws loudly on a missing key so Doc 4 §4.1's validator has teeth at runtime.
- **[[ninety-nine/src/bail.js|bail.js]]** — Doc 4 §9: the global accessibility exit, present in every scene/minigame. Quitting routes to PENDING REVIEW, not a hard exit.
- **[[ninety-nine/src/soundToggle.js|soundToggle.js]]** — the second persistent non-diegetic control, alongside bail.js's EXIT.
- **[[ninety-nine/src/application.js|application.js]]** — the S0 drag-and-drop intake form (added post-launch, not part of Doc 1–4's original design).

## Subsections
- [[ninety-nine/src/minigames/Minigames|minigames/]] — the 7 components / 11 modes, built on `_contract.js`
- [[ninety-nine/src/walk/Walk Mode|walk/]] — the set builder (materials, room, props: the museum-walkthrough pattern) the stage draws with, and WALK THE ROOM's launcher and controls
