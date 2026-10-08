---
tags: [game-code]
---

# Source Code

← [[ninety-nine/App Overview|App Overview]]

Engine modules in `ninety-nine/src/`. All conform to Doc 4's technical build spec, except where its dated amendment notes (2026-10-03) say the build moved on: the game is one continuous first-person walk, and there are no mini-games or choice buttons.

- **[[ninety-nine/src/main.js|main.js]]**: Doc 4 §2. Boots and runs the preflight, builds the stage and the director, and puts the candidate in his apartment. Two dev-only URL parameters: `?start=S5&render=H` starts the walk at that scene instead (`director.start()`), and `?autopilot=` loads `dev/autopilot.js`.
- **[[ninety-nine/src/state.js|state.js]]**: Doc 4 §3. The state module (conformance, dissonance, friction, flags). Only `commitChoice()` writes conformance and dissonance; friction comes from `friction.js`, through the director.
- **[[ninety-nine/src/director.js|director.js]]**: replaces the old router. It plays the spine (Doc 1 §4) as one continuous walk through one building ([[ninety-nine/src/world/World|world/]]).
  - **Entering a scene**: advances the drone's detune, crossfades the ambience, sets the music, schedules the captions and applies the fracture. It runs the scene's `onEnter` beats, then arms its two **thresholds**: zones in the room, named by `data/scenes.json`.
  - **Each frame**: inside a threshold's approach ring, its label fades in and its `approach` beats run. Stepping into the zone commits the choice: `commitChoice`, `setFlag`, the movement friction, then the threshold's `beat`s.
  - **The way on**: if the next scene's room is the same set, the next scene starts where he stands. Otherwise `openWay()` attaches the threshold's `via` connector to its `exit` door and joins the next room behind it, in whichever render the score picks after the choice.
  - **Sealing**: the door behind seals once he is 1.2 m into the connector, and the old room is dropped. Crossing the connector's midpoint is the scene boundary.
  - **Carried moments**: `sit`, `lookAt` (the call), `moveTo`, `shot`, `rideCab` (the freight cab really descends), `fallInto` (S7 H: the dive joined under the edge's water) and `chuteTo` (S8 H: through the grate into the store). Then the endings: walk into the ending room's zone, or wait out `autoSeconds`, for the pull-back and the hold before the card.
  - **S0**: the APPLY desk, the form laid over the CRT, the portal's answer drawn on the screen, the stairs, the street, the tower's doors and the vestibule. `audio.startDrone()` runs when the lobby's front doors close behind him.
  - **Locked doors**: walking into one makes it shudder and rattle, through the stage's bump handler. A branch may carry `bumpCount: {door, at, caption, setFlag}`: the pushes on that locked door are counted, and on the `at`-th one the flag is set (`COUNTED_DOOR`) and the caption lands. No branch in `scenes.json` uses it yet.
  - **Dev start**: `start(sceneId, render)` with a scene other than S0 puts him just inside that scene's room, with a score that gives the requested render, and starts the drone at once. The rest of the game plays on from there as normal.
  - `bail()` leads to PENDING REVIEW. `_debug()` reports the zones, links and state for the autopilot and for tests.
- **[[ninety-nine/src/spine.js|spine.js]]**: pure helpers over `scenes.json` and `state.js`. `outcomesFor()` gives what each threshold of a scene leads to (the next render and room, or the ending and its room), so the director can build both possible next rooms before either is chosen. Also `zonesOf()`, `baseOf()` and `cloneState()`.
- **[[ninety-nine/src/friction.js|friction.js]]**: friction from movement, now that the mini-games are gone.
  - **Hesitation** is the active seconds before committing, scaled between each scene's `t0` and `t1`. Time while carried or while the window is hidden does not count.
  - **Doubling back** counts how often he walks from one threshold's approach ring to the other's.
  - Each scene yields 0..1 (0.6 × hesitation + 0.4 × doubling back, with three alternations counting as full), summed into `state.friction` (capped at 8). Its only consumer is still `fracture()`.
- **[[ninety-nine/src/labels.js|labels.js]]**: the threshold labels. Each choice's words stand in the room over the place to walk to, projected every frame (`stage.project()`). They fade in across the approach ring and stamp when the zone is entered. Company text: never "you" (C4).
- **[[ninety-nine/src/captions.js|captions.js]]**: spoken lines and company text that land in the room: the receptionist's "Ninety-nine." / "Shaun.", the door's violation line, the cab's refusal, the box's contents. Timed from a scene's start (`captions`) or played as `caption` beats.
- **[[ninety-nine/src/screens.js|screens.js]]**: what the building's screens say, drawn as a canvas texture onto a monitor prop's screen. Pages: the apartment's job posting, the confirmation, the countdown and ACCEPTED; the Harlowe desktop; the requisition (rows from `text/manifest.json`). `screenPower()` turns a screen on or off. A screen is part of its room, so the window cannot be closed.
- **`stage/stage.js`**: the stage. It owns the renderer, the composite pass (ACES, vignette, grain, dither, and the fade: an ending's pull-back fading out, the blackout before the card; rooms no longer join through black) and the frame loop over the world and the player.
  - **Carried camera moves**: `carry(pose)` eases from wherever the camera is to a world pose; `playShot(inst, shot)` plays a named shot from `data/rooms.json`, authored in the room's own frame; `holdPose()`; `releaseShot()`.
  - **Previews** (`test/rooms.html`): `preview(key)` / `walk(key)` show a lone room.
  - **For the director**: `screenRect()` (where a prop's screen sits in the viewport, which is where the application form goes), `project()` (for the threshold labels), `onFrame()` (the director's per-frame tick), `setBumpHandler()` (what walking into a collider means: locked doors rattle) and `fadeTo()` / `blackout()`.
- **`stage/library.js`**: the open-source prop library (`assets/glb/library.glb`, from the Higgsfield scene builder's catalog). Clones a model by name and gives it the company's low-poly treatment (C1). Optional: box fallbacks stand in without it.
- **[[ninety-nine/src/fracture.js|fracture.js]]**: Doc 4 §5.2. Three visual-wrongness layers driven by `fracture()` (Doc 1 §2.3), capped so it reads as smooth wrongness, never a glitch. The bleed is the opposite render's palette (its room's fog, ambient and sun colours), not a still.
- **[[ninety-nine/src/audio.js|audio.js]]**: Doc 4 §7.
  - `unlock()` runs on the first trusted gesture (a click to look, a key, a touch). It starts the context and the music bus, so room tone and footsteps can sound from the apartment on. It does not start the drone.
  - `startDrone()` runs when the lobby doors close behind the candidate. This is C7's single `OscillatorNode`: guarded, faded in over 2 s, never stopped or restarted until the final card.
  - Also owns the bus (ambience / sfx / voice / music → master → limiter), per-file loudness trims, the equal-power ambience crossfade, tracked one-shots, ducking (the dive's underwater low-pass: filtered, never stopped) and the ending fade.
- **[[ninety-nine/src/music.js|music.js]]**: the liminal music bed. Generative Web Audio: an 8-bar muzak loop for the lobby, slow detuned pads after the doors close, colder voicings in the hostile render. No licensed tracks; there is an optional `{file}` slot for one. The mood per scene comes from `data/scenes.json`'s `music`.
- **[[ninety-nine/src/sfx.js|sfx.js]]**: Doc 4 §10 Phase 6. One-shot mechanical and VO SFX playback (see [[sfx-raw/Raw SFX Library]] for the raw sources these were built from), plus synthesised cues for the continuous building: `door-thud` (a door sealing behind), `door-buzz`, `deadbolt`, `elevator-motor`, `splash`, `stamp`.
- **[[ninety-nine/src/text.js|text.js]]**: resolves text keys against `/text`. It throws loudly on a missing key, so Doc 4 §4.1's validator has teeth at runtime.
- **[[ninety-nine/src/bail.js|bail.js]]**: Doc 4 §9. The global accessibility exit: the EXIT button and a 3-finger, 1200 ms long-press on touch. Escape no longer bails, because under pointer lock it is the browser's "release the mouse" key. Quitting routes to PENDING REVIEW, not a hard exit.
- **[[ninety-nine/src/soundToggle.js|soundToggle.js]]**: the second persistent non-diegetic control, alongside bail.js's EXIT.
- **[[ninety-nine/src/application.js|application.js]]**: the S0 WILLING / NOT WILLING intake form (added post-launch, not part of Doc 1–4's original design). `presentForm()` lays it over the apartment's CRT while he sits at it (the director follows `stage.screenRect()`). It also gives the director the countdown's steps and pace to draw on the screen.
- **[[ninety-nine/src/dev/autopilot.js|dev/autopilot.js]]**: dev only, and loaded only with `?autopilot=SSRRSSRR`. It walks the candidate through by himself, one letter per scene S1–S8: S to succumb, R to resist.
  - Options: `&seed=H` answers the form NOT WILLING, `&bail=S4` presses EXIT on reaching that scene, `&speed=2.5` scales the walking speed. Combine it with `?start=` to walk from a later scene.
  - It steers the real controls through the same colliders, zones and doors a player meets. Routes come from a navgrid built by raycasting each room's colliders, with A* over it. When he is stuck, it marks the cell blocked and re-plans.
  - It logs `[autopilot]` lines to the console.

## Subsections
- [[ninety-nine/src/world/World|world/]]: the continuous building. Rooms placed in one world space and joined door to door, the attach maths, the fixed light pool, the atmosphere blend, the candidate's body.
- [[ninety-nine/src/walk/Walk Mode|walk/]]: the room builder (materials, room, doorways, props: the museum-walkthrough pattern) and the first-person controls.
