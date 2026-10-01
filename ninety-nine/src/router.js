// Doc 4 §4/§10 Phase 1: the spine walker. The sequence never forks -- only
// the render does (Doc 1 §1.2). This module owns scene sequencing, mini-game
// mount lifecycle, and ending resolution.
//
// 3D-only build: every scene is a live set on the stage (src/stage/) and a
// sequence entry is a SHOT (a camera move from data/rooms.json), not a
// clip. A transition between two rooms is the `leave` shot of the room
// being left and the `arrive` shot of the room being entered, joined
// through black -- the same black-join the old clips had, which is also
// why a render flip can never walk the player into the wrong room: the
// destination render is decided at the join.
//
// Audio wiring (drone advance, ambience crossfade, ducking, music bed) lives
// here too, added in Phase 2 by editing this file.

import { renderFor, peekRenderFor, resolveEnding, commitChoice, fracture, seedRenderFromIntake } from './state.js';
import { createStage } from './stage/stage.js';
import { createChoiceUI } from './choice.js';
import { createApplicationUI } from './application.js';
import { createPreloader } from './preload.js';
import { createFractureOverlay } from './fracture.js';
import { stringFor } from './text.js';
import { createWalkLauncher } from './walk/launcher.js';

// Each of the 7 mini-game files covers 1-2 modes (11 modes total, Doc 3 §2),
// so the module's default export is a factory `(mode) => minigameInstance`.
// sceneAssets is an additive 4th mount() argument beyond Doc 4 §6.2's base
// contract (container, state, onComplete) -- rendering/positioning metadata
// (the terminal's screen rect, the room's actors) needed for S4-C/S6-C,
// never player state.
async function mountMinigameOrFallback(spec, container, stateSnapshot, sceneAssets, services, registerInstance) {
  if (!spec) return { friction: 0, dwell: 0, flags: [] };
  try {
    const mod = await import(`./minigames/${spec.module}.js`);
    const instance = mod.default(spec.mode);
    registerInstance(instance); // Doc 4 §9: bail.js needs this to unmount a live mini-game
    container.replaceChildren();
    return await new Promise((resolve) => {
      instance.mount(container, stateSnapshot, (payload) => {
        registerInstance(null);
        instance.unmount();
        container.replaceChildren();
        resolve(payload || { friction: 0, dwell: 0, flags: [] });
      }, sceneAssets, services);
    });
  } catch (err) {
    console.warn(`router: minigame "${spec.module}" not available yet, using pass-through`, err);
    registerInstance(null);
    return { friction: 0, dwell: 0, flags: [] };
  }
}

function readOnlySnapshot(state) {
  // Doc 4 §6.3: a mini-game must not import state.js directly or mutate
  // conformance/dissonance. It receives a frozen, shallow-cloned snapshot.
  return Object.freeze({
    conformance: state.conformance,
    dissonance: state.dissonance,
    friction: state.friction,
    flags: new Set(state.flags),
    formAnswers: { ...state.formAnswers }
  });
}

// The room a sequence entry plays in: its own `room`, else the branch's.
export function roomOfEntry(branch, entry) {
  return (entry && entry.room) || branch.room;
}

// The room a branch is entered in (its first entry's) and left from (its
// last entry's). S8-C enters the mailroom and leaves from the boardroom.
export function entryRoom(branch) { return roomOfEntry(branch, branch.sequence[0]); }
export function exitRoom(branch) { return roomOfEntry(branch, branch.sequence[branch.sequence.length - 1]); }

// Transition plan between two rooms: an ordered list of shots for
// playTransitionPlan(). Leaving and entering the SAME set (S1 -> S2: the
// call comes in the waiting room; S2_C aliases S1_C) is no transition at
// all -- the next scene's first shot simply plays. `baseOf` resolves
// aliases so that comparison holds. Explicit `transitions[next]` on a
// branch (a {leave, arrive} pair of shot names) overrides the defaults.
export function planTransition({ fromRoom, toRoom, baseOf = (k) => k, override = null }) {
  if (!fromRoom || !toRoom) return [];
  if (baseOf(fromRoom) === baseOf(toRoom)) return [];
  const leave = (override && override.leave) || 'leave';
  const arrive = (override && override.arrive) || 'arrive';
  return [{ room: fromRoom, shot: leave }, { room: toRoom, shot: arrive }];
}

// Which sequence entry the choice follows. Default: the last one. S8-H sets
// `choiceAfterEntry: 0` so DIVE / SWIM FOR THE PILLARS is asked underwater
// (where Doc 1 §5 puts it) and the store plays as the consequence.
export function choiceEntryIndex(branch) {
  const n = branch.sequence.length;
  const i = Number.isInteger(branch.choiceAfterEntry) ? branch.choiceAfterEntry : n - 1;
  return Math.min(n - 1, Math.max(0, i));
}

const SCENE_EFFECTS = new Set(['run-bob', 'slump']);

export function createRouter({ manifest, endings, state, mount, onEnding, audio = null, sfx = null, library = null, rooms = null, stage: stageIn = null }) {
  const stage = stageIn || createStage(mount.scene, { rooms, audio, sfx });
  const choiceUI = createChoiceUI(mount.choice);
  const preloader = createPreloader(manifest, endings, { stage });
  const fractureOverlay = createFractureOverlay(mount.scene);
  const walk = createWalkLauncher({ mount, rooms, stage });
  let currentMinigameSpec = null;
  let currentMinigameInstance = null; // exposed for bail.js (Phase 6)
  let bailedOut = false;
  let captionTimers = [];
  let captionEl = null;

  function scheduleCaptions(captions) {
    clearCaptions();
    if (!captions || !library) return;
    for (const cap of captions) {
      const text = cap.text || stringFor(library, cap.textKey);
      captionTimers.push(setTimeout(() => {
        if (bailedOut) return;
        captionEl = document.createElement('div');
        captionEl.className = `scene-caption ${cap.className || ''}`.trim();
        captionEl.textContent = text;
        mount.choice.appendChild(captionEl);
        const el = captionEl;
        captionTimers.push(setTimeout(() => { el.classList.add('scene-caption-out'); }, (cap.holdMs || 2500)));
        captionTimers.push(setTimeout(() => { el.remove(); }, (cap.holdMs || 2500) + 700));
      }, cap.atMs || 0));
    }
  }
  function clearCaptions() {
    for (const t of captionTimers) clearTimeout(t);
    captionTimers = [];
    for (const el of mount.choice.querySelectorAll('.scene-caption')) el.remove();
    captionEl = null;
  }

  // Every await in playScene() is followed by this check: bail() stops the
  // chain wherever it fires -- a video, choice or transition -- so nothing
  // keeps playing (and no audio keeps firing) underneath the ending card.
  const gone = () => bailedOut;

  async function leaveScene() {
    clearCaptions();
    if (audio) audio.stopOneShots({ ms: 300 }); // e.g. the receptionist line must not run into the next room
  }

  // Plays a planTransition() step list in order, bailing between steps.
  async function playTransitionPlan(steps) {
    for (const step of steps) {
      if (gone()) return;
      await stage.playShot(step.room, step.shot);
    }
  }

  function transitionPlanTo(scene, branch, nextSceneId) {
    const destLetter = peekRenderFor(state);
    const nextScene = manifest.scenes[nextSceneId];
    const dest = nextScene && nextScene.branches[destLetter];
    return planTransition({
      fromRoom: exitRoom(branch),
      toRoom: dest ? entryRoom(dest) : null,
      baseOf: (k) => stage.baseKey(k),
      override: branch.transitions && branch.transitions[nextSceneId]
    });
  }

  // Plays one sequence entry: a shot in a room. Looping shots (the idle
  // pingpong) resolve at once -- the router controls advancement; finite
  // shots (the street push, the descent) are awaited.
  async function playEntry(branch, entry, { onStart }) {
    const room = roomOfEntry(branch, entry);
    const p = stage.playShot(room, entry.shot || 'loop', { onStart });
    if (!entry.loop) await p;
  }

  async function playScene(sceneId) {
    if (gone()) return;
    const scene = manifest.scenes[sceneId];
    const branchLetter = sceneId === 'S0' ? 'X' : renderFor(state);
    const branch = scene.branches[branchLetter];
    state.sceneIndex = manifest.spineOrder.indexOf(sceneId);

    // Doc 4 §8.1: build both renders of the next scene while this one
    // plays (geometry + the prop library). Fire-and-forget.
    const nextSceneId = manifest.spineOrder[state.sceneIndex + 1] || null;
    preloader.prefetchNext(sceneId, nextSceneId);

    if (audio) audio.resumeIfSuspended(); // Doc 4 §7.4: resume silently if it was suspended

    if (sceneId === 'S0') {
      // Doc 4 §8.2 cold start: the apartment is up (camera parked on its
      // `in` pose) behind the application form and the countdown.
      await stage.holdPose(entryRoom(branch), 'in');
      if (gone()) return;
    }

    if (branch.preGesture) {
      // Doc 1 §5 / Doc 4 §7.4: the one non-diegetic-adjacent click in the
      // game. AudioContext + drone start here, nowhere else. S0 runs the
      // application form + countdown (src/application.js); the form's own
      // final click supplies that one required gesture.
      if (sceneId === 'S0') {
        const applicationUI = createApplicationUI(mount.choice);
        const { answers, refusals } = await applicationUI.present({
          onSubmitGesture: () => {
            if (!audio) return;
            audio.initOnGesture();
            audio.playAmbience(branch.ambience); // apartment room tone under the countdown
          }
        });
        if (gone()) return;
        state.formAnswers = { ...state.formAnswers, ...answers };
        seedRenderFromIntake(state, refusals); // render-only seed: two or more NOT WILLING open in S1-H
      } else {
        await choiceUI.presentSingle(branch.preGesture.label);
        if (gone()) return;
        if (audio) audio.initOnGesture();
      }
    }

    if (audio) {
      audio.advanceScene(state.sceneIndex); // Doc 4 §7.1 detune ramp
      const firstAmbience = branch.ambience !== undefined ? branch.ambience : (branch.ambienceSequence && branch.ambienceSequence[0]);
      audio.playAmbience(firstAmbience); // Doc 4 §7.2, null = carry over previous bed (Doc 1 §5 S2)
      const music = branch.music !== undefined ? branch.music : (scene.music !== undefined ? scene.music : null);
      audio.setMusic(music, branchLetter === 'X' ? 'C' : branchLetter);
    }

    if (sfx && branch.sfxCue) {
      for (const cue of Array.isArray(branch.sfxCue) ? branch.sfxCue : [branch.sfxCue]) sfx.play(cue);
    }
    scheduleCaptions(branch.captions);

    // Doc 4 §5.2: fracture overlay, driven by current friction/dissonance.
    // The bleed is the opposite render's palette; no opposite exists for S0.
    const oppositeLetter = branchLetter === 'C' ? 'H' : branchLetter === 'H' ? 'C' : null;
    const oppositeRoom = oppositeLetter ? stage.record(entryRoom(scene.branches[oppositeLetter])) : null;
    fractureOverlay.apply(fracture(state), oppositeRoom);

    const dwellStart = performance.now();
    let autoChoiceKey = null;
    let chosenKey = null;
    const choiceAt = branch.choice ? choiceEntryIndex(branch) : -1;

    for (let i = 0; i < branch.sequence.length; i++) {
      const entry = branch.sequence[i];
      const roomId = walk.roomFor(roomOfEntry(branch, entry));

      // Bed changes land ON the cut (the shot's onStart), not after it.
      const bedForEntry = i > 0 && branch.ambienceSequence ? branch.ambienceSequence[i] : null;
      const secondary = i === 0 && branch.ambienceSecondary ? branch.ambienceSecondary.file : null;
      const onStart = () => {
        if (!audio) return;
        if (bedForEntry) audio.playAmbience(bedForEntry);
        if (secondary) audio.playAmbience(secondary);
      };

      // A room change inside one scene (the mailroom to the boardroom, the
      // dive to the store, the apartment to the street) is the same
      // black-join a scene change gets.
      if (i > 0) {
        const prevRoom = roomOfEntry(branch, branch.sequence[i - 1]);
        await playTransitionPlan(planTransition({ fromRoom: prevRoom, toRoom: roomOfEntry(branch, entry), baseOf: (k) => stage.baseKey(k) }));
        if (gone()) return;
      }
      await playEntry(branch, entry, { onStart });
      if (gone()) return;

      if (entry.mount === 'minigame') {
        currentMinigameSpec = branch.minigame;
        const snapshot = readOnlySnapshot(state);
        const sceneAssets = {
          screenRect: () => stage.screenRect() || branch.screenRect || null,
          actors: branch.actors || null,
          sfxOneShot: branch.sfxOneShot
        };
        // Doc 4 §6.3: mini-games request nodes from audio.js, never create
        // their own AudioContext. `scene` is the narrow slice of the stage
        // a mini-game may drive: MG-05 H runs the garage only while the
        // player holds, slows it as stamina drains, then parks on the
        // dead-flat `out` pose for the silence at the end; MG-03 C walks
        // the manager up the aisle. Anything done here is undone below.
        const services = {
          audio,
          sfx,
          scene: {
            pause: () => stage.pause(),
            resume: () => stage.resume(),
            setRate: (rate) => stage.setRate(rate),
            hold: (pose = 'out') => { stage.holdPose(null, pose); },
            actor: (name, t) => stage.actor(name, t),
            screenRect: () => stage.screenRect(),
            setEffect: (name, on) => { if (SCENE_EFFECTS.has(name)) mount.scene.classList.toggle(`scene-fx-${name}`, !!on); }
          }
        };
        const payload = await mountMinigameOrFallback(branch.minigame, mount.minigame, snapshot, sceneAssets, services, (inst) => { currentMinigameInstance = inst; });
        currentMinigameSpec = null;
        if (gone()) return; // Doc 4 §9: bail fired mid-minigame -- stop this chain, jumpToEnding already ran
        stage.setRate(1);
        stage.resume();
        for (const name of SCENE_EFFECTS) mount.scene.classList.remove(`scene-fx-${name}`);

        state.friction = Math.min(8, state.friction + Math.min(1, Math.max(0, payload.friction || 0)));
        for (const flag of payload.flags || []) state.flags.add(flag);
        if (payload.formAnswers) state.formAnswers = { ...state.formAnswers, ...payload.formAnswers };
        if (payload.autoChoice === 'succumb' || payload.autoChoice === 'resist') {
          autoChoiceKey = payload.autoChoice; // MG-07 mode C: OPEN THE BOX / the handoff IS the choice
        }
      }

      if (i === choiceAt) {
        // Third, unscored affordance: walk the room (src/walk/). Only offered
        // where data/rooms.json has a room for this entry.
        const extra = roomId ? { label: 'WALK THE ROOM', run: () => walk.enter(roomId, { state }) } : null;
        chosenKey = autoChoiceKey || await choiceUI.present(branch.choice, { extra });
        if (gone()) return;
        const chosen = branch.choice[chosenKey];
        const polarity = chosenKey === 'succumb' ? 1 : -1;
        commitChoice(state, polarity);
        if (chosen.setFlag) state.flags.add(chosen.setFlag);
        if (chosen.sfxCue && sfx) sfx.play(chosen.sfxCue); // e.g. S4-C's paper handoff, S5-C's CRT wake
      }
    }

    state.dwell[state.sceneIndex] = (performance.now() - dwellStart) / 1000;
    await leaveScene();

    if (branch.choice) {
      const chosen = branch.choice[chosenKey];
      if (chosen.next === 'E') {
        const ending = resolveEnding(state);
        await playEndingVisual(ending, exitRoom(branch));
        if (gone()) return;
        return jumpToEnding(ending);
      }
      await playTransitionPlan(transitionPlanTo(scene, branch, chosen.next));
      if (gone()) return;
      return playScene(chosen.next);
    }

    // S0: no choice, single auto-advance (Doc 1 §4, "n/a").
    await playTransitionPlan(transitionPlanTo(scene, branch, branch.next));
    if (gone()) return;
    return playScene(branch.next);
  }

  // The ending room itself (data/endings.json: room + shot + holdSeconds),
  // reached through the usual leave/arrive black-join from wherever S8
  // ended, then its own camera move, then a dead-still hold before the
  // card ("4 second hold with no motion whatsoever", Doc 2).
  async function playEndingVisual(endingId, fromRoom) {
    const ending = endings[endingId];
    if (!ending) return;
    if (audio) audio.setMusic(null); // the bed goes before the card; the drone runs to it (C7)
    await playTransitionPlan(planTransition({ fromRoom, toRoom: ending.room, baseOf: (k) => stage.baseKey(k) }));
    if (gone()) return;
    if (ending.shot) await stage.playShot(ending.room, ending.shot);
    if (gone()) return;
    const holdMs = (ending.holdSeconds || 0) * 1000;
    if (holdMs > 0) await new Promise((resolve) => setTimeout(resolve, holdMs));
  }

  function jumpToEnding(endingId) {
    walk.abort();
    clearCaptions();
    stage.blackout(1.0).catch(() => {});
    fractureOverlay.destroy();
    choiceUI.clear();
    mount.minigame.replaceChildren();
    if (audio) audio.fadeOutForEnding();
    onEnding(endingId, state);
    return endingId;
  }

  // Doc 4 §9: the global accessibility exit. "Quitting is an ending, not an
  // exit." Works inside every mini-game, including hold-to-act ones.
  function bail() {
    if (bailedOut) return;
    bailedOut = true;
    state.flags.add('EARLY_EXIT');
    if (currentMinigameInstance) {
      currentMinigameInstance.unmount();
      currentMinigameInstance = null;
      mount.minigame.replaceChildren();
    }
    mount.choice.replaceChildren(); // an exit during the S0 form used to leave the form running
    jumpToEnding('PENDING');
  }

  return {
    start(sceneId = 'S0') {
      return playScene(sceneId);
    },
    jumpToEnding,
    bail,
    getCurrentMinigame() {
      return currentMinigameSpec;
    },
    isWalking() { return walk.isActive(); },
    stage
  };
}
