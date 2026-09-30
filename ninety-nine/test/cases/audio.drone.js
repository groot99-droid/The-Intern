// Doc 4 §11.3: "Drone continuity, full playthrough -> osc.start() called
// exactly once." The manual listening test (Phase 2's real gate, "cannot be
// automated" per Doc 4 §10) still has to happen by ear -- this only catches
// an accidental second start() call structurally, via a real
// OscillatorNode.prototype spy rather than trusting the idempotency guard
// by reading the source.

import { createAudio } from '../../src/audio.js';
import { runCase, assertEqual } from '../harness.js';

export async function run() {
  await runCase('osc.start() fires exactly once (primary + reference) even if initOnGesture() is called repeatedly', () => {
    if (typeof OscillatorNode === 'undefined' || typeof AudioContext === 'undefined') {
      console.warn('audio.drone.js: Web Audio API unavailable in this environment, skipping');
      return;
    }
    let startCalls = 0;
    const originalStart = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      startCalls++;
      return originalStart.apply(this, args);
    };
    try {
      const audio = createAudio();
      audio.initOnGesture();
      audio.initOnGesture(); // simulate an accidental second SUBMIT click / double-init
      audio.initOnGesture();
      assertEqual(startCalls, 2, `expected exactly 2 real oscillator starts (primary + 48Hz reference), got ${startCalls}`);
    } finally {
      OscillatorNode.prototype.start = originalStart;
    }
  });

  await runCase('advanceScene() runs across the full spine (S0..S8) without throwing', () => {
    if (typeof AudioContext === 'undefined') return;
    const audio = createAudio();
    audio.initOnGesture();
    for (let i = 0; i <= 8; i++) audio.advanceScene(i);
  });
}
