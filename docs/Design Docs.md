---
tags: [design-doc]
---

# Design Docs

← [[README|Router]]

The 4 numbered specs. Doc 1 is the master source of truth; Docs 2–4 derive from it and must not contradict it. Where the build has moved on from a spec, a dated amendment note at the top of the section says so, and the spec text below it is left as written. The 2026-10-03 notes cover the continuous first-person walk.

- **[[docs/01_GAME_LOGIC|01_GAME_LOGIC.md]]** — Doc 1 of 4: game logic. Source material: *Following The Sheep* (Elijah Skinner); structural reference: *Right Door Wrong Exit*. Defines the spine, scoring (conformance/dissonance), the canon rules (e.g. C4 "never say you"), and ending resolution. §4 and §5 carry 2026-10-03 amendments: choices are walked thresholds, and friction comes from movement.
- **[[docs/02_GENERATION_HIGGSFIELD|02_GENERATION_HIGGSFIELD.md]]** — Doc 2 of 4: generation pipeline for Higgsfield (stills) and Kling (motion + audio). Output filenames are consumed directly by Doc 4. See [[ninety-nine/assets/Generated Assets|ninety-nine/assets/]] for the resulting files and [[blender/Blender Pipeline|blender/]] for the parallel 3D pipeline this also informs.
- **[[docs/03_MINIGAME_UX|03_MINIGAME_UX.md]]** — Doc 3 of 4: mini-game UX spec, 7 components / 11 modes. **Retired 2026-10-03**: the mini-games were removed at the author's request, along with their implementation (`ninety-nine/src/minigames/`). Choices are now threshold zones the candidate walks to, and friction comes from how he moves ([[ninety-nine/assets/Scene Flow|Scene Flow]]). Kept as the record of what was built and replaced.
- **[[docs/04_TECHNICAL_BUILD|04_TECHNICAL_BUILD.md]]** — Doc 4 of 4: technical build spec for Claude Code. Implements Doc 1 and consumes Doc 2. It hosted Doc 3 until the mini-games went; its §6 mini-game contract is retired, and §7.4, §9 and §14 carry 2026-10-03 amendments. Implemented across [[ninety-nine/src/Source Code|ninety-nine/src/]].
