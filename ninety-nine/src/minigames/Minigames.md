---
tags: [game-code]
---

# Minigames

← [[ninety-nine/src/Source Code|Source Code]]

Doc 3's 7 components / 11 modes, in `ninety-nine/src/minigames/`, all built on the shared contract.

- **[[ninety-nine/src/minigames/_contract.js|_contract.js]]** — Doc 4 §6.2/§6.3, Doc 3 §1/§4: shared scaffolding for all 11 modes. A minigame gets a frozen read-only state snapshot from router.js and must never import state.js directly.
- **[[ninety-nine/src/minigames/mg01-stack.js|mg01-stack.js]]** — MG-01 THE TRAY. Mounted at S1 in both renders (`mode` dresses the tray, never changes the rules). A falling-block puzzle: 8 intake slips, no fail state, friction read off holes left in the stack. Replaced `mg01-form.js` (the ten-field ghost-text intake), which `data/scenes.json` never actually mounted — the intake questions are asked once now, at S0, by [[ninety-nine/src/application.js|application.js]].
- **[[ninety-nine/src/minigames/mg02-scan.js|mg02-scan.js]]** — MG-02 THE SCAN (mode C) / THE DOOR (mode H).
- **[[ninety-nine/src/minigames/mg03-corridor.js|mg03-corridor.js]]** — MG-03 THE CORRIDOR (mode C) / THE LABYRINTH (mode H). Built last — "procedural maze is the highest engineering cost and lowest thesis risk" (Doc 3 §5).
- **[[ninety-nine/src/minigames/mg04-stapler.js|mg04-stapler.js]]** — MG-04 THE STAPLER (mode C) / THE IGNITION (mode H).
- **[[ninety-nine/src/minigames/mg05-requisition.js|mg05-requisition.js]]** — MG-05 THE REQUISITION TERMINAL (mode C) / THE RUN (mode H). "The most important mini-game in the project" — resistance is available, costs 5x the effort, and is silently undone.
- **[[ninety-nine/src/minigames/mg06-panel.js|mg06-panel.js]]** — MG-06 THE PANEL (mode C) / THE EDGE (mode H). "The building only permits descent."
- **[[ninety-nine/src/minigames/mg07-handoff.js|mg07-handoff.js]]** — MG-07 THE HANDOFF (mode C) / THE BREATH (mode H).

Full UX spec: [[docs/Design Docs|docs/03_MINIGAME_UX.md]].
