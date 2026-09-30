// Doc 3 MG-07: THE HANDOFF (mode C) / THE BREATH (mode H).
//
// Mode C design decision: Doc 1 §4's spine table lists S8-C's choice itself
// as DELIVER / OPEN THE BOX, and Doc 3 describes OPEN THE BOX as an action
// available throughout the carry interaction that "forces -1 on the final
// choice" the moment it's taken. Read together, the hand-off interaction
// and the S8-C choice are the same act, not two independent steps -- so
// this mode resolves the scene's choice directly via the `autoChoice`
// mount() payload extension (router.js), skipping the normal separate
// choice-UI step. Reaching the table completes the payload with
// autoChoice: 'succumb'; opening the box completes it with 'resist'.
//
// Mode H keeps the ordinary separate choice UI afterward (DIVE / SWIM FOR
// THE PILLARS) -- every documented outcome of the dive interaction ends
// with the character going down the chute regardless (Doc 3: "nobody
// drowns... the building files them"), mirroring C3's "refusing a descent
// results in a descent anyway." The mini-game generates friction; the
// explicit choice still commits conformance, same as every other scene.

import { defineMinigame, createDwellTimer, createTrackedListeners, hardTimeout } from './_contract.js';

const STILL_SYNC_MS = 5000; // Doc 3: stop >5s -> pulse syncs to drone
const HARD_CAP_SECONDS = 120;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderIntakeReview(container, formAnswers, tracked, onContinue) {
  // Doc 4 §6.4: the MG-01 -> MG-07 payoff. Whatever the player entered (or
  // let the ghost fill in) six months ago, dated six months before now.
  const submittedAt = new Date();
  submittedAt.setMonth(submittedAt.getMonth() - 6);

  const overlay = el('div', 'mg07-review');
  const dateEl = el('div', 'mg07-review-date', `SUBMITTED: ${submittedAt.toDateString()}`);
  overlay.appendChild(dateEl);
  const entries = Object.entries(formAnswers || {});
  if (entries.length === 0) {
    overlay.appendChild(el('div', 'mg07-review-empty', '(the form is blank)'));
  } else {
    for (const [label, value] of entries) {
      const row = el('div', 'mg07-review-row');
      row.appendChild(el('div', 'mg07-review-label', label));
      row.appendChild(el('div', 'mg07-review-value', value));
      overlay.appendChild(row);
    }
  }
  const continueBtn = el('button', 'mg07-btn', 'CLOSE THE BOX');
  overlay.appendChild(continueBtn);
  container.appendChild(overlay);
  tracked.on(continueBtn, 'click', onContinue, { once: true });
}

function mountModeC(container, state, onComplete, tracked) {
  const dwell = createDwellTimer();
  dwell.start();
  let resolved = false;

  const stage = el('div', 'mg07-stage');
  const target = el('div', 'mg07-target', 'TABLE');
  const pkg = el('div', 'mg07-package');
  const openBoxBtn = el('button', 'mg07-openbox', 'OPEN THE BOX');
  stage.append(target, pkg, openBoxBtn);
  container.appendChild(stage);

  const pos = { x: 15, y: 60 };
  pkg.style.left = `${pos.x}%`;
  pkg.style.top = `${pos.y}%`;

  let dragging = false;
  let lastMoveTime = performance.now();
  let syncedBonusApplied = false;
  let frictionExtra = 0;

  function finish(autoChoice) {
    if (resolved) return;
    resolved = true;
    dwell.stop();
    onComplete({
      friction: Math.min(1, Math.max(0, frictionExtra)),
      dwell: dwell.elapsedSeconds(),
      flags: autoChoice === 'resist' ? ['OPENED_BOX'] : [],
      autoChoice
    });
  }

  tracked.on(openBoxBtn, 'click', () => {
    if (resolved) return;
    openBoxBtn.disabled = true;
    stage.classList.add('mg07-box-open');
    renderIntakeReview(container, state.formAnswers, tracked, () => finish('resist'));
  });

  tracked.on(pkg, 'pointerdown', () => {
    dragging = true;
    lastMoveTime = performance.now();
  });
  tracked.on(window, 'pointerup', () => {
    dragging = false;
  });
  tracked.on(window, 'pointermove', (e) => {
    if (!dragging || resolved) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    pos.x = Math.max(0, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
    pos.y = Math.max(0, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
    pkg.style.left = `${pos.x}%`;
    pkg.style.top = `${pos.y}%`;
    lastMoveTime = performance.now();
    if (pos.x >= 75 && pos.y >= 45 && pos.y <= 75) finish('succumb');
  });

  tracked.setInterval(() => {
    if (resolved || syncedBonusApplied) return;
    if (performance.now() - lastMoveTime > STILL_SYNC_MS) {
      syncedBonusApplied = true;
      frictionExtra += 0.3; // Doc 3: pulse syncs to drone, "once heard it cannot be unheard"
      pkg.classList.add('mg07-synced');
    }
  }, 250);

  hardTimeout(tracked, HARD_CAP_SECONDS, () => finish('succumb'));

  return { dispose() {} };
}

function mountModeH(container, state, onComplete, tracked, services) {
  const dwell = createDwellTimer();
  dwell.start();
  let resolved = false;

  // The mini-game layer is pointer-events:none (style.css); only its
  // children take input, so the press has to land on a full-layer zone,
  // not on the layer -- the same defect MG-05 H had ("hold does nothing").
  // The zone also draws the descent: it darkens with depth and pulses with
  // the air left, so holding visibly does something from the first tick.
  const zone = el('div', 'mg07-breath-zone');
  const hud = el('div', 'mg07-breath-hint', 'HOLD TO DESCEND');
  zone.appendChild(hud);
  container.appendChild(zone);
  const paint = () => {
    zone.style.setProperty('--depth', depth.toFixed(3));
    zone.style.setProperty('--air', air.toFixed(3));
    zone.classList.toggle('mg07-descending', holding && !resolved);
  };

  let depth = 0; // 0..1
  let air = 1; // 0..1
  let holding = false;
  let releaseCount = 0;
  const DEPTH_RATE = 1 / 60; // reaches grate in ~6s of continuous holding (100ms ticks)
  const AIR_DRAIN_RATE = 1 / 80; // ~8s to fully deplete while holding continuously
  const AIR_RECOVER_RATE = AIR_DRAIN_RATE * 0.6;

  function finish() {
    if (resolved) return;
    resolved = true;
    dwell.stop();
    if (services && services.audio) services.audio.restoreDrone({ ms: 600 });
    let friction;
    if (releaseCount >= 3) friction = 0.85;
    else if (depth >= 1) friction = 0.2;
    else friction = 0.6; // air depleted without reaching the grate -- carried down anyway
    onComplete({ friction, dwell: dwell.elapsedSeconds(), flags: [] });
  }

  tracked.setInterval(() => {
    if (resolved) return;
    if (holding) {
      depth = Math.min(1, depth + DEPTH_RATE);
      air = Math.max(0, air - AIR_DRAIN_RATE);
      paint();
      if (services && services.audio) {
        // Progressive occlusion as depth increases (Doc 3: "the drone
        // becomes progressively more occluded" -- real ducking, Doc 4 §7.3).
        services.audio.duckDrone({ lowpassHz: 1200 - depth * 900, gain: 1 - depth * 0.5, ms: 400 });
      }
      if (depth >= 1) {
        finish();
        return;
      }
      if (air <= 0) {
        finish();
        return;
      }
    } else {
      air = Math.min(1, air + AIR_RECOVER_RATE);
      paint();
    }
  }, 100);

  function release() {
    if (holding && depth > 0) {
      releaseCount++;
      depth = 0; // Doc 3: "Release: you surface. You lose all depth."
      if (services && services.audio) services.audio.restoreDrone({ ms: 800 });
    }
    holding = false;
    paint();
  }
  tracked.on(zone, 'pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    holding = true;
    paint();
  });
  tracked.on(window, 'pointerup', release);
  tracked.on(window, 'pointercancel', release);
  tracked.on(window, 'blur', release);
  tracked.on(zone, 'contextmenu', (e) => e.preventDefault());
  tracked.on(window, 'keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) { e.preventDefault(); holding = true; paint(); }
  });
  tracked.on(window, 'keyup', (e) => {
    if (e.code === 'Space') release();
  });

  hardTimeout(tracked, HARD_CAP_SECONDS, finish);

  return {
    dispose() {
      if (services && services.audio) services.audio.restoreDrone({ ms: 0 });
    }
  };
}

export default function createMg07(mode) {
  let tracked = null;
  let disposeFn = null;

  return defineMinigame({
    id: 'MG-07',
    mode,
    mount(container, state, onComplete, sceneAssets, services) {
      tracked = createTrackedListeners();
      const result = mode === 'C'
        ? mountModeC(container, state, onComplete, tracked)
        : mountModeH(container, state, onComplete, tracked, services);
      disposeFn = result && result.dispose;
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
