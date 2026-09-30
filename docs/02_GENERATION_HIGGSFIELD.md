# NINETY-NINE
## Document 2 of 4: Generation Pipeline
### For Higgsfield (stills) and Kling (motion + audio). Derived from Doc 1. Output filenames are consumed directly by Doc 4.

← [[docs/Design Docs|Design Docs]] · see also [[ninety-nine/assets/Generated Assets|generated assets]] and [[blender/Blender Pipeline|the parallel Blender pipeline]]

---

## 1. NAMING CONVENTION (NON-NEGOTIABLE)

Every file produced by this pipeline must be named exactly per this scheme. Doc 4's asset manifest does a literal string match. A file named `S3_C_imgin.png` will not load.

```
S{n}_{R}_{TYPE}[_{TARGET}].{ext}

n      = 0-8 for scenes, E for endings
R      = C (compliant) | H (hostile) | X (no branch, S0 only)
TYPE   = IMG_IN | IMG_OUT | VID | TRN | AMB | SFX
TARGET = destination scene, transitions only
```

**Examples**
```
S0_X_IMG_IN.png          apartment, first frame
S3_C_IMG_OUT.png         curtain, last frame
S3_C_VID.mp4             the curtain sequence
S3_C_TRN_S4.mp4          curtain to cubicle floor
SE_ASSIM_VID.mp4         assimilation ending
S6_H_AMB.wav             garage ambience stem
```

**Directory**
```
/assets
  /img    all IMG_IN and IMG_OUT
  /vid    all VID and TRN
  /aud    all AMB and SFX
```

---

## 2. THE CORE TECHNIQUE

Kling supports a **start frame and an end frame**. This is the entire pipeline.

1. Higgsfield generates `IMG_IN` (first frame) and `IMG_OUT` (last frame) for a scene.
2. Both go into Kling as start and end frame with the motion prompt from §5.
3. Kling interpolates the motion between two images you have already art-directed.

This is why the whole thing holds together visually: **you are not asking a video model to invent the aesthetic eighteen separate times.** You are asking it to travel between two images you already approved.

### 2.1 The looping trick

For any scene that idles while the player decides (S1, S4, S7 compliant), use **the same image as both start and end frame**. Kling will produce a clip that returns to its origin, which loops seamlessly with no crossfade. Use this for every scene that waits on player input. It is the difference between a scene that breathes and a scene that stutters every five seconds.

### 2.2 The single biggest risk

**Kling will try to smooth everything toward photoreal.** It is trained to make things look real. It will quietly add polygons to your PS1 models, soften vertex snapping, and anti-alias your affine texture warping. By clip 12 you will have a photoreal game with slightly cheap-looking furniture, which is not the same thing at all and is much less interesting.

Three mitigations, apply all three:

1. **Lock it in the stills.** Get the low-poly elements aggressively, almost cartoonishly blocky in Higgsfield. Overshoot. Kling will soften it back toward correct.
2. **Minimize low-poly motion.** Low-poly objects should be static or move on hard linear paths. The photoreal layer carries the motion: fog drift, light flicker, water, dust, camera dolly. Never ask Kling to animate a low-poly character walking, it will fail or it will smooth. NPCs animate via a 4-frame jaw loop composited in the engine (Doc 4, §6.4), not in Kling.
3. **Negative prompt every clip.** §4.2 is mandatory on every generation, no exceptions.

---

## 3. GLOBAL STYLE BLOCK

Prepend to **every** Higgsfield image prompt. Do not paraphrase it per scene. Consistency across 80 stills comes from this block being byte-identical every time.

```
STYLE: Liminal corporate horror. Two rendering layers coexist in one
continuous photograph with shared, physically correct lighting.

PHOTOREAL LAYER (architecture and matter): floors, walls, concrete, glass,
marble, water, fog, fabric of the building, all light and shadow. Shot on
35mm, natural falloff, fine film grain, shallow ambient occlusion,
no stylization, no grade.

LOW-POLY LAYER (anything the company owns): all human figures, furniture,
vehicles, signage, handheld objects, clothing, paper. 1996 PlayStation
aesthetic. Under 500 triangles per model. 128x128 textures, affine texture
warping, visible vertex snapping, no anti-aliasing, flat vertex lighting.

The two layers share one light source and cast into each other correctly.
No compositing seams. No glitch effects. No visible boundary between layers.

COMPOSITION: eye level, 35mm lens, static or very slow dolly. Empty of
people unless specified. Every shadow in frame falls inward toward the
center of the building.
```

---

## 4. NEGATIVE PROMPTS

### 4.1 Stills (Higgsfield)
```
glitch, datamosh, VHS, scanlines, chromatic aberration, film burn, light
leak, lens flare, bloom, HDR, neon, cyberpunk, text overlay, watermark,
signature, UI elements, crowds, groups of people, blood, gore, anime,
cartoon, cel shading, illustration, painterly, windows, daylight, sky,
sunbeams, clean modern minimalism, stock photo lighting
```

### 4.2 Motion (Kling), mandatory on every clip
```
smoothing low-poly geometry, anti-aliasing, subdivision, adding detail to
low-poly models, photorealistic characters, realistic human faces, facial
animation, blinking, walking characters, character locomotion, glitch
transitions, datamosh, camera shake, whip pan, zoom burst, morph, warping
architecture, text, subtitles, watermark, sky, windows, daylight
```

---

## 5. PROMPT LIBRARY

Format per scene: **IMG_IN**, **IMG_OUT**, **KLING MOTION**, **AUDIO**.
`[GLOBAL]` means paste the §3 block first.

---

### S0: THE UPLOAD (no branch)

**S0_X_IMG_IN.png**
```
[GLOBAL]
A small dim apartment at night, lit only by one CRT monitor. Photoreal:
the desk surface, the wall, the carpet, the monitor glow spilling across
everything, dust in the air. Low-poly: a pair of male hands resting on a
keyboard, blocky, four-fingered, untextured skin, and the keyboard itself,
and a coffee mug. The monitor displays a crude 1998 web page, grey
background, Times New Roman, a broken image icon. Over-shoulder framing,
the man's body unseen. 3am quality of light.
```

**S0_X_IMG_OUT.png**
```
[GLOBAL]
Dawn. An empty city street seen from the base of a tower. Photoreal:
asphalt, brick facades, wet gutters, low orange sun, long shadows, haze.
Low-poly: parked cars, street signs, a traffic light, a newspaper box,
all blocky with warped textures. Directly ahead, one enormous photoreal
office tower with no visible top, extending out of frame. Every shadow in
the image, from every object, points toward the base of that tower,
including shadows that should point away from it. No people. No birds.
```

**KLING**
```
Slow forward dolly toward the tower over 8 seconds. Long shadows creep
almost imperceptibly further inward. Faint haze drifts. Parked cars and
signs remain perfectly static, no jitter, no rotation, no added detail.
Sun does not rise further. Ends holding on the tower base.
```

**AUDIO** `S0_X_AMB.wav`. Apartment: pure room tone, a CRT's 15.7 kHz whine, nothing else. On cut to street: distant traffic that never resolves into a specific vehicle. On the final frame, the 48 Hz drone fades in over 2 seconds and does not stop for the rest of the game.

---

### S1: THE WAITING ROOM

**S1_C_IMG_IN.png**
```
[GLOBAL]
A corporate waiting room. Photoreal: deep polished marble floor with a
wet mirror finish, plaster walls, recessed ceiling light, a pane of
reception glass. Low-poly: eight identical chairs in two perfect rows,
blocky, one flat maroon texture; a ticket dispenser; a wall clock with a
face and no hands; a seated female receptionist behind the glass, head
down, blocky, blurred face texture. Inlaid in the marble at center, a
brass monogram of an interlocked V and A that reads on second look as a
serpent swallowing a lion. Cool even light. Perfectly still.
```

**S1_C_IMG_OUT.png**: Identical framing and content. Use for seamless loop (§2.1). Regenerate only if IMG_IN has an artifact worth escaping.

**S1_H_IMG_IN.png**
```
[GLOBAL]
The same corporate waiting room, over-exposed toward blowout. Photoreal:
the same marble, now reflecting a coffered ceiling that is not present in
the room; the plaster walls; harsh blown ceiling light. Low-poly: the same
eight chairs, now scattered at wrong angles as if vacated at speed, two
overturned; the same ticket dispenser, actively extruding a continuous
ribbon of paper slips; a growing pile of slips on the floor, each printed
99. The handless clock. The receptionist behind the glass, head down,
unchanged and unbothered. Light two stops too hot.
```

**S1_H_IMG_OUT.png**: Same, with a significantly larger slip pile, several slips having drifted to the foreground.

**KLING (C)**
```
Static camera, 5 second loop. The only motion is a slow drift of dust in
the ceiling light and a nearly imperceptible tick of reflected light on
the marble. Chairs absolutely static. Receptionist absolutely static, no
breathing, no blinking, no head movement. Returns exactly to first frame.
```

**KLING (H)**
```
Static camera, 8 seconds. The ticket dispenser continuously extrudes paper
slips which fall and accumulate. Overhead light pulses irregularly, roughly
every 2.5 seconds, never rhythmically. Chairs static. Receptionist static.
No camera movement at all.
```

**AUDIO** `S1_C_AMB.wav` eight bars of degraded Muzak on loop, sourced as if through a ceiling speaker, plus HVAC. `S1_H_AMB.wav` the same Muzak at 80% speed and pitch, plus the ratcheting of the dispenser, plus paper falling.

---

### S2: THE CALL

**S2_C_IMG_IN.png**
```
[GLOBAL]
Tight on the reception glass. Photoreal: the glass, fingerprints on it,
the plaster wall behind, a small ceiling speaker grille. Low-poly: the
receptionist in three-quarter view behind the glass, head tilted down at a
desk, blocky, flat texture, face blurred to unreadability, mouth closed.
Shallow depth of field on the photoreal layer only.
```

**S2_C_IMG_OUT.png**: Identical, except her jaw is dropped open one notch. Nothing else in the frame has changed. Not the eyes. Not the head angle.

**S2_H_IMG_IN / OUT**: Same pair, lit harsher, and the speaker grille in sharper focus than she is.

**KLING**
```
Static camera, 3 seconds. The jaw moves between the two frames in exactly
four discrete steps, snapping, no interpolation, no ease. Everything else
in frame is frozen. Do not animate the eyes. Do not animate the head. Do
not add breathing.
```
If Kling smooths the jaw, generate 4 stills and flipbook them in-engine instead (Doc 4, §6.4). This is the likeliest clip in the game to need that fallback.

**AUDIO** speaker click, brief hiss, then the line. Compliant: "Ninety-nine," flat, warm, unhurried. Hostile: "Shaun," identical delivery, which is the problem.

---

### S3: THE THRESHOLD

**S3_C_IMG_IN.png**
```
[GLOBAL]
A short corridor ending in a heavy red velvet curtain. Photoreal: the
curtain fabric with real weight and fold detail, the corridor walls, the
carpet, the light from an illuminated sign. Low-poly: a wall-mounted badge
reader with a red laser slot, and a mounted sign above the curtain reading
ENTER in green, blocky housing with a crisp photoreal glow. The curtain
moves very slightly although the air is still. Warm green cast on the
near wall.
```

**S3_C_IMG_OUT.png**: Curtain parted six inches. Behind it, pure black, no detail resolvable. Green sign mid-flicker, dimmer.

**S3_H_IMG_IN.png**
```
[GLOBAL]
Interior view of a building lobby's glass entrance doors, from inside.
Photoreal: the glass, the aluminium frame, the polished floor, the light.
Low-poly: a push bar, a small signage plate. Through the glass: the same
dawn street from earlier, the same buildings and low-poly parked cars,
but with no sun, flat grey light, and no shadows whatsoever cast by any
object outside. The interior side has normal shadows. The exterior has
none. Doors closed.
```

**S3_H_IMG_OUT.png**: Same, plus a smeared handprint on the glass at chest height, and one more further left, and one further left again.

**KLING (C)**
```
Static camera, 6 seconds. Curtain parts from closed to six inches with
real fabric weight. Green sign flickers on a 2.3 second cycle throughout.
Dust visible in the green light. No camera movement.
```

**KLING (H)**
```
Static camera, 6 seconds. Handprints appear on the glass one at a time,
three total, each fading in over half a second. Nothing outside the glass
moves at any point, no wind, no light change, nothing. Interior light is
steady. No camera movement.
```

**AUDIO** compliant: sign ballast buzz at the flicker rate, heavy fabric. Hostile: the push bar rattling against a lock, dead outside air with zero reverb, then the receptionist's violation line arriving with full lobby reverb from behind camera.

---

### S4: THE FLOOR

**S4_C_IMG_IN.png**
```
[GLOBAL]
An open plan cubicle floor extending beyond the limits of the frame.
Photoreal: drop ceiling, fluorescent troffers, the real quality of
fluorescent light including its slight green cast, carpet tile, dust in
the air, a distant wall lost in light haze. Low-poly: every cubicle
partition, desk, chair and monitor, identical, blocky, one repeated warped
texture, arranged in a perfect grid. All cubicles empty. Centre frame,
middle distance, one standing male figure in a suit, low-poly, tie modeled
as four flat polygons, face texture blurred beyond reading, holding a
stack of papers rendered in sharp photoreal detail.
```

**S4_C_IMG_OUT.png**: The figure now close to camera, papers extended toward lens. Papers still photoreal and now the sharpest thing in frame.

**S4_H_IMG_IN.png**
```
[GLOBAL]
A janitorial service corridor. Photoreal: wet sealed concrete floor, a
floor drain, cinderblock walls in institutional beige, a mop sink, a
single caged bulb, real moisture on surfaces. Low-poly: a row of identical
utility doors receding down the corridor, a mop bucket, a hand truck.
The corridor's vanishing point sits further away than the architecture
supports. At the very end of the corridor, very small, one standing male
figure in a suit, facing away.
```

**S4_H_IMG_OUT.png**: Identical corridor. Same figure, same size, same position, despite the camera having moved closer. The doors are nearer. He is not.

**KLING (C)**
```
Slow 3 second dolly forward. The low-poly figure translates toward camera
on a hard linear path with no gait, no bob, no arm swing, no walk cycle.
Fluorescent tubes flicker on two independent irregular cycles. Dust drifts.
Do not animate the figure's legs. Do not add a walk.
```

**KLING (H)**
```
Slow 6 second dolly forward down the corridor. Doors and sink grow as the
camera advances. The distant figure does not change size and does not
change position in frame. Caged bulb steady. Faint steam from the floor
drain.
```

**AUDIO** compliant: fluorescent ballast hum at two beating frequencies, deadened carpet room tone, paper. Hostile: dripping with a long tiled reverb, a distant industrial fan, footsteps that are not yours and do not sync with your movement.

---

### S5: THE DESK / THE GARAGE

**S5_C_IMG_IN.png**
```
[GLOBAL]
One desk alone in the centre of a dark open floor, lit by a single
overhead troffer that illuminates nothing beyond a four metre radius.
Photoreal: the pool of light, the darkness at its edge, carpet tile, dust.
Low-poly: the desk, a dark CRT monitor, a heavy stapler, a chair, and a
stack of papers. Framed from the chair's position, first person, with
low-poly hands resting at the desk edge.
```

**S5_C_IMG_OUT.png**: Same, monitor now on, screen glow photoreal and spilling onto the low-poly desk correctly. Screen content illegible at this distance.

**S5_H_IMG_IN.png**
```
[GLOBAL]
An underground parking garage, mostly empty. Photoreal: raw concrete
columns, sodium vapour lighting with its true orange spectrum, oil stains,
painted bay lines worn through, a real haze of exhaust that has nowhere to
go. Low-poly: four rusted vehicles, no two the same model, spanning
different decades, blocky, heavily warped rust textures, two with doors
ajar. A concrete ramp descends out of frame. No exit signage.
```

**S5_H_IMG_OUT.png**: Same, camera lower and nearer the ground as if seated on a curb. One additional vehicle now present that was not in the first frame, in the far bay, and it is the same model as the nearest one.

**KLING (C)**
```
Static camera, 4 seconds. The monitor wakes: black to a dim glow over
0.4 seconds, hard, no fade curve, like a CRT. Screen light spills across
the desk surface and the hands. Dust in the troffer beam. Nothing else
moves.
```

**KLING (H)**
```
Static camera, 7 seconds. Sodium lights buzz and one at the far end
strobes irregularly. Exhaust haze drifts slowly left to right. Vehicles
perfectly static. The additional far vehicle is present throughout, do not
fade it in.
```

**AUDIO** compliant: the stapler's concussive photoreal thud, CRT degauss thunk and the whine settling in, carpeted deadness. Hostile: sodium ballast buzz, deep concrete reverb, a distant car alarm that stops mid-cycle and does not resume.

---

### S6: THE REQUISITION / THE RUN

**S6_C_IMG_IN / OUT**: Screen content is rendered live in-engine (Doc 3, MG-05). Generate only the surround: a photoreal monitor bezel and desk edge with a keyed green screen area for the live UI, plus a photoreal screen-glow pass to composite over the interface.

**S6_H_IMG_IN.png**
```
[GLOBAL]
First person, running perspective, low in a parking garage, motion
oriented down a long bay between columns. Photoreal: concrete, sodium
light, haze, motion blur on the environment only. Low-poly: parked
vehicles either side, columns' painted numbers, and two blocky hands
entering frame at the lower edge. The bay recedes to a vanishing point
that never arrives.
```

**S6_H_IMG_OUT.png**
```
[GLOBAL]
The same garage bay, now ending abruptly one metre ahead at a raw broken
concrete edge with exposed rebar. Beyond and below the edge: an enormous
photoreal indoor pool, perfectly still water to the horizon, white tiled
pillars rising out of it in a grid, no ceiling visible, no far wall. Warm
humid light with no source. The garage above is dry and orange. The pool
below is pale and blue.
```

**KLING (H)**
```
12 seconds. Forward running motion through the bay for the first 9 seconds
with environment motion blur, the same columns and vehicles recurring
without variation. At 9 seconds the motion decelerates hard to a stop at
the concrete edge. Camera tips forward slightly to reveal the pool below.
Water perfectly still, zero ripple, zero caustic movement.
```

**AUDIO** compliant: CRT whine, key clicks, a soft acknowledgment chime after each processed row, gradually detuning. Hostile: breathing over concrete reverb, footfalls, both getting heavier and slower, then stopping, then nine seconds of nothing but the drone and the room tone of a very large wet space.

---

### S7: THE DESCENT

**S7_C_IMG_IN.png**
```
[GLOBAL]
Interior of an old freight elevator, doors open onto a dark corridor.
Photoreal: quilted steel wall padding, corroded diamond plate floor,
a caged ceiling bulb, real rust, real grease, real dents. Low-poly: the
control panel and its 66 buttons in a tall grid with exactly one lit, a
scissor gate, a floor indicator with a segmented display. Claustrophobic
framing.
```

**S7_C_IMG_OUT.png**: Same interior, scissor gate closed, doors closed, indicator reading a character that is not a number.

**S7_H_IMG_IN.png**
```
[GLOBAL]
Standing at the broken concrete edge above the infinite pool. Photoreal:
the concrete, the rebar, the pool below, the tiled pillars receding to
horizon, still water, humid sourceless light, the real optical clarity of
deep chlorinated water. Low-poly: two blocky hands at the lower frame edge,
and a section of bent guard rail. Looking down at a steep angle.
```

**S7_H_IMG_OUT.png**: Steeper angle, more pool, less concrete. Deep below the surface and only now visible, a rusted floor grate glowing sick blue.

**KLING (C)**
```
6 seconds. Scissor gate draws closed, then the outer doors close with
weight. Caged bulb swings a few centimetres from the impact and settles.
Floor indicator steps through B1, B2, B7, B12 at uneven intervals. Camera
does not move. Cab does not shake.
```

**KLING (H)**
```
6 seconds. Slow forward tip of the camera toward the water as if leaning.
A few grains of concrete detach from the edge and fall, and they fall for
noticeably too long. The blue grate light becomes visible in the last two
seconds. Water surface remains absolutely flat throughout.
```

**AUDIO** compliant: a genuinely painful metal tearing screech on door close, then cable strain, then a descent that is far too smooth for a cab that sounds like that. Hostile: humid room tone with enormous tiled reverb, a single drip that never lands, concrete grains clattering long after they should have stopped.

---

### S8: THE DELIVERY / THE DIVE

**S8_C_IMG_IN.png**
```
[GLOBAL]
An enormous mailroom warehouse. Photoreal: concrete floor, high bay
lighting with real falloff, genuine volumetric fog swallowing the far end,
a laminate counter surface with a dark wet ring on it. Low-poly: towers of
cardboard boxes stacked in a grid receding into the fog, a counter, and a
clerk behind it whose face is a smeared unreadable texture map. On the
counter, one soggy dark-stained package, low-poly box geometry with a
photoreal wet stain spreading through it.
```

**S8_C_IMG_OUT.png**
```
[GLOBAL]
A pristine executive boardroom. Photoreal: a vast glass table with real
refraction and reflection, marble, recessed lighting, a real sense of
expensive air. Low-poly: twelve seated figures in dark suits around the
table, all blocky, all faceless, all identical posture, and one empty
blocky chair nearest camera. The soggy package sits at the centre of the
glass table, its wet stain spreading across the photoreal glass.
```

**S8_H_IMG_IN.png**
```
[GLOBAL]
Underwater, mid-depth. Photoreal: the water itself, real caustics from a
surface far above, suspended particulate, true blue-green attenuation with
depth, tiled pillars descending past the frame. Low-poly: two blocky
hands in the near field, fingers fixed in one pose. Far below, a rusted
floor grate backlit with sick blue light.
```

**S8_H_IMG_OUT.png**
```
[GLOBAL]
Interior of an empty convenience store at midnight. Photoreal: waxed
linoleum with genuine specular sheen, fluorescent ceiling light, the front
glass storefront, the black street beyond it. Low-poly: shelving units,
product boxes, a chest cooler, a counter, a register. Reflected in the
storefront glass at centre frame, at standing height, a faceless cluster
of untextured polygons roughly where a person's reflection should be.
```

**KLING (C, mailroom)**
```
5 seconds. The package is slid across the counter toward camera. Fog
drifts at the far end of the warehouse. The wet ring on the counter
spreads by a few millimetres. Clerk absolutely static, no head turn, no
arm animation beyond the package's linear slide.
```

**KLING (C, boardroom)**
```
8 seconds. Very slow dolly back from the table. Twelve seated figures
absolutely static, no breathing, no head turns. The stain under the
package spreads visibly across the glass. Recessed lighting steady.
```

**KLING (H, dive)**
```
8 seconds. Descending motion toward the grate. Caustics move across the
pillars. Particulate drifts upward past camera. The blue grate light grows.
The low-poly hands remain in one fixed pose, do not animate the fingers,
do not add swimming motion.
```

**KLING (H, store)**
```
6 seconds. Static camera on the storefront glass. Fluorescent tube above
flickers twice, irregularly. The polygon cluster in the reflection is
present from the first frame, does not fade in, and does not move. Nothing
outside the glass moves.
```

**AUDIO** compliant: warehouse reverb with a fog-deadened top end, the wet drag of the package, a faint arrhythmic pulse from inside it. Boardroom: near-total silence, real HVAC, twelve people not breathing. Hostile: full underwater occlusion of the drone, pressure, one's own heartbeat, then the chute's dry concrete scrape, then convenience store fluorescent hum tuned to exactly 48 Hz and detuned exactly as far as the building's drone.

---

### ENDINGS

**SE_ASSIM_IMG_IN / OUT**: Boardroom, camera pulling back, resolving on his own face which is now the blurred texture map. Final frame includes the empty chair with a slip reading 100.

**SE_EXPUL_IMG_IN / OUT**: Convenience store, pushing toward the glass, the reflection resolving to polygons. Final frame: the door open outward, photoreal street, nothing rendering in the doorway.

**SE_PEND_IMG_IN / OUT**: The S1 waiting room from a seated position, slip reading 99 held in low-poly hands. Final frame: an empty chair opposite, recently vacated, and the curtain at the far end still swinging.

All three end on a 4 second hold with no motion whatsoever before the card.

---

## 6. AUDIO ARCHITECTURE

**Do not use Kling's generated audio.** Mute every clip on export. Kling audio restarts at every clip boundary, and rule C7 requires one unbroken drone from the lobby doors to the final card. The drone is a single engine-side oscillator (Doc 4, §7.1), not an asset.

Generate or source per scene:

| Stem | Purpose | Notes |
|---|---|---|
| `S{n}_{R}_AMB.wav` | Scene ambience bed | Seamless loop, 30s minimum, no transients at the loop point |
| `S{n}_{R}_SFX_*.wav` | One-shots | Triggered by engine events, never baked into video |

The drone is generated in the Web Audio API and detunes continuously. It is never a file.

---

## 7. PRODUCTION ORDER

Do not generate in scene order. Generate in risk order, so failures surface while they are still cheap.

**Phase 1, aesthetic lock.** `S1_C_IMG_IN` and `S1_H_IMG_IN` only. Iterate until the two-layer look is exactly right. Everything else inherits from these two frames. Do not proceed until they are approved.

**Phase 2, hardest motion test.** `S2_C_VID` (the four-frame jaw) and `S4_C_VID` (low-poly figure translating without a walk cycle). These are the two clips most likely to fail. If they fail, the flipbook fallback becomes the standard approach for all character motion and the schedule changes. Find this out now, not at clip 30.

**Phase 3, all stills.** All 80 IMG_IN and IMG_OUT, both renders, both branches. Approve as a set, side by side, not individually. Drift is invisible one at a time.

**Phase 4, all scene videos.** 16 base clips.

**Phase 5, transitions.** 19 clips. Generated last because they inherit both endpoints.

**Phase 6, audio beds.** 18 stems.

**Phase 7, endings.** Highest emotional stakes, lowest technical risk. Last.

---

## 8. QC CHECKLIST

Every asset passes all nine before it enters `/assets`. One failure means regenerate, not adjust in post.

1. **C1 layer test.** Is every company-owned object low-poly and every building surface photoreal? Any object in the wrong layer fails.
2. **C2 shadow test.** Do all shadows fall toward the building core?
3. **C3 window test.** Is there any window, sky, daylight, or upward movement after S0?
4. **C5 blink test.** Does any character blink, breathe, or raise their head?
5. **Seam test.** Is there a visible boundary, halo, or compositing edge between the two layers? There must not be.
6. **Glitch test.** Any chromatic aberration, datamosh, scanlines, or VHS artifacting? The contrast is smooth. Reject on sight.
7. **Text test.** Any generated text in frame? All text is engine-rendered from `/text/*.json` (Doc 1, §6). Generated text will be misspelled and will not match the string library.
8. **Loop test.** For looping scenes, does the last frame match the first with no crossfade?
9. **Filename test.** Does it match §1 exactly, including case?
