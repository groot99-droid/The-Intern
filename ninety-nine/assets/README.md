# NINETY-NINE — assets

The game is a set of live 3D scenes now (`src/stage/`), so the only media
under here is sound. The AI-generated stills and clips the Doc 2 pipeline
delivered (`img/`, `vid/`: 43 stills, 40 clips) were removed along with the
loading frames they stood behind; what they showed is built as 3D sets in
`data/rooms.json` (`tools/build_rooms.py`) and in the Higgsfield 3D scene
builder (`tools/higgsfield_scene.py`). `MANIFEST.csv` / `MANIFEST.json` keep the
audio rows only.

    /assets
      /aud   29 stems   (18 AMB beds, 30.000 s seamless loops, 48 kHz / 24-bit; one-shots and VO)
      /glb   library.glb (optional): the open-source prop library, see glb/README.md
      MANIFEST.csv / MANIFEST.json   per-file format, duration, hash, QC, notes (audio)

Names: `S{n}_{C|H}_AMB.wav` beds (Doc 2 §6); second-space beds `S0_X_AMB_STREET.wav`,
`S8_C_AMB_BOARDROOM.wav`, `S8_H_AMB_STORE.wav`; one-shots `S{n}_{R}_SFX_*.wav`.
Doc 1 names the prologue `S0_C_*`; Doc 2 and these files use `S0_X_*`.

## Engine notes

- **Audio**: no stem contains the 48 Hz drone (engine oscillator, C7). Beds are peak-normalised
  to -3 dBFS, loudness intentionally unmatched per scene (see MANIFEST) -- the engine trims each
  bed toward -18 LUFS and each one-shot toward -8 dBFS peak at play time (src/audio.js).
  Loop seams measured ≤ 0.023 on ±1 scale.
- **Transitions**: there are none to carry any more. The game is one continuous walk: rooms are
  joined door to door through `CN_*` connectors (src/world/), and beds crossfade as he walks
  through. A render flip (C↔H) is decided when the choice is committed: the room joined behind
  the door is already the right one. The `leave` / `arrive` shots stay in data/rooms.json for the
  Higgsfield proofs.
- **Text rule**: no lettering baked into a set. ENTER sign = blank green housing; every placard is
  a blank quad; what a monitor says (the S0 posting, ACCEPTED, the Harlowe desktop, the
  requisition) is engine text drawn onto its screen (src/screens.js); the 99 / 100 slips, the
  threshold labels and every card are engine text.
- **Music** is generated (`src/music.js`), not a file.

## Not generated

- `S{n}_{R}_SFX_*` one-shots still missing: stapler thud, CRT degauss, door screech, car alarm,
  package drag, concrete grains, chute scrape (sfx.js synthesises stand-ins).
- NEVER_SAT variant of the ASSIMILATION boardroom: not a file. The boardroom's `emptychair` prop
  is hidden when NEVER_SAT is set (data/endings.json `flagOverlays`).
