---
tags: [game-code]
---

# Walk Mode

← [[ninety-nine/src/Source Code|Source Code]]

The room builder the whole building is made of, and the first-person controls that walk it. Walking is no longer an option beside the choices. It is the game: the candidate walks every room of the continuous building ([[ninety-nine/src/world/World|world/]]) in first person, from the apartment to the ending card. Each room is either a scene's set or a `CN_*` connector, built here from its `data/rooms.json` record. The choices are places he walks to, and how he walks to them is what `src/friction.js` reads. The old WALK THE ROOM button and its `launcher.js` are gone.

Built the way the museum walkthrough in the Earth_Worldbuild repo is built: a JSON record per room, procedural box geometry, world-tiled textures, first-person controls with axis-separated raycast collision. The company's props come from the open-source catalog where `tools/build_rooms.py` placed one (`glb`), and from box builders otherwise. The game's own look goes on top, with canon C1 as a material rule:

- The building is textured (512 px colour + bump + roughness, trilinear/anisotropic), lit, shadowed (a soft 2048 px shadow map) and finished by the stage's composite pass (ACES, vignette, film grain, dither).
- Everything the company owns is flat-shaded low-poly with PS1 vertex snapping and no texture at all. That includes catalog models: `src/stage/library.js` re-materials every clone.

Canon, enforced in code:

- **C1**: two-tier materials ([[ninety-nine/src/walk/materials.js|materials.js]]). A door leaf is company property, low-poly; the lobby's glass is the building's, photoreal.
- **C2**: every shadow falls toward the core. Each room's env carries a sun that sits on the entrance side and aims at the core ([[ninety-nine/src/walk/room.js|room.js]]). `world/lights.js` turns that direction with the room, so the rule holds in every room of the joined building.
- **C3**: a room is closed on every side unless `open` names one, and then fog or glass closes it (asserted by `rooms.validate.js`). The street, before the lobby doors, is the one set with a sky colour. Doorways are the only openings between rooms; connectors only run level or down, and the door seals behind him.
- **C5 / C6**: figures are static boxes (an actor translates, never animates). His low-poly hands appear only in the apartment (`S0_X`, hidden until he sits at the computer) and in the PENDING REVIEW ending (`SE_PEND`, shown at the end). The hands that reached up in the dive were removed at the author's request. `build_rooms.py`'s `check_room()` refuses hands anywhere else.
- **C8**: exactly one handless clock per built room (asserted). Connectors carry none.

## Files

- **[[ninety-nine/src/walk/room.js|room.js]]**: builds a room from its record.
  - **Shell**: floor, ceiling and walls from `size`, with the floor at `floorY` when it is not 0 (stairs and ramps sit below their entry). `noWalls` / `noCeiling` cover the street.
  - **Doorways**: each wall is laid as the pieces around its `doors`. The holes are sorted along the wall, with full-height pieces between them, a lintel over each and a sill under a raised one.
  - **Bands and beams**: `skirt` / `cornice` bands break across the openings; `beams` run under the slab.
  - **Boxes**: extra `boxes` (pillars, water, ledges, barriers, stair treads, kerbs). A box marked `floor` is walkable; a `pitch` tilts it about its own centre (the ramp, the chute).
  - **Props**: named ones are addressable (the `terminal`, the `manager`, the `hands`); `hidden` ones are built but not shown. `actors` are named props with a path the director drives.
  - **Returns**: the room's doors (built by `doors.js`, each with an outward **anchor** of the same name for `world/anchors.js`), extra `anchors`, its `entry`, its threshold `zones`, its light **specs** and its `env` (ambient, hemisphere, sun, fog, exposure, grain, vignette). The room makes no three.js lights of its own; `world/lights.js` lights the specs, so the shader light count never changes as rooms are joined and dropped. Also `blocking()` (walls, minus any door body that stands open).
- **[[ninety-nine/src/walk/doors.js|doors.js]]**: what fills a doorway. A frame, a leaf that opens and closes, and the invisible body that blocks the opening while it is shut.
  - **Kinds**: `door` (one hinged low-poly leaf), `glass` (two photoreal glass leaves in a dark frame: the lobby), `curtain` (red velvet that parts: S3), `shutter` (a roll-up slab: the garage ramp), `slide` (two panels: the freight cab), `open` (a bare opening).
  - **Controller**: `open()` / `close()` resolve when the leaf settles. `rattle()` shudders a locked door that is tried, either by a beat (RUN, TRY THE DOOR) or by walking into it, which the director hears through the stage's bump handler. An `ajar` door stands slightly open (Harlowe's, in S4 H).
  - A doorway is the only way between two rooms of the building.
- **[[ninety-nine/src/walk/props.js|props.js]]**: the company's things.
  - **The original set**: chair, desk, monitor (its screen mesh tagged, so `src/screens.js` can draw on it and the stage can find its rectangle for the application form), partition, door, glass doors, curtain, sign, badge reader, counter, dispenser, figure, car, elevator panel, shelf, cooler, box tower, package, mop sink, drain, pillar, fluoro and sodium fixtures with glow plates, pendant, wall plate, pipe run, emblem, placard, slip, clock.
  - **Added for the 3D-only build**: keyboard, hands, mug, lamp, building, lamp post, table, and `glb` (a library model, with a box `fallback`).
  - **Added for the thresholds**: `bench` (S6 H's STOP), `tubestation` (S6 C's ORDER), `flagbox` (S6 C's FLAG), `boxcutter` (S8 C's OPEN THE BOX).
  - `hands` no longer take `reach`; `slip` still puts the 99 between the fingers (PENDING REVIEW).
  - Mirrors the archetypes in [[blender/prop_builders.py|blender/prop_builders.py]] and the port in `tools/higgsfield_scene.py`, which does not have the four new builders yet ([[blender/higgsfield/REBUILD_NOTE|REBUILD_NOTE]]).
- **[[ninety-nine/src/walk/materials.js|materials.js]]**: canvas-drawn procedural textures (marble, plaster, concrete, painted concrete, carpet, cinderblock, linoleum, ceiling tile, pool tile, water, cardboard, rust, grate, asphalt, glass…). Each slot draws a colour map, a height map and a roughness map, tiled in world units; the water drifts per frame. Also the `lp_*` flat palette with the vertex-snap shader patch (exported for library.js), plus `glow_*` additive fixture glows.
- **[[ninety-nine/src/walk/controls.js|controls.js]]**: ported from the museum's controls.js and touch.js.
  - **Moving**: WASD / arrows to walk (2.6 m/s), Shift to hurry (4.0 m/s). Look with pointer lock or click-drag; on touch, a left-half joystick and right-half drag-to-look.
  - **Collision**: two axis-separated raycasts against the walls of every live room, at knee height (chairs, hydrants, a car's flank) and at chest height. The rays run in world space, so a room placed anywhere in the joined building collides as it is.
  - **Steps**: a downward floor ray eases him up and down stairs, treads and kerbs (a 0.45 m step) instead of snapping. With nothing underfoot he falls; a fall of more than 6 m (a hole that should not be there) puts him back where he last stood.
  - **Swim**: the dive's mode, free movement along the look direction at 1.2 m/s between a floor and a ceiling.
  - **Carried moments**: `setEnabled(false)` hands the camera over. Afterwards `syncFromCamera()` picks yaw and pitch back up and re-finds the floor with a snap ray cast down from the eye, so a camera left low (seated) still lands on the floor beneath it.
  - Footsteps, the head-bob and the touch overlay live in `world/player.js`.

Data and tools: [[ninety-nine/data/rooms.json|data/rooms.json]] is generated by [[ninety-nine/tools/build_rooms.py|tools/build_rooms.py]] (edit that, not the JSON). Its `door()`, `zone()` and `anchor()` helpers write the doorways, zones and join points, its `cn_*` builders write the connectors, and `check_room()` refuses a record that breaks the building's rules. To play any shot of any room or walk it alone, without playing to it, use `/test/rooms.html?room=S4_C&shot=in` or `?room=S5_H&walk=1` ([[ninety-nine/test/Tests|test/]]). three.js r160 is vendored at `ninety-nine/vendor/three/` (MIT, licence alongside).
