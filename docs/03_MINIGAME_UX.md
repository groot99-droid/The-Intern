# NINETY-NINE
## Document 3 of 4: Mini-Game UX Specification
### Seven components, eleven modes. Built by Claude Code as ES modules conforming to the contract in Doc 4, §6.

← [[docs/Design Docs|Design Docs]] · implemented in [[ninety-nine/src/minigames/Minigames|ninety-nine/src/minigames/]]

---

## 1. THE GOVERNING PRINCIPLE

**No mini-game can be failed. Every mini-game can only characterize.**

There is no game over, no retry, no score, no win state. Every component ends, always, and the scene proceeds. What differs is *how* it ended and *how long* it took, and those two facts become `friction`.

This is not a difficulty decision. It is the thesis expressed mechanically. A building that lets you fail would be a building that cares what you do. This one does not care. It only records.

### 1.1 What mini-games output

```js
onComplete({
  friction: 0.0 .. 1.0,   // how much the player fought the interface
  dwell:    seconds,      // total time in the component
  flags:    []            // named events, see Doc 1 §2.5
})
```

**Mini-games never modify `conformance`.** Only the binary scene choice does that. Mini-games feed `friction`, which drives `fracture` (Doc 1, §2.3), which drives how damaged the world looks and sounds.

Consequence, and it is the good kind: two players who make the exact same eight choices and reach the exact same ending can experience visibly different buildings. One glides. One claws. Same route, same destination, different weather.

### 1.2 The friction gradient

| friction | Behaviour it represents |
|---|---|
| 0.0 to 0.2 | Did the expected thing immediately, no hesitation |
| 0.2 to 0.5 | Did the expected thing slowly, or explored first |
| 0.5 to 0.8 | Actively tested the boundaries, then complied |
| 0.8 to 1.0 | Fought the interface until it gave up on them |

### 1.3 The rule about time

Every component records `dwell`. Hesitation is legible to the building. A player who sits in the intake form for ninety seconds without typing is producing a reading, and the building is taking it.

Never show a timer. Never show a progress bar. Never show a friction meter. **The player must never know they are being measured.** The only feedback is that the world gets worse, and they will not know why.

---

## 2. COMPONENT INDEX

| ID | Scene | Mode C | Mode H | Core verb |
|---|---|---|---|---|
| MG-01 | S1 | THE INTAKE FORM | *(shared)* | Typing |
| MG-02 | S3 | THE SCAN | THE DOOR | Holding still / Repeating |
| MG-03 | S4 | THE CORRIDOR | THE LABYRINTH | Navigating |
| MG-04 | S5 | THE STAPLER | THE IGNITION | Rhythm / Futility |
| MG-05 | S6 | THE REQUISITION | THE RUN | Processing / Exhaustion |
| MG-06 | S7 | THE PANEL | THE EDGE | Selecting / Leaning |
| MG-07 | S8 | THE HANDOFF | THE BREATH | Carrying / Holding |

---

## MG-01: THE INTAKE FORM
**Scene:** S1, both renders. Runs before the seat/stand choice.
**Verb:** Typing.
**Thesis:** The first thing the building takes from you, you hand over. And it was already written down.

### Interaction

A clipboard form, ten fields (Doc 1, §6.2), one at a time. Photoreal clipboard and paper, low-poly pen cursor. Player types into each field.

**The mechanic:** from field 5 onward, an autocomplete begins. After the player stops typing for 700ms, ghost text appears in grey, completing the field. It is always more specific and more true than what they were writing.

Field 6, player types `a birthday party`. Ghost completes: `a birthday party, and the sound of the car leaving before it was over`.

- **Press Tab or tap the ghost:** accepted. Field locks. Next field. `friction` unchanged.
- **Keep typing:** ghost recedes, reappears 700ms after they stop, slightly more specific each time.
- **Press Backspace through the ghost:** it deletes character by character and reconstitutes from the other end. Each full deletion cycle adds `+0.08 friction`, capped at 3 cycles per field.
- **Leave blank and press Next:** the field fills itself on submit, with the ghost, animated as if typed by someone else at 4 characters per second. `+0.05 friction`. This is the most unsettling outcome and it costs the player almost nothing, which is the joke.

**There is no name field.** Load-bearing for S2-H (Doc 1, §5). Do not add one.

### Completion

All ten fields. Form cannot be abandoned. SUBMIT button is inert until field 10 locks.

`friction` = clamped sum of deletion cycles and blank-fills, plus `+0.15` if `dwell > 120s`.

### Visual
Photoreal paper with real fiber texture and a real drop shadow on the clipboard. Low-poly pen. Field text in a monospace typewriter face. Ghost text at 40% opacity in the *same* face, which is the detail that sells it: the building writes in your handwriting.

### Audio
Pen scratch on each keystroke. Ghost text arrives silently. Field lock is a soft mechanical clack. Nothing else.

### Touch
Native keyboard. Ghost text is a tappable region above the keyboard. Backspace-fighting works identically.

### Accessibility
Full keyboard nav. Screen reader announces ghost text as "suggested completion." Reduced-motion: ghost appears instantly instead of typing in.

---

## MG-02: THE SCAN / THE DOOR
**Scene:** S3.
**Verb:** Holding still (C) / Repeating (H).
**Thesis:** Compliance asks you to do nothing, uncomfortably. Resistance asks you to do everything, pointlessly.

### Mode C: THE SCAN

A red laser slot on a badge reader. The player must hold cursor (or finger) inside a 120px zone for **4.0 continuous seconds**.

A red beam sweeps across the zone. It is unpleasant: sharp, bright, with a rising sine that climbs toward the top of comfortable hearing. Every instinct says pull away.

- Hold 4s clean: `scan.pass`. `friction 0.0`.
- Break and restart: each break `+0.12 friction`. Timer resets to zero every time.
- **After 6 breaks the reader gives up:** `scan.fail` displays, the gate opens anyway, `friction 0.75`. It never needed the scan. It was seeing whether you would sit through it.

That last beat is the entire mini-game.

### Mode H: THE DOOR

The locked glass lobby doors. A push bar. The player can push it as many times as they want. It never opens.

There is no progress and no counter shown. The only feedback is that each push is fractionally quieter than the last, as though the door is losing interest.

- Leave before 10 pushes: `friction 0.2`.
- 10 to 29: handprints accumulate on the glass, one per 5 pushes, matching `S3_H_IMG_OUT`. `friction 0.5`.
- **30+:** sets `COUNTED_DOOR`. The receptionist, from across the lobby, without lifting her head: *"Thirty-one. The candidate is thorough."* She has been counting since the first push. `friction 0.9`.

The exit condition is the player deciding to stop. There is no other one.

### Visual
C: photoreal red laser with real bloom on the photoreal wall, zero bloom on the low-poly reader housing, which makes the reader look pasted into reality without a seam. H: real smeared handprints on real glass, accumulating.

### Audio
C: rising sine, climbing roughly 40 Hz per second of hold, resetting on break. This is the cost. H: a lock mechanism thudding against its strike, quieter each time, plus the total absence of exterior sound through the glass.

### Touch
C: press and hold. Finger leaving the zone counts as a break. H: tap.

### Accessibility
C: keyboard alternative is hold Space. Photosensitivity: static beam instead of sweeping, same audio. **The rising sine is the difficulty, not the visual, so this loses nothing.**

---

## MG-03: THE CORRIDOR / THE LABYRINTH
**Scene:** S4.
**Verb:** Navigating.
**Thesis:** One of these is a hallway. The other is a hallway that has noticed you are looking for the exit.

### Mode C: THE CORRIDOR

Simple first-person forward movement down the cubicle floor. Follow the manager. He maintains a fixed distance ahead on a linear path, never turning, never speeding up.

- Follow directly: arrives in ~20s. `friction 0.0`.
- Wander into the cubicle grid: every cubicle is identical and empty, and the manager waits, without turning around, for as long as it takes. Each 15s of wandering `+0.1 friction`.
- **Look behind you:** the floor you already walked is gone. Just more cubicles. Sets nothing, costs nothing, but it is there for anyone who checks.

### Mode H: THE LABYRINTH

The janitorial corridors. Player navigates freely among identical utility doors.

**The mechanic:** the maze is not fixed. It regenerates based on the player's behaviour.

- Turn consistently left: it stops having left turns.
- Backtrack: the corridor you came from is now a dead end with a mop sink.
- **Stand completely still for 8 seconds: a door opens.** Always. Every time. The only reliable way through the labyrinth is to stop trying to solve it.

`friction` is inverse to how quickly they discover stillness. Found it under 60s: `0.3`. Over 180s of active searching: `0.95`.

Hard timeout at 240s: a door opens on its own. Nobody is trapped in this game. `friction 1.0`.

### Visual
C: the manager's low-poly figure translating on a hard linear path, no walk cycle, exactly as specified in Doc 2, §5 (S4). H: procedurally reassembled corridor segments from a small kit of photoreal pieces, cut on player blind spots, never visibly rearranging.

### Audio
C: two fluorescent ballast hums beating against each other. H: **footsteps that are not the player's.** They do not sync to player movement. When the player stops, they continue for 1.5 seconds and then stop too, always slightly late.

### Touch
Virtual stick, lower left. Tap to interact. Standing still is simply not touching anything, which works better on touch than on desktop.

### Accessibility
Reduced-motion: corridor traversal becomes discrete room-to-room fades instead of continuous movement. Maze logic is identical. Motion sickness: FOV slider, head bob off by default.

---

## MG-04: THE STAPLER / THE IGNITION
**Scene:** S5.
**Verb:** Rhythm (C) / Futility (H).
**Thesis:** Compliance has a tempo, and it is accelerating without telling you. Resistance has no tempo at all.

### Mode C: THE STAPLER

Papers arrive at the desk on a metronome. Player clicks the stapler in time. Photoreal concussive thud on each hit.

Starting tempo: 72 bpm. **It accelerates by 0.4 bpm per staple.** After 40 staples it is at 88 bpm. The player almost certainly will not notice, because it is below the just-noticeable-difference threshold for tempo change. Their body will notice. Their hand will start to feel rushed and they will not be able to say why.

- Stay in rhythm 40 staples: the stack finishes, the monitor wakes on its own. `friction 0.0`.
- Miss beats: papers accumulate. Each miss adds one sheet. `+0.03 friction` each.
- **At 15 accumulated sheets the stack obscures the monitor.** The scene will not proceed. The player must either clear it by stapling in rhythm, or stop entirely.
- **Stop entirely for 10 seconds:** the papers stop arriving. Silence. Then the monitor wakes anyway, behind the stack, and the stack is gone next frame. `friction 0.85`.

### Mode H: THE IGNITION

Four rusted cars. Player can enter any of them and turn the key.

Every ignition does the same thing: click, click, a hopeful half-crank, nothing. Same audio every time? **No.** Each attempt is very slightly closer to catching. Attempt 12 gets a genuine two-cylinder cough. Attempt 13 goes back to clicking.

This is the cruelest thing in the game. It is doing what a slot machine does.

- Fewer than 5 attempts: `friction 0.2`.
- 5 to 19: `friction 0.55`.
- 20+: the fifth car appears in the far bay, matching `S5_H_IMG_OUT`, the same model as the nearest one. Its door is open. Its key is in the ignition. It behaves identically. `friction 0.95`.

Player leaves whenever they choose.

### Visual
C: papers rendered photoreal, stapler low-poly, and the thud is a screen-shake of exactly 2px, which is the only camera shake permitted anywhere in the entire game. H: a low-poly key rotating in three discrete steps, low-poly dash gauges twitching and returning to zero.

### Audio
C: the click track is **inaudible.** The tempo lives only in when the papers land. No metronome. The acceleration must be felt, never heard. H: starter motor sampled at genuine variation, plus the near-miss at attempt 12 which must be a real, specific, hope-shaped sound.

### Touch
C: tap the stapler. H: tap the key.

### Accessibility
C: rhythm tolerance window widens by 60% in an accessibility mode, and the acceleration still happens. The point is not difficulty, it is the unnoticed acceleration, so this costs nothing.

---

## MG-05: THE REQUISITION TERMINAL / THE RUN
**Scene:** S6.
**Verb:** Processing (C) / Exhaustion (H).
**Thesis:** Resistance is available. It is just expensive, and it does not work. This is the most important mini-game in the project.

### Mode C: THE REQUISITION TERMINAL

A scrollable spreadsheet, 18 rows (Doc 1, §6.3), rendered live in-engine over the photoreal monitor bezel. Each row has **ORDER** and **FLAG**.

**ORDER is one click.** Instant. A soft chime. Row greys out. Next.

**FLAG opens a justification field.** The player must type a reason. Then the system rejects it:

> `INSUFFICIENT.`

Try again. Type a longer reason.

> `SEE POLICY 4.4.`

Again.

> `THIS IS NOT A VALID CONCERN.`

Again.

> `THE CANDIDATE HAS RAISED THIS BEFORE.`

The fourth rejection is the one that lands, because they have not raised it before. On the fifth attempt the flag is **accepted**, the row is marked `UNDER REVIEW`, and it stays on the sheet, and at the end of the scene every `UNDER REVIEW` row silently reverts to `ORDERED`.

Flagging works. It takes five times the effort. And it is undone while you are not looking.

Player must process all 18 rows to proceed.

`friction` = `(rows flagged / 18) * 0.9`, plus `+0.1` if any row was flagged more than once after seeing a reversion.

If `SAW_HARLOWE`, row 019 appears in a different typeface reading *whatever is in the box, do not sign for it*. It has no ORDER or FLAG buttons. It cannot be interacted with. It does not block completion. It just sits there.

### Mode H: THE RUN

Hold to run down the garage bay. A stamina value depletes, invisible to the player.

The geometry never changes. Same four cars, same column, same oil stain, recurring on an 8 second cycle. A player who is paying attention will notice they are running past the same stain.

**The bay only ends when stamina reaches zero.** There is no distance to cover. Letting go early recovers stamina, which means resting makes the corridor longer. The only way out is to run until you cannot.

- Ran continuously to depletion: ~45s. `friction 0.3`.
- Rested repeatedly: up to 3 minutes. Each rest extends the run. `friction` up to `0.9`.
- **Never ran at all, just stood still:** after 90 seconds the camera slumps, stamina drains from standing, and the bay ends. `friction 1.0`.

### Visual
C: authentic corrupted-enterprise-software UI. System font, grey gradient buttons, 1px inset borders, a scrollbar that does not match the OS. It must look like real software somebody is required to use. The photoreal screen-glow pass from Doc 2 composites over the top, which is what marries the live UI to the filmed monitor.
H: environment motion blur on the photoreal layer only. The low-poly cars stay razor sharp as they fly past, which is deeply wrong in a way most players will feel without identifying.

### Audio
C: key clicks, a chime per processed row **that detunes downward by 3 cents per row**, so by row 18 it is a semitone flat and sounds sick. Rejections are a flat system error beep.
H: breathing and footfalls, both slowing and deepening. At depletion, ten full seconds of nothing but the drone and the wet room tone of the pool below, before the edge is revealed.

### Touch
C: tap ORDER or FLAG, native keyboard for justification. H: press and hold anywhere.

### Accessibility
C: the justification field accepts any input including a single character. The friction is the repetition, not the typing. H: hold-to-run has a toggle-to-run alternative. Stamina is unaffected.

---

## MG-06: THE PANEL / THE EDGE
**Scene:** S7.
**Verb:** Selecting (C) / Leaning (H).
**Thesis:** The building only permits descent. Both of these prove it.

### Mode C: THE PANEL

66 buttons in a tall grid. One is lit. All 66 are clickable.

- Press the lit one: cab descends. `friction 0.0`.
- **Press any other:** it illuminates for 0.8 seconds and dies. No sound. No response. Each unlit press `+0.04 friction`.
- Press all 65 unlit buttons: the panel goes fully dark for two seconds, then only the original button relights. `friction 0.9`.
- Press nothing for 25 seconds: `elevator.refuse` appears on the floor indicator and the cab descends with the doors still open. `friction 0.6`.

The floor indicator counts down through B1, B2, B7, B12, and a character that is not a number. Players who count will notice floors are missing. Nothing rewards noticing.

### Mode H: THE EDGE

Hold to lean over the concrete edge. Leaning reveals more of the pool. It also crumbles the ledge.

A visible crack propagates along the concrete as a real, photoreal fracture. It is honest: the ledge really is failing, and the game really is telling you.

- Lean past 60%: the blue grate light becomes visible far below. This is the information that makes the S8 dive choice meaningful, and it is gated behind risk.
- Lean past 85%: the ledge fails and the player falls regardless of intent. `friction 0.4`.
- **Turn back at any point:** the garage behind is gone. There is only the ledge, narrower now. Turning back again narrows it further. After three attempts there is nowhere to stand and they fall. `friction 0.95`.

### Visual
C: low-poly buttons, photoreal illumination bleeding onto the photoreal steel panel surround. The illumination is real light on real metal reflected from a fake button, which is C1 working exactly as intended. H: real concrete fracture propagation, real falling grains that fall too long.

### Audio
C: a real mechanical detent per press. Unlit presses have **no sound at all**, which is far worse than an error tone. H: concrete stress, grain clatter with a delay that does not match the drop, and the enormous tiled reverb of the space below.

### Touch
C: tap. H: press and hold to lean, release to straighten.

### Accessibility
Both modes have a keyboard path. H offers a reduced-motion mode where leaning is a discrete three-stage reveal rather than continuous tilt.

---

## MG-07: THE HANDOFF / THE BREATH
**Scene:** S8.
**Verb:** Carrying (C) / Holding (H).
**Thesis:** The last thing the building asks is whether you will hold something unbearable without putting it down.

### Mode C: THE HANDOFF

Carry the package across the boardroom to the glass table. It pulses. A stability value responds to movement speed.

- Walk slowly and steadily: arrives intact, `friction 0.0`. The pulse stays regular.
- Move fast: the pulse becomes irregular and the wet stain spreads through the low-poly box geometry in real time.
- **Stop and stand still for more than 5 seconds:** the pulse syncs to the drone. Exactly. And stays synced. `+0.3 friction`, and once heard it cannot be unheard.
- **OPEN THE BOX** is available the entire time, in the corner of the screen, never highlighted, never prompted. Taking it sets `OPENED_BOX` and forces -1 on the final choice (Doc 1, §2.5). Inside is the intake form from MG-01, in the player's own entered text, dated six months ago.

Seeing your own MG-01 answers here is the payoff for the ghost-text mechanic an hour earlier. If the player let the ghost fill the fields, the form is in the building's words. If they fought it, it is in theirs. **Both are already dated six months ago.**

### Mode H: THE BREATH

Hold to descend toward the grate. An air value depletes. No meter is shown.

Feedback is entirely diegetic: the drone becomes progressively more occluded, the heartbeat rises, and the photoreal caustics from the surface above dim as depth increases.

- Release: you surface. You lose all depth. The grate is as far away as when you started.
- Hold to the grate: it opens, the chute takes you, `friction 0.2`.
- **Release three or more times:** each surfacing is slower than the last, and the surface is further away than it should be. `friction 0.85`.
- Air reaches zero without reaching the grate: you do not drown. The current simply carries you down into the chute anyway. `friction 0.6`.

Nobody drowns. Nobody dies. The building does not kill people, it files them.

### Visual
C: the wet stain spreading across the photoreal glass table under a low-poly box is the single best C1 image in the game. Get it right. H: real caustic attenuation with depth, low-poly hands fixed in one unchanging pose throughout, which is what makes the descent feel like being lowered rather than swimming.

### Audio
C: the pulse. Arrhythmic, wet, organic, and it syncs to the drone if the player stands still. **This is the only moment where the building's sound and a physical object's sound become the same sound.**
H: progressive low-pass occlusion of everything, heartbeat, pressure, and at the grate, a hinge that sounds like it has not moved in a very long time.

### Touch
C: drag to move. Tap OPEN THE BOX. H: press and hold to descend.

### Accessibility
C: movement speed can be set to a fixed slow value, removing the stability mechanic. The box option remains. H: hold-to-descend has a toggle alternative. Air depletion is unchanged.

---

## 4. IMPLEMENTATION CONTRACT

All components are ES modules conforming to Doc 4, §6.2:

```js
export default {
  id: 'MG-05',
  mode: 'C',
  mount(container, state, onComplete) { },
  unmount() { },
  reducedMotion: false
}
```

### Rules that apply to every component without exception

1. **No fail state.** Every component has a guaranteed exit. Hard timeouts where listed.
2. **No visible measurement.** No timers, no meters, no scores, no progress bars. Diegetic feedback only.
3. **The drone is never interrupted.** Components may filter, duck, or occlude it. They may never stop or restart it. (Doc 1, C7; Doc 4, §7.1.)
4. **Unmount is clean.** Every listener removed, every timer cleared, every audio node disconnected. A leaked oscillator from MG-02 will still be audible in the ending.
5. **Reduced-motion has full parity.** The reduced-motion path must produce identical `friction` outcomes. Accessibility never changes the reading the building takes.
6. **Every component is escapable.** The global bail-out (Doc 4, §9) works inside every mini-game and resolves to PENDING REVIEW.

---

## 5. BUILD ORDER

Do not build in scene order. Build in proof order.

| Order | Component | Why first |
|---|---|---|
| 1 | MG-05 THE REQUISITION | Proves the thesis. If flagging does not feel expensive and futile, the design is wrong and you want to know before building six more |
| 2 | MG-01 THE INTAKE FORM | Ghost-text is the most novel mechanic and pays off in MG-07. Build the setup and the payoff early |
| 3 | MG-07 THE HANDOFF | The payoff. Verify the MG-01 to MG-07 data handoff works end to end |
| 4 | MG-04 THE STAPLER | Tests whether sub-threshold tempo acceleration is actually felt. If playtesters do not feel it, the mechanic is invisible and needs revisiting |
| 5 | MG-02 THE SCAN | Simple. Good palate cleanser |
| 6 | MG-06 THE PANEL | Simple |
| 7 | MG-03 THE CORRIDOR | Procedural maze is the highest engineering cost and the lowest thesis risk. Last |

---

## 6. OPEN UX QUESTIONS

**6.1 Is MG-04's acceleration too subtle to exist?**
0.4 bpm per staple is deliberately below the just-noticeable-difference threshold. The intent is bodily unease with no conscious cause. The risk is it does nothing at all and you have built an invisible feature. Playtest this specifically: ask testers whether the stapling felt rushed, without mentioning tempo.

**6.2 Does MG-05's reversion need to be witnessable?**
Currently `UNDER REVIEW` rows revert to `ORDERED` at scene end, off-screen. There is a crueler version where one row reverts on-screen while the player is working three rows below it, in peripheral vision. That is more devastating and significantly more likely to be missed entirely. Pick one.

**6.3 MG-03's stillness solution is undiscoverable by design. Is that acceptable?**
The 240s timeout guarantees nobody is trapped, but a player who never stands still never learns the rule and just experiences a maze that eventually gave up. That may be fine. It may also mean the best idea in the component is invisible to 90% of players.

**6.4 Should MG-02's rising sine have an upper bound?**
Currently it climbs 40 Hz per second of hold. Over four seconds that is a meaningful and genuinely unpleasant climb. It should be capped well below anything painful, and that cap needs to be set by ear, on real hardware, not by a number in this document.
