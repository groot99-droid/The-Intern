---
tags: [game-code]
---

# Source Code

← [[ninety-nine/App Overview|App Overview]]

Engine modules in `ninety-nine/src/`. All conform to Doc 4's technical build spec.

- **[[ninety-nine/src/main.js|main.js]]** — Doc 4 §2: boot, preflight, kicks off S0.
- **[[ninety-nine/src/state.js|state.js]]** — Doc 4 §3: state module (conformance, dissonance, friction, flags). Only `commitChoice()` writes conformance/dissonance; minigames only write `friction`.
- **[[ninety-nine/src/router.js|router.js]]** — Doc 4 §4/§10 Phase 1: the spine walker. Sequence never forks, only the render does. Owns scene sequencing, minigame mount lifecycle, ending resolution. `pickTransition()` picks a branch's clip (swap clip on a render flip, when one exists); `planTransition()` composes a flip out of black-join halves (`transitionsSplit` in `data/scenes.json`) or a still-cut so the player is never walked into the wrong room.
- **[[ninety-nine/src/renderer.js|renderer.js]]** — Doc 4 §5.1: two pooled `<video>` elements + crossfade (never created at runtime — Mobile Safari restriction); they live in `index.html` and are looked up here. Looping rooms are soft-looped (re-armed in the idle element and dissolved); every crossfade carries a token and a superseded one returns `null` and touches nothing — see the header for the re-arm race this closes. `playTransition(file, {startAt, stopAt})` plays a sub-range for the router's flip transitions.
- **[[ninety-nine/src/fracture.js|fracture.js]]** — Doc 4 §5.2: three visual-wrongness layers driven by `fracture()` (Doc 1 §2.3); capped so it reads as smooth wrongness, never a glitch.
- **[[ninety-nine/src/flipbook.js|flipbook.js]]** — Doc 4 §5.3 / Doc 2 §5 (S2): 4-frame NPC jaw fallback for if Kling can't hold the hard jaw snap. Dormant by default.
- **[[ninety-nine/src/choice.js|choice.js]]** — renders the two branch-invariant choice buttons (Doc 1 §4 spine table) and records dwell timing (Doc 1 §2.1).
- **[[ninety-nine/src/audio.js|audio.js]]** — Doc 4 §7: the drone is a single `OscillatorNode`, created once on S0's SUBMIT click and never stopped until the game ends; also owns the bus (ambience / sfx / voice / music → master → limiter), per-file loudness trims, equal-power ambience crossfade, tracked one-shots, ducking, and the ending fade.
- **[[ninety-nine/src/music.js|music.js]]** — the liminal music bed: generative Web Audio (an 8-bar muzak loop for the lobby, slow detuned pads after the doors close; colder voicings in the hostile render). No licensed tracks; optional `{file}` slot for one. Mood per scene from `data/scenes.json`'s `music`.
- **[[ninety-nine/src/sfx.js|sfx.js]]** — Doc 4 §10 Phase 6: one-shot mechanical/VO SFX playback (see [[sfx-raw/Raw SFX Library]] for the raw sources these were built from).
- **[[ninety-nine/src/preload.js|preload.js]]** — Doc 4 §8.1: while scene N plays, prefetch both branches of scene N+1 plus both transitions into it. Fire-and-forget, not awaited by router.js.
- **[[ninety-nine/src/text.js|text.js]]** — resolves text keys against `/text`; throws loudly on a missing key so Doc 4 §4.1's validator has teeth at runtime.
- **[[ninety-nine/src/bail.js|bail.js]]** — Doc 4 §9: the global accessibility exit, present in every scene/minigame. Quitting routes to PENDING REVIEW, not a hard exit.
- **[[ninety-nine/src/soundToggle.js|soundToggle.js]]** — the second persistent non-diegetic control, alongside bail.js's EXIT.
- **[[ninety-nine/src/application.js|application.js]]** — the S0 drag-and-drop intake form (added post-launch, not part of Doc 1–4's original design).

## Subsections
- [[ninety-nine/src/minigames/Minigames|minigames/]] — the 7 components / 11 modes, built on `_contract.js`
- [[ninety-nine/src/walk/Walk Mode|walk/]] — the third affordance: walkable 3D rooms (three.js, procedural, the museum-walkthrough pattern)
