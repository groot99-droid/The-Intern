---
tags: [blender-pipeline]
---

# Higgsfield rebuild note

← [[blender/higgsfield/README|Higgsfield projects]] · [[blender/Blender Pipeline|Blender Pipeline]]

A note to rebuild the scene-builder projects later, with what is needed to make the changes. Written 2026-10-03, when the game became one continuous walk (commit `65184db`, compared against `c1d415e`), and re-checked at `e967424`. Updated 2026-10-10 at `58f762e`, after the seven per-scene polish passes (S0 + street, S1-S2, S3, S4, S5-S6, S7, S8 + endings), compared against `9684b87`.

## Status

**Stale until rebuilt.** Every project in `projects.json` (the 18 rooms; the library project is fine) was built from `data/rooms.json` as it stood at `c1d415e`, before the continuous building and before the polish. None has a doorway or any of the polish's props, and `S6_C` is still its own room. The proofs in each `<ROOM>/` folder show those older sets.

**The polish has landed**, so the rooms have stopped moving for now. The rebuild can start once `higgsfield_scene.py` has the ports below. The game reads nothing from these projects, so nothing breaks while they are stale.

When the time comes, redo the tables below against the commit the rebuild starts from. They came from throwaway scripts, not committed: load the older `ninety-nine/data/rooms.json` with `git show <commit>:…` and the current file, and for each room key compare props by type (catalog props by `node`), `doors`, `zones`, `anchors`, `entry`, `size`, `floorY`, `boxes` and `lights` (as multisets of their JSON), and the `shots` names. Run `python ninety-nine/tools/higgsfield_scene.py <KEY> build` for every key and collect its `# WARNING` lines for the prop types still missing.

## Runtime-only vs geometry

Some of what changed is only read by the running game ([[ninety-nine/src/world/World|src/world/]], `src/director.js`). The Blender copy never needs it, and `higgsfield_scene.py build` already strips it from the JSON it embeds (`RUNTIME_ONLY`):

- `zones` (threshold zones, with any `seat` pose), `entry` (the doorway a connector arrives through), `anchors` (extra join points: the edge's `drop`, the dive's `surface` and `grate`, the chute's `top`), `holdEntry` (the cab and the store keep their entry open), `swim` (the dive's swim limits), `connector` and `drop` (connector metadata), `_note`.
- Also runtime, already ignored by the template: `spawn`, `footstep`, `actors` paths and their `face`, a prop's `collide`, a door's `locked`, its invisible blocking body and its shadow plug, a light's `id`, boxes marked `invisible` (the kerb bounds, the barrier at the lip, the counter's spine), and a prop's `showFrom` (the dead street is drawn only while the eye is in the lobby or its corridor).

What the Blender copy **must** get:

1. **Doorways** (`doors`): each one is a hole cut out of its wall, a frame and a leaf in the hole, and a sill strip across the reveal. The full list is in the Doorways section below.
2. **`floorY`**: a connector's floor sits below 0 (stairs, ramp, chute). The floor slab goes from `floorY - 0.2` to `floorY` and the walls run from `floorY` up to `H`.
3. **Pitched boxes** (`pitch`, degrees): the ramp slab in `CN_RAMP_DOWN` (−14.036°) and the chute slab in `CN_CHUTE` (−33.69°), each tilted about X around its own centre.
4. **`boxcutter`**, the one threshold-era prop the port still lacks (section 4). The other three threshold props (`bench`, `tubestation`, `flagbox`) are no longer placed.
5. **Hidden props** (`hidden: true`), built but not rendered until a beat shows them. There are many now: the hands in `S0_X` and `SE_PEND` (with `slip99`); the receptionist's jaw, `front_dark` and the green door lamps in the waiting rooms; S3 H's six handprints; S4 H's `evidence_h` and `end_cage_on`; S5 C's `tube_lamp` and `flag_lamp`; S5 H's `fifth_car` (a catalog `glb`, so `place` must hide its copy too) and `boom_up`; S7 C's indicator readings `ind_b1`…`ind_glyph` and the gate's `gate_1` / `gate_2`; S8 C's lit work lamps and `openbox`; the dive's `poollamp_dead` and `grate_open`; the boardroom's `self`.
6. **Lights that start off** (`off: true`): `inner_lamp` and `service_lamp` (waiting rooms, S3 H, SE_PEND), `end_bulb` (S4 H), `terminal_glow`, `harlowe_glow`, `tube_lamp` and `flag_lamp` (S5 C), `docklamp` and `sortlamp` (S8 C), `gratelight2` (the dive). They are dark when the room is entered.
7. The per-room changes below: props and boxes added, removed or moved, sizes, and new shots. New shots need no work, because the template keys every shot it finds.
8. **Material slots.** Any slot a room uses that is missing from the template's `RECIPES` / `LOWPOLY` silently falls back to plaster. Two rooms now use slots it lacks: `wood` (S0 X's desk) and `brick` (SET_STREET's end wall and facades). A door leaf's `mat` may now be a photoreal slot (`rust` on the freight doors, `plaster_dark` on S3 C's flush service door).
9. **The polish's props.** `src/walk/props.js` has a marked `polish: <group> -- begin/end` block per scene group. Every builder in those blocks that a room places needs a `p_*` twin in the template: 81 types, listed in section 5. `build` names each missing one in a `# WARNING` line.
10. **`noFloor`** (SET_DIVE): no floor slab. The pool floor is boxes laid round the grate's hole, with the pit under it.
11. **Door options**: `frame` (the frame's slot), `glass` (the pane's slot), `swing: 'out'`, and `panel` on more leaves (section 2).
12. **Catalog props painted flat**: a `palette` prop placed after the catalog chairs paints those with `paint` in one flat colour (S1's maroon, the boardroom's chairs). Without it the chairs take the library's 80% tint.
13. **`pattern` lights**: S1 H's six lamps each pulse on their own `pattern`, like S3 C's ENTER light. Store `pattern` as a custom property, like `flicker`.

## What changed at the continuous building, per room (`c1d415e` → `65184db`)

Read this table together with the polish table after it. Where the two disagree (a door moved, a prop replaced), the polish table and the current data win.

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

## What the polish changed, per room (`9684b87` → `58f762e`)

Counts are of the room's own record. "Lights" is the number of light specs.

| Room | Geometry to rebuild | Runtime-only (no Blender work) |
|---|---|---|
| `S0_X` apartment | The box `desk` → `homedesk` (photoreal `wood`); the catalog table lamp → `desklamp`. Added `bed`, `doorglow`, `crtdust` and a second `papers`. Lights 2 → 3 (the CRT, the desk lamp, the line under the door). Darker, bluer atmosphere; wall and ceiling tile 2.6. `sit`, `stand` changed | the door is `locked` |
| `SET_STREET` | **The catalog blocks are gone** (6 `lib_aptblock`, 5 `lib_brownstone`): 15 photoreal `facade`s line both sides. Boxes 65 → 89. Added 8 `lampglow`, 4 `streetsign`, a `newsbox`, a `clockpost` (its `clock` at `scale` 1.6), the `addressplate`, `kerbs`, 3 `roadmarks`, 2 fluoros, a wall plate and a fifth parked car (`lib_car_suv`). Lights 0 → 10. Sun moved from `[-6, 9, 60]` to `[0, 22.5, 64]` at intensity 3.2, hemisphere 0.95. `tower` door: `frame: marble`, `swing: out`. `in` changed | |
| `S1_C`, `S1_H` (S2 aliases them) | The booth: a `reception` counter with its glass, the `receptionist` on a dais (and her hidden `receptionist_jaw`), 5 boxes round the booth, a `notice` placard, a `speaker` and the booth fluoro. The `queue` lane and `ticketpost` dispenser, `floorsheen`, `monogram`, `lobbydust`, two `doorlamp` pairs, `backing` behind the front glass, a `badgereader` by the inner door, a `palette`. Removed: `counter`, `dispenser`, `emblem`, `figure`, `placard`. H: 36 loose `slip`s → one `slippile`; two catalog chairs → `tipchair`s. Doors: `front` pane `glass_dark`; `inner` 1.1 → 1.2 wide with a panel; `service` 1.0 × 2.1 → 1.2 × 2.2. Lights 3 → 9 (six ceiling lamps, the booth, two door lamps off; H's lamps on `pattern`s). Wall tile 4.4; H exposure 1.5 | zones `seat_w` / `seat_e` → `seat0`…`seat7` (H: six) with `seat` poses; the counter's invisible spine |
| `S3_C` corridor | `curtain` doorway 2.4 × 2.9 → 1.8 × 2.4; `side` moved z 4.6 → 1.2 (h 2.3); `service` moved z 4.0 → 5.4, 1.2 × 2.2, a flush `plaster_dark` leaf and frame. Added `velvetdrape`, two `entersign`s (ENTER lit, EXIT dead), `badgescanner` (replaces `badgereader`), `dustmotes`, `curtainvoid`, a `placard`, two downlight fluoros; the old `sign` is gone. Marble wainscot (skirt h 0.92). Lights 3 → 4 (two downlights, the green with its `pattern`, the laser's red). Shots changed | |
| `S3_H` lobby doors | Rebuilt from the new waiting room (the S1 booth, queue, sheen, monogram and lamps). Doors: `curtain` x −5.6 → −5.4, 1.8 × 2.6; `service` now on the W wall at 3.8 (was S, −4.6); `inner` as S1's. Added `velvetdrape`, a dead `entersign`, `curtainvoid`, six hidden `handprint`s on the front glass and the `deadstreet` beyond it (one unlit mesh outside the shell). Lights 4 → 9 | zones cut to `glass` (a box) and `curtain`; `bumpCount` |
| `S4_C` cubicle floor | Size 26 × 36 → 24.6 × 38; walls `plaster_blown`. 26 partitions and 18 fluoros fewer. `side` door moved z 3.9 → 0.9, 1.2 wide with a panel, hinge L. `figure` + `papers` → `manager` + `evidence`. Added a `bulkhead` over the side door, a `lightspill`, 3 `dust`, a `placard`. Lights 12 → 14. Shots changed | manager path `[0, -12]` → `[0, -5]`, `face: false` |
| `S4_H` labyrinth | `far` leaf `lp_beige` with a panel; `ajar` 0.22 → 0.3, hinge R, a panel; two piers (4 boxes) frame the ajar door. 7 fluoros → 9 `cagebulb`s (at the far end a dark one and a lit one, hidden). Added 5 `puddle`s, `steam`, 2 `mopsink`s, a `drain`, `mopbucket`, `handtruck`, `lightspill`; `figure` → `manager` (and the hidden `evidence_h`); one `lib_basin` fewer. Fog `#45423a`. Lights 7 → 9 | nine band zones; the manager actor; `armAfter` |
| `S5_C` desk (S6_C aliases it) | Ceiling 8 → 3 m (`ceiling_tile`), carpet floor. `freight` moved to x −3.8, 1.6 wide, a `slide` in `rust` with a `lp_dark` frame; a new `service` door (E, z 3.0). `stapler` → `staplerheavy`; `tubestation` → `tubeorder` + `canister`; `flagbox` → `callbox`; 3 `lampdot`s; a `troffbeam`; 4 pillars; 2 keyboards, a mug, 2 papers, a second wooden chair. Lights 5 → 6. Shots `desk`, `screen`, `harlowe` added | zone `read` |
| `S5_H` garage | `stairs` door moved z −8 → −19.5. `lib_car_sedan2` and `lib_car_taxi` gone (four cars, and the hidden fifth); 2 `cardoor`s; the `boom` pair before the ramp; a `lib_cagelamp` over the side door; 6 `oilstain`s; 10 wall plates. Boxes 1 → 9 (floor arrows, the side door's green). Lights 13 → 14. Shots `kerb`, `side`, `cruiser` added | |
| `S6_H` edge (S7_H aliases it) | Size 32 × 24 → 32 × 48 (the run). `front` is a 4 m `shutter`; `freight` moved to the E wall at z −22, a `slide` in `rust`. **Most of the pool's geometry (boxes 97 → 28) moved into one `boxkit` prop** (`poolkit`: 57 boxes and its water) so beats can hide it: build it shown. Added 20 catalog cars (5 each of cruiser, pastel, sedan, suv), 10 `cardoor`s, 12 pillars, 6 sodium fixtures, 14 wall plates, 5 `oilstain`s, 9 `rebar` stubs, 2 `guardrail`s either side of the gap, the `paintline`, `stopbench` (replaces `bench`). Lights 9 → 16 (8 `run`, 5 `pool`); no hemisphere. Shots `bench`, `gap`, `edge` added, the rest changed | anchor `drop` moved to `(-8, -4.3, -30)`; zones moved |
| `S7_C` freight cab | Ceiling `grate` → `rust`, a `grate` kick band (skirt). `cab` leaves `lp_dark`, sill `rust`, `open: true`: build it open. 39 boxes (rust shell, quilted padding, bumper rails). `panel` → `cabpanel`; the catalog cage lamp → `cabbulb`; 7 `floorind` placements (5 hidden) and 3 `scissorgate` placements (2 hidden). Lights 1 → 3 | zone `cab_center` → `cab_inside` |
| `S8_C` mailroom | Height 10 → 16. **The stack field is regenerated again**: 45 `boxtower`s → 43 `cartontower`s, 2 `lib_pallets` fewer, `lib_guarddesk` → `lib_crate`. `figure` → `blurfigure` (the clerk); `package` → `soggypackage` + `wetring` (and the hidden `openbox`); `table` → `sortingtable`; a `counter`; `pigeonholes`; 9 fluoros → 9 `highbay`s and 9 `lightcone`s; 4 `worklamp`s (the two lit ones hidden). Lights 9 → 11. Shot `dock` added | the package actor |
| `SET_DIVE` pool | Size 12 × 14 × 12 → 26 × 12 × 26; floor `pool_tile` with `noFloor` (boxes 6 → 26: the floor round the grate's hole, the pit, the pillars). Added 18 `caustics`, `motes`, 2 `poollamp`s, 2 `floorgrate`s and the pit's plug (a wall plate). Lights 3 → 6. Shot `descend` removed | anchors moved (`surface` y 12, z 4.5; `grate` y −1.7); zone `pillars` → `pillar` |
| `S8_H` store (SE_EXPUL aliases it) | `hatch` moved to the N wall at x 0; `staff` to E z 3.0. 6 `lib_shelf` → 5 `gondola`s; added `chestcooler`, `storedoor`, `shopglass`, `polycluster`, a `sign`. Boxes 3 → 13 | zone `storefront` → `door` |
| `SE_ASSIM` boardroom (SE_RETAINED aliases it) | Floor `marble_light`, a marble wainscot (skirt h 1.1). `table` → `glasstable`; `package` → `soggypackage` + `wetring`; 3 pendants → 8 fluoros; added the hidden `blurfigure` (`self`), a `numslip` (the 100 on his chair), a `palette`. Lights 3 → 8 | `flagOverlays` now name `mychair`, `hundredth`, `hundredth_print`, `package`, `ring` |
| `SE_PEND` | Rebuilt from the new waiting room (booth, queue, sheen, lamps; S1's doors). The `curtain` prop → `swaycurtain`; added the hidden `numslip` (`slip99`). Lights 3 → 9. Shot `entry` added | |
| `CN_STAIRS_APT`, `CN_STAIRS_CONCRETE`, `CN_CORRIDOR_DOWN` | One more fluoro each (3 lights) | |

`S2_C`, `S2_H`, `S7_H`, `SE_RETAINED` and `SE_EXPUL` stay aliases. `build_rooms.py`'s `CATALOG` still lists nodes no room places any more, among them `lib_tower`, `lib_lift`, `lib_aptblock`, `lib_brownstone`, `lib_tablelamp`, `lib_guarddesk` and `lib_shelf`.

## Doorways

Every doorway in the built rooms, as of `58f762e`. Aliases share their base room's doorways. `x` is the offset along the wall: the x coordinate on N/S walls, z on E/W. The sill is at the room's floor unless a `y` is given. If there is no leaf slot, the leaf uses its kind's default.

| Room | Door | Wall | x | w × h | Kind | Leaf / extras |
|---|---|---|---|---|---|---|
| S0_X | `door` | S | −1.3 | 1.2 × 2.2 | door | `lp_beige`, hinge R |
| SET_STREET | `stoop` | S | 0 | 1.2 × 2.2, sill y 0.14 | door | `lp_dark`, panel `glass`, hinge L |
| SET_STREET | `tower` | N | 0 | 2.6 × 2.9, sill y 0.3 | glass | frame `marble`, swings out |
| S1_C, S1_H | `front` | S | 0 | 2.6 × 2.9 | glass | pane `glass_dark` |
| S1_C, S1_H, S3_H, SE_PEND | `inner` | N | 5.6 | 1.2 × 2.2 | door | `lp_beige`, panel `lp_grey`, hinge R |
| S1_C, S1_H, SE_PEND | `service` | S | −4.6 | 1.2 × 2.2 | door | `lp_grey` |
| S3_C | `curtain` | N | 0 | 1.8 × 2.4 | curtain |  |
| S3_C | `glass` | S | 0 | 2.4 × 2.8 | glass | pane `glass_dark` |
| S3_C | `side` | E | 1.2 | 1.2 × 2.3 | door | `lp_beige`, hinge R |
| S3_C | `service` | W | 5.4 | 1.2 × 2.2 | door | `plaster_dark`, frame `plaster_dark`, hinge R |
| S3_H, SE_PEND | `front` | S | 0 | 2.6 × 2.9 | glass |  |
| S3_H | `curtain` | N | −5.4 | 1.8 × 2.6 | curtain |  |
| S3_H | `side` | E | 3 | 1.2 × 2.3 | door | `lp_beige`, hinge R |
| S3_H | `service` | W | 3.8 | 1.2 × 2.2 | door | `lp_grey`, hinge R |
| S4_C | `front` | S | 0 | 1.4 × 2.3 | door | `lp_beige` |
| S4_C | `back` | N | 0 | 1.4 × 2.3 | door | `lp_beige` |
| S4_C | `side` | E | 0.9 | 1.2 × 2.2 | door | `lp_grey`, panel `lp_dark`, hinge L |
| S4_H | `front` | S | 0 | 1.2 × 2.2 | door | `lp_grey` |
| S4_H | `far` | N | 0 | 1.2 × 2.2 | door | `lp_beige`, panel `lp_dark` |
| S4_H | `ajar` | W | −6 | 0.9 × 2.1 | door | `lp_beige`, panel `lp_dark`, hinge R, `ajar: 0.3` |
| S5_C | `front` | S | 0 | 1.2 × 2.2 | door | `lp_dark` |
| S5_C | `freight` | N | −3.8 | 1.6 × 2.3 | slide | `rust`, frame `lp_dark` |
| S5_C | `service` | E | 3 | 1 × 2.1 | door | `lp_grey` |
| S5_H | `front` | S | 0 | 1.4 × 2.3 | door | `lp_grey` |
| S5_H | `stairs` | E | −19.5 | 1.1 × 2.2 | door | `lp_grey` |
| S5_H | `ramp` | N | 0 | 4 × 2.8 | shutter | `lp_grey` |
| S6_H | `front` | S | 0 | 4 × 2.8 | shutter | `lp_grey` |
| S6_H | `freight` | E | −22 | 1.6 × 2.3 | slide | `rust`, frame `lp_dark` |
| S7_C | `cab` | S | 0 | 1.6 × 2.2 | slide | `lp_dark`, sill `rust`, stands open |
| S8_C | `front` | S | 0 | 2 × 3 | door | `lp_dark` |
| S8_C | `deliveries` | N | 0 | 1.6 × 2.6 | door | `lp_dark` |
| S8_H | `hatch` | N | 0 | 1 × 1.1 | open |  |
| S8_H | `staff` | E | 3 | 1 × 2.1 | door | `lp_grey` |
| SE_ASSIM | `front` | S | 0 | 1.4 × 2.4 | door | `lp_wood` |

For stills, build every leaf **shut**. There are three exceptions: a connector's `entry` has `open: true`, so it stands open; the cab's doors (`S7_C` `cab`, `open: true`) stand open; and `ajar` stands at that fraction (see the door formula below).

## What `higgsfield_scene.py` needs at rebuild time

The tool runs for every current key, aliases and `CN_*` included, without failing, and its `build`, `place` and `proof` output parses (checked at `58f762e`). That is all it does so far. The ports below are what make the rebuilt projects match the game.

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
  - Optional `panel` (a window or panel, in its own slot: the street door's `glass`, the inner doors' `lp_grey`): w·0.45 × h·0.32 × 0.09 at y = 0.66h, standing 2 cm proud of both faces.
  - Kick panel: `lp_dark`, (w − 0.24) × 0.36h × 0.09, at y = 0.25h.
  - Handles: `lp_brass`, 0.04 × 0.04 × 0.12, at (w − 0.12) from the hinge, y = 0.47h, on both faces (z ±0.05).
  - Open angle: 95° into the room. The leaf turns by `EASE(u) · 95°`, where `EASE(u) = 2u²` for u < 0.5 and `1 − (2 − 2u)²/2` above. `ajar: 0.22` gives about 9°.
- **glass**: two leaves hinged at x = ±w/2, z = +0.02, each `lw = w/2 − 0.02` wide.
  - Each leaf: `lp_dark` stiles 0.06 × h × 0.06 at both edges, a bottom rail lw × 0.1 × 0.06 (y 0.05) and a top rail lw × 0.08 × 0.06 (y h − 0.04).
  - Pane: (lw − 0.08) × (h − 0.2) × 0.02 in the door's `glass` slot (`glass_dark` for the smoked lobby doors) or the photoreal `glass`, since the building's glass is photoreal (C1).
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
- **`swing: 'out'`** (the tower's glass doors): every leaf's z offset above is mirrored to −z and it turns the other way, opening away from the room. An `angle` overrides the open angle (95° for `door`, 80° for `glass`).
- Skip the invisible blocking body (w × h × T, a collider for the running game only).

### 3. The smaller ports

- **`hidden` → `hide_render`**: a prop is an `empty()` with child boxes, and `hide_render` on the empty does not hide its children. Set it on the empty **and every child**, and set `hide_viewport` too if the proof should not show them. A hidden `glb` (S5 H's `fifth_car`) is a catalog copy made by `place`: hide that copy.
- **`pitch` → rotate about X around the box centre**: `archbox()`'s object origin is already the box centre, so set `ob.rotation_euler = (math.radians(b["pitch"]), 0, 0)`. Game X is Blender X and the sign carries over unchanged (three.js `rotateX(θ)` on game y/z is a +θ rotation about Blender X under `(x, y, z) → (x, −z, y)`).
- **`floorY` → shell from `floorY` to `H`**: the floor slab goes from `floorY − 0.2` to `floorY`; walls and bands start at `floorY`; the ceiling stays at `H`. A door with no `y` sits at `floorY` (every connector door gives its `y`).
- **`noFloor` → no floor slab** (SET_DIVE); its floor is in its `boxes`.
- **`off` lights → `hide_render`** (or energy 0), and store `id` as a custom property so a variant can still switch `terminal_glow` on for S6, or the lit lamps on for a later moment.
- **`palette` → paint the flagged catalog copies**: after `place`, give every catalog copy whose prop has `paint` a flat material in that colour (or in its `mat` slot's colour when `paint` is `true`), on its light surfaces.
- **`boxkit` → boxes**: its `boxes` are `[slot, [x0, y0, z0], [x1, y1, z1], tile]` in the prop's frame, built like the room's boxes, plus its `water` sheet (`y`, `from`, `to`).
- **`tile`** (the texture repeat per surface and per box) does not need porting: the template uses its own procedural scale.

### 4. The threshold-era builder still missing

These are the dimensions from `src/walk/props.js`, written in the template's own `box()` (y is the base, as in props.js). Add it beside the other `p_*` builders; `prune()` keeps only the ones a room uses.

```python
def p_boxcutter(g, o):
    box(g, "lp_brass", 0.14, 0.02, 0.03, 0, 0, 0); box(g, "lp_chrome", 0.04, 0.008, 0.015, 0.09, 0.006, 0)
```

`bench`, `tubestation` and `flagbox`, whose ports this note used to give, are no longer placed by any room (the polish replaced them with `stopbench`, `tubeorder` and `callbox`, in section 5), so they need no twin. The `p_hands` port never had `reach`, and the hands no longer carry a `slip` either: PENDING's 99 is its own `numslip` prop.

### 5. The polish's prop builders

`build` skips these with a `# WARNING` line. Each needs a `p_*` twin ported from its `polish: <group>` block in [[ninety-nine/src/walk/props.js|props.js]], at the dimensions there. Things to know before porting:

- **C1 still decides the material.** The building's things (facades, kerbs, road paint, the velvet, puddles, oil, rebar, the glass table, caustics, light shafts and glows) are photoreal slots; the company's (signs, the counter's body, figures, the gate, the panel, gondolas) are `LOWPOLY` flat colours.
- **Some draw their own textures** on a canvas: printed words (`notice`, `entersign`, `numslip`, `floorind`), blurred faces (`receptionist`, `manager`, `blurfigure`), the caustic web, the handprints. Bake them to image textures or stand in a flat colour; no legible text may say "you" (C4).
- **Some move in the game** (from `onBeforeRender`): the dispenser's falling slips, the receptionist's jaw, motes and dust, steam, the velvet's sway, the ENTER sign's `sync`, the badge reader's fan, the package's throb and the ring's `spread`, the swinging curtain, caustics. A still takes one fixed pose.
- **Some are stop-motion sets of placements** a beat swaps, sharing one position: `floorind` (one per reading), `scissorgate` (three `ext`s), the lit / dark pairs (`doorlamp`, `worklamp`, `poollamp`, `cagebulb`, `boom`, `floorgrate`). Port each; `hidden` decides which renders.
- **Some read their parent's spec**: `receptionist_jaw` (the receptionist's), `canister` (the tube station's), `lampdot` (a parent's pos / rot plus its own `at`).

Every type the port lacks at `58f762e`, by the block it comes from, with the rooms that place it (×count):

**the thresholds (pre-polish)**

| Type | Rooms | What it is |
|---|---|---|
| `boxcutter` | S8_C | the box cutter on the sorting table; port in section 4 |

**S0 + street**

| Type | Rooms | What it is |
|---|---|---|
| `addressplate` | SET_STREET | the brass address plate beside the tower doors, wordless bars (low-poly) |
| `bed` | S0_X | his bed (low-poly) |
| `clockpost` | SET_STREET | the street clock's post and cradle; the `clock` prop sits on it, scaled 1.6 |
| `desklamp` | S0_X | his desk lamp: low-poly base, stem and shade; the glow inside the shade is light |
| `doorglow` | S0_X | the stairwell's warm line of light under the shut door |
| `crtdust` | S0_X | a few dozen still motes in the CRT's light, in a w × h × d box |
| `facade` | SET_STREET ×15 | a street facade: photoreal brick or stone, a grid of dark windows with sills and lintels, a shopfront or door at the ground floor |
| `homedesk` | S0_X | his desk, photoreal wood, world-tiled grain (building) |
| `kerbs` | SET_STREET | kerb stones from `boxes`, bump-less stone (building) |
| `lampglow` | SET_STREET ×8 | the lit lens and glow under a catalog street lamp's head |
| `newsbox` | SET_STREET | a newspaper box, blank paper behind its window (low-poly) |
| `roadmarks` | SET_STREET ×3 | road paint, gutters and covers: flat quads in a bump-less copy of the slot (`rects`) |
| `streetsign` | SET_STREET ×4 | a wordless sign on a pole: `kind` ahead / noparking / oneway (low-poly) |

**S1-S2**

| Type | Rooms | What it is |
|---|---|---|
| `backing` | S1_C, S1_H, SE_PEND | matte black behind the front glass, outside the shell (shown once the vestibule is gone) |
| `lobbydust` | S1_C, S1_H, S3_H, SE_PEND | a slow drift of cool dust in the ceiling light, `n` motes in a w × h × d box from `y` up |
| `doorlamp` | S1_C ×4, S1_H ×4, S3_H ×4, SE_PEND ×4 | a lamp over a door, `lens` red or green (pairs swapped by beats) |
| `floorsheen` | S1_C, S1_H, S3_H, SE_PEND | the wet marble's mirror film: the ceiling's fixtures (`lamps`) reflected, `coffers` in H |
| `monogram` | S1_C, S1_H, S3_H, SE_PEND | the brass V&A monogram inlaid in the marble, radius `r` |
| `notice` | S1_C, S1_H, S3_H, SE_PEND | a brass placard engraved with `text` (the placard's words) in a dark rim |
| `palette` | S1_C, S1_H, S3_H, SE_ASSIM, SE_PEND | not geometry: paints the catalog props placed before it that ask for it (`paint`) in one flat colour |
| `queue` | S1_C, S1_H, S3_H, SE_PEND | brass stanchions and sagging maroon rope, `w` × `len` |
| `reception` | S1_C, S1_H, S3_H, SE_PEND | the reception counter: low-poly body and ledge, photoreal glass in mullions, grille, slot tray, fingerprints |
| `receptionist` | S1_C, S1_H, S3_H, SE_PEND | the receptionist on a dais, head bowed (`tilt`), face blurred |
| `receptionist_jaw` | S1_C, S1_H, S3_H, SE_PEND | her jaw, same spec as the receptionist, hidden until the call |
| `slippile` | S1_H | the heap of 99 slips under the dispenser, plus `drift` strays (H) |
| `speaker` | S1_C, S1_H, S3_H, SE_PEND | the round ceiling speaker grille |
| `ticketpost` | S1_C, S1_H, S3_H, SE_PEND | the ticket dispenser on its post (`feed`: slips falling, H) |
| `tipchair` | S1_H ×2 | the catalog chair (`node`) lying on its back or side (`tip`) |

**S3**

| Type | Rooms | What it is |
|---|---|---|
| `badgescanner` | S3_C | the badge reader: low-poly box, red laser slot (light) |
| `curtainvoid` | S3_C, S3_H | a one-sided matte black plane inside the curtain doorway's depth |
| `deadstreet` | S3_H | the street seen through the lobby glass: one unlit, shadowless overcast mesh (`level`, `grey`) |
| `dustmotes` | S3_C | dust in the ENTER sign's green, `size` box, `count` motes |
| `entersign` | S3_C ×2, S3_H | the ENTER / EXIT sign: low-poly housing, lit letters (`text`, `on`, `sync` to a room light) |
| `handprint` | S3_H ×6 | a smeared handprint on the glass (`flip`, `tilt`); all six start hidden |
| `velvetdrape` | S3_C, S3_H | photoreal red velvet either side of the curtain doorway (`gap`), a pelmet and brass trim |

**S4**

| Type | Rooms | What it is |
|---|---|---|
| `bulkhead` | S4_C | a wall bulkhead lamp, cold lens, over the side door |
| `cagebulb` | S4_H ×9 | a caged bulb hanging `drop` under a ceiling plate, dark when `lit: false` |
| `dust` | S4_C ×3 | warm motes drifting in a w × h × d box |
| `evidence` | S4_C, S4_H | the evidence: photoreal paper stack, typed and signed, a clip (`tilt`) |
| `handtruck` | S4_H | a hand truck on its nose plate with two cartons |
| `lightspill` | S4_C, S4_H | a fan of light on the floor through a door (`w`, `w2`, `len`) |
| `manager` | S4_C, S4_H | the manager: blocky suit, blurred face, four-polygon tie, `offer` forearm out |
| `mopbucket` | S4_H | the mop bucket on casters with its wringer and mop (low-poly yellow) |
| `puddle` | S4_H ×5 | standing water: an irregular dark glossy film `w` × `d` (building) |
| `steam` | S4_H | faint wisps off a floor drain (three crossed additive sheets) |

**S5-S6**

| Type | Rooms | What it is |
|---|---|---|
| `boom` | S5_H ×2 | the parking boom barrier, arm along +x (`up` raised) |
| `boxkit` | S6_H | building boxes shown and hidden as one prop (`boxes`): S6 H's pool kit |
| `callbox` | S5_C | the red call box on a post (replaces `flagbox`) |
| `canister` | S5_C | the canister in the station's tray (same pos / rot as the station) |
| `cardoor` | S5_H ×2, S6_H ×10 | a car door hanging open beside a catalog car (`angle`, `len`, `tint`) |
| `guardrail` | S6_H ×2 | a W-beam guard rail on posts, `len`, its last `bend` metres twisted over the drop |
| `lampdot` | S5_C ×3 | a small lit lamp face (`mat`) at `at` inside a parent's pos / rot: the station's and call box's lamps, Harlowe's standby light |
| `oilstain` | S5_H ×6, S6_H ×5 | a soft wet oil blotch on concrete, one of four shapes (`seed`) |
| `paintline` | S6_H | the painted stop line, `w` × `d` |
| `rebar` | S6_H ×9 | rusted rebar stubs bent out of the broken slab edge (`n`, `len`) |
| `staplerheavy` | S5_C | the heavy desk stapler (STAPLE) |
| `stopbench` | S6_H | the slatted bench at the stop line (replaces `bench`) |
| `troffbeam` | S5_C | the troffer's faint additive cone of lit dust to the carpet |
| `tubeorder` | S5_C | the pneumatic tube station: cabinet, receiver, OUT tray, tube rising `h` (replaces `tubestation`) |

**S7**

| Type | Rooms | What it is |
|---|---|---|
| `cabbulb` | S7_C | the cab's caged bulb: ceiling plate, stem, bare bulb and a rust wire guard, `h` up to the ceiling |
| `cabpanel` | S7_C | the 66-button panel with one lit (same layout and origin as `panel`) |
| `floorind` | S7_C ×7 | the floor indicator: three 7-segment cells in a housing; one placement per reading (`text`), swapped by the ride's stops |
| `scissorgate` | S7_C ×3 | the scissor gate drawn to `ext` (three placements: folded, half, shut) |

**S8 + endings**

| Type | Rooms | What it is |
|---|---|---|
| `blurfigure` | S8_C, SE_ASSIM | a figure with a blurred portrait over its face: the clerk, his `self` |
| `cartontower` | S8_C ×43 | a hand-stacked tower of cartons into the fog (`n`, `cols`), one instanced mesh |
| `caustics` | SET_DIVE ×18 | moving caustics on the pillars, the floor and the surface (light) |
| `chestcooler` | S8_H | a chest cooler, a lit well of product under sliding glass lids |
| `floorgrate` | SET_DIVE ×2 | the rusted grate in its frame, hinged on its −z edge (`open` degrees) |
| `glasstable` | SE_ASSIM | the vast photoreal glass table on chrome trestles, top at 0.79 |
| `gondola` | S8_H ×5 | a store gondola of product in blocks of colour (`single` against a wall) |
| `highbay` | S8_C ×9 | a high-bay lamp on a cable into the dark (`hang`) |
| `lightcone` | S8_C ×9 | a shaft of high-bay light down through the fog (additive, no depth write) |
| `motes` | SET_DIVE | particulate drifting upward through the water |
| `numslip` | SE_ASSIM, SE_PEND | a slip printed with its number `n` (99 in his hands, 100 on the chair) |
| `pigeonholes` | S8_C | mail pigeonholes with letters and small parcels |
| `polycluster` | S8_H | his reflection in the glass: a faceless cluster of flat polygons |
| `poollamp` | SET_DIVE ×2 | an underwater pool lamp in a tile face (`lit` pair) |
| `shopglass` | S8_H | the dark storefront glass, drawn by the store, not the shell |
| `soggypackage` | S8_C ×2, SE_ASSIM | the soggy package (and `openbox`, the same opened) |
| `sortingtable` | S8_C | the steel sorting table: cutting mat, shelf of flattened cartons, tape |
| `storedoor` | S8_H | the storefront door standing open outward (`leaves` angles) |
| `swaycurtain` | SE_PEND | a red curtain still swinging from its rod |
| `wetring` | S8_C, SE_ASSIM | the dark wet ring the package leaves (`spread`) |
| `worklamp` | S8_C ×4 | a work lamp on a long cord (`lit` pairs swapped by the package beat) |


### Connectors

Every connector has an entry doorway on its S wall and a bare opening on its N wall. The next room's own entry leaf closes that opening. They come from `build_rooms.py`'s `cn_*` builders.

| Key | Name | Floor / wall / ceiling | W × H × D | floorY | Entry (S) | Exit (N) | Inside |
|---|---|---|---|---|---|---|---|
| `CN_STAIRS_APT` | THE STAIRS | carpet / plaster_dark / plaster_dark | 1.4 × 2.6 × 6.6 | −2.8 | door 1.2 × 2.2, open | 1.2 × 2.2 at y −2.8 | top landing + 14 carpet treads (0.2 rise, 0.3 tread), 3 fluoros |
| `CN_VESTIBULE` | THE VESTIBULE | marble / plaster_dark / plaster_dark | 3.6 × 3.4 × 3.2 | 0 | glass 2.6 × 2.9, open | 2.6 × 2.9 | a pendant |
| `CN_CORRIDOR_OFFICE` | A CORRIDOR | carpet / plaster_dark / ceiling_tile | 1.8 × 2.6 × 6.0 | 0 | door 1.2 × 2.2, open | 1.2 × 2.2 | 2 fluoros |
| `CN_CORRIDOR_SERVICE` | A SERVICE CORRIDOR | concrete_wet / cinderblock / concrete | 1.6 × 2.6 × 6.0 | 0 | door 1.2 × 2.2, open | 1.2 × 2.2 | 2 fluoros |
| `CN_STAIRS_CONCRETE` | A STAIRWELL | concrete_wet / cinderblock / concrete | 1.6 × 2.6 × 6.9 | −3.0 | door 1.2 × 2.2, open | 1.2 × 2.2 at y −3 | landing + 15 concrete treads, 3 fluoros |
| `CN_CORRIDOR_DOWN` | A CORRIDOR DOWN | concrete_wet / cinderblock / concrete | 1.8 × 2.6 × 8.8 | −1.2 | door 1.2 × 2.2, open | 1.2 × 2.2 at y −1.2 | landing + 8 long treads (0.15 rise, 0.6 tread), 3 fluoros |
| `CN_RAMP_DOWN` | THE RAMP | garage_floor / concrete / concrete | 6.0 × 3.4 × 12.0 | −2.5 | shutter 4.0 × 2.8, open | 4.0 × 2.8 at y −2.5 | pitched slab (−14.036°) between two landings, 3 sodium fixtures |
| `CN_CHUTE` | THE CHUTE | concrete_wet / cinderblock / concrete | 1.6 × 1.8 × 10.0 | −6.0 | open 1.2 × 1.4 (it is entered from the vertical `top` anchor instead) | 1.2 × 1.2 at y −6 | pitched slab (−33.69°), 1 point light |

## Commands and order

1. The per-scene polish has landed. If a set has changed since `58f762e`, re-run `python ninety-nine/tools/build_rooms.py`; its `check_room()` asserts must pass.
2. Port sections 1–5 above into `ninety-nine/tools/higgsfield_scene.py`. Then run `python ninety-nine/tools/higgsfield_scene.py <KEY> build` for every key in `rooms.json`, and check that no `# WARNING` line is left and the code parses.
3. For each built room (not the aliases):
   1. `scene_builder_3d_create_project`: a fresh project, or revision 0 of the old one.
   2. `python ninety-nine/tools/higgsfield_scene.py <ROOM> build`: paste the output into `scene_builder_3d_run_python`. Its result's `skipped` list must be empty.
   3. `python ninety-nine/tools/higgsfield_scene.py <ROOM> imports`: one `scene_builder_3d_import_asset` per item.
   4. `python ninety-nine/tools/higgsfield_scene.py <ROOM> place`: one more `scene_builder_3d_run_python`. It strips `hf_id` / `hf_asset` from the copies.
   5. `python ninety-nine/tools/higgsfield_scene.py <ROOM> proof`: `scene_builder_3d_query_python`. Download its artifacts into `blender/higgsfield/<ROOM>/`.
   6. Record the new `id`, `url`, `revision` and `proof` in `projects.json`.
4. Update `projects.json` and the README's project table:
   - `S6_C` moves to `aliases` (→ `S5_C`). Ask the author before deleting its old project or its `S6_C/` proof folder.
   - The catalog props, as of `58f762e` (against the built projects): `S0_X` book stack and wooden chair (the table lamp is gone); `SET_STREET` 7 street lamps, traffic light, hydrant, trash bin and five cars (the brownstones, apartment blocks and tower are gone); `S1_C` 8 accent chairs, `S1_H` 6 (the two overturned are `tipchair`s), `S3_H` 8 and a payphone; `S3_C` the security camera; `S4_C` 78 desks, CRTs and wooden chairs; `S4_H` 3 wash basins and the breaker panel; `S5_C` 2 wooden chairs; `S5_H` five cars (one hidden) and a cage lamp; `S6_H` 20 cars; `S7_C` none (the cage lamp is the `cabbulb` prop); `S8_C` 22 pallet stacks, mail sacks and a crate (the guard desk is gone); `S8_H` none (the shelf racks are `gondola`s); `SET_DIVE` none (the lift is gone); `SE_ASSIM` 13 accent chairs; `SE_PEND` 2.
   - Decide whether the `CN_*` connectors get projects.

**The proofs still render the `leave` / `arrive` moves.** `rooms.json` keeps those shots, and the `in` / `out` poses, even though the game no longer cuts between rooms, so the proofs stay comparable with the old ones. The carried shots (`sit`, `lean`, `stand`, `fall`, `sink`, `grate`, `land`) and the polish's previews (`desk`, `screen`, `harlowe`, `kerb`, `side`, `cruiser`, `bench`, `gap`, `edge`, `dock`, `entry`) are keyed on the ShotCam like every other shot. To proof one of them, add its name to the `("leave", "arrive")` tuple that the `proof` command builds `PROOF_SHOTS` from.
