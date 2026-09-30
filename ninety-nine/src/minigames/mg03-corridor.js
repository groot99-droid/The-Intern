// Doc 3 MG-03: THE CORRIDOR (mode C) / THE LABYRINTH (mode H). Built last
// per Doc 3 §5 -- "procedural maze is the highest engineering cost and the
// lowest thesis risk."
//
// Mode C composites the manager as an engine billboard over the figure-free
// S4_C_VID_PLATE.mp4 dolly (npcSprite far/near from scenes.json, per the
// plan's §3.3 -- S4_C_VID's real Kling walk-cycle was rejected). Mode H
// simplifies full 3D maze navigation/pathfinding (out of scope for this
// build) down to its one load-bearing rule, stated directly by Doc 3:
// standing completely still for 8s always opens a door. Directional
// buttons register as "activity" (resetting the stillness timer) rather
// than driving real procedurally-regenerating geometry.

import { defineMinigame, createFrictionAccumulator, createDwellTimer, createTrackedListeners, hardTimeout } from './_contract.js';

const FOLLOW_SECONDS = 20;
const WANDER_FRICTION_PER_15S = 0.1;
const NPC_NEAR_THRESHOLD = 0.7;

const STILLNESS_SECONDS = 8;
const HARD_TIMEOUT_SECONDS = 240;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function mountModeC(container, tracked, sceneAssets) {
  const friction = createFrictionAccumulator();
  const dwell = createDwellTimer();
  dwell.start();
  let resolved = false;
  let onComplete;

  const scene = el('div', 'mg03-corridor-scene');
  const npcFar = el('div', 'mg03-npc-sprite mg03-npc-far');
  const npcNear = el('div', 'mg03-npc-sprite mg03-npc-near');
  const controls = el('div', 'mg03-controls');
  const followBtn = el('button', 'mg03-btn', 'FOLLOW');
  followBtn.textContent = 'FOLLOW';
  const wanderBtn = el('button', 'mg03-btn', 'WANDER');
  wanderBtn.textContent = 'WANDER INTO THE CUBICLES';
  const lookBehindBtn = el('button', 'mg03-btn', 'LOOK BEHIND');
  lookBehindBtn.textContent = 'LOOK BEHIND';
  const lookBehindNote = el('div', 'mg03-look-behind-note');
  lookBehindNote.textContent = 'The floor you already walked is gone. Just more cubicles.';
  lookBehindNote.hidden = true;
  controls.append(followBtn, wanderBtn, lookBehindBtn);
  scene.append(npcFar, npcNear, controls, lookBehindNote);
  container.appendChild(scene);

  // scenes.json's npcSprite rects are CROP boxes: where the manager stands
  // inside his source still, not a window to draw the whole still into.
  // Drawing the file into a box that size (the first cut: an <img> plus
  // object-fit) put the entire frame on screen shrunk to 14% wide, reading
  // as a small window pasted over the scene rather than a figure in it.
  // Background-position/-size crops to the figure alone.
  function cropTo(node, spec) {
    if (!spec) return;
    const { x, y, w, h } = spec.rect;
    node.style.backgroundImage = `url("./assets/img/${spec.file}")`;
    node.style.backgroundSize = `${(1 / w) * 100}% ${(1 / h) * 100}%`;
    // Percentage background-position is measured against (container - image),
    // hence the /(1-w): at w=1 there is nothing to pan, so clamp.
    node.style.backgroundPosition = `${w >= 1 ? 0 : (x / (1 - w)) * 100}% ${h >= 1 ? 0 : (y / (1 - h)) * 100}%`;
  }

  // Where the figure sits on screen, which is what makes him approach:
  // the far rect at progress 0, the near rect at 1, interpolated between.
  // (The old build had no approach at all -- two fixed sizes and a hard
  // swap at 70%, so the manager teleported one step closer and stopped.)
  function placeAt(node, t) {
    if (!far || !near) return;
    const lerp = (a, b) => a + (b - a) * t;
    node.style.left = `${lerp(far.rect.x, near.rect.x) * 100}%`;
    node.style.top = `${lerp(far.rect.y, near.rect.y) * 100}%`;
    node.style.width = `${lerp(far.rect.w, near.rect.w) * 100}%`;
    node.style.height = `${lerp(far.rect.h, near.rect.h) * 100}%`;
  }

  const far = sceneAssets && sceneAssets.npcSprite ? sceneAssets.npcSprite.far : null;
  const near = sceneAssets && sceneAssets.npcSprite ? sceneAssets.npcSprite.near : null;
  cropTo(npcFar, far);
  cropTo(npcNear, near);
  placeAt(npcFar, 0);
  placeAt(npcNear, 0);
  npcNear.classList.remove('visible');
  // Fade the figure in on the next frame rather than mounting him already
  // at full opacity -- the CSS opacity transition can't run from a class
  // set in the same paint.
  tracked.setTimeout(() => npcFar.classList.add('visible'), 50);

  let progress = 0; // 0..1 toward the manager
  let following = false;
  let wandering = false;
  let wanderElapsedMs = 0;

  function finish() {
    if (resolved) return;
    resolved = true;
    dwell.stop();
    onComplete({ friction: friction.value(), dwell: dwell.elapsedSeconds(), flags: [] });
  }

  // Was hold-to-follow (pointerdown, cancelled by ANY pointerup anywhere on
  // the page) with zero visual sign that holding was required -- a plain
  // click did nothing, same as WANDER/LOOK BEHIND not completing the scene
  // either, so there was no discoverable way forward at all (reported as
  // the game "breaking" at this scene). A click-to-toggle, matching WANDER's
  // own interaction, is equally valid against Doc 3 §MG-03 ("Follow
  // directly: arrives in ~20s") which never specifies hold vs. click.
  tracked.on(followBtn, 'click', () => {
    following = !following;
    wandering = false;
    followBtn.classList.toggle('mg03-active', following);
    wanderBtn.classList.remove('mg03-active');
  });
  tracked.on(wanderBtn, 'click', () => {
    wandering = !wandering;
    following = false;
    wanderBtn.classList.toggle('mg03-active', wandering);
    followBtn.classList.remove('mg03-active');
  });
  tracked.on(lookBehindBtn, 'click', () => {
    lookBehindNote.hidden = false;
    tracked.setTimeout(() => {
      lookBehindNote.hidden = true;
    }, 2000);
  });

  tracked.setInterval(() => {
    if (resolved) return;
    if (following) {
      progress = Math.min(1, progress + 1 / (FOLLOW_SECONDS * 10));
      // Both layers track the same interpolated placement, so the crossfade
      // at the threshold swaps the source still without the figure jumping.
      placeAt(npcFar, progress);
      placeAt(npcNear, progress);
      npcNear.classList.toggle('visible', progress >= NPC_NEAR_THRESHOLD);
      npcFar.classList.toggle('visible', progress < NPC_NEAR_THRESHOLD);
      if (progress >= 1) finish();
    } else if (wandering) {
      wanderElapsedMs += 100;
      if (wanderElapsedMs >= 15000) {
        wanderElapsedMs = 0;
        friction.add(WANDER_FRICTION_PER_15S);
      }
    }
  }, 100);

  hardTimeout(tracked, 240, finish);

  return {
    setOnComplete(fn) {
      onComplete = fn;
    },
    dispose() {}
  };
}

function mountModeH(container, tracked, sceneAssets, services) {
  const dwell = createDwellTimer();
  dwell.start();
  let resolved = false;
  let onComplete;

  // Doc 3 MG-03 mode H audio: "footsteps that are not the player's. They do
  // not sync to player movement." S4_H_SFX_FOOTSTEPS.wav is a real
  // delivered one-shot (not a synthesized stand-in) -- played on an
  // irregular schedule, deliberately out of sync with input.
  function scheduleFootsteps() {
    const delay = 4000 + Math.random() * 5000;
    tracked.setTimeout(() => {
      if (resolved) return;
      if (services && services.audio && sceneAssets && sceneAssets.sfxOneShot) {
        services.audio.playOneShot(sceneAssets.sfxOneShot, { gain: 0.4 });
      }
      scheduleFootsteps();
    }, delay);
  }
  scheduleFootsteps();

  const scene = el('div', 'mg03-labyrinth-scene');
  const hint = el('div', 'mg03-labyrinth-hint');
  hint.textContent = 'IDENTICAL UTILITY DOORS';
  const dpad = el('div', 'mg03-dpad');
  const forward = el('button', 'mg03-btn', 'FORWARD');
  forward.textContent = 'FORWARD';
  const left = el('button', 'mg03-btn', 'LEFT');
  left.textContent = 'LEFT';
  const right = el('button', 'mg03-btn', 'RIGHT');
  right.textContent = 'RIGHT';
  const back = el('button', 'mg03-btn', 'BACK');
  back.textContent = 'BACK';
  dpad.append(forward, left, right, back);
  scene.append(hint, dpad);
  container.appendChild(scene);

  const startTime = performance.now();
  let lastInputTime = performance.now();

  function finish(overrideFriction) {
    if (resolved) return;
    resolved = true;
    dwell.stop();
    const elapsedS = (performance.now() - startTime) / 1000;
    let friction = overrideFriction;
    if (friction === undefined) {
      if (elapsedS < 60) friction = 0.3;
      else if (elapsedS < 180) friction = 0.3 + ((elapsedS - 60) / 120) * 0.65;
      else friction = 0.95;
    }
    onComplete({ friction, dwell: dwell.elapsedSeconds(), flags: [] });
  }

  for (const btn of [forward, left, right, back]) {
    tracked.on(btn, 'click', () => {
      lastInputTime = performance.now();
    });
  }

  // Doc 3: "Stand completely still for 8 seconds: a door opens. Always.
  // Every time. The only reliable way through the labyrinth is to stop
  // trying to solve it."
  tracked.setInterval(() => {
    if (resolved) return;
    if ((performance.now() - lastInputTime) / 1000 >= STILLNESS_SECONDS) {
      finish();
    }
  }, 250);

  hardTimeout(tracked, HARD_TIMEOUT_SECONDS, () => finish(1.0));

  return {
    setOnComplete(fn) {
      onComplete = fn;
    },
    dispose() {}
  };
}

export default function createMg03(mode) {
  let tracked = null;
  let disposeFn = null;

  return defineMinigame({
    id: 'MG-03',
    mode,
    mount(container, state, onComplete, sceneAssets, services) {
      tracked = createTrackedListeners();
      const result = mode === 'C' ? mountModeC(container, tracked, sceneAssets) : mountModeH(container, tracked, sceneAssets, services);
      result.setOnComplete(onComplete);
      disposeFn = result.dispose;
    },
    unmount() {
      if (disposeFn) disposeFn();
      disposeFn = null;
      if (tracked) {
        tracked.disposeAll();
        tracked = null;
      }
    }
  });
}
