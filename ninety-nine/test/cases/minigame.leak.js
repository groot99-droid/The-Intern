// Doc 4 §6.3/§11.3: mount and unmount every mini-game 50x, assert listener
// and timer counts return to baseline. Built in Phase 4 (MG-05 is the first
// consumer of _contract.js's TrackedListeners) and reused unmodified as
// Phase 5 lands the remaining six. Modules not yet built are skipped, same
// pattern as manifest.validate.js's assertion 3.

import { runCase, assert } from '../harness.js';

async function loadJSON(path) {
  const res = await fetch(path);
  return res.json();
}

function spyListeners() {
  let active = 0;
  const origAdd = EventTarget.prototype.addEventListener;
  const origRemove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (...args) {
    active++;
    return origAdd.apply(this, args);
  };
  EventTarget.prototype.removeEventListener = function (...args) {
    active--;
    return origRemove.apply(this, args);
  };
  return {
    count: () => active,
    restore: () => {
      EventTarget.prototype.addEventListener = origAdd;
      EventTarget.prototype.removeEventListener = origRemove;
    }
  };
}

// A setTimeout that FIRES naturally is not a leak -- only one that's
// registered and never fires and never gets cleared is. (setInterval is
// different: it repeats forever, so it must always be explicitly cleared.)
function spyTimers() {
  let active = 0;
  const timeoutState = new Map(); // id -> {fired}
  const intervalIds = new Set();
  const origSetTimeout = window.setTimeout;
  const origClearTimeout = window.clearTimeout;
  const origSetInterval = window.setInterval;
  const origClearInterval = window.clearInterval;

  window.setTimeout = function (fn, ms, ...rest) {
    active++;
    const id = origSetTimeout.call(window, function (...args) {
      const st = timeoutState.get(id);
      if (st && !st.fired) {
        st.fired = true;
        active--;
      }
      return fn.apply(this, args);
    }, ms, ...rest);
    timeoutState.set(id, { fired: false });
    return id;
  };
  window.clearTimeout = function (id) {
    const st = timeoutState.get(id);
    if (st && !st.fired) {
      st.fired = true;
      active--;
    }
    return origClearTimeout.call(window, id);
  };
  window.setInterval = function (...args) {
    active++;
    const id = origSetInterval.apply(window, args);
    intervalIds.add(id);
    return id;
  };
  window.clearInterval = function (id) {
    if (intervalIds.has(id)) {
      intervalIds.delete(id);
      active--;
    }
    return origClearInterval.call(window, id);
  };

  return {
    count: () => active,
    restore: () => {
      window.setTimeout = origSetTimeout;
      window.clearTimeout = origClearTimeout;
      window.setInterval = origSetInterval;
      window.clearInterval = origClearInterval;
    }
  };
}

async function testModule(modName, mode) {
  let factory;
  try {
    factory = (await import(`../../src/minigames/${modName}.js`)).default;
  } catch {
    return 'skip';
  }

  const container = document.createElement('div');
  const snapshot = Object.freeze({ conformance: 0, dissonance: 0, friction: 0, flags: new Set(), formAnswers: {} });
  const sceneAssets = { screenRect: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 }, npcSprite: null };

  const listenerSpy = spyListeners();
  const timerSpy = spyTimers();

  for (let i = 0; i < 50; i++) {
    const instance = factory(mode);
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        instance.unmount();
        resolve();
      };
      // 20ms synthetic force-complete -- this is a leak/lifecycle check,
      // not a real interaction; components with no fail state (Doc 3 §4
      // rule 1) always have some exit path, but we don't wait for it here.
      const forceTimer = setTimeout(finish, 20);
      instance.mount(container, snapshot, () => {
        clearTimeout(forceTimer);
        finish();
      }, sceneAssets, { audio: null, sfx: null });
    });
  }

  listenerSpy.restore();
  timerSpy.restore();

  return { leftoverListeners: listenerSpy.count(), leftoverTimers: timerSpy.count() };
}

export async function run() {
  const manifest = await loadJSON('../../data/scenes.json');
  const modules = new Map();
  for (const scene of Object.values(manifest.scenes)) {
    for (const branch of Object.values(scene.branches)) {
      if (branch.minigame) {
        if (!modules.has(branch.minigame.module)) modules.set(branch.minigame.module, new Set());
        modules.get(branch.minigame.module).add(branch.minigame.mode);
      }
    }
  }

  for (const [modName, modes] of modules) {
    for (const mode of modes) {
      await runCase(`minigame.leak: ${modName} (${mode}) x50 mount/unmount returns to baseline`, async () => {
        const result = await testModule(modName, mode);
        if (result === 'skip') return;
        assert(result.leftoverListeners === 0, `${result.leftoverListeners} listeners leaked`);
        assert(result.leftoverTimers === 0, `${result.leftoverTimers} timers leaked`);
      });
    }
  }
}
