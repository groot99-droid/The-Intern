---
tags: [generated-asset]
---

# Asset Revisions

> **Superseded.** Every still and clip this note tracks was removed when the game became 3D-only (the sets in `data/rooms.json` replace them); the note stays as the history of what was delivered and re-cut.

← [[ninety-nine/assets/Generated Assets|Generated Assets]]

What changed in this pass, and what still needs regenerating. Regeneration means new Higgsfield/Kling renders (Doc 2) or new Blender renders ([[blender/Blender Pipeline|blender/]]) -- neither can run in the game repo, so the second list is a brief, not a diff.

## Done in this pass

| File | Change |
|---|---|
| `S0_X_TRN_S1.mp4` (removed) | Was a 12 s reversed-then-forward palindrome (interior → street → interior): the clip played backwards, then forwards. Re-cut to its forward half only (street → doors → reception, 6.04 s). Still ends on the reception interior so the hand-off into S1 matches. One more generation of loss; the true original was never recovered. |
| `S0_X_VID.mp4` (removed) | Was reverse-only (the street push-in ran backwards). Un-reversed: the shot now pushes toward the tower and ends on the frame the transition opens with. |
| [[S1_C_IMG_IN.png]] / [[S1_C_IMG_OUT.png]] / [[S1_C_VID.mp4]] | Restored the photoreal AI originals from `_retired_ai/` (`tools/stage_assets.py --restore`). The 1920×1080 / 1280×720 Blender re-skin that had been staged over them was a flat grey blockout -- the only non-photoreal scene in the run -- and was still marked `qc: pending`. |
| `MANIFEST.csv` / `MANIFEST.json` | Rows for the five files above re-measured (bytes, sha256_16, seconds, note). |

Not a file change, but visible: looping scene clips no longer snap from their last frame to their first (`renderer.js` (removed) soft loop), which used to read as the clip jumping backwards every few seconds.

## Still to regenerate

Ordered by how visible the problem is in play.

1. **`SE_RETAINED`** -- only one still exists (`SE_RETAINED_IMG_OUT.png` (removed)). Needs `SE_RETAINED_IMG_IN.png` + `SE_RETAINED_VID.mp4` (boardroom, one chair short) so it plays like the other three endings instead of a static hold. Also needs a real `S8_C_TRN_SE_RETAINED.mp4`; it currently borrows the ASSIMILATION transition.
2. **`S6_C_IMG_OUT.png`** -- byte-identical to IMG_IN (the green-screen monitor plate). Fine for MG-05's live UI, but the scene has no end frame of its own; an OUT frame with the terminal's glow dimmed would give `S6_C_TRN_S7` something to leave from.
3. **`S4_C_VID`** -- Kling's walk-cycle take was rejected; the game ships the figure-free `S4_C_VID_PLATE.mp4` + a billboard sprite of the manager. A clean approach clip (manager walking toward camera, face static, C5) would retire the sprite composite in `mg03-corridor.js` (removed).
4. **`S2_C_VID.mp4`** -- jaw moves in one snap instead of the four-frame loop (Doc 1 §5 S2 / C5). Either regenerate, or switch on the dormant `flipbookFallback` in `data/scenes.json` once `flipbook.js` (removed) is wired to the renderer (it currently is not imported anywhere).
5. **`NEVER_SAT` overlay** -- `data/endings.json` carries a disabled placeholder for the "no chair for him" variant of the ASSIMILATION pull-back. Needs a chair-removed plate.
6. **Render-swap transitions** -- no `transitionsSwap` clips exist, so a C↔H flip between scenes plays the old room's transition and then cuts to the other room. The black-join transitions hide this (S2 C/H, S3_H, S4_H, S5 C/H, S6_C); S1 C/H, S3_C, S4_C, S6_H and S7 C/H show it. `blender/export_game_assets.py`'s `slot_report()` lists the 15 slots.
7. **`S6_H_VID.mp4`** -- MANIFEST says "engine holds on S6_H_IMG_OUT for the 9 s silence"; the engine has never done that (the clip loops). Either trim the clip to the run and add the hold in `scenes.json`, or leave the loop.
8. **Receptionist voice** ([[S2_X_SFX_RECEPTIONIST.wav]]) -- 15 s of a generic library voice with five separate phrases; the scene needs one word ("Ninety-nine." / "Shaun."). A recorded or synthesised single line per render would replace it. The engine now fades it out at the scene cut and shows the line as a caption, so it no longer runs into S3.

## Audio, for the record

The beds were delivered peak-normalised to -3 dBFS with loudness "intentionally unmatched" (a 17 dB spread). The engine now trims each bed toward -18 LUFS (+6 dB cap) and each one-shot toward -8 dBFS peak, and runs a limiter on the master -- see the header of [[ninety-nine/src/audio.js|audio.js]]. No audio file was rewritten.
