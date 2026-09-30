---
tags: [design-doc]
---

# Design Docs

← [[README|Router]]

The 4 numbered specs. Doc 1 is the master source of truth; Docs 2–4 derive from it and must not contradict it.

- **[[docs/01_GAME_LOGIC|01_GAME_LOGIC.md]]** — Doc 1 of 4: game logic. Source material: *Following The Sheep* (Elijah Skinner); structural reference: *Right Door Wrong Exit*. Defines the spine, scoring (conformance/dissonance), the canon rules (e.g. C4 "never say you"), and ending resolution.
- **[[docs/02_GENERATION_HIGGSFIELD|02_GENERATION_HIGGSFIELD.md]]** — Doc 2 of 4: generation pipeline for Higgsfield (stills) and Kling (motion + audio). Output filenames are consumed directly by Doc 4. See [[ninety-nine/assets/Generated Assets|ninety-nine/assets/]] for the resulting files and [[blender/Blender Pipeline|blender/]] for the parallel 3D pipeline this also informs.
- **[[docs/03_MINIGAME_UX|03_MINIGAME_UX.md]]** — Doc 3 of 4: mini-game UX spec, 7 components / 11 modes. Implemented in [[ninety-nine/src/minigames/Minigames|ninety-nine/src/minigames/]].
- **[[docs/04_TECHNICAL_BUILD|04_TECHNICAL_BUILD.md]]** — Doc 4 of 4: technical build spec for Claude Code. Implements Doc 1, consumes Doc 2, hosts Doc 3. Implemented across [[ninety-nine/src/Source Code|ninety-nine/src/]].
