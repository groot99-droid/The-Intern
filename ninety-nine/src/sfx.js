// Doc 4 §10 Phase 6 / plan §7: originally no VO or mechanical SFX files were
// generated (README "Not generated" list -- speaker click/hiss, receptionist
// lines, stapler thud, CRT degauss, door screech, car alarm, package drag,
// concrete grains, chute scrape), so every cue below was a procedural Web
// Audio stand-in: noise bursts + envelopes, filtered clicks, oscillator
// sweeps. Most of that list has since been recorded for real (REAL_FILES
// below) and routed through audio.js's playOneShot() instead of synthesis --
// see each cue's real-file entry. The receptionist's spoken lines are the
// one deliberate exception kept out of CUES entirely: her words are already
// full UI text in text/system.json, presented as on-screen text cards, and
// this module still does not fake dialogue with TTS. `receptionist-voice`
// is real recorded audio (REAL_FILES only, no synthesized fallback) played
// alongside those cards, not a replacement for them.
//
// For everything still without a real recording, this module keeps
// providing the clearly-labeled engine-synthesized stand-in so mini-games
// get *some* diegetic audio feedback instead of silence. Doc 4 §6.3:
// mini-games request nodes from audio.js's bus; this module is itself the
// only thing allowed to build synthesis graphs, and it never creates its
// own AudioContext -- it uses audio.getContext()/getSfxBus().

function noiseBurst(ctx, bus, { durationMs = 120, filterHz = 2000, filterType = 'bandpass', gain = 0.3 }) {
  const sampleCount = Math.max(1, Math.floor((ctx.sampleRate * durationMs) / 1000));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterHz;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);

  src.connect(filter).connect(g).connect(bus);
  src.start();
  src.stop(ctx.currentTime + durationMs / 1000 + 0.05);
}

function toneClick(ctx, bus, { freq = 220, durationMs = 60, gain = 0.4, type = 'square' }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
  osc.connect(g).connect(bus);
  osc.start();
  osc.stop(ctx.currentTime + durationMs / 1000 + 0.05);
}

function pitchSweep(ctx, bus, { from = 800, to = 80, durationMs = 400, gain = 0.35, type = 'sawtooth' }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), ctx.currentTime + durationMs / 1000);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
  osc.connect(g).connect(bus);
  osc.start();
  osc.stop(ctx.currentTime + durationMs / 1000 + 0.05);
}

const CUES = {
  'speaker-click': (ctx, bus) => toneClick(ctx, bus, { freq: 1200, durationMs: 15, gain: 0.25, type: 'square' }),
  'speaker-hiss': (ctx, bus) => noiseBurst(ctx, bus, { durationMs: 250, filterHz: 4000, filterType: 'highpass', gain: 0.15 }),
  'stapler-thud': (ctx, bus) => {
    toneClick(ctx, bus, { freq: 90, durationMs: 40, gain: 0.5, type: 'square' });
    noiseBurst(ctx, bus, { durationMs: 30, filterHz: 1500, gain: 0.2 });
  },
  'flag-reject-beep': (ctx, bus) => toneClick(ctx, bus, { freq: 320, durationMs: 90, gain: 0.3, type: 'square' }),
  'requisition-chime': (ctx, bus, { detuneCents = 0 } = {}) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.detune.value = detuneCents;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.connect(g).connect(bus);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  },
  'door-rattle': (ctx, bus, opts = {}) => noiseBurst(ctx, bus, { durationMs: 80, filterHz: 300, filterType: 'lowpass', gain: 0.35, ...opts }),
  'metal-tear-screech': (ctx, bus) => pitchSweep(ctx, bus, { from: 1800, to: 200, durationMs: 900, gain: 0.3, type: 'sawtooth' }),
  'crt-degauss': (ctx, bus) => pitchSweep(ctx, bus, { from: 60, to: 400, durationMs: 350, gain: 0.25, type: 'triangle' }),
  'car-alarm': (ctx, bus) => {
    toneClick(ctx, bus, { freq: 1100, durationMs: 120, gain: 0.3, type: 'square' });
  },
  'concrete-grains': (ctx, bus) => noiseBurst(ctx, bus, { durationMs: 600, filterHz: 3000, filterType: 'highpass', gain: 0.12 }),
  'chute-scrape': (ctx, bus) => noiseBurst(ctx, bus, { durationMs: 1200, filterHz: 800, filterType: 'lowpass', gain: 0.2 }),
  'package-drag': (ctx, bus) => noiseBurst(ctx, bus, { durationMs: 500, filterHz: 500, filterType: 'lowpass', gain: 0.18 }),
  'starter-motor': (ctx, bus) => {
    noiseBurst(ctx, bus, { durationMs: 200, filterHz: 600, gain: 0.25 });
    toneClick(ctx, bus, { freq: 60, durationMs: 200, gain: 0.3, type: 'square' });
  },
  // Added alongside the RETAINED ending / real-SFX pass -- no synthesized
  // stand-in previously existed because nothing called these yet.
  'curtain-rustle': (ctx, bus) => noiseBurst(ctx, bus, { durationMs: 350, filterHz: 1200, filterType: 'lowpass', gain: 0.15 }),
  'paper-handoff': (ctx, bus) => noiseBurst(ctx, bus, { durationMs: 300, filterHz: 2500, filterType: 'highpass', gain: 0.15 }),
  'keyboard-press': (ctx, bus) => toneClick(ctx, bus, { freq: 1800, durationMs: 12, gain: 0.15, type: 'square' }),
  // Deliberately silent with no real file: see the header comment. Exists
  // so branch.sfxCue entries can reference it without an "unknown cue" log.
  'receptionist-voice': () => {}
};

// Real recordings that replace a synthesized CUES entry above, keyed by the
// same cue name. play() below checks here first; if audio.playOneShot()
// exists, the file plays instead of the procedural stand-in. Filenames
// follow the S{n}_{R}_SFX_* scheme (README's "outside §1" table); X means a
// file shared by both branches of a scene, same convention as S0_X_*.
const REAL_FILES = {
  'speaker-click': 'S2_C_SFX_SPEAKER.wav',
  'speaker-hiss': 'S2_H_SFX_SPEAKER.wav',
  'receptionist-voice': 'S2_X_SFX_RECEPTIONIST.wav',
  'curtain-rustle': 'S3_C_SFX_CURTAIN.wav',
  'door-rattle': 'S3_H_SFX_DOOR.wav',
  'paper-handoff': 'S4_C_SFX_PAPERS.wav',
  'stapler-thud': 'S5_C_SFX_STAPLER.wav',
  'crt-degauss': 'S5_C_SFX_CRT_ON.wav',
  'car-alarm': 'S5_H_SFX_CARALARM.wav',
  'keyboard-press': 'S6_C_SFX_KEYBOARD.wav'
};

export const REAL_SFX_FILES = REAL_FILES; // exported for test/cases/manifest.validate.js

export function createSfx(audio) {
  return {
    play(name, opts) {
      const ctx = audio && audio.getContext ? audio.getContext() : null;
      const bus = audio && audio.getSfxBus ? audio.getSfxBus() : null;
      if (!ctx || !bus) return; // silent no-op before S0's SUBMIT gesture (Doc 4 §7.4)

      const realFile = REAL_FILES[name];
      if (realFile && audio.playOneShot) {
        audio.playOneShot(realFile);
        return;
      }

      const cue = CUES[name];
      if (!cue) {
        console.debug(`sfx.js: unknown cue "${name}"`);
        return;
      }
      cue(ctx, bus, opts);
    },
    availableCues: Object.keys(CUES)
  };
}
