# NINETY-NINE
## Document 1 of 4: Game Logic
### Master source of truth. Documents 2, 3, and 4 derive from this file and must not contradict it.

← [[docs/Design Docs|Design Docs]]

Working title. Swappable in one line (`TITLE` constant, Doc 4, §3.1). Source material: *Following The Sheep* by Elijah Skinner. Structural reference: *Right Door Wrong Exit*.

---

## 0. PREMISE

A man in his late twenties uploads a résumé to a badly built job portal for an entry-level posting. The confirmation says six months. Three seconds later he is accepted and promoted to a role he did not apply for and cannot perform. The next morning he walks to the address at dawn and enters the building.

Every choice inside is a variation on one question: **do you resist the feeling, or do you let it carry you?**

There is no correct answer. There is no escape. There are three ways to stop being a person.

---

## 1. THE ARCHITECTURE PROBLEM, AND THE SOLUTION

### 1.1 The problem

Eight binary choice points produce 2^8 = 256 unique paths. Producing 256 paths of video, audio, and interaction is impossible at any reasonable scale, and attempting it would produce 256 shallow paths instead of one deep one.

### 1.2 The solution: Spine and Render

The game runs on a **fixed spine of nine scenes in a fixed order**. Nobody skips a scene. Nobody unlocks a scene. The sequence is identical for every player, every time.

What changes is the **render**. Each scene exists in two production states:

- **COMPLIANT (C)**: the building cooperating with you
- **HOSTILE (H)**: the building refusing you

Which render loads is determined by your running `conformance` score, not by the individual choice you just made. A third state, **FRACTURED (F)**, is not a separate render. It is a modifier layer applied on top of C or H: audio detune, a single anomalous object, texture bleed from the opposite render.

### 1.3 Why this is the right call, and what it costs

**Gain:** production drops from 256 paths to 18 base sequences plus a modifier layer. The game stays finishable.

**Gain, thematically:** the player who resists at every turn and the player who complies at every turn walk through the same rooms in the same order. They just experience them as different buildings. That is the actual horror of the premise. Resistance does not get you different geography. It gets you the same geography, angrier.

**Cost, and you should decide this knowingly:** a player who replays will notice the spine. The second run reveals that their agency was cosmetic. Two readings of that:

1. It is a design flaw, and it needs a hidden fourth branch to reward discovery.
2. It is the thesis, and revealing it on replay is the final payload.

This document is built on reading 2. Section 9 flags it as an open question for you.

---

## 2. STATE MODEL

### 2.1 Variables

| Variable | Type | Range | Set by |
|---|---|---|---|
| `conformance` | int | -8 to +8 | Binary choices. Succumb +1, Resist -1 |
| `dissonance` | int | 0 to 7 | Increments each time polarity flips from the previous choice |
| `friction` | float | 0.0 to 8.0 | Sum of per-scene mini-game friction (0.0 to 1.0 each). See Doc 3 |
| `dwell[]` | float[] | seconds | Time spent on each scene before committing |
| `flags{}` | set | n/a | Named one-off events. See §2.5 |

`conformance` starts at 0. After eight choices of ±1 it is always an even number: -8, -6, -4, -2, 0, 2, 4, 6, 8. This parity guarantee makes threshold logic exact with no rounding ambiguity. **Mini-games never touch `conformance`.** They feed `friction` only. This is deliberate: it keeps ending math clean while letting mini-game performance visibly change the world.

### 2.2 Render resolution (evaluated at the top of each scene)

```
renderFor(sceneIndex):
    if conformance >=  2  -> COMPLIANT
    if conformance <= -2  -> HOSTILE
    if conformance ==  0  -> last non-zero render, or COMPLIANT if none
```

The tie at zero resolving to the *last* render is what makes wavering feel like drifting instead of teleporting.

### 2.3 Fracture intensity

```
fracture = clamp( (friction / 8.0) * 0.6 + (dissonance / 7.0) * 0.4 , 0, 1 )
```

Drives, on a 0 to 1 scale: audio detune depth, opposite-render texture bleed opacity, anomalous-object spawn chance, and receptionist voice pitch drift. Never drives which base video plays.

### 2.4 Ending resolution (after scene 8)

```
if dissonance >= 4              -> PENDING REVIEW
else if conformance >=  4       -> ASSIMILATION
else if conformance <= -4       -> EXPULSION
else                            -> PENDING REVIEW
```

Reading: the building can file you as an asset or file you as a rejection. If you cannot hold a position long enough to be either, it files you as unresolved, forever.

### 2.5 Flags

| Flag | Set when | Effect |
|---|---|---|
| `SAW_HARLOWE` | Player wakes the terminal before stapling (S5-C) | S6 spreadsheet includes one row in Harlowe's handwriting. Ending cards gain one extra line |
| `OPENED_BOX` | Player opens the package (S8-C) | Forces -1 on the final choice. Can flip a borderline run |
| `COUNTED_DOOR` | Player attempts the locked exit 30+ times (S3-H) | Receptionist reads the attempt count aloud. `friction` +0.5 |
| `NEVER_SAT` | Player never sits in S1 | Chair is missing from the ASSIMILATION boardroom |
| `EARLY_EXIT` | Player uses the accessibility bail-out (Doc 4, §9) | Forces PENDING REVIEW immediately |

---

## 3. CANON: RULES THAT NEVER BREAK

These are load-bearing. Documents 2, 3, and 4 enforce them. If a generated asset or built component violates one of these, it is wrong and gets rebuilt.

**C1. The Aesthetic Law.**
Anything the company owns renders **low-poly PS1**: people, furniture, vehicles, signage, handheld objects, clothing, paper.
Anything the **building** is made of renders **photoreal**: floors, walls, concrete, glass, water, fog, light, fabric of the building itself.
The company is fake. The building is real. This is why the contrast is smooth and not glitchy. It is not a stylistic mashup. It is a statement about which layer is lying.

**C2. Shadows point toward the building's core.**
In every exterior and every interior with a visible light source, shadows fall inward toward the center of the structure, regardless of where the light is. Nobody in-game remarks on this.

**C3. No windows. No sky. No ascent.**
After the lobby doors close, there is never a window, never daylight, never an upward movement. Elevators descend. Stairs descend. Refusing a descent results in a descent anyway.

**C4. The company never says "you."**
All company-authored text uses "the candidate," "the applicant," "the assigned party," "personnel." The word "you" appears exactly once in the entire game: on the final card of the ending. That switch is the last beat.

**C5. Nobody blinks. Nobody looks up.**
Every NPC face is a low-poly model with a static or 4-frame-loop jaw. The receptionist never raises her head. The manager's face texture is blurred at every LOD.

**C6. Shaun's hands are already low-poly.**
From the very first shot, in his own apartment, his hands render as company property. He was hired before he applied. Nobody points this out.

**C7. One continuous drone.**
A 48 Hz HVAC bed runs from the moment the lobby doors close to the final card. It never restarts, never cuts on a scene change, and detunes by roughly 4 cents per scene, so by scene 8 it beats audibly against its own memory. See Doc 4, §7.

**C8. The clock has no hands.**
Every clock, on every wall, in every render. It is the same clock.

---

## 4. THE SPINE

| # | Scene | Compliant render | Hostile render | Choice (Succumb / Resist) | Mini-game |
|---|---|---|---|---|---|
| S0 | THE UPLOAD | Apartment, portal, dawn commute | *(no branch)* | n/a | n/a |
| S1 | THE WAITING ROOM | Sterile, ordered | Scattered, over-lit | Take a seat / Stay standing | MG-01 THE INTAKE FORM |
| S2 | THE CALL | "Ninety-nine." | "Shaun." | Stand / Run | n/a |
| S3 | THE THRESHOLD | Red curtain, green ENTER | Locked glass doors | Part the curtain / Try the door | MG-02 THE SCAN |
| S4 | THE FLOOR | Cubicle maze, the manager | Janitorial labyrinth | Take the papers / Take the side door | MG-03 THE CORRIDOR |
| S5 | THE DESK | Unmarked desk, stapler, monitor | Parking garage, rusted cars | Staple / Wake the terminal · Rest / Side door | MG-04 THE STAPLER / THE IGNITION |
| S6 | THE REQUISITION | Spreadsheet of items | The run that does not end | Order / Flag · Push on / Stop | MG-05 THE REQUISITION / THE RUN |
| S7 | THE DESCENT | Damaged freight elevator | Concrete edge over the pool | Descend / Refuse · Jump / Turn back | MG-06 THE PANEL / THE EDGE |
| S8 | THE DELIVERY | Mailroom, the package, boardroom | Grate, chute, convenience store | Deliver / Open the box · Dive / Swim | MG-07 THE HANDOFF / THE BREATH |
| E | ENDING | ASSIMILATION · EXPULSION · PENDING REVIEW | | | |

---

## 5. SCENE BREAKDOWNS

Asset IDs follow the canonical scheme (Doc 2, §1; Doc 4, §4):
`S{n}_{C|H}_{IMG_IN|IMG_OUT|VID|TRN}`

---

### S0: THE UPLOAD
*No branch. Establishes C1, C2, C6 before the player knows they are rules.*

**Beat 1, the portal.** A dim apartment at night. One monitor. The site is brutalist Web 1.0: table layout, Times New Roman, a broken image icon where the logo should be. Posting title: **"YOUNG INTERNS WANTED!"** Employer: **VELLUM & ASHE, LLP.** His hands on the keyboard are low-poly. The desk, the wall, the lamp glow are photoreal.

He clicks SUBMIT.

> Thank you. The candidate's application has been received.
> Due to volume, VELLUM & ASHE will respond within 6 months.

Three seconds of nothing. The cursor blinks. Then, without a transition:

> **ACCEPTED.**
> POSITION AMENDED: SENIOR DIRECTOR OF SYSTEMIC ARCHITECTURE.
> THE CANDIDATE WILL REPORT AT 7:00 AM.
> 666 HALLAM ROW.

No confirm button. The window cannot be closed.

**Beat 2, the commute.** Dawn. Empty street, photoreal asphalt and brick and low sun. Parked cars and street signs are low-poly. Every shadow, his included, points at the tower ahead (C2). The tower is photoreal and has no visible top. He pushes through the glass doors.

**Audio:** apartment is room tone only. On the door push, the 48 Hz drone starts and never stops (C7).

`S0_C_IMG_IN` apartment · `S0_C_IMG_OUT` lobby doors from inside · `S0_C_VID` · `S0_C_TRN_S1`

---

### S1: THE WAITING ROOM
**Choice:** TAKE A SEAT (+1) / STAY STANDING (-1)
**Mini-game:** MG-01 THE INTAKE FORM (runs before the choice)

**COMPLIANT.** Photoreal marble floor, deep and wet-looking. Low-poly chairs in perfect rows. A handless wall clock (C8). A ticket dispenser. Muzak, tinny, from a speaker you cannot locate. The receptionist behind photoreal glass, low-poly, head down. The floor mosaic at center: an interlocked V and A that resolves, if you hold on it, into a serpent swallowing a lion.

**HOSTILE.** Same room, over-lit to blowout. Chairs scattered at wrong angles as though something left in a hurry. The marble reflects a ceiling that is not there. Muzak at 80% speed. The dispenser feeds continuously, slips piling on the floor, every one of them reading **99**.

**Text:**
- Slip: `99`
- Wall placard: `THE CANDIDATE WILL BE SEEN IN TURN.`
- Muzak: the same eight bars, forever.

`S1_C_IMG_IN` `S1_C_IMG_OUT` `S1_C_VID` · `S1_H_IMG_IN` `S1_H_IMG_OUT` `S1_H_VID`

---

### S2: THE CALL
**Choice:** STAND (+1) / RUN (-1)
**No mini-game.** This scene is short on purpose. It is the first time the room acts on you.

**COMPLIANT.** The speaker clicks. The receptionist, head still down: **"Ninety-nine."** Her jaw moves on a four-frame loop that does not match the syllables.

**HOSTILE.** The speaker clicks and hisses first. Then: **"Shaun."** She never asked his name. He never gave it to her. The intake form (MG-01) did not have a name field.

That last detail is the scene. Verify it in build: MG-01 must not contain a name field.

`S2_C_*` `S2_H_*`

---

### S3: THE THRESHOLD
**Choice:** PART THE CURTAIN (+1) / TRY THE DOOR (-1)
**Mini-game:** MG-02 THE SCAN

**COMPLIANT.** Corridor off the lobby. Heavy red velvet curtain, photoreal, moving slightly though there is no air. Above it, a hyper-real green **ENTER** sign on a 2.3-second flicker cycle. Beside the curtain, a badge reader with a red laser slot.

**HOSTILE.** Back at the lobby's glass doors. Locked. Through them: the street from S0, but with no sun and no shadows at all. The absence of shadows is worse than wrong shadows. The receptionist, from across the room, without raising her head:

> **"That action violates the terms of the contracted agreement."**

He never signed anything. The intake form was not a contract. The blood is not drawn here, it was drawn in the upload.

**Text:**
- Badge reader: `PRESENT CANDIDATE FOR READING.`
- After 30 door attempts (`COUNTED_DOOR`): **"Thirty-one. The candidate is thorough."**

`S3_C_*` `S3_H_*`

---

### S4: THE FLOOR
**Choice:** TAKE THE PAPERS (+1) / TAKE THE SIDE DOOR (-1)
**Mini-game:** MG-03 THE CORRIDOR

**COMPLIANT.** An unending cubicle floor. Photoreal fluorescent light, real ballast hum, real dust in the air. Every cubicle low-poly and identical and empty. **THE MANAGER** approaches: low-poly, blurred face texture at every distance, a tie modeled as four flat polygons. He offers a stack of papers rendered in absurd, crisp photoreal detail, the only paper in the game that is not company-owned, because it is not company property, it is evidence.

> **"You're early. That's already in the file."**

Note: the manager is the only character permitted to use second person, and only here, and only once. He is not company copy. He is a person. That is why it is unsettling.

**HOSTILE.** The janitorial spine of the same floor. Mop sinks, floor drains, wet photoreal concrete, a labyrinth of identical utility doors. The manager is here too, seen once, at the far end of a corridor, facing away, never closer no matter how long you move.

`S4_C_*` `S4_H_*`

---

### S5: THE DESK / THE GARAGE
**Choice (C):** STAPLE (+1) / WAKE THE TERMINAL (-1)
**Choice (H):** REST (+1) / TAKE THE SIDE DOOR (-1)
**Mini-game:** MG-04 THE STAPLER (C) / THE IGNITION (H)

**COMPLIANT.** An unmarked desk in the middle of the floor. Stack of papers, low-poly stapler, dark monitor. Stapling produces a photoreal concussive thud and the monitor wakes on its own.

Waking the terminal first sets `SAW_HARLOWE`: the previous occupant is still logged in. Desktop wallpaper is a default gradient. One document open, unsaved:

> `resignation_final_v7.docx`
> **I am writing to inform**

Nothing more. Seven versions. Session user: **S. HARLOWE.** The role you were promoted into was occupied.

**HOSTILE.** Parking garage. Photoreal concrete, photoreal sodium light, photoreal oil stains. Four rusted low-poly vehicles, no two the same model, none from the same decade. Resting means sitting on the curb, and the scene simply continues, which is worse.

`S5_C_*` `S5_H_*`

---

### S6: THE REQUISITION / THE RUN
**Choice (C):** ORDER (+1) / FLAG (-1)
**Choice (H):** PUSH ON (+1) / STOP (-1)
**Mini-game:** MG-05 THE REQUISITION TERMINAL (C) / THE RUN (H)

**COMPLIANT.** The monitor shows a requisition sheet. The horror is not that the items are strange. It is that most of them are not. Full manifest in §6.3.

**HOSTILE.** The garage that does not end. The player holds to run. Stamina depletes. The geometry never changes: same pillar, same four cars, same stain. **The level ends only when stamina hits zero.** You cannot reach the edge by trying. You reach it by being unable to continue. When you stop, the concrete ends one meter ahead, and below is the pool room: photoreal water to the horizon, tiled pillars, no ceiling, no far wall.

`S6_C_*` `S6_H_*`

---

### S7: THE DESCENT
**Choice (C):** DESCEND (+1) / REFUSE (-1)
**Choice (H):** JUMP (+1) / TURN BACK (-1)
**Mini-game:** MG-06 THE PANEL (C) / THE EDGE (H)

Both branches are descents. This is C3 made explicit. If you refuse the elevator, the cab descends anyway with the doors open. If you turn back from the ledge, the garage behind you is gone and there is only the ledge.

**COMPLIANT.** Freight elevator, photoreal grating, photoreal rust, tearing-metal screech on the door close. Low-poly control panel, 66 buttons, one lit. Floor indicator counts down through B1, B2, B7, B12, and a glyph that is not a number.

**HOSTILE.** The concrete edge. Leaning reveals more of the pool and crumbles the ledge. The water is perfectly still and perfectly clear and very warm-looking. Chlorine and old copper.

`S7_C_*` `S7_H_*`

---

### S8: THE DELIVERY / THE DIVE
**Choice (C):** DELIVER (+1) / OPEN THE BOX (-1, sets `OPENED_BOX`)
**Choice (H):** DIVE (+1) / SWIM FOR THE PILLARS (-1)
**Mini-game:** MG-07 THE HANDOFF (C) / THE BREATH (H)

**COMPLIANT.** The postal section: a cavernous photoreal warehouse, towers of photoreal cardboard fading into real volumetric fog. A clerk whose face is a blurred texture map slides across a soggy package. It throbs. It leaves a dark ring on the counter.

**Opening the box** reveals the intake form from MG-01. His handwriting. Every answer he gave. Dated six months ago.

**HOSTILE.** Underwater. Jagged low-poly hands against photoreal caustics. Below, a rusted grate with sick blue light behind it. Prying it open feeds you into a dry concrete chute and expels you onto the linoleum of an empty convenience store at midnight.

`S8_C_*` `S8_H_*`

---

## 6. TEXT LIBRARY

All strings live in `/text/*.json` (Doc 4, §4.3). Company copy obeys C4 without exception.

### 6.1 System and UI

| Key | String |
|---|---|
| `portal.confirm` | Thank you. The candidate's application has been received. Due to volume, VELLUM & ASHE will respond within 6 months. |
| `portal.accept` | ACCEPTED. POSITION AMENDED: SENIOR DIRECTOR OF SYSTEMIC ARCHITECTURE. THE CANDIDATE WILL REPORT AT 7:00 AM. 666 HALLAM ROW. |
| `wait.placard` | THE CANDIDATE WILL BE SEEN IN TURN. |
| `scan.prompt` | PRESENT CANDIDATE FOR READING. |
| `scan.pass` | READING COMPLETE. THE CANDIDATE IS CONSISTENT. |
| `scan.fail` | READING INCOMPLETE. PROCEED REGARDLESS. |
| `door.violation` | That action violates the terms of the contracted agreement. |
| `door.counted` | Thirty-one. The candidate is thorough. |
| `flag.reject.1` | INSUFFICIENT. |
| `flag.reject.2` | SEE POLICY 4.4. |
| `flag.reject.3` | THIS IS NOT A VALID CONCERN. |
| `flag.reject.4` | THE CANDIDATE HAS RAISED THIS BEFORE. |
| `elevator.refuse` | THE CAR IS ALREADY IN MOTION. |

### 6.2 MG-01 intake form fields, in order

Field 1 to 4 are normal. The degradation must be gradual enough that the player does not notice exactly where it turned.

1. `DATE OF BIRTH`
2. `CURRENT ADDRESS`
3. `HIGHEST LEVEL OF EDUCATION`
4. `EMERGENCY CONTACT`
5. `MOTHER'S MAIDEN NAME`
6. `EARLIEST MEMORY`
7. `PREVIOUS ADDRESS, IF THE CANDIDATE WAS HAPPY THERE`
8. `A THING THE CANDIDATE WOULD NOT DO FOR MONEY`
9. `THE SAME, BUT TRUE`
10. `A NAME THE CANDIDATE HAS NOT SAID ALOUD IN SOME TIME`

**There is no name field.** This is load-bearing for S2-H. Do not add one.

### 6.3 MG-05 requisition manifest

Mundane and impossible items interleave and never separate. The mundane items must continue all the way to the last row.

| # | Item | Qty | Unit |
|---|---|---|---|
| 001 | Ballpoint pen, blue, medium | 24 | ct |
| 002 | Copier toner, K-series | 4 | ct |
| 003 | Liquid teeth | 4 | L |
| 004 | Coffee filter, #4 | 200 | ct |
| 005 | Time-lapsed dread | 12 | unit |
| 006 | Fluorescent tube, T8, 48 in | 60 | ct |
| 007 | One (1) childhood bedroom, disassembled | 1 | pallet |
| 008 | Hand soap, refill | 12 | ct |
| 009 | Hold music, unlooped | 1 | reel |
| 010 | Copy paper, 20 lb, letter | 40 | case |
| 011 | The sound of a car in a driveway at 6:40 pm | 1 | unit |
| 012 | Binder clip, medium | 144 | ct |
| 013 | Consent, notarized | 1 | ct |
| 014 | Floor wax, industrial | 20 | gal |
| 015 | Legs, pair, personnel-issue | 2 | ct |
| 016 | Staples, standard | 5000 | ct |
| 017 | Six (6) months | 1 | unit |
| 018 | Trash liner, 55 gal | 100 | ct |

If `SAW_HARLOWE` is set, row 019 appears, and it is the only row not in the system's typeface:

| 019 | *whatever is in the box, do not sign for it* | n/a | n/a |

### 6.4 Ending cards

Rule C4 breaks here and only here.

**ASSIMILATION**
> ONBOARDING COMPLETE.
> THE CANDIDATE IS NOW PERSONNEL.
>
> Welcome, you.

Then the pull-back: his face is the blurred texture map. The chair beside him is empty, and on it is a slip reading **100**. If `NEVER_SAT`, there is no chair for him at all, and he remains standing at the table for the length of the hold.

**EXPULSION**
> THE CANDIDATE'S APPLICATION HAS BEEN WITHDRAWN.
> NO FURTHER ACTION IS REQUIRED.
>
> You are not on file.

The convenience store. His reflection in the storefront glass is a faceless cluster of static polygons. The door opens outward. The street outside is photoreal and empty. He cannot render out there. The fluorescent hum inside the store is 48 Hz, detuned exactly as far as the building's drone. He never left.

**PENDING REVIEW**
> THE CANDIDATE'S FILE REMAINS OPEN.
> VELLUM & ASHE WILL RESPOND WITHIN 6 MONTHS.
>
> Please wait, you.

The waiting room. He is seated. The slip in his hand reads **99**, uncalled. The clock has no hands. The speaker clicks: **"One hundred."** Someone he cannot quite see stands up and walks past him toward the curtain. He does not move. The Muzak restarts its eight bars.

---

## 7. COMBINATORICS: HOW 256 PATHS RESOLVE

### 7.1 Distribution

Across all 256 paths (choices weighted equally):

| Ending | Condition | Paths | Share |
|---|---|---|---|
| ASSIMILATION | conf ≥ +4, diss ≤ 3 | 27 | 10.5% |
| EXPULSION | conf ≤ -4, diss ≤ 3 | 27 | 10.5% |
| PENDING REVIEW | everything else | 202 | 78.9% |

*(Verified by exhaustive enumeration of all 256 paths, not estimated. Doc 4, §11.1 re-runs this sweep in CI.)*

This is intentional and it is the whole design. **Commitment is rare.** Most people waver, and wavering is the most common way to end up filed and forgotten. A player must hold a line for six of eight choices with almost no reversals to earn either of the two "real" endings. Those two endings should feel like achievements of will, in opposite directions, and equally bad.

### 7.2 Worked runs

**Run A, pure compliance.** SSSSSSSS. conf +8, diss 0. Render: C from S1 on, no fracture. Ending: ASSIMILATION. Smoothest, quietest, shortest run. The building never once resists him.

**Run B, pure resistance.** RRRRRRRR. conf -8, diss 0. Render: H from S1 on. Ending: EXPULSION. Loudest run. Note this is *also* a frictionless run: the building is equally happy to reject him cleanly.

**Run C, late conversion.** SSSRRRRR. conf +3-5 = -2, diss 1. Renders C through S3, flips H at S5 after the score crosses. Ending: PENDING REVIEW (|conf| ≤ 2). He tried to leave too late and got filed as undecided.

**Run D, the waverer.** SRSRSRSR. conf 0, diss 7. Render: oscillates, ties at 0 resolve to last render, so he drifts rather than snaps. `fracture` maxes near 1.0 by S7. Ending: PENDING REVIEW, forced by dissonance. This player sees the most damaged version of the building and gets the least resolution. Correct.

### 7.3 What the player actually controls

Not the route. The **weather**. Doc 3's mini-games and `dwell` timing let a player who makes identical choices to another player see a measurably different building. That is the replay value, not branching.

---

## 8. PRODUCTION SCOPE

| Asset class | Count |
|---|---|
| Scene base videos (S1 to S8 × C/H) | 16 |
| Prologue sequences (S0) | 2 |
| Ending sequences | 3 |
| Transitions | 19 |
| Start/end still frames | 80 |
| Mini-games | 7 IDs, 11 modes |
| Audio: continuous drone bed | 1 |
| Audio: per-scene one-shot sets | 18 |

Honest total: roughly 40 generated video sequences, 80 stills, 11 interactive modes. Large, but finite and countable. That is the point of §1.

---

## 9. OPEN CONCEPTUAL QUESTIONS

Not build blockers. Things worth deciding before Doc 2 goes into Higgsfield.

**9.1 Is the absence of a good ending correct?**
All three endings are losses. Compliance ends you as furniture, resistance ends you as a ghost, indecision ends you as paperwork. There is no fourth door. I believe the absence is the argument, and adding a secret escape would break it into a puzzle game. But it is your story.

**9.2 Should the spine ever be visible?**
Consider: on a second playthrough, one object persists across renders. A slip on the floor. Same position, both branches. It is the only evidence that the two buildings are one building. Cheap to implement, devastating if noticed.

**9.3 Does Harlowe deserve more?**
`SAW_HARLOWE` currently adds one desktop and one spreadsheet row. There is a version where Harlowe's unfinished resignation appears in the requisition manifest, in the box, and on the boardroom table. A haunting instead of an easter egg. The risk is that it becomes a mystery to solve, which pulls against 9.1.

**9.4 The word "you."**
C4 reserves second person for the final card. The manager breaks it once in S4-C. Is that one crack intentional enough to be a signal, or does it just look like an inconsistency? I think it reads as the last human in the building, but it is the most fragile rule in the document.

**9.5 Does the mundane manifest need a floor?**
§6.3 interleaves horror with binder clips. If the impossible items get too imaginative, the sheet becomes whimsical instead of dreadful. The current ratio is roughly 60% mundane. Below 50% it tips into surrealism and loses the office.
