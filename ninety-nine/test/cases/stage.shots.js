// The stage against the real data: every room in data/rooms.json --
// scene sets, endings, extra sets and the CN_* connectors -- builds and
// joins the world (box fallbacks when the prop library is absent), a
// finite shot plays to its end on the real frame clock, a pingpong loop
// resolves at once, holdPose parks the camera, screenRect() finds the CRT
// in the apartment, and a room's doors open and close and stop blocking.
// Runs on a detached container, so this is a smoke test of the data and
// the maths, not of what the picture looks like.

import { runCase, assert, assertEqual } from '../harness.js';
import { createStage } from '../../src/stage/stage.js';

export function canWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// resolves after `n` frames of the stage's own loop (swiftshader frames can be slow)
export function frames(stage, n = 1, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let k = 0;
    const timer = setTimeout(() => { off(); resolve(false); }, timeoutMs);
    const off = stage.onFrame(() => { if (++k >= n) { clearTimeout(timer); off(); resolve(true); } });
  });
}

async function until(fn, ms, step = 30) {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    if (fn()) return true;
    await sleep(step);
  }
  return fn();
}

export async function run() {
  if (!canWebGL()) {
    await runCase('stage: (skipped: no WebGL in this browser)', () => {});
    return;
  }
  const rooms = await fetch('../data/rooms.json').then((r) => r.json());

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px;opacity:0.01;pointer-events:none;';
  document.body.appendChild(container);
  const library = { ready: Promise.resolve(false), loaded: () => false, failed: () => true, has: () => false, instance: () => null };
  const stage = createStage(container, { rooms, library });

  try {
    await runCase('stage: every room in rooms.json (scene sets, endings, extra sets, CN_* connectors) builds via preview() with the box fallbacks', async () => {
      const failed = [];
      for (const key of Object.keys(rooms.rooms)) {
        try {
          const inst = await stage.preview(key);
          assertEqual(stage._debug().world.current, key, `preview(${key}) current`);
          assertEqual(stage.world.instances().length, 1, `preview(${key}) leaves one instance`);
          assert(inst.room.walls.length > 0 && inst.room.floors.length > 0, `${key}: no walls/floors`);
          // every doorway of the record yields a door controller and an anchor
          for (const d of inst.rec.doors || []) assert(inst.room.doors.get(d.name) && inst.anchorsWorld[d.name], `${key}: door ${d.name}`);
          if (inst.rec.entry) assert(inst.anchorsWorld[inst.rec.entry], `${key}: entry anchor ${inst.rec.entry}`);
          assertEqual(inst.zonesWorld.length, (inst.rec.zones || []).length, `${key}: zones`);
        } catch (e) {
          failed.push(`${key}: ${e.message}`);
        }
      }
      assert(failed.length === 0, failed.join(' | '));
    });

    await runCase('stage: a connector joins behind a door (world.attach): its entry lands on the exit, the room behind on its exit', async () => {
      const s2 = await stage.preview('S2_C');
      await stage.world.prebuild('S3_C');
      const conn = stage.world.attach(s2, 'inner', 'CN_CORRIDOR_OFFICE');
      const dest = stage.world.attach(conn, 'exit', 'S3_C');
      const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      assert(d(conn.anchorsWorld.entry.pos, s2.anchorsWorld.inner.pos) < 1e-4, 'connector entry not on the exit');
      assert(d(dest.anchorsWorld[dest.entryName].pos, conn.anchorsWorld.exit.pos) < 1e-4, 'next room entry not on the connector exit');
      assertEqual(stage.world.instances().length, 3, 'three rooms live');
      const mid = conn.center;
      assertEqual(stage.world.locate([mid[0], mid[1] + 1.6, mid[2]]), conn, 'locate() finds the connector');
      stage.world.remove(dest);
      stage.world.remove(conn);
      assertEqual(stage.world.instances().length, 1, 'removed');
    });

    await runCase('stage: the S2_C `call` shot resolves in ~4 s; a pingpong loop resolves at once; holdPose parks the camera', async () => {
      await stage.preview('S2_C');
      const seconds = rooms.rooms.S1_C.shots.call.seconds;
      // The shot clock is the stage's frame clock (dt clamped to 0.1 s a frame,
      // so a slow software renderer stretches wall time, never shot time).
      const t0 = performance.now();
      const e0 = stage.elapsed();
      await stage.playShot('S2_C', 'call'); // resolves when done (rAF-driven)
      const wall = (performance.now() - t0) / 1000;
      const shotTime = stage.elapsed() - e0;
      assert(Math.abs(shotTime - seconds) < 0.25, `call should take ${seconds} s of stage time, took ${shotTime.toFixed(2)} s`);
      assert(wall >= seconds * 0.9, `call resolved after ${wall.toFixed(2)} s of wall time, faster than real time`);
      const t1 = performance.now();
      await stage.playShot('S1_C', 'loop');
      assert(performance.now() - t1 < 500, 'a pingpong loop must resolve immediately');
      assert(stage._debug().shot && stage._debug().shot.pingpong, 'loop still running');
      await stage.holdPose('S1_C', 'in');
      assertEqual(stage._debug().shot, null, 'holdPose clears the shot');
      const cam = stage._debug().camera;
      const pose = rooms.rooms.S1_C.shots.in.pos;
      assert(Math.abs(cam[0] - pose[0]) < 1e-6 && Math.abs(cam[1] - pose[1]) < 1e-6 && Math.abs(cam[2] - pose[2]) < 1e-6, `camera parked on the pose: ${cam} vs ${pose}`);
    });

    await runCase('stage: carry() eases from wherever the camera is to a world pose and resolves', async () => {
      await stage.holdPose('S1_C', 'in');
      const t0 = performance.now();
      await stage.carry({ pos: [1, 1.6, 2], look: [1, 1.6, -5], space: 'world' }, { seconds: 0.6 });
      assert(performance.now() - t0 >= 450, 'carry resolved too early');
      const cam = stage._debug().camera;
      assert(Math.hypot(cam[0] - 1, cam[1] - 1.6, cam[2] - 2) < 1e-3, `carry did not land: ${cam}`);
      stage.releaseShot();
    });

    await runCase('stage: screenRect() finds the CRT in S0_X (seated pose) and returns a plausible rect', async () => {
      const apt = await stage.preview('S0_X');
      await stage.holdPose(apt, 'lean');
      await frames(stage, 3); // the camera's matrices catch up at the next render
      const r = stage.screenRect(apt, 'terminal');
      assert(r, 'no rect');
      assert(r.w > 0.05 && r.w < 0.95 && r.h > 0.05 && r.h < 0.95, `rect ${JSON.stringify(r)}`);
      assert(r.x >= 0 && r.x + r.w <= 1 && r.y >= 0 && r.y + r.h <= 1, `rect off-screen ${JSON.stringify(r)}`);
      assertEqual(stage.screenRect(apt, 'no-such-prop'), null, 'unknown prop gives null');
    });

    await runCase('stage: doors in a built room open and close, and stop blocking / block again (room.blocking() shrinks / grows)', async () => {
      const inst = await stage.preview('S1_C');
      const door = inst.room.doors.get('inner');
      assert(door, 'S1_C has an inner door');
      const shut = inst.room.blocking().length;
      assert(door.blocks() && door.isShut(), 'the inner door starts shut');
      await Promise.race([door.open(0.3), sleep(5000)]);
      assert(door.isOpen(), `door did not open (progress ${door.progress()})`);
      assertEqual(inst.room.blocking().length, shut - 1, 'an open door stops blocking');
      assert(stage.world.collidables().walls.length === inst.room.blocking().length, 'world colliders follow the room');
      await Promise.race([door.close(0.3), sleep(5000)]);
      assert(door.isShut() && door.locked, 'door did not close and lock');
      assertEqual(inst.room.blocking().length, shut, 'a shut door blocks again');
      // a bare opening never blocks; a rattled locked door stays shut
      const glass = inst.room.doors.get('front');
      glass.rattle();
      await sleep(400);
      assert(glass.isShut() && glass.blocks(), 'a rattled door stays shut');
      const cn = await stage.preview('CN_CORRIDOR_OFFICE');
      assert(!cn.room.doors.get('exit').blocks(), 'a bare opening never blocks');
      assert(!cn.room.doors.get('entry').blocks(), 'a connector\'s seal stands open until he is through');
    });

    await runCase('stage: actors walk their path (S4_C\'s manager) and the room still renders', async () => {
      const inst = await stage.preview('S4_C');
      const a = inst.room.actors.manager;
      assert(a, 'S4_C manager actor');
      const path = rooms.rooms.S4_C.actors.manager.path;
      a.set(0);
      const p0 = a.at();
      a.set(1);
      const p1 = a.at();
      assert(Math.hypot(p0[0] - path[0][0], p0[1] - path[0][1]) < 1e-6, 'actor at t=0 is on the first point');
      const last = path[path.length - 1];
      assert(Math.hypot(p1[0] - last[0], p1[1] - last[1]) < 1e-6, 'actor at t=1 is on the last point');
      assert(await until(() => stage._debug().world.current === 'S4_C', 500), 'still current');
    });
  } finally {
    stage.destroy();
    container.remove();
  }
}
