---
tags: [generated-asset]
---

# Generated Assets

← [[ninety-nine/App Overview|App Overview]]

29 audio files under `ninety-nine/assets/aud`, the optional open-source prop library under `ninety-nine/assets/glb`, and the pipeline's own docs:

- **[[ninety-nine/assets/README.md|README.md]]** — the asset doc: layout, naming, engine notes, what was deliberately *not* generated.
- **[[ninety-nine/assets/MANIFEST.csv|MANIFEST.csv]]** — per-file format/duration/hash/QC/notes for the audio. The authoritative record.
- **`MANIFEST.json`** — the same data as JSON.
- **`aud/_MANIFEST.csv`** — per-stem loudness data (integrated LUFS, true peak) for the beds.
- **`glb/README.md`** — the prop library (`library.glb`): every catalog model `tools/build_rooms.py` places, exported from the Higgsfield 3D scene builder.

**No stills, no clips.** The 43 AI-generated stills and 40 clips (and the loading frames that stood in for them) were removed: every scene is a live 3D set from [[ninety-nine/data/rooms.json|data/rooms.json]], played through `src/stage/stage.js` as camera shots. [[ninety-nine/assets/Scene Flow|Scene Flow]] walks the sets and shots in play order.

## Scenes (each has a set, its shots, an AMB bed)
`S0_X` (apartment) + `SET_STREET` · `S1_C` / `S1_H` (S2 plays in the same room) · `S3_C` / `S3_H` · `S4_C` / `S4_H` · `S5_C` / `S5_H` · `S6_C` / `S6_H` (S7_H is the same edge) · `S7_C` · `S8_C` + `SE_ASSIM` (boardroom) / `SET_DIVE` + `S8_H` (store)

## Endings
`SE_ASSIM` · `SE_EXPUL` · `SE_PEND` · `SE_RETAINED` — each a set and a pull-back shot, then a 4 s dead-still hold before the card.

## Library SFX (not generated, sourced from raw files)
10 of the `aud/` stems are mechanical/VO one-shots built from files in [[sfx-raw/Raw SFX Library|sfx-raw/]] — see that note for the file-to-file mapping.

## Cross-links
- The sets in Blender: [[blender/Blender Pipeline|blender/]] (the hand-built pilots) and the Higgsfield scene-builder projects `tools/higgsfield_scene.py` builds (project links in [[ninety-nine/App Overview|App Overview]]).
- Raw SFX sources: [[sfx-raw/Raw SFX Library|sfx-raw/]]

## Revisions
- [[ninety-nine/assets/Asset Revisions|Asset Revisions]] — the history of the removed stills and clips.
