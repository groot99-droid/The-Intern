---
tags: [generated-asset]
---

# Generated Assets

← [[ninety-nine/App Overview|App Overview]]

113 generated media files (43 img / 30 aud / 40 vid) under `ninety-nine/assets/{img,aud,vid}`, plus the pipeline's own docs sitting alongside them:

- **[[ninety-nine/assets/README.md|README.md]]** — the asset-delivery doc: directory layout, naming scheme, engine notes (transition timing, loop behavior, text rule), what was deliberately *not* generated.
- **[[ninety-nine/assets/MANIFEST.csv|MANIFEST.csv]]** — per-file format/duration/hash/QC/notes. The authoritative exhaustive record — this note summarizes by scene, MANIFEST.csv has the individual rows.
- **`MANIFEST.json`** — the same data as JSON.
- **`aud/_MANIFEST.csv`** — per-stem loudness data (integrated LUFS, true peak) for the audio beds specifically.

This note summarizes *by scene* rather than one bit per file — see [[ninety-nine/assets/Scene Flow|Scene Flow]] for every individual file wikilinked in actual play order, or MANIFEST.csv for exact filenames/hashes.

## Scenes (each has some subset of IMG_IN/IMG_OUT, a VID, an AMB bed)
`S0_X` (prologue) · `S1_C` / `S1_H` · `S2_C` / `S2_H` · `S3_C` / `S3_H` · `S4_C` (+ `S4_C_PLATE_IN/OUT` — the figure-free plate fallback, Doc 2 §2.2) / `S4_H` · `S5_C` / `S5_H` · `S6_C` / `S6_H` · `S7_C` / `S7_H` · `S8_C` (mailroom + boardroom clips) / `S8_H` (dive + store clips)

## Endings
`SE_ASSIM` · `SE_EXPUL` · `SE_PEND` · `SE_RETAINED` — each a still + video ending on a hold for the 4s pre-card pause.

## Library SFX (not Higgsfield-generated, sourced from raw files)
10 of the `aud/` stems are mechanical/VO one-shots built from files in [[sfx-raw/Raw SFX Library|sfx-raw/]] rather than generated — see that note for the file-to-file mapping.

## Cross-links
- Pipeline/method: [[docs/Design Docs|docs/02_GENERATION_HIGGSFIELD.md]]
- The 3 pilot stills these were also used as Blender modeling reference for: [[blender/refs/Reference Images|blender/refs/]]
- Raw SFX sources: [[sfx-raw/Raw SFX Library|sfx-raw/]]

## Revisions
- [[ninety-nine/assets/Asset Revisions|Asset Revisions]] — what this pass re-cut/restored and what still needs regenerating.
