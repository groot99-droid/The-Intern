# assets/glb

`library.glb` — the open-source prop library: every catalog model that
`tools/build_rooms.py` places (its `CATALOG` table), imported once into the
Higgsfield 3D scene builder's "NINETY-NINE — Prop Library" project and exported
as one GLB. Each model is a named node (`lib_chair`, `lib_car_sedan`, ...);
`src/stage/library.js` clones them by name and gives every clone the company's
low-poly treatment (flat shading, vertex snapping, palette colours only; canon C1).

The file is optional: without it every `glb` prop in `data/rooms.json` builds
its box `fallback` instead, so the game runs from a checkout with no binaries.

Re-export: open the library project in the scene builder and download its GLB
(`scene_builder_3d_get_glb`), or re-run the imports listed in `build_rooms.py`'s
`CATALOG` into a new project. Models are the scene builder's shared catalog
(stylised low-poly game assets); their licence is the catalog's.
