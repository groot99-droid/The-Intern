---
tags: [generated-asset]
---

# Scene Flow

← [[ninety-nine/assets/Generated Assets|Generated Assets]]

Every still, clip, and ambience bed, wikilinked in actual play order — taken directly from [[ninety-nine/data/scenes.json|data/scenes.json]] / [[ninety-nine/data/endings.json|data/endings.json]] (the game's real sequencing data), not inferred. This is what connects the individual media files to each other in the graph: [[README|README.md]]'s Map links to *notes*, this note links to *files*.

Per scene/branch: `IMG_IN` and `IMG_OUT` are Kling's start/end frame pair that `VID` interpolates between; `TRN` is the transition clip into the next scene.

## S0 — THE UPLOAD (no branch)
[[S0_X_IMG_IN.png]] → [[S0_X_VID.mp4]] → [[S0_X_IMG_OUT.png]] → [[S0_X_TRN_S1.mp4]] → **S1**
Ambience: [[S0_X_AMB.wav]] under the form/countdown, crossfading to [[S0_X_AMB_STREET.wav]] on the commute cut. Both prologue clips play forward only (see [[ninety-nine/assets/Asset Revisions|Asset Revisions]] for the reversed cuts they replace).

## S1 — THE WAITING ROOM
- **C**: [[S1_C_IMG_IN.png]] → [[S1_C_VID.mp4]] (loops) → [[S1_C_IMG_OUT.png]] → [[S1_C_TRN_S2.mp4]] → **S2** · amb [[S1_C_AMB.wav]] · choice TAKE A SEAT / STAY STANDING (sets `NEVER_SAT`)
- **H**: [[S1_H_IMG_IN.png]] → [[S1_H_VID.mp4]] (loops) → [[S1_H_IMG_OUT.png]] → [[S1_H_TRN_S2.mp4]] → **S2** · amb [[S1_H_AMB.wav]] · same choice

## S2 — THE CALL
- **C**: [[S2_C_IMG_IN.png]] → [[S2_C_VID.mp4]] → [[S2_C_IMG_OUT.png]] → [[S2_C_TRN_S3.mp4]] → **S3** · sfx [[S2_C_SFX_SPEAKER.wav]] + [[S2_X_SFX_RECEPTIONIST.wav]] · no ambience bed of its own (S1's carries through) · choice STAND / RUN
- **H**: [[S2_H_IMG_IN.png]] → [[S2_H_VID.mp4]] → [[S2_H_IMG_OUT.png]] → [[S2_H_TRN_S3.mp4]] → **S3** · sfx [[S2_H_SFX_SPEAKER.wav]] + [[S2_X_SFX_RECEPTIONIST.wav]]

## S3 — THE THRESHOLD
- **C**: [[S3_C_IMG_IN.png]] → [[S3_C_VID.mp4]] (MG-02 THE SCAN) → [[S3_C_IMG_OUT.png]] → [[S3_C_TRN_S4.mp4]] → **S4** · amb [[S3_C_AMB.wav]] · sfx [[S3_C_SFX_CURTAIN.wav]]
- **H**: [[S3_H_IMG_IN.png]] → [[S3_H_VID.mp4]] (MG-02 THE DOOR) → [[S3_H_IMG_OUT.png]] → [[S3_H_TRN_S4.mp4]] → **S4** · amb [[S3_H_AMB.wav]] · sfx [[S3_H_SFX_DOOR.wav]]

## S4 — THE FLOOR
- **C**: [[S4_C_PLATE_IN.png]] → [[S4_C_VID_PLATE.mp4]] → [[S4_C_PLATE_OUT.png]] (figure-free room plate — Kling's walk-cycle take was rejected; separate from the sprite pair below) → [[S4_C_TRN_S5.mp4]] → **S5** · amb [[S4_C_AMB.wav]] · sfx [[S4_C_SFX_PAPERS.wav]] on TAKE THE PAPERS
  Manager billboard sprites (composited over the plate, not baked in): [[S4_C_IMG_IN.png]] ("far") / [[S4_C_IMG_OUT.png]] ("near")
- **H**: [[S4_H_IMG_IN.png]] → [[S4_H_VID.mp4]] → [[S4_H_IMG_OUT.png]] → [[S4_H_TRN_S5.mp4]] → **S5** · amb [[S4_H_AMB.wav]] · one-shot [[S4_H_SFX_FOOTSTEPS.wav]]

## S5 — THE DESK / THE GARAGE
- **C**: [[S5_C_IMG_IN.png]] → [[S5_C_VID.mp4]] (MG-04 THE STAPLER) → [[S5_C_IMG_OUT.png]] → [[S5_C_TRN_S6.mp4]] → **S6** · amb [[S5_C_AMB.wav]] · sfx [[S5_C_SFX_STAPLER.wav]] / [[S5_C_SFX_CRT_ON.wav]] (WAKE THE TERMINAL, sets `SAW_HARLOWE`)
- **H**: [[S5_H_IMG_IN.png]] → [[S5_H_VID.mp4]] (MG-04 THE IGNITION) → [[S5_H_IMG_OUT.png]] → [[S5_H_TRN_S6.mp4]] → **S6** · amb [[S5_H_AMB.wav]] · sfx [[S5_H_SFX_CARALARM.wav]]

## S6 — THE REQUISITION / THE RUN
- **C**: [[S6_C_IMG_IN.png]] (still only — byte-identical to [[S6_C_IMG_OUT.png]] per MANIFEST.csv; also the green-screen monitor plate for MG-05) → [[S6_C_TRN_S7.mp4]] → **S7** · amb [[S6_C_AMB.wav]] · sfx [[S6_C_SFX_KEYBOARD.wav]]
- **H**: [[S6_H_IMG_IN.png]] → [[S6_H_VID.mp4]] (MG-05 THE RUN; holds on IMG_OUT for a 9s silent tail) → [[S6_H_IMG_OUT.png]] → [[S6_H_TRN_S7.mp4]] → **S7** · amb [[S6_H_AMB.wav]]

## S7 — THE DESCENT
- **C**: [[S7_C_IMG_IN.png]] → [[S7_C_VID.mp4]] (MG-06 THE PANEL) → [[S7_C_IMG_OUT.png]] → [[S7_C_TRN_S8.mp4]] → **S8** · amb [[S7_C_AMB.wav]]
- **H**: [[S7_H_IMG_IN.png]] → [[S7_H_VID.mp4]] (MG-06 THE EDGE) → [[S7_H_IMG_OUT.png]] → [[S7_H_TRN_S8.mp4]] → **S8** · amb [[S7_H_AMB.wav]]

## S8 — THE DELIVERY / THE DIVE
- **C**: [[S8_C_IMG_IN.png]] → [[S8_C_VID.mp4]] → [[S8_C_VID_BOARDROOM.mp4]] (MG-07 THE HANDOFF; choice DELIVER / OPEN THE BOX, sets `OPENED_BOX`) → [[S8_C_IMG_OUT.png]] · amb [[S8_C_AMB.wav]] then [[S8_C_AMB_BOARDROOM.wav]] (the bed change lands on the cut) → ending transition:
  - **ASSIMILATION** or **RETAINED** → [[S8_C_TRN_SE_ASSIM.mp4]]
  - **PENDING REVIEW** → [[S8_C_TRN_SE_PEND.mp4]]
- **H**: [[S8_H_IMG_IN.png]] → [[S8_H_VID.mp4]] (MG-07 THE BREATH; choice DIVE / SWIM FOR THE PILLARS is asked here, underwater) → [[S8_H_VID_STORE.mp4]] (the consequence) → [[S8_H_IMG_OUT.png]] · amb [[S8_H_AMB.wav]] then [[S8_H_AMB_STORE.wav]] → ending transition:
  - **EXPULSION** → [[S8_H_TRN_SE_EXPUL.mp4]]
  - **PENDING REVIEW** → [[S8_H_TRN_SE_PEND.mp4]]

The ending is `resolveEnding()` in [[ninety-nine/src/state.js|state.js]] (conformance / dissonance / flags), never the button pressed: OPEN THE BOX on a high-conformance run is **RETAINED** through the ASSIMILATION clip, and PENDING is reachable from both branches.

## Endings
- **ASSIMILATION**: [[SE_ASSIM_IMG_IN.png]] → [[SE_ASSIM_VID.mp4]] → [[SE_ASSIM_IMG_OUT.png]] (4s hold)
- **EXPULSION**: [[SE_EXPUL_IMG_IN.png]] → [[SE_EXPUL_VID.mp4]] → [[SE_EXPUL_IMG_OUT.png]] (4s hold)
- **PENDING REVIEW**: [[SE_PEND_IMG_IN.png]] → [[SE_PEND_VID.mp4]] → [[SE_PEND_IMG_OUT.png]] (4s hold)
- **RETAINED** (post-launch addition; still-only, no video/IN frame): [[SE_RETAINED_IMG_OUT.png]] (static 4s hold)

Driven by [[ninety-nine/src/Source Code|router.js]]; SFX one-shots trace back to raw sources in [[sfx-raw/Raw SFX Library|sfx-raw/]]. The music bed under all of it is generated live by [[ninety-nine/src/music.js|music.js]] (muzak in S1–S2, pads from S3, deeper from S7, `water` under the pool renders) -- no audio file. Every scene from S1 on also has a walkable 3D room ([[ninety-nine/src/walk/Walk Mode|walk/]], [[ninety-nine/data/rooms.json|data/rooms.json]]) offered as WALK THE ROOM beside the two choices.
