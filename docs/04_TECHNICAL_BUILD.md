# NINETY-NINE
## Document 4 of 4: Technical Build Specification
### For Claude Code. Implements Doc 1 (logic), consumes Doc 2 (assets), hosts Doc 3 (mini-games).

← [[docs/Design Docs|Design Docs]] · implemented across [[ninety-nine/src/Source Code|ninety-nine/src/]]

---

## 1. STACK DECISION

**Vanilla ES modules. No framework. No build step. No bundler. Static hosting.**

| Choice | Reason |
|---|---|
| No React/Vue | The UI is nine scenes and eleven mini-games. A virtual DOM solves a problem this project does not have, and it fights the audio and video timing that this project is entirely made of |
| No bundler | GitHub Pages serves ES modules natively. `git push` is the deploy. Matches the existing *Right Door Wrong Exit* workflow |
| No TypeScript | Optional. If used, use JSDoc annotations plus `// @ts-check`, not a compile step. The no-build-step rule is the point |
| Web Audio API | Non-negotiable. Rule C7 requires one unbroken, continuously detuning drone across every scene boundary. `<audio>` tags cannot do this |
| `<video>` elements | Two pooled elements with crossfade. Not canvas. Hardware decode matters on mobile |

**Hard constraint:** if a proposed dependency requires a build step, it is the wrong dependency.

---

## 2. FILE TREE

```
/ninety-nine
├── index.html
├── style.css
│
├── /src
│   ├── main.js              boot, preflight, kick off S0
│   ├── state.js             conformance, dissonance, friction, flags
│   ├── router.js            the spine. Scene sequencing
│   ├── renderer.js          video pool, crossfade, fracture overlay
│   ├── choice.js            choice UI, commit, dwell timing
│   ├── audio.js             drone, bus, ducking, stems
│   ├── preload.js           N+1 both-branch prefetch
│   ├── text.js              string lookup from /text
│   ├── fracture.js          overlay intensity, anomaly spawn
│   ├── flipbook.js          4-frame NPC jaw fallback (Doc 2 §5, S2)
│   └── bail.js              global accessibility exit
│
├── /src/minigames
│   ├── _contract.js         shared interface + base helpers
│   ├── mg01-form.js
│   ├── mg02-scan.js
│   ├── mg03-corridor.js
│   ├── mg04-stapler.js
│   ├── mg05-requisition.js
│   ├── mg06-panel.js
│   └── mg07-handoff.js
│
├── /data
│   ├── scenes.json          THE MANIFEST. Single source of truth
│   └── endings.json
│
├── /text
│   ├── system.json          §6.1 of Doc 1
│   ├── form.json            §6.2
│   ├── manifest.json        §6.3 requisition items
│   └── endings.json         §6.4
│
└── /assets
    ├── /img    S{n}_{R}_IMG_{IN|OUT}.png
    ├── /vid    S{n}_{R}_VID.mp4, S{n}_{R}_TRN_S{m}.mp4
    └── /aud    S{n}_{R}_AMB.wav, S{n}_{R}_SFX_*.wav
```

Asset filenames are defined in Doc 2, §1 and matched by literal string. Do not normalize case, do not add prefixes, do not reorganize the asset directories.

---

## 3. STATE MODULE

### 3.1 Constants

```js
export const TITLE   = 'NINETY-NINE';
export const COMPANY = 'VELLUM & ASHE, LLP';
export const ROLE    = 'SENIOR DIRECTOR OF SYSTEMIC ARCHITECTURE';
export const ADDRESS = '666 HALLAM ROW';
export const DRONE_HZ = 48;
export const DETUNE_PER_SCENE = 4; // cents
```

Title change is one line here. Nothing else references the string.

### 3.2 Shape

```js
const state = {
  conformance: 0,        // int, -8..+8, even at scene end
  dissonance:  0,        // int, 0..7
  friction:    0.0,      // float, 0..8
  lastPolarity: null,    // +1 | -1 | null
  lastRender:  'C',      // 'C' | 'H'
  dwell:       [],       // float[], per scene
  flags:       new Set(),
  formAnswers: {},       // MG-01 output, read by MG-07
  sceneIndex:  0
};
```

### 3.3 Choice commit (the only writer of `conformance`)

```js
export function commitChoice(polarity) {    // +1 succumb, -1 resist
  if (state.lastPolarity !== null && polarity !== state.lastPolarity) {
    state.dissonance++;
  }
  state.lastPolarity = polarity;
  state.conformance += polarity;
}
```

### 3.4 Render resolution

```js
export function renderFor() {
  if (state.conformance >=  2) return (state.lastRender = 'C');
  if (state.conformance <= -2) return (state.lastRender = 'H');
  return state.lastRender;              // tie at 0 holds the last render
}
```

The tie holding is what makes wavering read as drift instead of a jump cut. Do not "fix" it to default to C.

### 3.5 Fracture

```js
export function fracture() {
  const f = (state.friction / 8.0) * 0.6;
  const d = (state.dissonance / 7.0) * 0.4;
  return Math.min(1, Math.max(0, f + d));
}
```

### 3.6 Ending

```js
export function resolveEnding() {
  if (state.flags.has('EARLY_EXIT'))  return 'PENDING';
  if (state.dissonance >= 4)          return 'PENDING';
  if (state.conformance >=  4)        return 'ASSIMILATION';
  if (state.conformance <= -4)        return 'EXPULSION';
  return 'PENDING';
}
```

### 3.7 Persistence: none

**There is no save.** Closing the tab ends the run. Reopening starts at S0.

This is a design decision, not an omission. A building you can bookmark and return to is not the building in Doc 1. It is also a large amount of engineering removed.

One exception, dev only:

```js
const DEBUG_RESUME = false;  // MUST be false in any deployed build
```

Add a CI check or a pre-push hook that fails if `DEBUG_RESUME` is true.

---

## 4. THE MANIFEST

`/data/scenes.json` is the single artifact that links Doc 1's logic, Doc 2's filenames, and Doc 3's components. Every other module reads from it. Adding a scene means editing this file and nothing else.

### 4.1 Schema

```json
{
  "id": "S3",
  "name": "THE THRESHOLD",
  "branches": {
    "C": {
      "video":  "S3_C_VID.mp4",
      "loop":   true,
      "ambience": "S3_C_AMB.wav",
      "imgIn":  "S3_C_IMG_IN.png",
      "imgOut": "S3_C_IMG_OUT.png",
      "minigame": { "module": "mg02-scan", "mode": "C" },
      "choice": {
        "succumb": { "label": "PART THE CURTAIN", "next": "S4" },
        "resist":  { "label": "TRY THE DOOR",     "next": "S4" }
      },
      "transitions": { "S4": "S3_C_TRN_S4.mp4" }
    },
    "H": {
      "video":  "S3_H_VID.mp4",
      "loop":   false,
      "ambience": "S3_H_AMB.wav",
      "imgIn":  "S3_H_IMG_IN.png",
      "imgOut": "S3_H_IMG_OUT.png",
      "minigame": { "module": "mg02-scan", "mode": "H" },
      "choice": {
        "succumb": { "label": "PART THE CURTAIN", "next": "S4" },
        "resist":  { "label": "TRY THE DOOR",     "next": "S4" }
      },
      "transitions": { "S4": "S3_H_TRN_S4.mp4" }
    }
  }
}
```

Note that `next` is `S4` in all four cases. **That is correct and it is the architecture.** The spine never forks. Only the render does. A schema validator should assert that all `next` values within a scene are identical, and fail the build if they are not.

### 4.2 Validator

Ship `validate.js` and run it in CI. It must assert:

1. Every `next` within a scene is identical across all four choice entries
2. Every referenced asset filename exists in `/assets`
3. Every referenced minigame module exists in `/src/minigames`
4. Every scene has exactly one `C` and one `H` branch, except `S0`
5. Every scene reachable from `S0` terminates at the ending resolver
6. Every text key referenced in a scene exists in `/text`

Item 2 is the one that will actually catch things. Filename drift between Doc 2's output and this manifest is the single likeliest source of runtime failure.

---

## 5. RENDERER

### 5.1 Video pool

Two `<video>` elements, `A` and `B`, absolutely positioned, one visible. Never create video elements at runtime. Mobile Safari will not let you.

```js
playScene(branch) {
  const hidden = this.active === this.A ? this.B : this.A;
  hidden.src = `/assets/vid/${branch.video}`;
  hidden.loop = branch.loop;
  hidden.load();
  hidden.addEventListener('canplaythrough', () => {
    hidden.play();
    this.crossfade(hidden, 400);   // ms
  }, { once: true });
}
```

**400ms crossfade, never a cut.** A hard cut reveals the seam between renders. A crossfade reads as the room changing rather than the camera changing.

### 5.2 Fracture overlay

Three layers over the video, all driven by `fracture()`:

| Layer | Implementation | At fracture 0 | At fracture 1 |
|---|---|---|---|
| Texture bleed | The opposite render's `IMG_IN` as a `<div>` background, `mix-blend-mode: soft-light` | opacity 0 | opacity 0.22 |
| Chroma drift | CSS `filter: hue-rotate()` on the video | 0deg | 4deg |
| Anomaly | One low-poly PNG sprite placed at a fixed per-scene coordinate | hidden | visible |

**Cap texture bleed at 0.22.** Above that it reads as a glitch effect, which violates Doc 1, C1 and Doc 2, §4. The smoothness is the horror.

The anomaly sprite for every scene is the same object: a single paper slip reading `99`, lying at the same screen coordinate in both renders. It is the only evidence that the two buildings are one building. See Doc 1, §9.2.

### 5.3 Flipbook fallback

If Kling cannot hold a hard four-step jaw (Doc 2, §5, S2), `flipbook.js` takes four stills and steps them on a fixed interval with `image-rendering: pixelated` and zero interpolation. Build this module regardless. Doc 2, §7 Phase 2 will tell you whether you need it, and you want it ready when it does.

---

## 6. MINI-GAME CONTRACT

> **Amendment, 2026-10-03: retired.** There are no mini-games (removed at the author's request; Doc 3 is retired), so this contract governs nothing. Nothing mounts over a scene, and the choice UI is the room itself: threshold zones the candidate walks to (§14's amendment). `state.js` keeps its single-writer rule, so only `commitChoice()` touches conformance. Friction is written by the director from movement (`src/friction.js`). The leak test and the MG-01 → MG-07 handoff went with the modules. The S0 form (`src/application.js`) still fills `state.formAnswers`, and OPEN THE BOX now shows the box's contents as a caption.

### 6.1 Lifecycle

```
scene video begins looping
  -> minigame.mount(container, stateSnapshot, onComplete)
  -> [player interacts]
  -> onComplete({ friction, dwell, flags })
  -> minigame.unmount()
  -> choice UI fades in
```

The scene video keeps looping underneath the entire time. The mini-game is a DOM layer on top of a living room, not a separate screen. This is what stops the game feeling like a menu.

### 6.2 Interface

```js
export default {
  id: 'MG-05',
  mode: 'C',
  reducedMotion: false,

  mount(container, state, onComplete) { },
  unmount() { }
};
```

### 6.3 Contract enforcement

A mini-game **must not**:
- import `state.js` directly. It receives a read-only snapshot
- modify `conformance` or `dissonance`
- stop, restart, or replace the drone oscillator
- create an `AudioContext`. It requests nodes from `audio.js`
- leave listeners, timers, or audio nodes alive after `unmount()`

**Write a leak test.** Mount and unmount every mini-game 50 times in sequence and assert that `audioContext.destination.numberOfInputs` and the document listener count return to baseline. A leaked oscillator from MG-02 will still be ringing under the ending card, and it will take a long time to find.

### 6.4 The MG-01 to MG-07 handoff

MG-01 writes to `state.formAnswers`. MG-07 mode C reads it to render the intake form inside the package, dated six months before the game's start date.

```js
const submittedAt = new Date();
submittedAt.setMonth(submittedAt.getMonth() - 6);
```

This is the payoff for the ghost-text mechanic (Doc 3, MG-01). Test it explicitly in both states: ghost-accepted answers and player-fought answers. Both must render, and both must carry the same backdated timestamp.

---

## 7. AUDIO

### 7.1 The drone (rule C7)

One `OscillatorNode`, created once when the lobby doors close in S0, never stopped until the game ends.

```js
class Drone {
  start(ctx) {
    this.osc = ctx.createOscillator();
    this.osc.type = 'sine';
    this.osc.frequency.value = 48;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.06;
    this.osc.connect(this.gain).connect(ctx.destination);
    this.osc.start();                    // never stopped
  }
  advanceScene(n) {
    this.osc.detune.linearRampToValueAtTime(
      n * DETUNE_PER_SCENE, this.ctx.currentTime + 8
    );
  }
}
```

By S8 the detune is 32 cents and it beats audibly against the 48 Hz reference in the player's memory of the lobby. This is the whole trick and it costs about twenty lines.

Add a second oscillator at exactly 48 Hz, gain 0.0, starting from scene 5 and ramping to 0.02 by S8, so the beat is literal and physical rather than remembered. Test both versions. The remembered version is subtler. The literal version reliably works.

### 7.2 Bus

```
drone ──────────────────┐
ambience (per scene) ───┼──> master ──> destination
sfx (one-shots) ────────┘
```

Ambience crossfades on scene change over the same 400ms as the video. SFX are fire and forget. **The drone never touches the crossfade.**

### 7.3 Ducking

Mini-games may request a low-pass filter on the drone (MG-07 mode H needs progressive occlusion). `audio.js` exposes:

```js
audio.duckDrone({ lowpassHz: 400, gain: 0.5, ms: 1200 });
audio.restoreDrone({ ms: 800 });
```

Filtering is permitted. Stopping is not.

### 7.4 Autoplay policy

> **Amendment, 2026-10-03.** There is no SUBMIT click to hang audio on any more: the game starts on foot in the apartment.
> - The **first trusted gesture** (a click to look, a key, a touch) calls `audio.unlock()`. That starts the `AudioContext` and the music bus, so room tone and footsteps sound from the apartment on. **The drone does not start there.**
> - `audio.startDrone()` runs once, when the lobby's front glass doors close behind the candidate (`src/director.js`). That is where C7 and §7.1 place it. The oscillator fades in over two seconds and is never stopped or restarted.
>
> There is still no "enable audio" prompt.

Browsers block audio until a user gesture. S0's SUBMIT click is that gesture, and it is diegetic. Initialize the `AudioContext` on that click and nowhere else. If the context is suspended at any later point, resume it silently and log it. Never show an "enable audio" prompt. It would be the only non-diegetic UI in the game.

---

## 8. PRELOADING

A horror game cannot buffer. A spinner between S6 and S7 destroys an hour of work.

### 8.1 Strategy

While scene N plays, prefetch **both branches** of scene N+1, plus both transitions into it. You do not know which render the player will get until they commit.

```js
async function prefetchNext(sceneId) {
  const s = manifest[sceneId];
  await Promise.all([
    fetchAsset(s.branches.C.video),
    fetchAsset(s.branches.H.video),
    fetchAsset(s.branches.C.ambience),
    fetchAsset(s.branches.H.ambience)
  ]);
}
```

Cost: roughly 2x bandwidth. Worth it. Compressed, this is around 40 to 60 MB for an entire run, which is one short YouTube video.

### 8.2 Cold start

S0 must begin within 2 seconds on a median connection. Load order:

1. `S0_X_IMG_IN.png` shown immediately as a still, no loader, no spinner
2. `S0_X_VID.mp4` streams behind it and swaps in when `canplaythrough`
3. Everything else prefetches during the portal interaction, which takes the player at least 20 seconds

The apartment still standing in for the apartment video is invisible to the player. The apartment is nearly static anyway.

### 8.3 Encoding

| Setting | Value |
|---|---|
| Codec | H.264 High, `faststart`, plus a WebM/VP9 fallback |
| Resolution | 1920x1080, downscale to 1280x720 on `devicePixelRatio < 2` |
| Bitrate | 4 Mbps scenes, 6 Mbps transitions |
| Audio in video | **Stripped entirely.** All audio is engine-side (§7) |

Stripping audio from every video file is not optional. It is what makes C7 possible.

---

## 9. THE BAIL-OUT

> **Amendment, 2026-10-03.** Keyboard `Escape` no longer bails. The candidate is always walking, and under pointer lock Escape is the browser's own "release the mouse" key. Two ways out remain, and both still route to PENDING REVIEW (`director.bail()`): the persistent **EXIT** button, a click away once the pointer is released, and the **3-finger, 1200 ms long-press** on touch (§13).

A persistent, low-contrast `ESC` affordance in a fixed corner, present in every scene and every mini-game. Keyboard `Escape`, or a long-press anywhere on touch.

```js
function bail() {
  state.flags.add('EARLY_EXIT');
  router.jumpToEnding('PENDING');
}
```

**Quitting is an ending, not an exit.** The player who leaves is filed as unresolved, which is exactly what PENDING REVIEW means. The accessibility requirement and the narrative are the same feature. Do not build a separate quit screen.

This must work inside every mini-game, including those with hold-to-act mechanics.

---

## 10. BUILD PHASES

Do not build in scene order. Build in the order that surfaces failure cheapest.

**Phase 1, the skeleton.** `state.js`, `router.js`, `scenes.json` with placeholder colored rectangles instead of video. Play all nine scenes end to end with text-only choices. **Verify all three endings are reachable** by scripting the four worked runs in Doc 1, §7.2. No assets required. This should take an afternoon and it de-risks everything.

**Phase 2, audio spine.** `audio.js` and the drone. Walk the skeleton from S0 to the ending and confirm the drone never restarts and detunes continuously. Listen to it. This is the single most important verification in the project and it cannot be automated.

**Phase 3, renderer.** `renderer.js`, video pool, crossfade, preloader. Drop in real assets as Doc 2 delivers them. Fracture overlay last.

**Phase 4, the thesis mini-game.** MG-05 only. If flagging does not feel expensive and futile, stop and revisit before building the other six. (Doc 3, §5.)

**Phase 5, remaining mini-games.** In the order given in Doc 3, §5.

**Phase 6, fracture and polish.** Overlay tuning, anomaly placement, detune curve by ear, crossfade timing by ear.

**Phase 7, endings.** Built last, highest emotional stakes, lowest technical risk.

---

## 11. ACCEPTANCE TESTS

### 11.1 Logic

| Test | Expect |
|---|---|
| Run `SSSSSSSS` | conformance +8, dissonance 0, ASSIMILATION |
| Run `RRRRRRRR` | conformance -8, dissonance 0, EXPULSION |
| Run `SSSRRRRR` | conformance -2, dissonance 1, PENDING |
| Run `SRSRSRSR` | conformance 0, dissonance 7, PENDING, fracture > 0.9 |
| Exhaustive 256-path sweep | Exactly 27 ASSIMILATION, 27 EXPULSION, 202 PENDING |
| Any path with `EARLY_EXIT` | PENDING regardless of score |
| `conformance` after 8 choices | Always even |

The 256-path sweep is a loop over 8 bits. Write it. It takes ten minutes and it proves §7.1 of Doc 1 permanently.

### 11.2 Canon

| Test | Expect |
|---|---|
| Grep all `/text/*.json` for `"you"` outside `endings.json` | Zero results, except the single permitted manager line |
| Every scene has a handless clock in at least one frame | Manual QC per Doc 2, §8 |
| MG-01 field list | Contains no name field |
| Any scene after S0 | No window, no sky, no daylight, no upward motion |

The grep is a real test. Write it as a CI step. Rule C4 is the easiest rule in the project to break by accident and the most expensive to break.

### 11.3 Integrity

| Test | Expect |
|---|---|
| Mount/unmount every mini-game 50x | Listener count and audio node count return to baseline |
| Drone continuity, full playthrough | `osc.start()` called exactly once |
| Manifest validator | All six assertions pass |
| `DEBUG_RESUME` in any deployed build | Build fails |
| Every video file | Contains no audio track |

---

## 12. PERFORMANCE BUDGET

| Metric | Target | Hard ceiling |
|---|---|---|
| Time to first frame | 2s | 4s |
| Scene transition stall | 0ms | 120ms |
| Frame rate, scene + mini-game | 60fps | 30fps |
| Total download, full run | 45 MB | 80 MB |
| Peak memory | 300 MB | 500 MB |

Mobile Safari is the constraint. Test on a four-year-old iPhone before anything else.

---

## 13. MOBILE AND TOUCH

- Lock to landscape. A portrait warning screen is acceptable and should be styled in-world.
- Every mini-game's touch path is specified in Doc 3. It is not a port, it is a parallel spec.
- Long-press is the bail-out. Ensure it does not conflict with MG-02 mode C, MG-05 mode H, MG-06 mode H, or MG-07 mode H, which are all hold-to-act. **Bail-out long-press requires 1200ms and 3+ fingers.** Hold-to-act is single finger.
- `playsinline` on every video element, no exceptions, or iOS takes over the screen.

---

## 14. WHAT NOT TO BUILD

> **Amendment, 2026-10-03.** The rule against non-diegetic buttons now covers the choices too: there are no choice buttons. Each choice is a **diegetic zone** in the room, marked by its words standing over the place to walk to (`src/labels.js`); walking into it is the choice. The only non-diegetic controls left are EXIT and the sound toggle, plus a one-line walk hint that fades after a few seconds.

Explicitly out of scope. Each of these has been considered and rejected.

- **Save/resume.** §3.7. Design decision, not an oversight
- **Settings menu.** The only options are reduced-motion and photosensitivity, and both read from OS `prefers-reduced-motion`. No menu
- **Volume slider.** Use the device volume. A slider is non-diegetic UI in a game with none
- **Any `<button>` that is not diegetic.** Every interactive element is an object in the world. The one exception is the bail-out, and it is deliberately styled as a fire exit sign
- **Achievements, endings gallery, path tracker.** Doc 1, §9.1. Making the endings collectible turns three tragedies into a checklist
- **A tutorial.** The intake form is the tutorial

---

## 15. THE SINGLE POINT OF FAILURE

`scenes.json`.

It is the only artifact that touches all four documents. Doc 1's choices, Doc 2's filenames, Doc 3's module IDs, and this document's router all meet in that file. Everything else can be rebuilt from it.

Version it, validate it in CI, and never let an asset rename happen without the validator running. When something breaks in this project at 2am, it will be a string in `scenes.json` that does not match a filename in `/assets`.
