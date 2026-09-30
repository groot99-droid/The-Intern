// Doc 4 §7. The drone is a single OscillatorNode, created once on S0's
// SUBMIT click (the diegetic user gesture, §7.4) and never stopped until the
// game ends. Everything else (ambience crossfade, ducking, sfx bus) hangs
// off the same AudioContext/master bus (§7.2).
//
// Doc 4 §6.3 / §11.3: `osc.start()` must be called exactly once per
// playthrough -- Drone.start() below is idempotent (guarded by `started`)
// specifically so a stray double-call from router.js can't violate that.

import { DRONE_HZ, DETUNE_PER_SCENE } from './state.js';

class Drone {
  constructor(ctx, master) {
    this.ctx = ctx;
    this.started = false;

    this.osc = ctx.createOscillator();
    this.osc.type = 'sine';
    this.osc.frequency.value = DRONE_HZ;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0.06;

    // Ducking (§7.3) filters, never stops, the drone.
    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 20000; // effectively bypassed until ducked

    this.osc.connect(this.gain).connect(this.lowpass).connect(master);

    // Second, literal 48Hz reference oscillator: silent until scene 5,
    // ramping to gain 0.02 by S8, so the beat against the detuned primary
    // is physical rather than only remembered (§7.1's "test both versions"
    // note -- shipping both, since the doc says the literal version
    // "reliably works").
    this.refOsc = ctx.createOscillator();
    this.refOsc.type = 'sine';
    this.refOsc.frequency.value = DRONE_HZ;
    this.refGain = ctx.createGain();
    this.refGain.gain.value = 0.0;
    this.refOsc.connect(this.refGain).connect(master);
  }

  start() {
    if (this.started) return;
    this.osc.start();
    this.refOsc.start();
    this.started = true;
  }

  advanceScene(sceneIndex) {
    const t = this.ctx.currentTime;
    this.osc.detune.cancelScheduledValues(t);
    this.osc.detune.linearRampToValueAtTime(sceneIndex * DETUNE_PER_SCENE, t + 8);

    if (sceneIndex >= 5) {
      const refTarget = 0.02 * Math.min(1, (sceneIndex - 5) / 3); // ramps in across S5..S8
      this.refGain.gain.cancelScheduledValues(t);
      this.refGain.gain.linearRampToValueAtTime(refTarget, t + 8);
    }
  }
}

function createAmbiencePool(ctx, master) {
  const els = [new Audio(), new Audio()];
  const gains = els.map(() => ctx.createGain());
  els.forEach((el, i) => {
    el.loop = true;
    const src = ctx.createMediaElementSource(el);
    src.connect(gains[i]).connect(master);
  });
  gains[0].gain.value = 1;
  gains[1].gain.value = 0;
  let active = 0;
  let currentFile = null;

  return {
    async play(file, { crossfadeMs = 400, base = './assets/aud/' } = {}) {
      if (!file || file === currentFile) return; // null/unchanged = carry over previous bed (Doc 1 §5 S2)
      currentFile = file;
      const nextIdx = 1 - active;
      const el = els[nextIdx];
      el.src = `${base}${file}`;
      try {
        await el.play();
      } catch (e) {
        console.warn('audio.js: ambience play() blocked (needs a user gesture first)', e);
        return;
      }
      const t = ctx.currentTime;
      gains[nextIdx].gain.cancelScheduledValues(t);
      gains[nextIdx].gain.setValueAtTime(gains[nextIdx].gain.value, t);
      gains[nextIdx].gain.linearRampToValueAtTime(1, t + crossfadeMs / 1000);
      gains[active].gain.cancelScheduledValues(t);
      gains[active].gain.setValueAtTime(gains[active].gain.value, t);
      gains[active].gain.linearRampToValueAtTime(0, t + crossfadeMs / 1000);
      const prevIdx = active;
      active = nextIdx;
      setTimeout(() => els[prevIdx].pause(), crossfadeMs + 50);
    }
  };
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let drone = null;
  let sfxBus = null;
  let ambience = null;
  // Mute gates the single master bus everything else connects to (drone,
  // ambience, sfx one-shots and synth cues alike), so one flag silences the
  // whole game. Read at context creation and whenever toggled thereafter --
  // set-before-SUBMIT is legal (it's just a flag until ensureContext() runs).
  let muted = true;

  function ensureContext() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1.0;
    master.connect(ctx.destination);
    drone = new Drone(ctx, master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.8;
    sfxBus.connect(master);
    ambience = createAmbiencePool(ctx, master);
    return ctx;
  }

  return {
    // Doc 4 §7.4: call ONLY from S0's SUBMIT click, nowhere else.
    initOnGesture() {
      ensureContext();
      drone.start();
    },

    // Doc 4 §7.4: if the context is suspended later, resume silently and log it.
    resumeIfSuspended() {
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => console.log('audio.js: resumed suspended AudioContext'));
      }
    },

    advanceScene(sceneIndex) {
      if (drone) drone.advanceScene(sceneIndex);
    },

    playAmbience(file, opts) {
      if (ambience) ambience.play(file, opts);
    },

    // Real delivered one-shots (currently only S4_H_SFX_FOOTSTEPS.wav) --
    // distinct from sfx.js's synthesized stand-ins for the SFX that were
    // never generated. Fire-and-forget, routed through the sfx bus.
    playOneShot(file, { base = './assets/aud/', gain = 0.7 } = {}) {
      if (!ctx || !sfxBus || !file) return;
      const el = new Audio(`${base}${file}`);
      const src = ctx.createMediaElementSource(el);
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(sfxBus);
      el.play().catch((e) => console.warn(`audio.js: one-shot play() blocked for ${file}`, e));
    },

    duckDrone({ lowpassHz = 400, gain = 0.5, ms = 1200 } = {}) {
      if (!drone) return;
      const t = ctx.currentTime;
      drone.lowpass.frequency.cancelScheduledValues(t);
      drone.lowpass.frequency.setValueAtTime(drone.lowpass.frequency.value, t);
      drone.lowpass.frequency.linearRampToValueAtTime(lowpassHz, t + ms / 1000);
      drone.gain.gain.cancelScheduledValues(t);
      drone.gain.gain.setValueAtTime(drone.gain.gain.value, t);
      drone.gain.gain.linearRampToValueAtTime(0.06 * gain, t + ms / 1000);
    },

    restoreDrone({ ms = 800 } = {}) {
      if (!drone) return;
      const t = ctx.currentTime;
      drone.lowpass.frequency.cancelScheduledValues(t);
      drone.lowpass.frequency.setValueAtTime(drone.lowpass.frequency.value, t);
      drone.lowpass.frequency.linearRampToValueAtTime(20000, t + ms / 1000);
      drone.gain.gain.cancelScheduledValues(t);
      drone.gain.gain.setValueAtTime(drone.gain.gain.value, t);
      drone.gain.gain.linearRampToValueAtTime(0.06, t + ms / 1000);
    },

    // Sound toggle (src/soundToggle.js). Ramped, not stepped, so flipping it
    // mid-scene isn't an audible click of its own. Safe to call before the
    // AudioContext exists (pre-SUBMIT) -- just updates the flag ensureContext()
    // reads when it eventually runs.
    setMuted(value) {
      muted = !!value;
      if (master) {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(muted ? 0 : 1.0, t + 0.15);
      }
    },
    toggleMute() {
      this.setMuted(!muted);
      return muted;
    },
    isMuted() { return muted; },

    // Exposed for sfx.js (Phase 6) and mini-games (Doc 4 §6.3: "requests
    // nodes from audio.js; must not create an AudioContext").
    getContext() { return ctx; },
    getSfxBus() { return sfxBus; },
    getMaster() { return master; },

    // Test-only introspection (test/cases/audio.drone.js).
    _debugDroneStartCount() { return drone && drone.started ? 1 : 0; },
    _debugDetuneValue() { return drone ? drone.osc.detune.value : null; }
  };
}
