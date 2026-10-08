---
tags: [game-code]
---

# World

← [[ninety-nine/src/Source Code|Source Code]]

The continuous building. Every room the candidate can stand in is an **instance**: a room built by [[ninety-nine/src/walk/Walk Mode|walk/room.js]] and placed in one shared world space by a matrix. That covers each scene's set and each `CN_*` connector between two sets.

Nothing cuts. When a threshold is committed, [[ninety-nine/src/director.js|director.js]] attaches a connector to the threshold's exit door and the next scene's room to the connector's far end. The candidate walks through, the door seals behind him, and the room he left is dropped.

Rooms are built ahead of time (geometry, procedural textures, catalog clones), keyed by their base set, so an alias such as `S2_C` (which is `S1_C`) is the same room.

- **[[ninety-nine/src/world/world.js|world.js]]**: the world itself.
  - `prebuild(key)` builds ahead and pools by base set; connectors are never pooled, so every join gets its own.
  - `spawn` places a room. `attach(fromInst, exitName, toKey, {entry})` places a room so that its entry anchor meets another room's exit anchor. `move` re-places one (the freight cab really descends). `remove` drops one.
  - `locate` / `current` say which instance the player is in; a connector wins where a reveal overlaps.
  - `progress` gives 0..1 along a connector from its entry to its exit. 0.5 is the director's scene boundary.
  - `collidables` returns the walls of every live instance, minus door bodies that stand open, plus every floor, for `walk/controls.js`.
  - Each frame it updates the rooms, blends the atmosphere and feeds the light rig.
- **[[ninety-nine/src/world/anchors.js|anchors.js]]**: the attach maths. Pure, with no renderer.
  - An anchor is a doorway's outward-facing frame `{pos, yaw}` in its room's coordinates: an N wall faces yaw 0, S 180, E −90, W 90, and the position is on the wall's outer face at the sill.
  - Joining room B's entry to room A's exit is `M_B = M_A · P(exitA) · Ry(180°) · P(entryB)⁻¹`.
  - A `vertical` anchor joins without the turn: the edge's `drop` over the dive's water `surface`, the dive's `grate` over the chute's `top`.
  - Also: `doorAnchor` (a door's anchor from its wall, offset and sill), `poseToWorld` (room-local shot poses carried into world space) and `interiorBox`.
- **[[ninety-nine/src/world/lights.js|lights.js]]**: one fixed pool of real lights for the whole building.
  - The pool is one sun (the only shadow caster), one ambient, one hemisphere, 16 point lights and 4 spots. Joining or dropping a room never changes the light count, so it never recompiles a shader.
  - Rooms only describe their lights (`room.js` `lightSpecs`). Each frame the pool goes to the specs that matter most: the current room, then its connector, then the nearest. A slot that changes hands fades.
  - Per-light flicker and the ENTER sign's 2.3 s `pattern` are computed here.
  - **C2** lives here: the sun's direction is the current room's vector from the entrance side toward the core, turned with the room.
- **[[ninety-nine/src/world/env.js|env.js]]**: a room's atmosphere (ambient, hemisphere, sun, fog, background, exposure, grain, vignette) and the blend between two of them. Inside a connector, the room behind blends into the room ahead by how far along it the player is: night turns to dawn on the apartment stairs, and the street's light goes down as the lobby's comes up. There is no fade.
- **[[ninety-nine/src/world/player.js|player.js]]**: the candidate's body.
  - It wraps `walk/controls.js` and adds footsteps that answer the floor surface under him: marble rings, carpet swallows, the grate clanks. Each material slot has its own filter and gain.
  - A head-bob follows the distance walked; it is off under `prefers-reduced-motion` and while swimming.
  - Shift hurries him, with a few degrees of extra FOV. The touch joystick is here too.
  - The body is on from the first frame; the director disables it for carried moments.
