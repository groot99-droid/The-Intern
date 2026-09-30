# Plan: Remaining "Ninety-Nine" 3D Environments

## Status

**Update (post-plan):** all 15 environments now have a final still rendered (see [[blender/renders/Scene Renders|blender/renders/Scene Renders.md]] for the per-folder inventory) — the 4 phases below were evidently carried out for stills. Only the original 3 pilots have a walkthrough animation. What's left is deciding which (if any) of the other 12 also get a walkthrough; the rest of this doc's phasing/sequencing rationale is still valid for that decision, it's just the "stills" half that's now done.

Originally: 3 of ~15 environments were built (`ninety-nine_pilots.blend`): **S1_C Waiting Room**, **SE_ASSIM Boardroom**, **S5_H Parking Garage** — each with final stills, a walkthrough animation, and materials assigned from the shared `material_factories.py` two-tier pipeline (PhotorealArch_* / LowPolyProp_* factories, stashed as a Text datablock in the .blend).

**12 environments remained** at that point. Consolidating the game's S0–S8 spine (some C/H branches share one physical set, just different dressing/lighting):

| # | Environment | Scene(s) it serves | Complexity |
|---|---|---|---|
| 1 | Lobby glass doors | S3_H | Trivial — reuses S1_C waiting-room geometry, new camera + street visible through the glass |
| 2 | Desk in the Void | S5_C / S6_C (same desk, monitor off→on) | Trivial — single desk, dark void, reuses Character + CRT monitor |
| 3 | Freight elevator | S7_C | Small — one compact room |
| 4 | Threshold corridor | S3_C | Small-medium — curtain, blank ENTER sign, badge scanner |
| 5 | Cubicle floor | S4_C | Medium — repeated partition module, "the manager" figure |
| 6 | Utility corridor | S4_H | Medium — mop sinks, drains, cinderblock, repeated doors |
| 7 | Broken edge / sunken pool | S6_H (tail) / S7_H | Medium — concrete edge, still water, tiled pillars |
| 8 | Mailroom / warehouse | S8_C (before boardroom) | Medium-large — cardboard towers, fog, counter, clerk |
| 9 | Underwater descent | S8_H (before store) | Medium — caustics approximation, particulates, floor grate |
| 10 | Convenience store | S8_H / SE_EXPUL ending | Medium-large — shelving, cooler, counter, storefront glass |
| 11 | Apartment interior | S0_X (night) | Medium — the one scene with real interior daylight-adjacent lighting (pre-lobby, C3 doesn't apply yet) |
| 12 | City street exterior | S0_X (dawn) | Large — exterior block, buildings, tower backdrop; only true exterior in the whole game |

## Sequencing: 4 phases, cheapest/most-reusable first

**Phase A — Cheap wins (reuse existing geometry/assets, validates the expanded pipeline fast)**
1. Lobby glass doors (S3_H)
2. Desk in the Void (S5_C/S6_C)
3. Freight elevator (S7_C)

**Phase B — Office cluster (shares S1_C's material palette; expands the shared kit)**
4. Threshold corridor (S3_C)
5. Cubicle floor (S4_C)
6. Utility corridor (S4_H)

**Phase C — Decay/finale cluster (shares S5_H's grime palette)**
7. Broken edge / sunken pool (S6_H/S7_H)
8. Mailroom / warehouse (S8_C)
9. Underwater descent (S8_H)
10. Convenience store (S8_H/SE_EXPUL)

**Phase D — Bookends (only scenes with real daylight — everything else is windowless per canon C3)**
11. Apartment interior (S0_X night)
12. City street exterior (S0_X dawn)

Recommend building in this order and pausing for a quick look after each phase (matches the original 3-scene pilot cadence) rather than committing to all 12 in one pass.

## New shared assets needed (add to `_SharedAssetLibrary`, reused across phases)

- Badge/laser scanner (small prop, Phase B)
- Curtain (cloth material via Sheen recipe, Phase B)
- Blank ENTER sign housing (no lettering, per canon) (Phase B)
- Cubicle partition module, arrayed (Phase B)
- Utility door module, repeatable (Phase B)
- Elevator button panel — blank grid, no numbers (Phase A)
- Desk + CRT monitor w/ emissive screen (Phase A, reused from S1_C's counter monitor concept)
- Tiled pool-pillar module (Phase C)
- Cardboard box tower module, stackable (Phase C)
- Store shelving + cooler + register (Phase C)
- Streetlight, storefront awning, low-poly period cars (Phase D — distinct from the rusted garage cars; these are the intact 1996-PS1-style street cars from S0)

## Process changes from the pilot (lessons learned)

The pilot's biggest time-sink was trial-and-error camera framing (cameras kept clipping through walls/cars because I was eyeballing blockout renders where everything is flat grey). This time:

1. **Bounding-box clearance check before every camera placement** — a small reusable helper that computes min distance from the proposed camera location to every mesh's world-space bounding box, and rejects/flags positions under ~1.5m clearance, instead of discovering the problem after a render.
2. **Fewer QA checkpoints per scene** (2-3 instead of 5-8) now that the two-tier shading pipeline, lighting-rig pattern, and vertex-snap/marble-veining techniques are proven — apply them directly rather than re-deriving.
3. **Batch similar scenes** within a phase so wall/corridor-building helper code is written once and reused (e.g., Phase B's three office-adjacent scenes share a "corridor blockout" helper).
4. Keep using the same `ninety-nine_pilots.blend` (one Scene per environment + the shared library) — consider renaming to `ninety-nine_full.blend` once past Phase A to reflect the expanded scope.

## Verification per scene (unchanged from pilot)

Side-by-side against the reference still (where one exists) or the written description (S3/S4/S6/S7/S8 don't all have stills I've inspected yet — worth pulling those images before modeling each one), two-tier shading contrast check, shadow-toward-core check, no-windows/no-legible-text check, poly-budget spot check, final still + optional walkthrough.

## Immediate next step

~~Confirm scope and starting point before I begin: all 4 phases, or start with Phase A only?~~ — done; all 4 phases' stills are rendered.

Remaining decision: stills-only is where things stand for 12 of 15 environments; walkthroughs roughly double the work per scene given the render/encode pipeline built for the pilot. Confirm whether any/all of the 12 should get a walkthrough next, and if so in what order (this doc's phase order is a reasonable default).
