// Doc 4 §6.2/§6.3, Doc 3 §1/§4. Shared scaffolding for all 11 minigame
// modes across the 7 components. A minigame receives a frozen read-only
// state snapshot (router.js) and must never: import state.js directly,
// modify conformance/dissonance, stop/restart/replace the drone, create its
// own AudioContext, or leave listeners/timers/audio nodes alive after
// unmount(). TrackedListeners below makes the last one structural instead
// of a discipline problem repeated across 7 files.
//
// Each mg0X-*.js file's default export is a factory: (mode) => instance,
// since one file can cover two modes (11 modes, 7 files -- see router.js's
// mountMinigameOrFallback).

export function createFrictionAccumulator(initial = 0) {
  let value = Math.min(1, Math.max(0, initial));
  return {
    add(delta) {
      value = Math.min(1, Math.max(0, value + delta));
      return value;
    },
    set(v) {
      value = Math.min(1, Math.max(0, v));
      return value;
    },
    value() {
      return value;
    },
    reset() {
      value = 0;
    }
  };
}

export function createDwellTimer() {
  let startedAt = null;
  let accumulated = 0;
  return {
    start() {
      startedAt = performance.now();
    },
    stop() {
      if (startedAt !== null) {
        accumulated += (performance.now() - startedAt) / 1000;
        startedAt = null;
      }
    },
    elapsedSeconds() {
      const live = startedAt !== null ? (performance.now() - startedAt) / 1000 : 0;
      return accumulated + live;
    }
  };
}

// Doc 3 §4 rule 5: the reduced-motion path must produce identical friction
// outcomes -- accessibility never changes the reading the building takes.
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Doc 4 §6.3 / §11.3: mount and unmount 50x must return listener/timer/
// audio-node counts to baseline. Route every addEventListener/setTimeout/
// setInterval/audio-node-creation through this so unmount() can call one
// disposeAll() and guarantee that structurally.
export function createTrackedListeners() {
  const listeners = [];
  const timeouts = new Set();
  const intervals = new Set();
  const audioNodes = [];

  return {
    on(target, type, fn, options) {
      target.addEventListener(type, fn, options);
      listeners.push({ target, type, fn, options });
    },
    setTimeout(fn, ms) {
      const id = window.setTimeout(() => {
        timeouts.delete(id);
        fn();
      }, ms);
      timeouts.add(id);
      return id;
    },
    clearTimeout(id) {
      window.clearTimeout(id);
      timeouts.delete(id);
    },
    setInterval(fn, ms) {
      const id = window.setInterval(fn, ms);
      intervals.add(id);
      return id;
    },
    clearInterval(id) {
      window.clearInterval(id);
      intervals.delete(id);
    },
    trackAudioNode(node) {
      audioNodes.push(node);
      return node;
    },
    disposeAll() {
      for (const { target, type, fn, options } of listeners) {
        target.removeEventListener(type, fn, options);
      }
      listeners.length = 0;
      for (const id of timeouts) window.clearTimeout(id);
      timeouts.clear();
      for (const id of intervals) window.clearInterval(id);
      intervals.clear();
      for (const node of audioNodes) {
        try {
          node.disconnect();
        } catch {
          // already disconnected
        }
      }
      audioNodes.length = 0;
    },
    _debugCounts() {
      return { listeners: listeners.length, timeouts: timeouts.size, intervals: intervals.size, audioNodes: audioNodes.length };
    }
  };
}

// Doc 3 §4 rule 1: every component has a guaranteed exit, hard timeouts
// where listed (MG-02 6 breaks, MG-03 240s, MG-05 90s standing, etc.).
export function hardTimeout(tracked, seconds, onFire) {
  return tracked.setTimeout(onFire, seconds * 1000);
}

// Doc 4 §6.2's export shape, enforced at definition time rather than
// discovered at runtime inside the game.
export function defineMinigame({ id, mode, reducedMotion = false, mount, unmount }) {
  if (!id || !mode || typeof mount !== 'function' || typeof unmount !== 'function') {
    throw new Error('_contract.js: minigame definition missing required fields (id, mode, mount, unmount)');
  }
  return { id, mode, reducedMotion, mount, unmount };
}
