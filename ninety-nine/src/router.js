// Doc 4 §4/§10 Phase 1: the spine walker. The sequence never forks -- only
// the render does (Doc 1 §1.2). This module owns scene sequencing, mini-game
// mount lifecycle, and ending resolution.
//
// Audio wiring (drone advance, ambience crossfade, ducking, music bed) lives
// here too, added in Phase 2 by editing this file.

import { renderFor, peekRenderFor, resolveEnding, commitChoice, fracture, seedRenderFromIntake } from './state.js';
import { createRenderer } from './renderer.js';
import { createChoiceUI } from './choice.js';
import { createApplicationUI } from './application.js';
import { createPreloader } from './preload.js';
import { createFractureOverlay } from './fracture.js';
import { stringFor } from './text.js';
import { createWalkLauncher } from './walk/launcher.js';

// Mini-game modules (Doc 3) don't exist until Phase 4/5. This fallback lets
// the skeleton run standalone: if the module 404s, the "mini-game" completes
// instantly with zero friction, so nothing downstream needs to change when
// the real modules land.
//
// Each of the 7 files covers 1-2 modes (11 modes total, Doc 3 §2), so the
// module's default export is a factory `(mode) => minigameInstance`, not a
// single fixed-mode instance (Doc 4 §6.2's example shows one mode; a file
// serving two modes selects between them internally).
// sceneAssets is an additive 4th mount() argument beyond Doc 4 §6.2's base
// contract (container, state, onComplete) -- purely rendering/positioning
// metadata (screenRect, npcSprite) needed for S4-C/S6-C's compositing
// (see the plan's scenes.json §3.3/§3.4), never player state.
async function mountMinigameOrFallback(spec, container, stateSnapshot, sceneAssets, services, registerInstance) {
  if (!spec) return { friction: 0, dwell: 0, flags: [] };
  try {
    const mod = await import(`./minigames/${spec.module}.js`);
    const instance = mod.default(spec.mode);
    registerInstance(instance); // Doc 4 §9: bail.js needs this to unmount a live mini-game
    container.replaceChildren(); // clear any stale DOM from a previous mini-game
    return await new Promise((resolve) => {
      instance.mount(container, stateSnapshot, (payload) => {
        registerInstance(null);
        instance.unmount();
        container.replaceChildren(); // unmount() clears listeners/timers, not DOM -- do that here
        resolve(payload || { friction: 0, dwell: 0, flags: [] });
      }, sceneAssets, services);
    });
  } catch (err) {
    console.warn(`router: minigame "${spec.module}" not available yet, using pass-through`, err);
    registerInstance(null); // a mount() that threw must not leave a half-live instance registered for bail.js
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

// Swap-aware transition selection. A branch's plain `transitions` clip lands
// in the same render it left (C->C, H->H; S0's X lands in C). When the
// destination render differs -- the render flipped between scenes -- prefer
// `transitionsSwap`, which lands in the opposite room. Entries are only ever
// added to transitionsSwap once the clip exists (renderer.js does not error
// on a missing file, it stalls ~14s), so an absent key falls back to the
// plain clip, exactly as before swap clips existed.
export function pickTransition(branch, fromLetter, destLetter, nextSceneId) {
  const landsIn = fromLetter === 'X' ? 'C' : fromLetter;
  const isSwap = destLetter !== landsIn;
  return (isSwap && branch.transitionsSwap?.[nextSceneId]) || branch.transitions[nextSceneId];
}

// Which sequence entry the choice follows. Default: the last one. S8-H sets
// `choiceAfterEntry: 0` so DIVE / SWIM FOR THE PILLARS is asked underwater
// (where Doc 1 §5 puts it) and the store clip plays as the consequence,
// instead of the choice appearing over the store's frozen last frame.
export function choiceEntryIndex(branch) {
  const n = branch.sequence.length;
  const i = Number.isInteger(branch.choiceAfterEntry) ? branch.choiceAfterEntry : n - 1;
  return Math.min(n - 1, Math.max(0, i));
}

export function createRouter({ manifest, endings, state, mount, onEnding, audio = null, sfx = null, library = null, rooms = null }) {
  const renderer = createRenderer(mount.scene);
  const choiceUI = createChoiceUI(mount.choice);
  const preloader = createPreloader(manifest, endings);
  const fractureOverlay = createFractureOverlay(mount.scene);
  const walk = createWalkLauncher({ mount, rooms, audio, sfx, renderer });
  let currentMinigameSpec = null;
  let currentMinigameInstance = null; // exposed for bail.js (Phase 6)
  let bailedOut = false;
  let captionTimers = [];
  let captionEl = null;

  // Receptionist lines etc. (text/system.json) shown as on-screen cards
  // alongside the recorded voice -- Doc 1 §5 S2's "Ninety-nine." / "Shaun."
  // never actually appeared anywhere before.
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

  // Every await in playScene() is followed by this check: bail() used to
  // only stop the chain if it fired inside a mini-game, so an exit during a
  // video, choice or transition let the whole spine keep playing (and the
  // audio keep firing) underneath the ending card.
  const gone = () => bailedOut;

  async function leaveScene() {
    clearCaptions();
    if (audio) audio.stopOneShots({ ms: 300 }); // e.g. the receptionist line must not run into the next room
  }

  async function playScene(sceneId) {
    if (gone()) return;
    const scene = manifest.scenes[sceneId];
    const branchLetter = sceneId === 'S0' ? 'X' : renderFor(state);
    const branch = scene.branches[branchLetter];
    state.sceneIndex = manifest.spineOrder.indexOf(sceneId);

    // Doc 4 §8.1: prefetch both branches of the next scene (+ both
    // transitions into it) while this one plays. Fire-and-forget.
    const nextSceneId = manifest.spineOrder[state.sceneIndex + 1] || null;
    preloader.prefetchNext(sceneId, nextSceneId);

    if (audio) audio.resumeIfSuspended(); // Doc 4 §7.4: resume silently if it was suspended

    if (sceneId === 'S0' && branch.imgIn) {
      // Doc 4 §8.2 cold start, moved ahead of the preGesture block (added
      // post-launch): the desk/monitor still is the backdrop for the new
      // application form + countdown too, not just the video's load wait --
      // otherwise the player fills out the form and watches the countdown
      // against plain black, and the "you're at your desk" framing the
      // monitor image establishes is missing for that whole beat.
      renderer.primeStill(branch.imgIn);
    }

    if (branch.preGesture) {
      // Doc 1 §5 / Doc 4 §7.4: the one non-diegetic-adjacent click in the
      // game. AudioContext + drone start here, nowhere else. S0 now runs
      // the application form + countdown (src/application.js, added post-
      // launch) instead of a single SUBMIT click; the form's own final
      // click still supplies that one required gesture.
      if (sceneId === 'S0') {
        const applicationUI = createApplicationUI(mount.choice);
        const { answers, refusals } = await applicationUI.present({
          onSubmitGesture: () => {
            if (!audio) return;
            audio.initOnGesture();
            // Apartment room tone under the countdown (Doc 1 §5 S0: "the
            // apartment is room tone only"); the street bed takes over on
            // the commute cut below.
            audio.playAmbience(branch.ambience);
          }
        });
        if (gone()) return;
        // Doc 4 §6.4's intake -> MG-07 payoff reads state.formAnswers. This
        // form is now the only place they're collected (MG-01 is gone), so
        // MG-07's review at S8 shows exactly what was handed over at S0.
        state.formAnswers = { ...state.formAnswers, ...answers };
        // Render-only seed: two or more NOT WILLING answers open in S1-H.
        seedRenderFromIntake(state, refusals);
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
      // Music bed: per-branch override, else per-scene, else none (fades out).
      const music = branch.music !== undefined ? branch.music : (scene.music !== undefined ? scene.music : null);
      audio.setMusic(music, branchLetter === 'X' ? 'C' : branchLetter);
    }

    // Branch-entry one-shots (sfx.js's real-file/synthesized cues), e.g. the
    // PA speaker click + receptionist voice at S2, or the parking garage's
    // car alarm at S5-H. A single string or an array (S2's speaker click
    // firing alongside the shared receptionist-voice recording).
    if (sfx && branch.sfxCue) {
      for (const cue of Array.isArray(branch.sfxCue) ? branch.sfxCue : [branch.sfxCue]) sfx.play(cue);
    }
    scheduleCaptions(branch.captions);

    // Doc 4 §5.2: fracture overlay, driven by current friction/dissonance.
    // No opposite branch exists for S0 (X only).
    const oppositeLetter = branchLetter === 'C' ? 'H' : branchLetter === 'H' ? 'C' : null;
    const oppositeImgIn = oppositeLetter ? scene.branches[oppositeLetter].imgIn : null;
    fractureOverlay.apply(fracture(state), oppositeImgIn);

    const dwellStart = performance.now();
    let autoChoiceKey = null;
    let chosenKey = null;
    const choiceAt = branch.choice ? choiceEntryIndex(branch) : -1;
    const roomId = walk.roomFor(sceneId, branchLetter);

    for (let i = 0; i < branch.sequence.length; i++) {
      const entry = branch.sequence[i];

      // Bed changes land ON the cut (renderer's onStart), not after the
      // clip has finished: S8's second bed used to start only once the
      // store/boardroom clip had already ended.
      const bedForEntry = i > 0 && branch.ambienceSequence ? branch.ambienceSequence[i] : null;
      const secondary = i === 0 && branch.ambienceSecondary ? branch.ambienceSecondary.file : null;
      const onStart = () => {
        if (!audio) return;
        if (bedForEntry) audio.playAmbience(bedForEntry);
        if (secondary) audio.playAmbience(secondary);
      };

      await renderer.playEntry(entry, branchLetter, { onStart });
      if (gone()) return;

      if (entry.mount === 'minigame') {
        currentMinigameSpec = branch.minigame;
        const snapshot = readOnlySnapshot(state);
        const sceneAssets = { screenRect: branch.screenRect, npcSprite: branch.npcSprite, imgIn: branch.imgIn, imgOut: branch.imgOut, sfxOneShot: branch.sfxOneShot };
        const services = { audio, sfx }; // Doc 4 §6.3: mini-games request nodes from audio.js, never create their own AudioContext
        const payload = await mountMinigameOrFallback(branch.minigame, mount.minigame, snapshot, sceneAssets, services, (inst) => { currentMinigameInstance = inst; });
        currentMinigameSpec = null;
        if (gone()) return; // Doc 4 §9: bail fired mid-minigame -- stop this chain, jumpToEnding already ran

        state.friction = Math.min(8, state.friction + Math.min(1, Math.max(0, payload.friction || 0)));
        for (const flag of payload.flags || []) state.flags.add(flag);
        if (payload.formAnswers) state.formAnswers = { ...state.formAnswers, ...payload.formAnswers };
        // MG-07 mode C only (Doc 3): OPEN THE BOX / a completed handoff IS
        // the S8-C choice, not a separate step -- the mini-game may resolve
        // the choice directly instead of falling through to choiceUI.
        if (payload.autoChoice === 'succumb' || payload.autoChoice === 'resist') {
          autoChoiceKey = payload.autoChoice;
        }
      }

      if (i === choiceAt) {
        // Third, unscored affordance: walk the room (src/walk/). Only offered
        // where data/rooms.json has a room for this scene+render.
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
        const transitionFile = branch.endingTransitions[ending];
        await renderer.playTransition(transitionFile);
        if (gone()) return;
        await playEndingVisual(ending);
        if (gone()) return;
        return jumpToEnding(ending);
      }

      const transitionFile = pickTransition(branch, branchLetter, peekRenderFor(state), chosen.next);
      await renderer.playTransition(transitionFile);
      if (gone()) return;
      return playScene(chosen.next);
    }

    // S0: no choice, single auto-advance (Doc 1 §4, "n/a").
    const transitionFile = pickTransition(branch, branchLetter, peekRenderFor(state), branch.next);
    await renderer.playTransition(transitionFile);
    if (gone()) return;
    return playScene(branch.next);
  }

  // Doc 2 generated a dedicated SE_*_VID/IMG pair per ending (data/endings.json's
  // video/imgOut/holdSeconds), separate from the S8_*_TRN_SE_* clip that gets
  // the player TO the ending room -- this is the ending room itself. Endings
  // with a video hold on its last frame for `holdSeconds` (README: "each
  // SE_*_VID ends on a still hold; extend on the last frame for the 4s
  // pre-card hold"); an ending with no video (e.g. RETAINED, only one still
  // was ever generated for it) just holds imgOut directly for the same span.
  async function playEndingVisual(endingId) {
    const ending = endings[endingId];
    if (!ending) return;
    if (audio) audio.setMusic(null); // the bed goes before the card; the drone runs to it (C7)
    if (ending.video) {
      await renderer.playTransition(ending.video);
    } else if (ending.imgOut) {
      renderer.primeStill(ending.imgOut);
    }
    const holdMs = (ending.holdSeconds || 0) * 1000;
    if (holdMs > 0) await new Promise((resolve) => setTimeout(resolve, holdMs));
  }

  function jumpToEnding(endingId) {
    walk.abort();
    clearCaptions();
    renderer.destroy();
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
    isWalking() { return walk.isActive(); }
  };
}
