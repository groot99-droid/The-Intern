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

**No stills, no clips.** The 43 AI-generated stills and 40 clips (and the loading frames that stood in for them) were removed: every scene is a live 3D room from [[ninety-nine/data/rooms.json|data/rooms.json]], walked in first person through one continuous building (`src/world/`, `src/director.js`). [[ninety-nine/assets/Scene Flow|Scene Flow]] walks the rooms, thresholds and connectors in play order.

## Scenes (each has a room and an AMB bed)
`S0_X` (apartment) + `SET_STREET` · `S1_C` / `S1_H` (S2 plays in the same room) · `S3_C` / `S3_H` · `S4_C` / `S4_H` · `S5_C` / `S5_H` · `S6_C` (the S5 desk room again) / `S6_H` (S7_H is the same edge) · `S7_C` · `S8_C` + `SE_ASSIM` (boardroom) / `SET_DIVE` + `S8_H` (store). The `CN_*` connectors between them carry no bed of their own: the ambience crossfades as he walks through.

## Endings
`SE_ASSIM` · `SE_EXPUL` · `SE_PEND` · `SE_RETAINED` — each a room he walks into. Its zone, or 90 s passing, starts the pull-back shot, and a 4 s dead-still hold follows before the card.

## Library SFX (not generated, sourced from raw files)
10 of the `aud/` stems are mechanical/VO one-shots built from files in [[sfx-raw/Raw SFX Library|sfx-raw/]] — see that note for the file-to-file mapping.

## Cross-links
- The sets in Blender: [[blender/Blender Pipeline|blender/]] (the hand-built pilots) and the Higgsfield scene-builder projects that `tools/higgsfield_scene.py` builds ([[blender/higgsfield/README|blender/higgsfield/]]; stale until rebuilt, see [[blender/higgsfield/REBUILD_NOTE|REBUILD_NOTE]]).
- Raw SFX sources: [[sfx-raw/Raw SFX Library|sfx-raw/]]

## Revisions
- [[ninety-nine/assets/Asset Revisions|Asset Revisions]] — the history of the removed stills and clips.
