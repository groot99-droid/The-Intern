---
tags: [generated-asset]
---

# Scene Flow

← [[ninety-nine/assets/Generated Assets|Generated Assets]]

The game as it is walked, in play order: every room, threshold, doorway, connector and ambience bed. Taken from [[ninety-nine/data/scenes.json|data/scenes.json]] (rooms, thresholds, beats), [[ninety-nine/data/endings.json|data/endings.json]] (ending rooms and routes) and [[ninety-nine/data/rooms.json|data/rooms.json]] (the doorways, zones and connectors themselves, written by `tools/build_rooms.py`).

## How to read it

- **A scene is a room with two thresholds.** A threshold is a zone the candidate walks to. Its label (the choice's words) fades in as he enters its approach ring, and stepping into the zone commits the choice: succumb +1, resist −1.
- **Then the way on opens.** The threshold's beats play. Either the next scene starts where he stands (same set), or the threshold's **exit** door opens onto a **connector** (`via`) with the next scene's room joined behind it.
- **The render is decided at the choice.** The room behind the door is in the render the score picks after the choice, and both possible rooms are built before he commits. Both thresholds of a scene lead to the same next scene; only the render can differ, and only on the flip edges S2→S3, S4→S5 and S6→S7.
- **There is no going back (C3).** The door seals behind him once he is 1.2 m into the connector, and the room he left is dropped. Crossing the connector's midpoint is the scene boundary: the drone detunes, and the ambience, music, captions and fracture move to the next scene.
- **The camera is taken from him only for carried moments**, named below: sitting, the call, the cab, the fall, the chute, the endings.
- **Locked doors answer.** Walking into a locked door makes it shudder and rattle.

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

`S0_X`, the apartment, at night. He spawns standing; the CRT shows the job posting. A hint fades after a few seconds: CLICK TO LOOK · W A S D WALKS · SHIFT HURRIES (on touch: LEFT THUMB WALKS · RIGHT THUMB LOOKS). The first click, key or touch unlocks audio: room tone, footsteps and the music bus, but not the drone. Ambience: [[S0_X_AMB.wav]].

1. **APPLY**, at zone `desk` in front of the computer.
   - He is carried to `sit` and the hands appear (C6), then `lean` in.
   - The WILLING / NOT WILLING form is laid over the CRT (`#screen-layer`). Two or more NOT WILLING answers seed the hostile render.
   - The portal answers on the screen itself: received, the countdown from 6 MONTHS to LEAVE NOW, then ACCEPTED, which stays there.
   - A deadbolt. He is carried to `stand` and the hands go.
2. **The way out.** The apartment `door` opens onto `CN_STAIRS_APT`, and the stairs lead down to `SET_STREET`, entered by the `stoop` door in the dead end's brick wall. The street bed [[S0_X_AMB_STREET.wav]] comes in on the stairs, and dawn comes up as he descends.
3. **666 HALLAM ROW.**, at zone `report` on the tower's step (the last step up in the game).
   - A buzz, and the tower's glass doors (`tower`) open onto `CN_VESTIBULE`. Beyond it is `S1_C` or `S1_H`, entered through its `front` glass doors.
   - When those doors close behind him, the 48 Hz drone starts (C7, exactly once) and S1 begins.

## S1 — THE WAITING ROOM

`S1_C` (sterile) / `S1_H` (over-lit, chairs scattered) · amb [[S1_C_AMB.wav]] / [[S1_H_AMB.wav]] · music muzak

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| TAKE A SEAT | `seat_w` or `seat_e` (either row of chairs) | a scrape; he sits, then stands again | none: S2 is the same room |
| STAY STANDING | `counter` | sets `NEVER_SAT` | none: S2 is the same room |

## S2 — THE CALL

The same room (`S2_C` / `S2_H` alias `S1_C` / `S1_H`); S1's bed carries on.

On entering: the speaker clicks (C, [[S2_C_SFX_SPEAKER.wav]]) or hisses (H, [[S2_H_SFX_SPEAKER.wav]]), then [[S2_X_SFX_RECEPTIONIST.wav]]. His head is turned to the receptionist (carried `lookAt`) and the caption reads "Ninety-nine." / "Shaun.". Friction runs on a shorter clock here (10–45 s).

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| STAND | `inner_door` | a buzz | `inner` door (N, beside the counter) → `CN_CORRIDOR_OFFICE` → S3 |
| RUN | `front_doors` | the locked front glass rattles twice ([[S3_H_SFX_DOOR.wav]]), then a buzz | `service` door (S, by the entrance) → `CN_CORRIDOR_SERVICE` → S3 |

**Flip edge:** either door can open onto `S3_C` or `S3_H`, entered by its `side` door.

## S3 — THE THRESHOLD

**C: `S3_C`**, the corridor: red curtain ahead under the green ENTER sign (2.3 s cycle), the lobby's locked glass behind · amb [[S3_C_AMB.wav]]

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| PART THE CURTAIN | `curtain` | on the approach: PRESENT CANDIDATE FOR READING.; on commit: a rustle ([[S3_C_SFX_CURTAIN.wav]]) and the curtain parts | `curtain` doorway (N) → `CN_CORRIDOR_OFFICE` → S4 |
| TRY THE DOOR | `glass` | two rattles; "That action violates the terms of the contracted agreement."; a buzz | `service` door (W) → `CN_CORRIDOR_SERVICE` → S4 |

**H: `S3_H`**, the lobby doors: the waiting room again, a curtain in the far corner · amb [[S3_H_AMB.wav]]. Doc 1's "Thirty-one. The candidate is thorough." (`COUNTED_DOOR`) has a mechanism, a branch's `bumpCount`, but S3 H does not carry one yet.

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| PART THE CURTAIN | `curtain` | a rustle; the curtain parts | `curtain` doorway → `CN_CORRIDOR_SERVICE` → S4 |
| TRY THE DOOR | `glass` (the lobby's own front glass) | it rattles twice; the violation line; a buzz | `service` door → `CN_CORRIDOR_SERVICE` → S4 |

## S4 — THE FLOOR

**C: `S4_C`**, the cubicle floor, entered at `front` · amb [[S4_C_AMB.wav]]. On entering, the manager starts up the aisle toward him.

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| TAKE THE PAPERS | `manager` (the zone walks with him) | [[S4_C_SFX_PAPERS.wav]]; "You're early. That's already in the file."; the papers pass into his hands | `back` door (N) → `CN_CORRIDOR_OFFICE` → S5 |
| TAKE THE SIDE DOOR | `side_door`, at the end of the cross-aisle | | `side` door (E) → `CN_STAIRS_CONCRETE` → S5 |

**H: `S4_H`**, the utility corridor · amb [[S4_H_AMB.wav]]

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| TAKE THE PAPERS | `far_end` | [[S4_H_SFX_FOOTSTEPS.wav]]; the manager at the far end is gone | `far` door (N) → `CN_CORRIDOR_SERVICE` → S5 |
| TAKE THE SIDE DOOR | `ajar`, the one door ajar (Harlowe's) | | `ajar` door (W) → `CN_STAIRS_CONCRETE` → S5 |

**Flip edge:** S5 may be either render.

## S5 — THE DESK / THE GARAGE

**C: `S5_C`**, the desk in the void, entered at `front` · amb [[S5_C_AMB.wav]]

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| STAPLE | `desk` | two stapler thuds ([[S5_C_SFX_STAPLER.wav]]) | none: S6 C is the same room |
| WAKE THE TERMINAL | `terminal`: a second desk at the edge of the light | **approaching it** wakes it: the S. HARLOWE desktop on its screen, its glow, a degauss ([[S5_C_SFX_CRT_ON.wav]]), and `SAW_HARLOWE` is set, even if he then turns back and staples | none: S6 C is the same room |

**H: `S5_H`**, the garage, entered at `front` · amb [[S5_H_AMB.wav]], and a car alarm ([[S5_H_SFX_CARALARM.wav]]) on entering

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| REST | `curb` | he sits on the curb for a while; the `ramp` shutter rolls up | `ramp` (N) → `CN_RAMP_DOWN` → S6 H |
| TAKE THE SIDE DOOR | `stairs` | | `stairs` door (E) → `CN_STAIRS_CONCRETE` → S6 H |

## S6 — THE REQUISITION / THE RUN

**C: `S6_C`**, the same desk room (an alias of `S5_C`) · amb [[S6_C_AMB.wav]]. On entering, the desk's terminal wakes with the requisition: `text/manifest.json`'s rows, plus a Harlowe row if `SAW_HARLOWE`. Its glow comes on, with a degauss.

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| ORDER | `tube`: the pneumatic tube station | a chime | `freight` door (N) → `CN_CORRIDOR_DOWN` → S7 |
| FLAG | `flagbox`: the red box on its post | two reject beeps: INSUFFICIENT. … THE CANDIDATE HAS RAISED THIS BEFORE. | `freight` door (N) → `CN_CORRIDOR_DOWN` → S7 |

**H: `S6_H`**, the edge room: the garage bay running out over the pool · amb [[S6_H_AMB.wav]] · music water

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| PUSH ON | `push`, down the bay toward the edge | | see below |
| STOP | `stopline`, the painted line by the bench | he sits | see below |

Either way: if S7 is H, the scene changes where he stands (`S7_H` aliases `S6_H`); if the render flips to C, the `freight` door (W) opens onto `CN_CORRIDOR_DOWN` → `S7_C`. From `S6_C`, a flip to H opens the same corridor onto the edge room.

## S7 — THE DESCENT

**C: `S7_C`**, the freight cab, entered through its sliding `cab` doors, which stay open behind him until he chooses · amb [[S7_C_AMB.wav]]

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| DESCEND | `panel` | a keypress ([[S6_C_SFX_KEYBOARD.wav]]); the cab doors close; **the cab really descends**, 14 m over 11 s, with the candidate in it (carried) | the same `cab` doors open at the bottom → `CN_CORRIDOR_OFFICE` → S8 C |
| REFUSE | `doorway`, armed only once he has stood in the middle of the cab | THE CAR IS ALREADY IN MOTION.; he is stepped back inside; the doors close; the same descent | the same `cab` doors open at the bottom → `CN_CORRIDOR_OFFICE` → S8 C |

**H: `S7_H`**, the same edge (an alias of `S6_H`) · amb [[S7_H_AMB.wav]] · music water

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| JUMP | `gap`, the break in the guard rail | | **the fall** (below) |
| TURN BACK | `turnback`, armed only after he has stood at the edge | grains of concrete; the ledge shakes | **the fall** (below) |

**The fall:** `SET_DIVE` is joined under the edge's water by a vertical anchor, and he is carried off the lip (`fall`). A splash; the drone is low-passed, never stopped. S8 begins in the water (`sink`), and then he swims.

## S8 — THE DELIVERY / THE DIVE

**C: `S8_C`**, the mailroom · amb [[S8_C_AMB.wav]]. First, the beat zone `counter`, THE PACKAGE: he takes it from the counter and carries it. Both thresholds arm only after that.

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| DELIVER | `deliver`, at the far end | | `deliveries` door (N) → `CN_CORRIDOR_OFFICE` → the ending's room |
| OPEN THE BOX | `sorting`: the table with the box cutter | sets `OPENED_BOX`; he sets the package down; THE CANDIDATE'S APPLICATION. RECEIVED SIX MONTHS AGO. | `deliveries` door (N) → `CN_CORRIDOR_OFFICE` → the ending's room |

**H: `SET_DIVE`**, the pool, swimming (free vertical movement, no hands) · amb [[S8_H_AMB.wav]] · music water

| Choice | Zone | Beats | Way on |
|---|---|---|---|
| DIVE | `grate`, at the bottom | | **the chute** (below) |
| SWIM FOR THE PILLARS | `pillars`, up beside a tiled corner pillar | | **the chute** (below) |

**The chute:** through the grate (`grate`), the drone restored, a scrape, carried down `CN_CHUTE`, out of the `hatch` onto the linoleum of `S8_H`, the store (`land`). [[S8_H_AMB_STORE.wav]].

## Endings

After S8, `resolveEnding()` picks the ending (Doc 1 §2.4). Its room is joined behind S8's way on: on the C side, the deliveries corridor; on the H side, the store itself or, for PENDING, its `staff` door. Walking into the ending's zone takes the camera for the pull-back; so does 90 s passing. A 4 s dead-still hold follows, then the blackout and the card.

| Ending | Room | Zone | Pull-back |
|---|---|---|---|
| ASSIMILATION | `SE_ASSIM`, the boardroom · amb [[S8_C_AMB_BOARDROOM.wav]] | `head`, at the head of the table | **`ending`**. With `NEVER_SAT` there is no chair for him: `emptychair` is hidden |
| RETAINED | the same boardroom (`SE_RETAINED`) | `head` | **`retained`**, with the same `NEVER_SAT` rule |
| EXPULSION | `SE_EXPUL`, the store · [[S8_H_AMB_STORE.wav]] | `storefront`, the open door | **`ending`** |
| PENDING REVIEW | `SE_PEND`, the waiting room, entered by its `inner` door; from the store, through the `staff` door → `CN_CORRIDOR_SERVICE` | `seat` | he sits (`sit`), the hands appear holding a 99 slip, then **`ending`** |

EXIT (the bail-out) skips the walk and goes straight to the PENDING REVIEW card.
