// Doc 4 §11.3: "Drone continuity, full playthrough -> osc.start() called
// exactly once." In the walkable build the AudioContext is unlocked by the
// first gesture in the apartment (room tone, footsteps, music), but C7's
// drone only starts when the lobby doors close behind the candidate
// (director.js reportBeat -> audio.startDrone()). So: unlock() never starts
// it, startDrone() starts it once however often it is called. The manual
// listening test (Phase 2's real gate, "cannot be automated" per Doc 4 §10)
// still has to happen by ear -- this only catches an accidental second
// start() structurally, via a real OscillatorNode.prototype spy as well as
// the audio module's own debug hook.

import { createAudio } from '../../src/audio.js';
import { runCase, assertEqual } from '../harness.js';

function hasWebAudio() {
  return typeof OscillatorNode !== 'undefined' && typeof AudioContext !== 'undefined';
}

// Counts OscillatorNode.start() calls made by fn() and the drone's own
// oscillators (primary + 48 Hz reference) separately from anything else
// (music.js may start voices of its own once unlocked).
function spyStarts(fn) {
  let calls = 0;
  const originalStart = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...args) {
    calls++;
    return originalStart.apply(this, args);
  };
  try { fn(); } finally { OscillatorNode.prototype.start = originalStart; }
  return calls;
}

export async function run() {
  if (!hasWebAudio()) {
    await runCase('audio.drone: (skipped: Web Audio API unavailable in this browser)', () => {});
    return;
  }

  await runCase('unlock() x3 never starts the drone (C7: room tone before the lobby, no drone)', () => {
    const audio = createAudio();
    audio.unlock();
    audio.unlock();
    audio.unlock();
    assertEqual(audio._debugDroneStartCount(), 0, 'drone started by unlock()');
    assertEqual(audio.getContext() !== null, true, 'unlock() should create the AudioContext');
  });

  await runCase('startDrone() x3 starts the drone exactly once (primary + reference oscillator, one start() each)', () => {
    const audio = createAudio();
    audio.unlock();
    const calls = spyStarts(() => {
      audio.startDrone();
      audio.startDrone(); // the lobby doors closing twice, a dev ?start= on top of it
      audio.startDrone({ fadeMs: 400 });
    });
    assertEqual(calls, 2, `expected exactly 2 real oscillator starts (primary + 48Hz reference), got ${calls}`);
    assertEqual(audio._debugDroneStartCount(), 1, 'drone started');
  });

  await runCase('startDrone() before any unlock() creates the context and still starts once', () => {
    const audio = createAudio();
    const calls = spyStarts(() => { audio.startDrone(); audio.startDrone(); });
    assertEqual(calls, 2, `expected 2 oscillator starts, got ${calls}`);
    assertEqual(audio._debugDroneStartCount(), 1, 'drone started');
  });

  await runCase('initOnGesture() (the old one-call path) x3 starts the drone exactly once', () => {
    const audio = createAudio();
    audio.unlock(); // so any music.js voices start outside the spy
    const calls = spyStarts(() => {
      audio.initOnGesture();
      audio.initOnGesture(); // simulate an accidental double-init
      audio.initOnGesture();
    });
    assertEqual(calls, 2, `expected exactly 2 real oscillator starts (primary + 48Hz reference), got ${calls}`);
    assertEqual(audio._debugDroneStartCount(), 1, 'drone started');
  });

  await runCase('advanceScene() runs across the full spine (S0..S8) without throwing, before and after the drone starts', () => {
    const before = createAudio();
    for (let i = 0; i <= 8; i++) before.advanceScene(i); // no context yet: a no-op
    const audio = createAudio();
    audio.unlock();
    for (let i = 0; i <= 1; i++) audio.advanceScene(i);
    audio.startDrone();
    for (let i = 0; i <= 8; i++) audio.advanceScene(i);
    assertEqual(audio._debugDroneStartCount(), 1, 'advanceScene never restarts the drone');
  });
}
