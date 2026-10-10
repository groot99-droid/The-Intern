---
tags: [generated-asset]
---

# Scene Flow

← [[ninety-nine/assets/Generated Assets|Generated Assets]]

The game as it is walked, in play order: every room, threshold, doorway, connector and ambience bed. Taken from [[ninety-nine/data/scenes.json|data/scenes.json]] (rooms, thresholds, beats), [[ninety-nine/data/endings.json|data/endings.json]] (ending rooms, beats and routes) and [[ninety-nine/data/rooms.json|data/rooms.json]] (the doorways, zones, props and connectors themselves, written by `tools/build_rooms.py`).

## How to read it

- **A scene is a room with two thresholds.** A threshold is a zone the candidate walks to, at something in the room: a chair, a door, a lit button. Its label (the choice's words) fades in as he enters its approach ring, and stepping into the zone commits the choice: succumb +1, resist −1. Some zones arm only after he has stood in another (`armAfter`).
- **Then the way on opens.** The threshold's beats play. Either the next scene starts where he stands (same set), or the threshold's **exit** door opens onto a **connector** (`via`) with the next scene's room joined behind it. A `viaDark` passage stays unlit until he is in it.
- **The render is decided at the choice.** The room behind the door is in the render the score picks after the choice, and both possible rooms are built before he commits. Both thresholds of a scene lead to the same next scene; only the render can differ, and only on the flip edges S2→S3, S4→S5 and S6→S7.
- **There is no going back (C3).** The door seals behind him once he is 1.2 m into the connector, and the room he left is dropped. Until then the connector's own entry leaf is hidden, so only the room's door shows in that doorway. Crossing the connector's midpoint is the scene boundary: the drone detunes, and the ambience, music, captions and fracture move to the next scene. The next room's entry shuts once he is 1.6 m inside; a held-entry room (the cab, the store) holds it open from the moment he is in until the choice.
- **The camera is taken from him only for carried moments**, named below: sitting, the call, the cab, the fall, the chute, the endings. Several carried beats can run as one move (`together`).
- **Locked doors answer.** Walking into a locked door makes it shudder and rattle. S3 H counts the pushes.
- **Waiting answers too.** A branch's `idle` runs when nothing has been chosen for a while: S2 repeats the call, and 25 s in the cab is REFUSE.

Connectors (`CN_*`, all level or downhill):

| Connector | What it is |
|---|---|
| `CN_STAIRS_APT` | carpeted stairs down, 2.8 m |
| `CN_VESTIBULE` | a marble airlock with glass at both ends |
| `CN_CORRIDOR_OFFICE` | a carpeted corridor, 6 m |
| `CN_CORRIDOR_SERVICE` | wet concrete and cinderblock, 6 m |
| `CN_STAIRS_CONCRETE` | a stairwell, 3 m down |
| `CN_CORRIDOR_DOWN` | long shallow steps, 1.2 m down |
| `CN_RAMP_DOWN` | the garage ramp behind a shutter, 2.5 m down |
| `CN_CHUTE` | a dry concrete chute, 6 m down, entered from above |

## S0 — THE UPLOAD (no branch)

`S0_X`, the apartment, at 3 a.m.: the CRT's grey-blue page, a desk lamp's warm pool on the wooden desk, the bed under the clock, dust in the screen's light, and a line of the stairwell's light under the door. He spawns standing; the CRT shows the job posting. A hint fades after a few seconds: CLICK TO LOOK · W A S D WALKS · SHIFT HURRIES (on touch: LEFT THUMB WALKS · RIGHT THUMB LOOKS). The first activating click, key or tap unlocks audio: room tone, footsteps and the music bus, but not the drone. Ambience: [[S0_X_AMB.wav]].

1. **APPLY**, at zone `desk` in front of the computer.
   - He is carried to `sit` and the hands appear (C6), then `lean` in.
   - The WILLING / NOT WILLING form is laid over the CRT (`#screen-layer`). Two or more NOT WILLING answers seed the hostile render.
   - The portal answers on the screen itself: received, the countdown from 6 MONTHS to LEAVE NOW, then ACCEPTED, which stays there.
   - A deadbolt. He is carried to `stand` and the hands go.
2. **The way out.** The apartment `door` opens onto `CN_STAIRS_APT`, and the stairs lead down to `SET_STREET`, entered by the `stoop` door (glass-panelled) in his building's brick end wall. The street bed [[S0_X_AMB_STREET.wav]] comes in on the stairs, and dawn comes up as he descends.
3. **The street.** Photoreal brick facades, kerbs, wet gutters and road paint run 60 m to the tower, whose top the haze takes; the low sun behind him throws every shadow at it (C2). Parked cars, street signs, lamps still burning, a newspaper box and the street's clock on its post are low-poly. The first 99 slip lies before the tower's step.
4. **666 HALLAM ROW.**, at zone `report` on the tower's step (the last step up in the game).
   - A buzz, and the tower's glass doors (`tower`, opening outward in a marble frame) open onto `CN_VESTIBULE`. Beyond it is `S1_C` or `S1_H`, entered through its `front` glass doors.
   - When those doors close behind him, the 48 Hz drone starts (C7, exactly once) and S1 begins.

## S1 — THE WAITING ROOM

`S1_C` (sterile: eight maroon chairs in two rows, the brass monogram in wet marble, cool still light) / `S1_H` (the same room scattered and over-lit: chairs at wrong angles, two overturned, the dispenser feeding 99 slips onto the floor, every lamp pulsing on its own period) · amb [[S1_C_AMB.wav]] / [[S1_H_AMB.wav]] · music muzak

The receptionist sits head-down behind photoreal glass in a booth on the core wall, the placard and a ceiling speaker over her. 1.3 s after he enters, the front doors read dark: nothing of the street once they close (C3).

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| TAKE A SEAT | any upright chair: `seat0`…`seat7` in C; in H, all but the two overturned ones | a look to the receptionist, a scrape, then he turns and sits down into that chair (the zone's `seat` pose), and stands again where he was | none: S2 is the same room |
| STAY STANDING | `counter`, the head of the queue lane at the counter | sets `NEVER_SAT` | none: S2 is the same room |

## S2 — THE CALL

The same room (`S2_C` / `S2_H` alias `S1_C` / `S1_H`); S1's bed carries on.

On entering: the speaker clicks ([[S2_C_SFX_SPEAKER.wav]]); in H it then hisses ([[S2_H_SFX_SPEAKER.wav]]). Her jaw shows (four snapping steps, C5) while his head is turned to her (carried `lookAt`) and the caption reads "Ninety-nine." / "Shaun.". Then the lamp over the inner door turns from red to green. Friction runs on a shorter clock here (10–45 s). If nothing is chosen for 25 s, the speaker clicks and the line comes again, once (`idle`).

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| STAND | `inner_door` | a buzz | `inner` door (N, beside the counter) → `CN_CORRIDOR_OFFICE` → S3 |
| RUN | `front_doors` | the locked front glass rattles twice ([[S3_H_SFX_DOOR.wav]]), a buzz, and the service door's lamp turns green | `service` door (S, by the entrance) → `CN_CORRIDOR_SERVICE` → S3 |

**Flip edge:** either door can open onto `S3_C` or `S3_H`, entered by its `side` door.

## S3 — THE THRESHOLD

**C: `S3_C`**, a short red-carpeted corridor. He comes in by the side door: to his right a heavy velvet curtain under a green ENTER sign (on its 2.3 s cycle, dust drifting in its light) with the badge reader's red laser slot beside it, and pure black behind the curtain; to his left the lobby's glass, locked and smoked, a dead EXIT over it · amb [[S3_C_AMB.wav]]

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| PART THE CURTAIN | `curtain` | on the approach: PRESENT CANDIDATE FOR READING.; on commit: a rustle ([[S3_C_SFX_CURTAIN.wav]]), the curtain parts, READING COMPLETE. THE CANDIDATE IS CONSISTENT. | `curtain` doorway (N) → `CN_CORRIDOR_OFFICE`, dark until he is in it → S4 |
| TRY THE DOOR | `glass`, the glass's whole width | two rattles; a click and "That action violates the terms of the contracted agreement."; a buzz | `service` door (W, flush in the plaster beside the glass) → `CN_CORRIDOR_SERVICE` → S4 |

**H: `S3_H`**, the lobby doors: the waiting room again, entered by a side door. Through its clear front glass, the street from S0 with no sun and no shadows. The curtain hangs in the far corner under a dead ENTER sign · amb [[S3_H_AMB.wav]]

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| PART THE CURTAIN | `curtain`, in the far corner | a rustle; the curtain parts | `curtain` doorway (N) → `CN_CORRIDOR_SERVICE`, dark until he is in it → S4 |
| TRY THE DOOR | `glass`, the whole width of the front glass | three rattles, each leaving one of his handprints on it; the violation line, her jaw moving; a buzz; the service door's lamp turns green | `service` door (W) → `CN_CORRIDOR_SERVICE` → S4 |

**Counted pushes** (`bumpCount`): every walk into the locked front glass is counted. More handprints appear at the 6th, 14th and 22nd push. At the 31st, `COUNTED_DOOR` is set, friction rises by 0.5 and the receptionist says "Thirty-one. The candidate is thorough." (Doc 1).

## S4 — THE FLOOR

**C: `S4_C`**, the cubicle floor, entered at `front` into the rear aisle. The main aisle runs between two clean walls of identical workstations, broken once by the cross aisle, into light haze · amb [[S4_C_AMB.wav]]. On entering, the manager starts up the aisle toward him, the evidence held out, and stops past the cross aisle.

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| TAKE THE PAPERS | `manager`, just in front of him (the zone walks with him; its label shows only within 3.5 m) | on the approach: "You're early. That's already in the file."; on commit: [[S4_C_SFX_PAPERS.wav]], the evidence passes into his hands (the one photoreal paper), the troffer over them blinks and the manager is gone; a deadbolt | `back` door (N) → `CN_CORRIDOR_OFFICE` → S5 |
| TAKE THE SIDE DOOR | `side_door`, at the dead end of the cross aisle: a grey fire door under a cold lamp | a deadbolt; a step back is taken for him, and the door opens | `side` door (E) → `CN_STAIRS_CONCRETE` → S5 |

**H: `S4_H`**, the utility corridor: wet concrete, cinderblock, identical doors receding, caged bulbs, mop sinks, puddles and steam. The manager is far ahead, facing away · amb [[S4_H_AMB.wav]]

Nine silent bands across the corridor (`band_0`…`band_8`, beat zones) keep him 20 m ahead: each band crossed walks him a ninth further, with footsteps ([[S4_H_SFX_FOOTSTEPS.wav]]) at two of them. At the last band the evidence appears on the floor at the far door, the door opens, he goes through, it shuts, and the caged bulb at the end comes on.

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| TAKE THE PAPERS | `far_end`, the evidence at the far door (armed after the last band) | the papers sound; the evidence into his hands; a step back from the door as it opens | `far` door (N) → `CN_CORRIDOR_SERVICE` → S5 |
| TAKE THE SIDE DOOR | `ajar`, stepped into between two piers: the one door left open, cold light through its gap (Harlowe's) | a step back out of the recess as it opens | `ajar` door (W) → `CN_STAIRS_CONCRETE` → S5 |

**Flip edge:** S5 may be either render.

## S5 — THE DESK / THE GARAGE

**C: `S5_C`**, one unmarked desk under a single troffer on a dark carpeted floor, the building's columns off in the dark, entered at `front`. West of the desk, the pneumatic tube station; east, a second desk still logged in as S. HARLOWE and a call box on its post · amb [[S5_C_AMB.wav]]

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| STAPLE | `desk`: the chair, the label over the stapler | he looks down at the stapler; a thud ([[S5_C_SFX_STAPLER.wav]]) and a small jolt | none: S6 C is the same room |
| WAKE THE TERMINAL | `terminal`, at Harlowe's desk | **approaching it** wakes it: the S. HARLOWE desktop on its screen, its glow, a degauss ([[S5_C_SFX_CRT_ON.wav]]), its standby light out, and `SAW_HARLOWE` set, even if he then turns back and staples. On commit he reads the screen | none: S6 C is the same room |

**H: `S5_H`**, the garage, entered at `front`: raw concrete, sodium orange, oil stains, four rusted cars of different decades, two with a door hanging open, and a boom barrier before the ramp's shutter · amb [[S5_H_AMB.wav]], and a car alarm ([[S5_H_SFX_CARALARM.wav]]) on entering

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| REST | `curb`, the kerb island under the centre sodium | a fifth car is parked in the far bay (the nearest one's model again); he looks to the boom and sits on the kerb a while; the boom lifts and the shutter rolls up | `ramp` (N) → `CN_RAMP_DOWN` → S6 H |
| TAKE THE SIDE DOOR | `stairs`, the unmarked steel door in the far corner under the only caged lamp | | `stairs` door (E) → `CN_STAIRS_CONCRETE` → S6 H |

## S6 — THE REQUISITION / THE RUN

**C: `S6_C`**, the same desk room (an alias of `S5_C`) · amb [[S6_C_AMB.wav]]. On entering, the desk's terminal wakes with the requisition: `text/manifest.json`'s rows, plus a Harlowe row in another hand if `SAW_HARLOWE`. Its glow comes on with a degauss. Then a green lamp comes on at the tube station and a red one at the call box, each with a clunk. Walking back to the chair (beat zone `read`, THE REQUISITION) sits him down in front of the screen once.

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| ORDER | `tube`, the pneumatic tube station | he looks at it; the canister goes with a thud; two chimes; its lamp goes out | `freight` doors (N, rusted sliding doors behind the station) → `CN_CORRIDOR_DOWN` → S7 |
| FLAG | `flagbox`, the call box | four reject beeps: INSUFFICIENT. / SEE POLICY 4.4. / THIS IS NOT A VALID CONCERN. / THE CANDIDATE HAS RAISED THIS BEFORE.; its lamp goes out; a deadbolt | `service` door (E, behind the call box) → `CN_CORRIDOR_SERVICE` → S7 |

**H: `S6_H`**, the run, entered through its `front` shutter: the garage that does not end, the same pillar, cars and stain in every bay, and at its end the concrete stops above the pool, with rebar past the lip and a guard rail with one gap · amb [[S6_H_AMB.wav]] · music water. On entering, the pool lights go out (light id `pool`): the run ends in black.

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| PUSH ON | `push`, the strip short of the lip east of the bench, running on into the dark | a jolt; a breath as he crouches; then the pool lights come on with a thud (the reveal) | see below |
| STOP | `stopline`, the lit bench at the painted stop line, 1 m short of the lip | he is stepped to the line and looks down at it; the pool lights come on; he sits on the bench | see below |

**Flip edge.** If S7 is H, the scene changes where he stands (`S7_H` aliases `S6_H`). If the render flips to C, the `freight` doors (E, at the end of the run) open onto `CN_CORRIDOR_DOWN` → `S7_C`. From `S6_C`, a flip to H opens either corridor onto the run, entered at its `front` shutter.

## S7 — THE DESCENT

**C: `S7_C`**, a damaged freight cab, 3.0 × 3.4 m: rust, quilted padding with one pad peeling, a caged bulb, a panel of 66 buttons with one lit, a scissor gate and a segmented floor indicator over the doors. It is entered through its sliding `cab` doors, which stay open behind him until he chooses · amb [[S7_C_AMB.wav]]

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| DESCEND | `panel`, the one lit button | a clunk; then as one carried move he looks up at the indicator, the gate is drawn, a screech and the doors close, and **the cab really descends**: 20 m in one eased 9.5 s ride with the candidate in it, the indicator stepping B1, B2, B7, B12 and a glyph at uneven intervals; a thud, and the gate folds back | the same `cab` doors open at the bottom → `CN_CORRIDOR_OFFICE` → S8 C |
| REFUSE | `doorway`, jamb to jamb, armed only once he has been inside (`cab_inside`); 25 s inside without choosing is REFUSE too | a buzz on the approach; THE CAR IS ALREADY IN MOTION.; he is pulled back to the middle of the cab, the gate slams shut, and the same ride, with the doors open until they drag shut two thirds of the way down | the same `cab` doors open at the bottom → `CN_CORRIDOR_OFFICE` → S8 C |

**H: `S7_H`**, the same edge (an alias of `S6_H`) · amb [[S7_H_AMB.wav]] · music water

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| JUMP | `gap`, the break in the guard rail | grains of concrete fall on the approach | **the fall** (below) |
| TURN BACK | `turnback`, a strip across the run 5 m back, armed only after he has stood at the lip (`edge_approach`) | a thud and grains of concrete; the run's lamps fade out behind him; the ledge shakes; THERE IS ONLY THE LEDGE. | **the fall** (below) |

**The fall:** `SET_DIVE` is joined under the edge's water by a vertical anchor, and he is carried off the lip (`fall`). A splash; the drone is low-passed, never stopped. S8 begins in the water (`sink`), and then he swims.

## S8 — THE DELIVERY / THE DIVE

**C: `S8_C`**, a cavernous mailroom: towers of cardboard receding into real fog, high-bay lamps hanging out of the dark, a clerk whose face is a blurred texture map behind a laminate counter · amb [[S8_C_AMB.wav]]. On entering, the clerk slides a soggy package across the counter toward him. First comes the beat zone `counter`, THE PACKAGE: he lifts it and carries it, a wet ring stays on the counter, and two lamps come on at the back of the hall, over the deliveries door and over the sorting table. Both thresholds arm only after that.

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| DELIVER | `deliver`, at the deliveries door | sets `DELIVERED`; a buzz | `deliveries` door (N) → `CN_CORRIDOR_OFFICE` → the ending's room |
| OPEN THE BOX | `sorting`, the sorting table with the box cutter | sets `OPENED_BOX`; he sets the package down, open; THE CANDIDATE'S APPLICATION. RECEIVED SIX MONTHS AGO.; he looks into it; a buzz | `deliveries` door (N) → `CN_CORRIDOR_OFFICE` → the ending's room |

**H: `SET_DIVE`**, the pool, swimming (free vertical movement, no hands). Tiled pillars descend into blue-green, motes drift upward and caustics move overhead. Far below is a rusted grate with sick blue light behind it, and on the nearest pillar to the left a pool lamp, the one warm thing. He can only sink: the swim ceiling is where he went under · amb [[S8_H_AMB.wav]] · music water

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| DIVE | `grate`, at the bottom (approaching it, a second light comes on under it) | a rattle and a jolt; the grate opens | **the chute** (below) |
| SWIM FOR THE PILLARS | `pillar`, up beside the lamp on the pillar | the lamp dies; the grate opens and the pit lights; the current shakes him and takes him down anyway (C3) | **the chute** (below) |

**The chute:** through the open grate (`grate`), the drone restored, a scrape, carried down `CN_CHUTE`, out of the low `hatch` at the head of the store's central aisle onto the linoleum of `S8_H` (`land`), looking down the aisle at the storefront glass. [[S8_H_AMB_STORE.wav]]. The store: low-poly gondolas, a chest cooler, the counter, his reflection in the glass a faceless cluster of polygons, the door standing open onto an empty street, and a staff door under a green lamp.

## Endings

After S8, `resolveEnding()` picks the ending (Doc 1 §2.4). Its room is joined behind S8's way on: on the C side, the deliveries corridor; on the H side, the store itself or, for PENDING, its `staff` door. On arrival, `flagOverlays` hide props. Walking into the ending's zone takes the camera; so does 90 s passing. Then the ending's `preShot` and `beats` play, `show` puts props in place and the pull-back runs. A 4 s dead-still hold follows, then the blackout and the card, and the stage stops drawing.

| Ending | Room | Zone | What plays |
|---|---|---|---|
| ASSIMILATION | `SE_ASSIM`, the boardroom: a glass table on marble, twelve faceless seated figures, his chair pulled out at the head with the hundredth slip on it · amb [[S8_C_AMB_BOARDROOM.wav]] | `head`, at the head of the table | **`ending`**: the camera leaves him standing beside the chair (`self`, his face the blurred map) and pulls back down the table. With `DELIVERED` the package and its wet ring are hidden on arrival and stand at the table's centre once the camera leaves him. With `NEVER_SAT` there is no chair for him: `mychair` and its slip are hidden |
| RETAINED | the same boardroom (`SE_RETAINED`) | `head` | **`retained`**, a shorter pull-back. The package is already on the glass, resealed (the one he opened is on the sorting table). The same `NEVER_SAT` rule |
| EXPULSION | `SE_EXPUL`, the store · [[S8_H_AMB_STORE.wav]] | `door`, the open storefront door (an invisible threshold stops him in the doorway) | **`ending`**: the camera withdraws into the store without him |
| PENDING REVIEW | `SE_PEND`, the waiting room, entered by its `inner` door (from the store: the `staff` door → `CN_CORRIDOR_SERVICE`). Two chairs face each other mid-room, one just vacated; a red curtain on the east wall still sways | `seat` (TAKE A SEAT again) | he sits (`sit`); the speaker clicks: "One hundred."; the hands appear holding a slip printed 99 (`slip99`); then **`ending`** |

EXIT (the bail-out) skips the walk and goes straight to the PENDING REVIEW card. On touch it takes two taps (EXIT?, then EXIT within 3 s).
