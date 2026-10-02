// The stage against the real data: every room builds (box fallbacks when
// the prop library is absent), every shot plays to its end on a stubbed
// clock, a pingpong loop resolves at once, pause/resume/setRate drive the
// shot clock the way MG-05 H expects, and screenRect() finds the terminal
// in S6_C. Runs headless: the WebGL renderer is created on a detached
// container, so this is a smoke test of the data and the shot maths, not
// of what the picture looks like.

import { runCase, assert, assertEqual } from '../harness.js';
import { createStage } from '../../src/stage/stage.js';
import { roomOfEntry, entryRoom, exitRoom, choiceEntryIndex } from '../../src/router.js';

function canWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

export async function run() {
  const [rooms, scenes] = await Promise.all([
    fetch('../data/rooms.json').then((r) => r.json()),
    fetch('../data/scenes.json').then((r) => r.json())
  ]);

  await runCase('router: entryRoom/exitRoom read the first and last entry (S8-C enters the mailroom, leaves the boardroom)', () => {
    const c = scenes.scenes.S8.branches.C;
    assertEqual(entryRoom(c), 'S8_C');
    assertEqual(exitRoom(c), 'SE_ASSIM');
    const h = scenes.scenes.S8.branches.H;
    assertEqual(entryRoom(h), 'SET_DIVE');
    assertEqual(exitRoom(h), 'S8_H');
    assertEqual(roomOfEntry(scenes.scenes.S1.branches.C, scenes.scenes.S1.branches.C.sequence[0]), 'S1_C');
    assertEqual(choiceEntryIndex(h), 0);
  });

  if (!canWebGL()) {
    await runCase('stage: (skipped: no WebGL in this browser)', () => {});
    return;
  }

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-2000px;top:0;width:640px;height:360px;';
  document.body.appendChild(container);
  const library = { ready: Promise.resolve(false), loaded: () => false, failed: () => true, has: () => false, instance: () => null };
  const stage = createStage(container, { rooms, library });

  await runCase('stage: every room in rooms.json builds with the box fallbacks', async () => {
    for (const key of Object.keys(rooms.rooms)) {
      await stage.show(key);
      assertEqual(stage._debug().current, key, `show(${key})`);
    }
  });

  await runCase('stage: a finite shot resolves, a pingpong loop resolves at once, a pose parks', async () => {
    const t0 = performance.now();
    await stage.playShot('S2_C', 'call'); // 4 s move: resolves when done (real time, rAF-driven)
    const dt = performance.now() - t0;
    assert(dt >= 3500, `call should take ~4 s, took ${Math.round(dt)} ms`);
    const t1 = performance.now();
    await stage.playShot('S1_C', 'loop');
    assert(performance.now() - t1 < 500, 'a pingpong loop must resolve immediately');
    assert(stage._debug().shot && stage._debug().shot.pingpong, 'loop still running');
    await stage.holdPose('S1_C', 'in');
    assertEqual(stage._debug().shot, null, 'holdPose clears the shot');
    const cam = stage._debug().camera;
    const pose = rooms.rooms.S1_C.shots.in.pos;
    assert(Math.abs(cam[0] - pose[0]) < 1e-6 && Math.abs(cam[2] - pose[2]) < 1e-6, 'camera parked on the pose');
  });

  await runCase('stage: pause freezes the shot clock, setRate scales it (MG-05 H)', async () => {
    await stage.playShot('S6_H', 'loop'); // the run: 40 s, not pingpong, resolves when it reaches the edge
    stage.pause();
    const a = stage._debug().shot.t;
    await new Promise((r) => setTimeout(r, 300));
    assertEqual(stage._debug().shot.t, a, 'paused: t must not advance');
    stage.setRate(2);
    stage.resume();
    await new Promise((r) => setTimeout(r, 400));
    const b = stage._debug().shot.t;
    assert(b > a, 'resumed: t advances');
    assert(b * 40 >= 0.6, `rate 2 over 0.4 s should cover ~0.8 s of a 40 s shot, got ${(b * 40).toFixed(2)}`);
    stage.setRate(1);
    await stage.holdPose('S6_H', 'out');
  });

  await runCase('stage: screenRect() finds the terminal in S6_C and returns a plausible rect', async () => {
    await stage.holdPose('S6_C', 'in');
    const r = stage.screenRect();
    assert(r, 'no rect');
    assert(r.w > 0.05 && r.w < 0.9 && r.h > 0.05 && r.h < 0.9, `rect ${JSON.stringify(r)}`);
    assert(r.x >= 0 && r.x + r.w <= 1 && r.y >= 0 && r.y + r.h <= 1, `rect off-screen ${JSON.stringify(r)}`);
  });

  await runCase('stage: actors move along their path (MG-03 C manager)', async () => {
    await stage.holdPose('S4_C', 'in');
    const room = stage._debug();
    assert(room.current === 'S4_C');
    stage.actor('manager', 0);
    stage.actor('manager', 1);
    // no throw and the room still renders
    assertEqual(stage._debug().current, 'S4_C');
  });

  stage.destroy();
  container.remove();
}
