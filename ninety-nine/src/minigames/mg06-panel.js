// Doc 3 MG-06: THE PANEL (mode C) / THE EDGE (mode H). "The building only
// permits descent. Both of these prove it."

import { defineMinigame, createFrictionAccumulator, createDwellTimer, createTrackedListeners, hardTimeout } from './_contract.js';

const PANEL_BUTTON_COUNT = 66;
const UNLIT_PRESS_FRICTION = 0.04;
const NO_PRESS_TIMEOUT_S = 25;
const LEAN_FAIL_THRESHOLD = 0.85;
const LEAN_GRATE_VISIBLE_THRESHOLD = 0.6;
const LEAN_RATE_PER_TICK = 1 / 30; // ~3s hold to fail from zero
const MAX_TURN_BACK_ATTEMPTS = 3;
const HARD_CAP_SECONDS = 180;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function mountModeC(container, tracked) {
  const friction = createFrictionAccumulator();
  const dwell = createDwellTimer();
  dwell.start();
  let resolved = false;
  let onComplete;

  const grid = el('div', 'mg06-panel-grid');
  container.appendChild(grid);

  const litIndex = Math.floor(Math.random() * PANEL_BUTTON_COUNT);
  const pressedUnlit = new Set();
  const buttons = [];

  function finish(overrideFriction) {
    if (resolved) return;
    resolved = true;
    dwell.stop();
    if (overrideFriction !== undefined) friction.set(overrideFriction);
    onComplete({ friction: friction.value(), dwell: dwell.elapsedSeconds(), flags: [] });
  }

  for (let i = 0; i < PANEL_BUTTON_COUNT; i++) {
    const btn = el('button', 'mg06-panel-btn');
    if (i === litIndex) btn.classList.add('mg06-lit');
    tracked.on(btn, 'click', () => {
      if (resolved) return;
      if (i === litIndex) {
        finish(0);
        return;
      }
      if (!pressedUnlit.has(i)) {
        pressedUnlit.add(i);
        friction.add(UNLIT_PRESS_FRICTION);
      }
      btn.classList.add('mg06-flash');
      tracked.setTimeout(() => btn.classList.remove('mg06-flash'), 800);
      if (pressedUnlit.size >= PANEL_BUTTON_COUNT - 1) {
        // Doc 3: panel goes fully dark for 2s, then only the original relights.
        grid.classList.add('mg06-panel-dark');
        tracked.setTimeout(() => {
          grid.classList.remove('mg06-panel-dark');
          finish(0.9);
        }, 2000);
      }
    });
    buttons.push(btn);
    grid.appendChild(btn);
  }

  hardTimeout(tracked, NO_PRESS_TIMEOUT_S, () => finish(0.6));
  hardTimeout(tracked, HARD_CAP_SECONDS, () => finish());

  return {
    setOnComplete(fn) {
      onComplete = fn;
    },
    dispose() {}
  };
}

function mountModeH(container, tracked) {
  const dwell = createDwellTimer();
  dwell.start();
  let resolved = false;
  let onComplete;

  const scene = el('div', 'mg06-edge-scene');
  const ledge = el('div', 'mg06-ledge');
  const hint = el('div', 'mg06-edge-hint', 'HOLD TO LEAN');
  const turnBackBtn = el('button', 'mg06-turnback-btn', 'TURN BACK');
  scene.append(ledge, hint, turnBackBtn);
  container.appendChild(scene);

  let lean = 0;
  let holding = false;
  let turnBackAttempts = 0;

  function finish(friction) {
    if (resolved) return;
    resolved = true;
    dwell.stop();
    onComplete({ friction, dwell: dwell.elapsedSeconds(), flags: [] });
  }

  tracked.setInterval(() => {
    if (resolved) return;
    if (holding) {
      lean = Math.min(1, lean + LEAN_RATE_PER_TICK);
      ledge.classList.toggle('mg06-grate-visible', lean >= LEAN_GRATE_VISIBLE_THRESHOLD);
      if (lean >= LEAN_FAIL_THRESHOLD) {
        finish(0.4); // Doc 3: ledge fails, falls regardless of intent
      }
    } else {
      lean = Math.max(0, lean - LEAN_RATE_PER_TICK * 2);
      ledge.classList.toggle('mg06-grate-visible', lean >= LEAN_GRATE_VISIBLE_THRESHOLD);
    }
  }, 100);

  tracked.on(ledge, 'pointerdown', () => {
    if (!resolved) holding = true;
  });
  tracked.on(window, 'pointerup', () => {
    holding = false;
  });
  tracked.on(window, 'keydown', (e) => {
    if (e.code === 'Space' && !resolved) holding = true;
  });
  tracked.on(window, 'keyup', (e) => {
    if (e.code === 'Space') holding = false;
  });

  tracked.on(turnBackBtn, 'click', () => {
    if (resolved) return;
    turnBackAttempts++;
    ledge.classList.add('mg06-narrowed');
    ledge.style.setProperty('--narrow', turnBackAttempts);
    if (turnBackAttempts >= MAX_TURN_BACK_ATTEMPTS) {
      finish(0.95); // Doc 3: nowhere to stand, falls
    }
  });

  hardTimeout(tracked, HARD_CAP_SECONDS, () => finish(0.4));

  return {
    setOnComplete(fn) {
      onComplete = fn;
    },
    dispose() {}
  };
}

export default function createMg06(mode) {
  let tracked = null;
  let disposeFn = null;

  return defineMinigame({
    id: 'MG-06',
    mode,
    mount(container, state, onComplete, sceneAssets, services) {
      tracked = createTrackedListeners();
      const result = mode === 'C' ? mountModeC(container, tracked) : mountModeH(container, tracked);
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
