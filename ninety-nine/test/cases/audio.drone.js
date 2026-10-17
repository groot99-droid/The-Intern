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

  await runCase('the store hum (setHum): its own oscillator, started once, carrying the drone\'s detune; the drone is never started, stopped or retuned by it (C7)', () => {
    const audio = createAudio();
    audio.setHum({ hz: 48 }); // before any context: a no-op, nothing created
    assertEqual(audio._debugHum(), null, 'no hum without a context');
    audio.unlock();
    audio.startDrone();
    for (let i = 0; i <= 8; i++) audio.advanceScene(i);
    const droneTo = audio._debugDroneDetuneTo();
    assertEqual(droneTo, 32, 'the drone is ramping to S8\'s 8 x 4 cents');
    const droneNow = audio._debugDetuneValue();
    const starts = spyStarts(() => {
      audio.setHum({ hz: 48, gain: 0.018, followDrone: true });
      audio.setHum({ hz: 48, gain: 0.02, followDrone: true }); // the ending carries it on
    });
    assertEqual(starts, 1, `the hum starts one oscillator of its own, once (got ${starts})`);
    assertEqual(audio._debugDroneStartCount(), 1, 'the drone was not restarted');
    assertEqual(audio._debugDroneDetuneTo(), droneTo, 'the drone\'s detune target is untouched');
    // (a running context moves the drone along its own ramp between reads: a cent of slack)
    assertEqual(Math.abs(audio._debugDetuneValue() - droneNow) < 1, true, 'the drone\'s detune is untouched');
    const h = audio._debugHum();
    assertEqual(h.detuneTo, droneTo, 'the hum is detuned exactly as far as the drone (Doc 1 §6.4)');
    assertEqual(h.follow, true, 'followDrone');
    audio.advanceScene(9); // were the drone to move on, the hum goes with it
    assertEqual(audio._debugHum().detuneTo, 36, 'the hum follows a later ramp');
    audio.setHum({ hz: 48, followDrone: false });
    assertEqual(audio._debugHum().detuneTo, 0, 'followDrone: false is the literal 48 Hz');
    let stops = 0;
    const originalStop = OscillatorNode.prototype.stop;
    OscillatorNode.prototype.stop = function (...args) { stops++; return originalStop.apply(this, args); };
    try { audio.setHum(null, { ms: 200 }); audio.setHum(null); } finally { OscillatorNode.prototype.stop = originalStop; }
    assertEqual(stops, 1, `fading the hum out stops its own oscillator only (got ${stops} stops)`);
    assertEqual(audio._debugHum(), null, 'the hum is gone');
    assertEqual(audio._debugDroneStartCount(), 1, 'the drone runs on');
  });

  await runCase('fadeOutForEnding() takes the hum down with the beds (the card), and the drone is still never restarted', () => {
    const audio = createAudio();
    audio.unlock();
    audio.startDrone();
    audio.setHum({ hz: 48 });
    audio.fadeOutForEnding({ bedsMs: 300, droneMs: 600 });
    assertEqual(audio._debugHum(), null, 'the hum fades at the card');
    audio.startDrone();
    assertEqual(audio._debugDroneStartCount(), 1, 'drone started once');
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
