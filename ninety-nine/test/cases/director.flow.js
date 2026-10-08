// The director end to end, in the real game page: an iframe of
// ../index.html?start=S3&render=C (the dev start: just inside S3 C's room,
// drone running), driven through window.__NINETY_NINE__. Stepping into a
// threshold zone commits the choice (state.js moves), the exit door opens
// onto a CN_* connector with the next scene's room already joined behind
// it, walking down the connector crosses the scene boundary (the next
// scene starts in the render the score picked), and walking on seals the
// way back: the room left behind and the connector are dropped. Twice:
// S3 C succumb (PART THE CURTAIN) -> S4 C through a level corridor, then
// S4 C resist (TAKE THE SIDE DOOR) -> S5 C down a stairwell, 3 m lower.
// The candidate is moved by teleporting him (stage.player.teleport), not by
// walking: tools/walkthrough.cjs walks whole games with the autopilot.
//
// Time-bounded: every wait shares one 60 s budget (a software renderer runs
// the game's clock at a fraction of real time; on a GPU this takes seconds).
// Skipped without WebGL.

import { runCase, assert, assertEqual } from '../harness.js';
import { canWebGL } from './stage.shots.js';

const BUDGET_MS = 60000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const facing = (yawDeg) => { const y = yawDeg * Math.PI / 180; return [-Math.sin(y), 0, -Math.cos(y)]; };

export async function run() {
  if (!canWebGL()) {
    await runCase('director.flow: (skipped: no WebGL in this browser)', () => {});
    return;
  }
  const deadline = performance.now() + BUDGET_MS;
  const waitFor = async (fn, what) => {
    while (performance.now() < deadline) {
      let v = null;
      try { v = fn(); } catch (e) { v = null; }
      if (v) return v;
      await sleep(100);
    }
    throw new Error(`the ${BUDGET_MS / 1000} s budget ran out waiting for ${what}`);
  };

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:8px;bottom:8px;width:320px;height:180px;border:1px solid #444;';
  frame.src = '../index.html?start=S3&render=C';
  const errors = [];
  document.body.appendChild(frame);
  let G = null;
  let broken = false;
  const step = async (name, fn) => {
    if (broken) { await runCase(name, () => { throw new Error('not run: an earlier step failed'); }); return; }
    await runCase(name, async () => {
      try { await fn(); } catch (e) { broken = true; throw e; }
    });
  };

  // Down the live connector to the next room: three-quarters along (the
  // scene boundary), then 2.6 m into the room (its entry seals behind him).
  const walkThrough = async (fromKey, toKey, toScene) => {
    const conn = G.stage.world.instances().find((i) => i.role === 'connector');
    assert(conn, 'no connector live');
    const a = conn.anchorsWorld.entry.pos, b = conn.anchorsWorld.exit.pos;
    G.stage.player.teleport(a[0] + (b[0] - a[0]) * 0.8, b[1], a[2] + (b[2] - a[2]) * 0.8, conn.anchorsWorld.exit.yaw);
    await waitFor(() => G.stage.world.current() === conn, 'the player to be in the connector');
    const dbg = await waitFor(() => { const d = G.director._debug(); return d.scene === toScene ? d : null; }, `the boundary into ${toScene}`);
    await waitFor(() => !G.stage.world.instances().some((i) => i.key === fromKey), `${fromKey} to be sealed and dropped`);
    const dest = G.stage.world.instances().find((i) => i.key === toKey);
    assert(dest, `${toKey} not live`);
    const e = dest.anchorsWorld[dest.entryName];
    const f = facing(e.yaw);
    G.stage.player.teleport(e.pos[0] - f[0] * 2.6, e.pos[1], e.pos[2] - f[2] * 2.6, e.yaw + 180);
    await waitFor(() => G.director._debug().links.length === 0, 'the connector to be sealed and dropped');
    assertEqual(G.stage.world.instances().map((i) => i.key).join(','), toKey, 'only the new room is live');
    assertEqual(G.stage.world.current(), dest, 'standing in the new room');
    return dbg;
  };

  try {
    await step('director.flow: the game boots into S3 C at the dev start, armed, drone running', async () => {
      await waitFor(() => frame.contentWindow && frame.contentDocument && frame.contentDocument.readyState !== 'loading', 'the iframe');
      frame.contentWindow.addEventListener('error', (e) => errors.push(e.message));
      frame.contentWindow.addEventListener('unhandledrejection', (e) => errors.push(String((e.reason && e.reason.message) || e.reason)));
      G = await waitFor(() => frame.contentWindow.__NINETY_NINE__, 'window.__NINETY_NINE__');
      const dbg = await waitFor(() => {
        const boot = frame.contentDocument.getElementById('boot-error');
        if (boot && !boot.hidden) throw new Error(boot.textContent);
        const d = G.director._debug();
        return d.scene === 'S3' && d.armed && d.playerEnabled ? d : null;
      }, 'S3 to arm');
      assertEqual(dbg.render, 'C', 'render');
      assertEqual(dbg.state.sceneIndex, 3, 'sceneIndex');
      assertEqual(G.stage.world.current().key, 'S3_C', 'standing in S3_C');
      assertEqual(dbg.targets.filter((t) => t.kind === 'threshold').map((t) => t.key).sort().join(','), 'resist,succumb', 'two thresholds');
      assertEqual(G.audio._debugDroneStartCount(), 1, 'the dev start runs the drone');
    });

    await step('director.flow: stepping into PART THE CURTAIN commits succumb and opens the curtain onto CN_CORRIDOR_OFFICE, S4_C joined behind', async () => {
      const t = G.director._debug().targets.find((x) => x.kind === 'threshold' && x.key === 'succumb');
      const c0 = G.state.conformance;
      G.stage.player.teleport(t.world[0], t.world[1], t.world[2], 0);
      await waitFor(() => G.state.conformance === c0 + 1, 'the commit (conformance +1)');
      assertEqual(G.state.lastPolarity, 1, 'lastPolarity');
      assert(G.state.dwell[3] >= 0, 'dwell recorded for S3');
      const dbg = await waitFor(() => { const d = G.director._debug(); return d.links.length ? d : null; }, 'the way on to open');
      const L = dbg.links[0];
      assertEqual(L.from, 'S3_C', 'link from');
      assertEqual(L.conn, 'CN_CORRIDOR_OFFICE', 'link via');
      assertEqual(L.dest, 'S4_C', 'the room behind the door is S4 in the render the score picked');
      const curtain = G.stage.world.instances().find((i) => i.key === 'S3_C').room.doors.get('curtain');
      await waitFor(() => curtain.progress() > 0.9, 'the curtain to open');
      assert(!curtain.blocks(), 'an open curtain does not block');
    });

    await step('director.flow: walking down the corridor crosses into S4 C; S3_C and the corridor are sealed and dropped behind him', async () => {
      const dbg = await walkThrough('S3_C', 'S4_C', 'S4');
      assertEqual(dbg.render, 'C', 'S4 render');
      assertEqual(G.state.sceneIndex, 4, 'sceneIndex');
      await waitFor(() => G.director._debug().armed, 'S4 to arm');
    });

    await step('director.flow: S4 C resist (TAKE THE SIDE DOOR) -> dissonance, down CN_STAIRS_CONCRETE into S5 C, 3 m lower, drone never restarted', async () => {
      const t = G.director._debug().targets.find((x) => x.kind === 'threshold' && x.key === 'resist');
      assert(t, 'S4 resist threshold');
      const floor4 = G.stage.player.feet()[1];
      G.stage.player.teleport(t.world[0], t.world[1], t.world[2], -90);
      await waitFor(() => G.state.dissonance === 1, 'the commit (dissonance 1)');
      assertEqual(G.state.conformance, 0, 'conformance back to 0');
      const dbg = await waitFor(() => { const d = G.director._debug(); return d.links.length ? d : null; }, 'the side door to open');
      assertEqual(dbg.links[0].conn, 'CN_STAIRS_CONCRETE', 'via the stairwell');
      assertEqual(dbg.links[0].dest, 'S5_C', 'a tie holds the last render: S5 C');
      const d5 = await walkThrough('S4_C', 'S5_C', 'S5');
      assertEqual(d5.render, 'C', 'S5 render');
      const drop = G.rooms.rooms.CN_STAIRS_CONCRETE.drop;
      const floor5 = G.stage.player.feet()[1];
      assert(Math.abs(floor5 - (floor4 - drop)) < 0.3, `S5's floor at ${floor5.toFixed(2)}, expected ${(floor4 - drop).toFixed(2)}`);
      assertEqual(G.audio._debugDroneStartCount(), 1, 'the drone was never restarted (C7)');
      assert(G.state.friction >= 0 && G.state.friction <= 8, `friction ${G.state.friction}`);
    });

    await runCase('director.flow: no uncaught errors in the game page', () => {
      assert(errors.length === 0, errors.join(' | '));
    });
  } finally {
    frame.remove();
  }
}
