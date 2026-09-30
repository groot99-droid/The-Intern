// Doc 3 MG-02: THE SCAN (mode C) / THE DOOR (mode H).

import { defineMinigame, createFrictionAccumulator, createDwellTimer, createTrackedListeners, hardTimeout, prefersReducedMotion } from './_contract.js';

const HOLD_SECONDS = 4.0;
const BREAK_FRICTION = 0.12;
const MAX_BREAKS = 6;
const DOOR_HANDPRINT_EVERY = 5;
const DOOR_COUNTED_THRESHOLD = 30;
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

  const scene = el('div', 'mg02-scan-scene');
  const zone = el('div', 'mg02-scan-zone', 'HOLD');
  if (prefersReducedMotion()) zone.classList.add('mg02-static-beam');
  scene.appendChild(zone);
  container.appendChild(scene);

  let holding = false;
  let holdStart = 0;
  let breaks = 0;

  function finish(overrideFriction) {
    if (resolved) return;
    resolved = true;
    dwell.stop();
    if (overrideFriction !== undefined) friction.set(overrideFriction);
    onComplete({ friction: friction.value(), dwell: dwell.elapsedSeconds(), flags: [] });
  }

  function startHold() {
    if (resolved || holding) return;
    holding = true;
    holdStart = performance.now();
    zone.classList.add('mg02-holding');
  }

  function breakHold() {
    if (resolved || !holding) return;
    holding = false;
    zone.classList.remove('mg02-holding');
    breaks++;
    friction.add(BREAK_FRICTION);
    if (breaks >= MAX_BREAKS) {
      finish(0.75); // Doc 3: reader gives up, gate opens anyway
    }
  }

  tracked.on(zone, 'pointerdown', startHold);
  tracked.on(zone, 'pointerup', breakHold);
  tracked.on(zone, 'pointerleave', breakHold);
  tracked.on(window, 'keydown', (e) => {
    if (e.code === 'Space') startHold();
  });
  tracked.on(window, 'keyup', (e) => {
    if (e.code === 'Space') breakHold();
  });

  tracked.setInterval(() => {
    if (resolved || !holding) return;
    const elapsed = (performance.now() - holdStart) / 1000;
    if (elapsed >= HOLD_SECONDS) {
      finish(0); // clean hold, friction 0.0
    }
  }, 50);

  hardTimeout(tracked, HARD_CAP_SECONDS, () => finish(0.75));

  return {
    setOnComplete(fn) {
      onComplete = fn;
    },
    dispose() {}
  };
}

function mountModeH(container, tracked, services) {
  const dwell = createDwellTimer();
  dwell.start();
  let resolved = false;
  let onComplete;

  const scene = el('div', 'mg02-door-scene');
  const doorBar = el('button', 'mg02-push-bar', 'PUSH THE BAR');
  const handprints = el('div', 'mg02-handprints');
  const stopBtn = el('button', 'mg02-stop-btn', 'STOP');
  scene.append(doorBar, handprints, stopBtn);
  container.appendChild(scene);

  let pushCount = 0;

  function finish() {
    if (resolved) return;
    resolved = true;
    dwell.stop();
    let friction;
    const flags = [];
    if (pushCount < 10) friction = 0.2;
    else if (pushCount < DOOR_COUNTED_THRESHOLD) friction = 0.5;
    else {
      friction = 0.9;
      flags.push('COUNTED_DOOR');
    }
    onComplete({ friction, dwell: dwell.elapsedSeconds(), flags });
  }

  tracked.on(doorBar, 'click', () => {
    if (resolved) return;
    pushCount++;
    // Doc 3: "each push is fractionally quieter than the last."
    if (services && services.sfx) services.sfx.play('door-rattle', { gain: Math.max(0.05, 0.35 - pushCount * 0.01) });
    if (pushCount % DOOR_HANDPRINT_EVERY === 0 && pushCount >= 10 && pushCount < DOOR_COUNTED_THRESHOLD) {
      const print = el('div', 'mg02-handprint');
      print.style.left = `${20 + Math.random() * 60}%`;
      handprints.appendChild(print);
    }
  });

  tracked.on(stopBtn, 'click', finish);
  hardTimeout(tracked, HARD_CAP_SECONDS, finish);

  return {
    setOnComplete(fn) {
      onComplete = fn;
    },
    dispose() {}
  };
}

export default function createMg02(mode) {
  let tracked = null;
  let disposeFn = null;

  return defineMinigame({
    id: 'MG-02',
    mode,
    mount(container, state, onComplete, sceneAssets, services) {
      tracked = createTrackedListeners();
      const result = mode === 'C' ? mountModeC(container, tracked) : mountModeH(container, tracked, services);
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
