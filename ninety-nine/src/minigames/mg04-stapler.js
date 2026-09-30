// Doc 3 MG-04: THE STAPLER (mode C) / THE IGNITION (mode H).
//
// Mode C simplification: Doc 3 says "the tempo lives only in when the
// papers land. No metronome [is audible]" -- so this reads as a
// click-and-check-timing interaction rather than a strict input-every-beat
// rhythm game. A click is scored against the nearest scheduled beat; there
// is no penalty for simply not clicking between beats (that case is
// covered separately by the documented "stop entirely for 10s" exit).

import { defineMinigame, createFrictionAccumulator, createDwellTimer, createTrackedListeners, hardTimeout } from './_contract.js';

const START_BPM = 72;
const BPM_PER_STAPLE = 0.4;
const TARGET_STAPLES = 40;
const HIT_TOLERANCE_MS = 180;
const OBSTRUCTION_LIMIT = 15;
const STOP_IDLE_SECONDS = 10;
const HARD_CAP_SECONDS = 180;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function mountModeC(container, tracked, services) {
  const friction = createFrictionAccumulator();
  const dwell = createDwellTimer();
  dwell.start();
  let resolved = false;

  const scene = el('div', 'mg04-scene');
  const stack = el('div', 'mg04-stack');
  const stapleBtn = el('button', 'mg04-staple-btn', 'STAPLE');
  scene.append(stack, stapleBtn);
  container.appendChild(scene);

  let tempo = START_BPM;
  let beatDurationMs = 60000 / tempo;
  let lastBeatTime = performance.now();
  let correctStaples = 0;
  let accumulatedSheets = 0;
  let lastInputTime = performance.now();

  function updateStack() {
    stack.style.setProperty('--sheets', Math.min(accumulatedSheets, OBSTRUCTION_LIMIT));
  }

  function finish(overrideFriction) {
    if (resolved) return;
    resolved = true;
    dwell.stop();
    if (overrideFriction !== undefined) friction.set(overrideFriction);
    onComplete({ friction: friction.value(), dwell: dwell.elapsedSeconds(), flags: [] });
  }

  let onComplete;

  function scheduleBeat() {
    tracked.setTimeout(() => {
      lastBeatTime = performance.now();
      scheduleBeat();
    }, beatDurationMs);
  }
  scheduleBeat();

  tracked.on(stapleBtn, 'click', () => {
    if (resolved) return;
    lastInputTime = performance.now();
    const delta = Math.abs(performance.now() - lastBeatTime);
    if (delta <= HIT_TOLERANCE_MS) {
      correctStaples++;
      if (services && services.sfx) services.sfx.play('stapler-thud');
      accumulatedSheets = Math.max(0, accumulatedSheets - 1);
      tempo += BPM_PER_STAPLE;
      beatDurationMs = 60000 / tempo;
      if (correctStaples >= TARGET_STAPLES) {
        finish();
        return;
      }
    } else {
      accumulatedSheets++;
      friction.add(0.03);
    }
    updateStack();
  });

  // Doc 3: "Stop entirely for 10 seconds: the papers stop arriving.
  // Silence. Then the monitor wakes anyway... friction 0.85."
  const idleCheck = tracked.setInterval(() => {
    if (resolved) return;
    if ((performance.now() - lastInputTime) / 1000 >= STOP_IDLE_SECONDS) {
      finish(0.85);
    }
  }, 500);
  void idleCheck;

  hardTimeout(tracked, HARD_CAP_SECONDS, () => finish());

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

  const scene = el('div', 'mg04-garage');
  const status = el('div', 'mg04-ignition-status', '');
  const turnKeyBtn = el('button', 'mg04-key-btn', 'TURN THE KEY');
  const leaveBtn = el('button', 'mg04-leave-btn', 'LEAVE THE CAR');
  const fifthCar = el('div', 'mg04-fifth-car', 'a fifth car, far bay, door open, key in the ignition');
  fifthCar.hidden = true;
  scene.append(status, turnKeyBtn, leaveBtn, fifthCar);
  container.appendChild(scene);

  let attempts = 0;

  function finish() {
    if (resolved) return;
    resolved = true;
    dwell.stop();
    let friction;
    if (attempts < 5) friction = 0.2;
    else if (attempts < 20) friction = 0.55;
    else friction = 0.95;
    onComplete({ friction, dwell: dwell.elapsedSeconds(), flags: [] });
  }

  let onComplete;

  tracked.on(turnKeyBtn, 'click', () => {
    if (resolved) return;
    attempts++;
    if (services && services.sfx) services.sfx.play('starter-motor');
    if (attempts === 12) {
      status.textContent = 'a genuine two-cylinder cough.';
    } else {
      status.textContent = 'click, click, a hopeful half-crank, nothing.';
    }
    if (attempts >= 20) fifthCar.hidden = false; // Doc 3: identical behavior, present only visually
  });

  tracked.on(leaveBtn, 'click', finish);
  hardTimeout(tracked, HARD_CAP_SECONDS, finish);

  return {
    setOnComplete(fn) {
      onComplete = fn;
    },
    dispose() {}
  };
}

export default function createMg04(mode) {
  let tracked = null;
  let disposeFn = null;

  return defineMinigame({
    id: 'MG-04',
    mode,
    mount(container, state, onComplete, sceneAssets, services) {
      tracked = createTrackedListeners();
      const result = mode === 'C' ? mountModeC(container, tracked, services) : mountModeH(container, tracked, services);
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
