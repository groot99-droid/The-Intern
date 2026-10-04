---
tags: [blender-pipeline]
---

# Higgsfield rebuild note

← [[blender/higgsfield/README|Higgsfield projects]] · [[blender/Blender Pipeline|Blender Pipeline]]

A note to rebuild the scene-builder projects later, with what is needed to make the changes. Written 2026-10-03, when the game became one continuous walk (commit `65184db`, compared against `c1d415e`). It was re-checked at `e967424`: since `65184db` only the connectors' light levels and `CN_CORRIDOR_OFFICE`'s wall (`plaster` → `plaster_dark`) have changed.

## Status

**Stale until rebuilt.** Every project in `projects.json` (the 18 rooms; the library project is fine) was built from `data/rooms.json` as it stood at `c1d415e`, before the continuous building. None has a doorway, none of the props the threshold zones stand at, the street's box-built tower or the dive's pillars, and `S6_C` is still its own room. The proofs in each `<ROOM>/` folder show those older sets.

**Rebuild after the per-scene polish lands**, not before: the rooms are still moving, and every rebuild is 18 projects of tool calls. The game reads nothing from these projects, so nothing breaks while they are stale.

When the time comes, redo the table below against the commit the rebuild starts from (the polish will change more). The table came from a throwaway script, not committed: load `git show c1d415e:ninety-nine/data/rooms.json` and the current file, and for each room key compare props by type (catalog props by `node`), `doors`, `zones`, `anchors`, `entry`, `size`, `floorY`, `boxes` and `lights` (as multisets of their JSON), and the `shots` names.

## Runtime-only vs geometry

Some of what changed is only read by the running game ([[ninety-nine/src/world/World|src/world/]], `src/director.js`). The Blender copy never needs it, and `higgsfield_scene.py build` already strips it from the JSON it embeds (`RUNTIME_ONLY`):

- `zones` (threshold zones), `entry` (the doorway a connector arrives through), `anchors` (extra join points: the edge's `drop`, the dive's `surface` and `grate`, the chute's `top`), `holdEntry` (the cab and the store keep their entry open), `swim` (the dive's swim limits), `connector` and `drop` (connector metadata), `_note`.
- Also runtime, already ignored by the template: `spawn`, `footstep`, `actors` paths, a prop's `collide`, a door's `locked`, its invisible blocking body, a light's `id`, and boxes marked `invisible` (the kerb bounds, the barrier at the lip).

What the Blender copy **must** get:

1. **Doorways** (`doors`): each one is a hole cut out of its wall, a frame and a leaf in the hole, and a sill strip across the reveal. The full list is in the Doorways section below.
2. **`floorY`**: a connector's floor sits below 0 (stairs, ramp, chute). The floor slab goes from `floorY - 0.2` to `floorY` and the walls run from `floorY` up to `H`.
3. **Pitched boxes** (`pitch`, degrees): the ramp slab in `CN_RAMP_DOWN` (−14.036°) and the chute slab in `CN_CHUTE` (−33.69°), each tilted about X around its own centre.
4. **New prop types**: `bench`, `tubestation`, `flagbox`, `boxcutter`. The port has no `p_*` builder for them yet, so `build` skips them with a `# WARNING` line. The builders are in section 4 below.
5. **Hidden props** (`hidden: true`): the hands in `S0_X` and `SE_PEND`. They are built but not rendered until he sits.
6. **Lights that start off** (`off: true`): `terminal_glow` and `harlowe_glow` in `S5_C`. They are dark when the room is entered.
7. The per-room changes below: props and boxes added, removed or moved, sizes, and new shots. New shots need no work, because the template keys every shot it finds.
8. **New material slots.** `src/walk/materials.js` gained `brick` and `wood` (the building's, photoreal) for the polish, and no room uses them yet. Any slot a room uses that is missing from the template's `RECIPES` / `LOWPOLY` silently falls back to plaster, so add each new slot there.
9. **The polish's props.** `src/walk/props.js` has a marked `polish: <scene> -- begin/end` block per scene for the props the per-scene polish will add. Every builder that appears between those markers needs a `p_*` twin in the template. `build` will name the missing ones in its `# WARNING` lines.

## What changed, per room

| Room | Project | Geometry to rebuild | Runtime-only (no Blender work) |
|---|---|---|---|
| `S0_X` apartment | rebuild | 1 doorway (`door`); `hands` now `hidden`; shots `sit`, `lean`, `stand` added, `arrive` changed | zone `desk`; spawn; chair `collide` |
| `SET_STREET` | rebuild | 2 doorways, leaves only (`noWalls`: the openings are boxes): `stoop`, `tower`. **The catalog tower (`lib_tower`) and the `glassdoors` prop are gone**: the tower is now photoreal boxes (C1: forecourt and step, a facade with the door gap, a mass with no top up to y 220, 48 `glass_dark` window bands). A brick end wall (`plaster_dark`, three boxes around the stoop door) closes the dead end. Pavements are shortened to z −28.2…29.6 and walkable, with a kerb across the dead end. One `lib_brownstone` and one `lib_streetlamp` (east, z 34/35) removed. Street lamps, traffic light, hydrant and bin raised to y 0.14 (on the kerb). Sun moved from `[-6, 7, 40]` to `[-6, 9, 60]`. Boxes 3 → 65. `in` shot changed | zone `report`; entry `stoop`; invisible kerb bounds; spawn |
| `S1_C`, `S1_H` (S2 aliases them) | rebuild both | 3 doorways: `front`, `inner`, `service` | zones `seat_w`, `seat_e` (boxes), `counter`, `inner_door`, `front_doors`; entry `front` |
| `S3_C` corridor | rebuild | 4 doorways: `curtain`, `glass`, `side`, `service`. The `curtain` prop is removed: the curtain is now the doorway. The ENTER `sign` moves to the end wall over it (`[0, 3.12, -6.94]`, 1.0 × 0.28, named `enter_sign`). Its green light moves to z −6.4 and now runs a 2.3 s `pattern` instead of a `flicker` (store `pattern` as a custom property, like `flicker`) | zones `curtain`, `glass`; entry `side` |
| `S3_H` lobby doors | rebuild | S1's 3 doorways, plus `curtain` (far corner) and `side`. The `glassdoors` prop is removed: it is the `front` doorway now. Clock moved from x −4.6 to x −2.9 | S1's zones, plus `glass`, `curtain`; entry `side` |
| `S4_C` cubicle floor | rebuild | 3 doorways: `front`, `back`, `side`. **The cubicle row at z 3.2 is removed** (the cross-aisle to the side door): 12 partitions, 6 `lib_desk`, 6 `lib_crt` and 6 `lib_chair_wood` fewer. Clock moved from x 0 to x 4.0 (the back door is at the centre) | manager path now ends at z 6.0; zones `manager` (moves with the actor), `side_door`; entry `front` |
| `S4_H` labyrinth | rebuild | 3 doorways: `front`, `far`, and `ajar` (its leaf stands 0.22 open). Two `door` props removed: the fake door at (−1.54, z −6), which the real `ajar` doorway replaces, and the old ajar prop at z −12 | zones `far_end`, `ajar`; entry `front` |
| `S5_C` desk (S6_C is now this room) | rebuild | **Size 40 × 8 × 40 → 24 × 8 × 24.** 2 doorways: `front`, `freight`. Added: a second desk (`lp_grey`, 1.1 × 0.7, at `[6, 0, -4.2]`) with a dark monitor named `harlowe`, a `tubestation` (`[-6, 0, -4.4]`, named `tube`) and a `flagbox` (`[6.4, 0, 3.6]`, rot −90). Lights 1 → 5: `terminal_glow` (off), `harlowe_glow` (off), a green lamp at the tube station, a red lamp at the flag box | zones `desk`, `terminal`, `tube`, `flagbox`; entry `front`; light ids |
| `S5_H` garage | rebuild | 3 doorways: `front`, `stairs`, `ramp` (a shutter). A curb box (`concrete`, `[-16, 0, -6]` to `[-15.25, 0.16, 6]`) | zones `curb`, `stairs`; entry `front` |
| `S6_C` | **retire** | Now an alias of `S5_C` (it was its own 40 m desk room with the monitor on). The S6 look (the requisition on the screen, `terminal_glow` on) is runtime state in `S5_C`. In `projects.json`, move it to `aliases` | n/a |
| `S6_H` edge (S7_H aliases it) | rebuild | 2 doorways: `front`, `freight`. The 90 pool-room pillars' bases raised from y −4.5 to y −4.28, so they stand on the water rather than under it. A painted stop line (`plaster_blown`, `[-15.4, 0, 1.4]` to `[-0.6, 0.004, 1.55]`) and a `bench` (`[-5, 0, 2.4]`). `fall` shot added | the lip's invisible barrier, now split around a 2.4 m gap; zones `push`, `stopline`, `edge_approach`, `gap`, `turnback`; anchor `drop` (vertical, under the water); entry `front` |
| `S7_C` freight cab | rebuild | 1 doorway: `cab` (sliding doors, `lp_rust`) | `holdEntry`; zones `cab_center`, `panel`, `doorway`; entry `cab`; the cab's 14 m descent |
| `S8_C` mailroom | rebuild | 2 doorways: `front`, `deliveries`. **The pallet and box-tower field is regenerated**: the centre (abs(x) < 4) is now clear to the deliveries door. That shifts the seeded random sequence, so every remaining stack moved; re-place them all from the new data. There is 1 `lib_pallets` and there are 2 `boxtower`s fewer. Added: a sorting `table` (1.2 × 2.0 at `[-3.5, 0, -3.5]`, named `sorting`) and a `boxcutter` on it | zones `counter`, `deliver`, `sorting`; entry `front` |
| `SET_DIVE` pool | rebuild | **The reaching `hands` are removed** (the author's request), and so is the catalog `lib_lift` (one import fewer). 4 tiled corner pillars added (`pool_tile`, 0.9 × 14 × 0.9 at (±4.3, ±4.3), floor to ceiling). Shots `sink`, `grate` added | anchors `surface`, `grate` (vertical); entry `surface`; `swim`; zones `grate`, `pillars` (3D positions) |
| `S8_H` store (SE_EXPUL aliases it) | rebuild | 2 doorways: `hatch` (a bare opening where the chute lets out), `staff`. `land` shot added | `holdEntry`; zone `storefront`; entry `hatch` |
| `SE_ASSIM` boardroom (SE_RETAINED aliases it) | rebuild | 1 doorway: `front` | zone `head`; entry `front`; NEVER_SAT now hides `emptychair` while the game runs |
| `SE_PEND` | rebuild | The waiting room's 3 doorways (`front`, `inner`, `service`); `hands` now `hidden`; `sit` shot added | zone `seat`; entry `inner` |
| `CN_*` (8 new) | optional | Connectors: short passages the game joins rooms with. No project exists for them. They have no clock and no slip, only an `in` shot, so a proof is one still. Build them only if the Blender copy is to be assembled into the joined building. See the Connectors section below | `connector`, `drop`, `entry`, the chute's `top` anchor |

`S2_C`, `S2_H`, `S7_H`, `SE_RETAINED` and `SE_EXPUL` stay aliases. `lib_tower` and `lib_lift` are still in `build_rooms.py`'s `CATALOG`, but no room places them any more.

## Doorways

Every doorway in the built rooms. Aliases share their base room's doorways. `x` is the offset along the wall: the x coordinate on N/S walls, z on E/W. The sill is at the room's floor unless a `y` is given. If there is no `mat`, the leaf uses its kind's default.

| Room | Door | Wall | x | w × h | Kind | Leaf / extras |
|---|---|---|---|---|---|---|
| S0_X | `door` | S | −1.3 | 1.2 × 2.2 | door | `lp_beige`, hinge R |
| SET_STREET | `stoop` | S | 0 | 1.2 × 2.2, sill y 0.14 | door | `lp_dark`, glass `panel`, hinge L |
| SET_STREET | `tower` | N | 0 | 2.6 × 2.9, sill y 0.3 | glass | |
| S1_C, S1_H, S3_H, SE_PEND | `front` | S | 0 | 2.6 × 2.9 | glass | |
| S1_C, S1_H, S3_H, SE_PEND | `inner` | N | 5.6 | 1.1 × 2.2 | door | `lp_beige`, hinge R |
| S1_C, S1_H, S3_H, SE_PEND | `service` | S | −4.6 | 1.0 × 2.1 | door | `lp_grey` |
| S3_C | `curtain` | N | 0 | 2.4 × 2.9 | curtain | |
| S3_C | `glass` | S | 0 | 2.4 × 2.8 | glass | |
| S3_C | `side` | E | 4.6 | 1.2 × 2.2 | door | `lp_beige`, hinge R |
| S3_C | `service` | W | 4.0 | 1.0 × 2.1 | door | `lp_grey` |
| S3_H | `curtain` | N | −5.6 | 2.0 × 2.9 | curtain | |
| S3_H | `side` | E | 3.0 | 1.2 × 2.2 | door | `lp_beige`, hinge R |
| S4_C | `front` / `back` | S / N | 0 | 1.4 × 2.3 | door | `lp_beige` |
| S4_C | `side` | E | 3.9 | 1.0 × 2.2 | door | `lp_grey` |
| S4_H | `front` / `far` | S / N | 0 | 1.2 × 2.2 | door | `lp_grey` |
| S4_H | `ajar` | W | −6.0 | 0.9 × 2.1 | door | `lp_beige`, hinge L, `ajar: 0.22` |
| S5_C | `front` | S | 0 | 1.2 × 2.2 | door | `lp_dark` |
| S5_C | `freight` | N | 0 | 1.4 × 2.3 | door | `lp_dark` |
| S5_H | `front` | S | 0 | 1.4 × 2.3 | door | `lp_grey` |
| S5_H | `stairs` | E | −8.0 | 1.1 × 2.2 | door | `lp_grey` |
| S5_H | `ramp` | N | 0 | 4.0 × 2.8 | shutter | `lp_grey` |
| S6_H | `front` | S | 0 | 1.4 × 2.3 | door | `lp_grey` |
| S6_H | `freight` | W | 4.0 | 1.2 × 2.2 | door | `lp_grey` |
| S7_C | `cab` | S | 0 | 1.6 × 2.2 | slide | `lp_rust` |
| S8_C | `front` | S | 0 | 2.0 × 3.0 | door | `lp_dark` |
| S8_C | `deliveries` | N | 0 | 1.6 × 2.6 | door | `lp_dark` |
| S8_H | `hatch` | W | −4.0 | 1.0 × 1.1 | open | |
| S8_H | `staff` | E | −5.0 | 1.0 × 2.1 | door | `lp_grey` |
| SE_ASSIM | `front` | S | 0 | 1.4 × 2.4 | door | `lp_wood` |

For stills, build every leaf **shut**. There are two exceptions: a connector's `entry` has `open: true`, so it stands open, and `ajar` stands at that fraction (see the door formula below).

## What `higgsfield_scene.py` needs at rebuild time

The tool now runs for every current key, aliases and `CN_*` included, without failing. That is all it does so far. The ports below are what make the rebuilt projects match the game.

### 1. Walls with holes: port `room.js`'s wall split into `build_room`

Today `build_room` lays each wall as one box. `src/walk/room.js` lays each wall as the pieces around its doorways:

- **Per wall** (skip a side named in `open`, and skip all walls when `noWalls`), take that wall's doors as holes: `s0 = x - w/2`, `s1 = x + w/2`, sill `y` (default `floorY`), height `h`. **Sort them along the wall's axis** by `s0`.
- Walk a cursor from the run's start to its end. N/S runs go from `-W/2 - T` to `W/2 + T` (they cover the corners) and E/W runs from `-D/2` to `D/2`, with `T = 0.3`. For each hole:
  - add a **full-height piece** `[cursor, s0] × [floorY, H]` if there is a gap;
  - add a **lintel** `[s0, s1] × [y + h, H]` over the hole if it stops below the ceiling;
  - add a **sill piece** `[s0, s1] × [floorY, y]` under a raised hole (the street's doors and any door with `y` above the floor);
  - set `cursor = max(cursor, s1)`.
- Close the run with a last full-height piece `[cursor, end]`.
- A piece's box, in game axes: N `[s0, y0, -D/2 - T]` to `[s1, y1, -D/2]`; S `[s0, y0, D/2]` to `[s1, y1, D/2 + T]`; E `[W/2, y0, s0]` to `[W/2 + T, y1, s1]`; W `[-W/2 - T, y0, s0]` to `[-W/2, y1, s1]`. Pass each to `archbox(wall, a, b)`.
- **Bands** (the `skirt`, from `floorY` to `floorY + h`; the `cornice`, from `H - h` to `H`) run along the wall's inner face over `[-W/2, W/2]` (N/S) or `[-D/2, D/2]` (E/W). Break them at every hole whose `[y, y + h]` overlaps the band. The template has never built `cornice`, although six rooms have one (`S1_C`, `S1_H`, `S3_C`, `S3_H`, `SE_ASSIM`, `SE_PEND`); port it at the same time.
- For each door, add a **sill strip** across the reveal: the door's `sill` slot or the room's floor, 0.2 deep, its top at `y`. N `[x - w/2, y - 0.2, -D/2 - T]` to `[x + w/2, y, -D/2]`; S `[x - w/2, y - 0.2, D/2]` to `[x + w/2, y, D/2 + T]`; E `[W/2, y - 0.2, x - w/2]` to `[W/2 + T, y, x + w/2]`; W `[-W/2 - T, y - 0.2, x - w/2]` to `[-W/2, y, x + w/2]`.

### 2. Door leaves per kind (sizes from `src/walk/doors.js`)

Put each doorway under an `empty()` at the opening's centre, on the wall's centre plane, at the sill: N `(x, y, -D/2 - T/2)` yaw 0; S `(x, y, D/2 + T/2)` yaw 180; E `(W/2 + T/2, y, x)` yaw −90; W `(-W/2 - T/2, y, x)` yaw 90. The yaw maps onto `empty()`'s Z rotation unchanged. In door-local axes, +x runs along the wall and **+z points into the room**. `doors.js` positions are **box centres**; the template's `box()` takes the base, so pass `y - h/2`.

- **Frame** (every kind except `open` and `curtain`), in the door's `frame` slot or `lp_dark`, `depth = T + 0.04 = 0.34`. Two jambs, 0.08 × (h + 0.08) × depth, centred at x = ±(w/2 + 0.04), y = (h + 0.08)/2. A head, (w + 0.16) × 0.08 × depth, centred at y = h + 0.04.
- **door**: one leaf on a pivot at the hinge jamb (x = −w/2 for hinge L, the default; +w/2 for R), z = +0.11.
  - Leaf: (w − 0.02) × (h − 0.02) × 0.05, centred w/2 from the hinge, at y = h/2. It uses `mat` or `lp_beige`.
  - Optional `panel` (the street's glass): w·0.45 × h·0.32 × 0.055 at y = 0.66h.
  - Kick panel: `lp_dark`, (w − 0.24) × 0.36h × 0.06, at y = 0.25h.
  - Handles: `lp_brass`, 0.04 × 0.04 × 0.12, at (w − 0.12) from the hinge, y = 0.47h, on both faces (z ±0.05).
  - Open angle: 95° into the room. The leaf turns by `EASE(u) · 95°`, where `EASE(u) = 2u²` for u < 0.5 and `1 − (2 − 2u)²/2` above. `ajar: 0.22` gives about 9°.
- **glass**: two leaves hinged at x = ±w/2, z = +0.02, each `lw = w/2 − 0.02` wide.
  - Each leaf: `lp_dark` stiles 0.06 × h × 0.06 at both edges, a bottom rail lw × 0.1 × 0.06 (y 0.05) and a top rail lw × 0.08 × 0.06 (y h − 0.04).
  - Pane: (lw − 0.08) × (h − 0.2) × 0.02 in the photoreal `glass` slot, since the building's glass is photoreal (C1).
  - `lp_brass` push bars, lw·0.6 × 0.04 × 0.05, at y 1.0 on both faces (z ±0.06).
  - Opens 80°.
- **curtain**: no frame.
  - `folds = max(4, round(w / 0.22))`, split between two halves at z = +0.18. Half `s` (±1) holds folds `i = 0 … ceil(folds/2) − 1`.
  - Each fold sits at x = s·w/2 − s·(i + 0.5)·(w/folds) and is (w/folds + 0.02) × (h + 0.2) × (0.08 + 0.05·(i mod 2)), set 0.03 further into the room on odd folds, in `mat` or `lp_curtain`.
  - A brass rod, (w + 0.4) × 0.05 × 0.05, at y = h + 0.25, z = +0.18.
  - Parted, each half is scaled to 0.28 in x about its jamb.
- **shutter**: ceil(h / 0.12) slats, w × 0.11 × 0.04, every 0.12 m from y 0.06, at z = +0.10, in `mat` or `lp_grey`. When open it rises h − 0.15 and compresses to 8%.
- **slide**: two panels, w/2 × h × 0.05, at x = ±w/4, z = +0.10, in `mat` or `lp_rust`. Each has 4 `lp_dark` ribs, (w/2 − 0.04) × 0.03 × 0.06, at y = 0.3 + i·(h − 0.6)/3. When open, each slides out by w/2 − 0.05.
- **open**: nothing. Just the hole and the sill strip.
- Skip the invisible blocking body (w × h × T, a collider for the running game only).

### 3. The smaller ports

- **`hidden` → `hide_render`**: a prop is an `empty()` with child boxes, and `hide_render` on the empty does not hide its children. Set it on the empty **and every child**, and set `hide_viewport` too if the proof should not show them.
- **`pitch` → rotate about X around the box centre**: `archbox()`'s object origin is already the box centre, so set `ob.rotation_euler = (math.radians(b["pitch"]), 0, 0)`. Game X is Blender X and the sign carries over unchanged (three.js `rotateX(θ)` on game y/z is a +θ rotation about Blender X under `(x, y, z) → (x, −z, y)`).
- **`floorY` → shell from `floorY` to `H`**: the floor slab goes from `floorY − 0.2` to `floorY`; walls and bands start at `floorY`; the ceiling stays at `H`. A door with no `y` sits at `floorY` (every connector door gives its `y`).
- **`off` lights → `hide_render`** (or energy 0), and store `id` as a custom property so a variant still can switch `terminal_glow` on for S6.

### 4. New prop builders

These are the dimensions from `src/walk/props.js`, written in the template's own `box()` / `cylinder()` (y is the base, as in props.js). Add them beside the other `p_*` builders; `prune()` keeps only the ones a room uses.

```python
def p_bench(g, o):
    w, m = o.get("w", 1.8), o.get("mat", "lp_wood")
    box(g, m, w, 0.05, 0.4, 0, 0.44, 0); box(g, m, w, 0.3, 0.04, 0, 0.55, -0.2)
    for x in (-w/2 + 0.1, w/2 - 0.1): box(g, "lp_dark", 0.06, 0.44, 0.36, x, 0, 0)
def p_tubestation(g, o):
    box(g, "lp_grey", 0.7, 1.9, 0.45, 0, 0, 0); box(g, "lp_dark", 0.5, 0.3, 0.05, 0, 1.15, 0.24)
    cylinder(g, "lp_glass", 0.09, 1.3, 0, 1.9, 0.0, 8); box(g, "lp_brass", 0.22, 0.06, 0.12, 0, 0.98, 0.26)
    box(g, "lp_sign", 0.08, 0.08, 0.04, 0.22, 1.6, 0.24)
def p_flagbox(g, o):
    box(g, "lp_dark", 0.08, 1.2, 0.08, 0, 0, 0); box(g, "lp_red", 0.42, 0.5, 0.26, 0, 1.15, 0)
    box(g, "lp_black", 0.08, 0.26, 0.06, 0.12, 1.25, 0.16); box(g, "lp_taillight", 0.06, 0.06, 0.03, -0.12, 1.5, 0.14)
def p_boxcutter(g, o):
    box(g, "lp_brass", 0.14, 0.02, 0.03, 0, 0, 0); box(g, "lp_chrome", 0.04, 0.008, 0.015, 0.09, 0.006, 0)
```

The `p_hands` port never had `reach`, so the dive's removal needs no change there. The hands simply are not in the dive's record any more.

### Connectors

Every connector has an entry doorway on its S wall and a bare opening on its N wall. The next room's own entry leaf closes that opening. They come from `build_rooms.py`'s `cn_*` builders.

| Key | Name | Floor / wall / ceiling | W × H × D | floorY | Entry (S) | Exit (N) | Inside |
|---|---|---|---|---|---|---|---|
| `CN_STAIRS_APT` | THE STAIRS | carpet / plaster_dark / plaster_dark | 1.4 × 2.6 × 6.6 | −2.8 | door 1.2 × 2.2, open | 1.2 × 2.2 at y −2.8 | top landing + 14 carpet treads (0.2 rise, 0.3 tread), 2 fluoros |
| `CN_VESTIBULE` | THE VESTIBULE | marble / plaster_dark / plaster_dark | 3.6 × 3.4 × 3.2 | 0 | glass 2.6 × 2.9, open | 2.6 × 2.9 | a pendant |
| `CN_CORRIDOR_OFFICE` | A CORRIDOR | carpet / plaster_dark / ceiling_tile | 1.8 × 2.6 × 6.0 | 0 | door 1.2 × 2.2, open | 1.2 × 2.2 | 2 fluoros |
| `CN_CORRIDOR_SERVICE` | A SERVICE CORRIDOR | concrete_wet / cinderblock / concrete | 1.6 × 2.6 × 6.0 | 0 | door 1.2 × 2.2, open | 1.2 × 2.2 | 2 fluoros |
| `CN_STAIRS_CONCRETE` | A STAIRWELL | concrete_wet / cinderblock / concrete | 1.6 × 2.6 × 6.9 | −3.0 | door 1.2 × 2.2, open | 1.2 × 2.2 at y −3 | landing + 15 concrete treads, 2 fluoros |
| `CN_CORRIDOR_DOWN` | A CORRIDOR DOWN | concrete_wet / cinderblock / concrete | 1.8 × 2.6 × 8.8 | −1.2 | door 1.2 × 2.2, open | 1.2 × 2.2 at y −1.2 | landing + 8 long treads (0.15 rise, 0.6 tread), 2 fluoros |
| `CN_RAMP_DOWN` | THE RAMP | garage_floor / concrete / concrete | 6.0 × 3.4 × 12.0 | −2.5 | shutter 4.0 × 2.8, open | 4.0 × 2.8 at y −2.5 | pitched slab (−14.036°) between two landings, 3 sodium fixtures |
| `CN_CHUTE` | THE CHUTE | concrete_wet / cinderblock / concrete | 1.6 × 1.8 × 10.0 | −6.0 | open 1.2 × 1.4 (it is entered from the vertical `top` anchor instead) | 1.2 × 1.2 at y −6 | pitched slab (−33.69°), 1 point light |

## Commands and order

1. Land the per-scene polish. Re-run `python ninety-nine/tools/build_rooms.py`; its `check_room()` asserts must pass.
2. Port sections 1–4 above into `ninety-nine/tools/higgsfield_scene.py`. Then run `python ninety-nine/tools/higgsfield_scene.py <KEY> build` for every key in `rooms.json`, and check that no `# WARNING` line is left and the code parses.
3. For each built room (not the aliases):
   1. `scene_builder_3d_create_project`: a fresh project, or revision 0 of the old one.
   2. `python ninety-nine/tools/higgsfield_scene.py <ROOM> build`: paste the output into `scene_builder_3d_run_python`. Its result's `skipped` list must be empty.
   3. `python ninety-nine/tools/higgsfield_scene.py <ROOM> imports`: one `scene_builder_3d_import_asset` per item.
   4. `python ninety-nine/tools/higgsfield_scene.py <ROOM> place`: one more `scene_builder_3d_run_python`. It strips `hf_id` / `hf_asset` from the copies.
   5. `python ninety-nine/tools/higgsfield_scene.py <ROOM> proof`: `scene_builder_3d_query_python`. Download its artifacts into `blender/higgsfield/<ROOM>/`.
   6. Record the new `id`, `url`, `revision` and `proof` in `projects.json`.
4. Update `projects.json` and the README's project table:
   - `S6_C` moves to `aliases` (→ `S5_C`). Ask the author before deleting its old project or its `S6_C/` proof folder.
   - `SET_STREET` loses the tower from its catalog props, `SET_DIVE` loses the lift, and `S5_C` gains the Harlowe desk, the tube station and the flag box.
   - Decide whether the `CN_*` connectors get projects.

**The proofs still render the `leave` / `arrive` moves.** `rooms.json` keeps those shots, and the `in` / `out` poses, even though the game no longer cuts between rooms, so the proofs stay comparable with the old ones. The new carried shots (`sit`, `lean`, `stand`, `fall`, `sink`, `grate`, `land`) are keyed on the ShotCam like every other shot. To proof one of them, add its name to the `("leave", "arrive")` tuple that the `proof` command builds `PROOF_SHOTS` from.
