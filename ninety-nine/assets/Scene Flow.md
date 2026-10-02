---
tags: [generated-asset]
---

# Scene Flow

← [[ninety-nine/assets/Generated Assets|Generated Assets]]

Every set, shot and ambience bed in actual play order — taken from [[ninety-nine/data/scenes.json|data/scenes.json]] / [[ninety-nine/data/endings.json|data/endings.json]] (the game's real sequencing data) and [[ninety-nine/data/rooms.json|data/rooms.json]] (the sets and their shots).

Per set: `in` / `out` are the poses the room is entered on and left from; `loop` the idle move while the player is there; `leave` → black → the next set's `arrive` is the transition. Shot names in **bold** are the room's own (the street's push, the dive's descent, the endings' pull-backs).

## S0 — THE UPLOAD (no branch)
`S0_X` (the apartment): `in` under the form, `loop`, then `leave` (the push into the screen) → `SET_STREET` **`arrive` = the push to the tower** → `out` at the doors → `leave` through them → **S1**. Ambience: [[S0_X_AMB.wav]] under the form/countdown, crossfading to [[S0_X_AMB_STREET.wav]] on the street.

## S1 — THE WAITING ROOM
- **C**: `S1_C` `arrive` → `loop` (MG-01) · amb [[S1_C_AMB.wav]] · choice TAKE A SEAT / STAY STANDING (sets `NEVER_SAT`)
- **H**: `S1_H` (the same room over-lit, chairs scattered, slips on the floor) · amb [[S1_H_AMB.wav]]

## S2 — THE CALL
Same room as S1 (`S2_C` / `S2_H` alias it): no transition, the **`call`** shot pushes to the receptionist · sfx [[S2_C_SFX_SPEAKER.wav]] / [[S2_H_SFX_SPEAKER.wav]] + [[S2_X_SFX_RECEPTIONIST.wav]] · choice STAND / RUN

## S3 — THE THRESHOLD
- **C**: `S3_C` the corridor to the curtain (MG-02 THE SCAN); `leave` goes through the curtain · amb [[S3_C_AMB.wav]] · sfx [[S3_C_SFX_CURTAIN.wav]]
- **H**: `S3_H` the lobby doors, locked (MG-02 THE DOOR); `leave` turns back into the dark · amb [[S3_H_AMB.wav]] · sfx [[S3_H_SFX_DOOR.wav]]

## S4 — THE FLOOR
- **C**: `S4_C` the cubicle floor; MG-03 walks the `manager` actor up the aisle · amb [[S4_C_AMB.wav]] · sfx [[S4_C_SFX_PAPERS.wav]] on TAKE THE PAPERS
- **H**: `S4_H` the utility corridor (MG-03 THE LABYRINTH) · amb [[S4_H_AMB.wav]] · one-shot [[S4_H_SFX_FOOTSTEPS.wav]]

## S5 — THE DESK / THE GARAGE
- **C**: `S5_C` the desk in the void (MG-04 THE STAPLER) · amb [[S5_C_AMB.wav]]
- **H**: `S5_H` the garage (MG-04 THE IGNITION) · amb [[S5_H_AMB.wav]]

## S6 — THE REQUISITION / THE RUN
- **C**: `S6_C` the same desk, terminal on; MG-05's sheet is projected onto its screen · amb [[S6_C_AMB.wav]]
- **H**: `S6_H` the garage that ends: the `loop` runs toward the edge only while MG-05 H holds; `out` is the dead-flat edge · amb [[S6_H_AMB.wav]]

## S7 — THE DESCENT
- **C**: `S7_C` the freight elevator (MG-06 THE PANEL); `leave` drops through the grate · amb [[S7_C_AMB.wav]]
- **H**: `S7_H` the same edge (aliases `S6_H`), the **`lean`** shot out over the pool (MG-06 THE EDGE) · amb [[S7_H_AMB.wav]]

## S8 — THE DELIVERY / THE DIVE
- **C**: `S8_C` the mailroom **`push`** to the counter → `SE_ASSIM` the boardroom `loop` (MG-07 THE HANDOFF) · amb [[S8_C_AMB.wav]] → [[S8_C_AMB_BOARDROOM.wav]]
- **H**: `SET_DIVE` **`descend`** to the grate (MG-07 THE BREATH; the choice is asked here) → `S8_H` the store `loop` · amb [[S8_H_AMB.wav]] → [[S8_H_AMB_STORE.wav]]

## Endings
- ASSIMILATION: `SE_ASSIM` **`ending`** (the pull-back down the table) · RETAINED: the same room, **`retained`**
- EXPULSION: `SE_EXPUL` (the store) **`ending`** through the open door
- PENDING: `SE_PEND` (the waiting room, seated) **`ending`**
