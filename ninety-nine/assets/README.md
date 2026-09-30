# NINETY-NINE — Generated Asset Delivery (Doc 2 pipeline, Phases 1–7)

Directory layout follows Doc 2 §1:

    /assets
      /img   42 stills   (S0–S8 IMG_IN/IMG_OUT both branches, SE_* endings, S4_C plates)
      /vid   40 clips    (19 base scene clips, 19 transitions, 3 endings; all muted per §6)
      /aud   19 stems    (18 AMB beds, 30.000 s seamless loops, 48 kHz / 24-bit; 1 footstep one-shot)
      MANIFEST.csv / MANIFEST.json   per-file format, duration, hash, QC, notes
      /_rejected   20 rejected versions, prefixed `_rejected_` so Doc 4's literal match ignores them

All filenames match §1 exactly except the nine extensions listed below, which Doc 4's
manifest needs entries for.

## Names outside the §1 scheme (Doc 4 must add these)

| File | Why |
|---|---|
| S4_C_PLATE_IN.png, S4_C_PLATE_OUT.png, S4_C_VID_PLATE.mp4 | Phase 2 found Kling adds a walk cycle to the manager. Fallback per §2.2: figure-free room plate + engine sprite (S4_C_IMG_IN/OUT are the sprite sources). S4_C_VID (walk-cycle version) is in _rejected. |
| S8_C_VID_BOARDROOM.mp4, S8_H_VID_STORE.mp4 | Doc 2 defines two clips each for S8_C (mailroom, boardroom) and S8_H (dive, store). |
| S0_X_AMB_STREET.wav, S8_C_AMB_BOARDROOM.wav, S8_H_AMB_STORE.wav | Second-space beds; S2 has no bed of its own (S1 beds carry through; S2 audio is one-shots). |
| S4_H_SFX_FOOTSTEPS.wav | Distant footsteps one-shot for engine-triggered off-sync passes. |

Also: Doc 1 names the prologue `S0_C_*`; Doc 2 and these files use `S0_X_*`.

## Engine notes

- **Transitions with a black join** (S2_C→S3, S2_H→S3, S3_H→S4, S4_H→S5, S5_C→S6, S5_H→S6, S6_C→S7,
  S8_C→SE_ASSIM, S8_C→SE_PEND, S8_H→SE_PEND): 6 s each, ~1 s of true black mid-clip (luma ≤ 2/255).
  That black is a safe point to swap render (C↔H) when the top-of-scene evaluation flips.
- **Loops**: S1_C_VID returns to frame 0 within 0.86/255 mean difference; cut, do not crossfade.
- **S6_H_VID**: hold on S6_H_IMG_OUT for the 9 s silence (dead-flat water); the clip's last second has subtle ripple.
- **S2_C_VID**: jaw snaps once, not four steps. Flipbook fallback (Doc 4 §6.4) can be built from S2_C_IMG_IN/OUT.
- **Endings**: each SE_*_VID ends on a still hold; extend on the last frame for the 4 s pre-card hold.
  The "100" slip and all cards are engine text; slips in stills are blank quads.
- **Audio**: no stem contains the 48 Hz drone (engine oscillator). Beds are peak-normalised to -3 dBFS,
  loudness intentionally unmatched per scene (see MANIFEST) -- the engine trims each bed toward -18 LUFS
  and each one-shot toward -8 dBFS peak at play time (src/audio.js), so the files stay as delivered.
  Loop seams measured ≤ 0.023 on ±1 scale.
- **Text rule**: no generated lettering anywhere. ENTER sign = blank green housing; S0 monitor page = grey
  placeholder bars; S7 indicator = non-numeric segment pattern.

## Not generated (outside the phases requested)

- `S{n}_{R}_SFX_*` one-shots: speaker click/hiss, the receptionist's lines ("Ninety-nine", "Shaun",
  the violation line, "Thirty-one. The candidate is thorough."), stapler thud, CRT degauss, door screech,
  car alarm, package drag, concrete grains, chute scrape.
- NEVER_SAT variant of the ASSIMILATION boardroom (chair missing).
- 4-frame jaw flipbook stills for S2 (only if the single-snap clip is rejected).

## Method summary

Stills: GPT Image 2, 2K, §3 global block byte-identical + §4.1 negatives; S1_C_IMG_IN used as the image
reference for every later still; every IMG_OUT is an edit of its IMG_IN. Motion: Kling 3.0 pro,
start+end frame, §4.2 negatives on every clip, native audio off. Beds: Seed Audio 35 s → trimmed,
halves swapped, 2 s equal-power crossfade at the interior join, exact 30.000 s.
