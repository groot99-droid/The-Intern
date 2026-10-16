// S4 THE FLOOR's engine features in the real game page, as director.flow
// drives it (an iframe of ../index.html at the dev start, driven through
// window.__NINETY_NINE__, the candidate moved by teleporting him):
//
//   S4 H (?start=S4&render=H) -- the manager is DRIVEN by the candidate's
//   progress (rooms.json actors.manager.drive): wherever he walks down the
//   corridor the manager stands 20 m further on, and he never comes back
//   when the candidate does (ratchet). Stood still for 8 s (`stillness`),
//   the ajar door swings wider -- still locked, still blocking -- and its
//   cold light comes up. At the far door the drive ends: the evidence is
//   there, the manager goes through, and TAKE THE PAPERS arms.
//
//   S4 C (?start=S4&render=C) -- past the cross aisle (`unseen`), the aisle
//   behind him closes up into more workstations, but only once it is out
//   of his view: looking back down it, nothing changes; turned away, it
//   fills, and only then do its colliders block.
//
// Time-bounded (one budget per room); skipped without WebGL.

import * as THREE from '../../vendor/three/three.module.js';
import { runCase, assert } from '../harness.js';
import { canWebGL } from './stage.shots.js';

const BUDGET_MS = 120000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function inGame(query, steps) {
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
  frame.src = `../index.html?${query}`;
  const errors = [];
  document.body.appendChild(frame);
  let broken = false;
  const ctx = { waitFor, errors, G: null, inst: null };
  // a pose in the room's own frame: x, z on its floor, facing local yaw (0 = toward -z, the core)
  ctx.put = (x, z, yawLocal) => {
    const inst = ctx.inst;
    const e = inst.matrix.elements;
    const p = new THREE.Vector3(x, inst.rec.floorY || 0, z).applyMatrix4(inst.matrix);
    const rotY = Math.atan2(e[8], e[0]) * 180 / Math.PI;
    ctx.G.stage.player.teleport(p.x, p.y, p.z, rotY + yawLocal);
  };
  ctx.local = (obj) => obj.position; // a room prop's place in the room's frame
  try {
    await runCase(`director.s4: the game boots at ${query}, armed`, async () => {
      await waitFor(() => frame.contentWindow && frame.contentDocument && frame.contentDocument.readyState !== 'loading', 'the iframe');
      frame.contentWindow.addEventListener('error', (e) => errors.push(e.message));
      frame.contentWindow.addEventListener('unhandledrejection', (e) => errors.push(String((e.reason && e.reason.message) || e.reason)));
      ctx.G = await waitFor(() => frame.contentWindow.__NINETY_NINE__, 'window.__NINETY_NINE__');
      await waitFor(() => {
        const boot = frame.contentDocument.getElementById('boot-error');
        if (boot && !boot.hidden) throw new Error(boot.textContent);
        const d = ctx.G.director._debug();
        return d.scene === 'S4' && d.armed && d.playerEnabled ? d : null;
      }, 'S4 to arm');
      ctx.inst = ctx.G.stage.world.current();
    });
    for (const [name, fn] of steps) {
      if (broken) { await runCase(name, () => { throw new Error('not run: an earlier step failed'); }); continue; }
      await runCase(name, async () => { try { await fn(ctx); } catch (e) { broken = true; throw e; } });
    }
    await runCase(`director.s4: no uncaught errors in the game page (${query})`, () => { assert(errors.length === 0, errors.join(' | ')); });
  } finally {
    frame.remove();
  }
}

export async function run() {
  if (!canWebGL()) {
    await runCase('director.s4: (skipped: no WebGL in this browser)', () => {});
    return;
  }

  await inGame('start=S4&render=H', [
    ['director.s4: S4 H -- the manager is driven 20 m ahead of the candidate along the corridor, and never comes back when he does', async ({ G, inst, waitFor, put }) => {
      const a = inst.room.actors.manager;
      assert(a && a.drive, 'S4_H manager has a drive');
      const lead = a.drive.lead;
      // his footsteps (drive.footstep, every drive.footsteps metres he moves)
      const steps = [];
      const play = G.audio.playOneShot.bind(G.audio);
      G.audio.playOneShot = (f, o) => { steps.push(f); return play(f, o); };
      for (const z of [12, 6]) {
        put(0, z, 0);
        const got = await waitFor(() => { const mz = a.group.position.z; return Math.abs(mz - (z - lead)) < 0.05 ? mz : null; }, `the manager at z ${z - lead} with the candidate at ${z}`);
        assert(Math.abs(got - (z - lead)) < 0.05, `manager at ${got}`);
      }
      put(0, 14, 0);
      await sleep(1500);
      assert(Math.abs(a.group.position.z - (6 - lead)) < 0.05, `the candidate went back to z 14 and the manager came back to ${a.group.position.z.toFixed(2)} (ratchet)`);
      const d = G.director._debug();
      assert(d.drives.length === 1 && d.drives[0].actor === 'manager' && !d.drives[0].ended, `drives ${JSON.stringify(d.drives)}`);
      assert(!d.targets.find((t) => t.zone === 'far_end').armed, 'TAKE THE PAPERS armed before the manager reached the far door');
      assert(steps.includes('S4_H_SFX_FOOTSTEPS.wav'), `no footsteps as he receded (${steps.join(', ') || 'no one-shots'})`);
    }],
    ['director.s4: S4 H -- creeping 1 cm a frame for 9 s (game time) is not standing still; stood still for 8 s, the ajar door swings wider, still locked and blocking, and its cold light comes up', async ({ G, inst, waitFor, put }) => {
      const door = inst.room.doors.get('ajar');
      const u0 = door.progress();
      // to and fro over half a metre near the entry, a centimetre every frame
      // (a slow walk on a fast display; the ratchet keeps the manager put)
      await new Promise((resolve) => {
        let gameT = 0, k = 0;
        const off = G.stage.onPreFrame((dt) => {
          gameT += dt;
          const w = (k++ % 100) / 100;
          put(0, 14 + 0.5 * (w < 0.5 ? 2 * w : 2 - 2 * w), 0);
          if (gameT >= 9) { off(); resolve(); }
        });
      });
      assert(door.progress() < u0 + 0.01 && !inst.room.named.get('ajar_spill_wide').visible, 'the door opened for a slow walk');
      await waitFor(() => door.progress() > u0 + 0.1, 'the ajar door to swing wider (8 s of stillness, in game time)');
      await waitFor(() => door.progress() >= 0.45 && inst.room.named.get('ajar_spill_wide').visible, 'the swing to finish and the wider spill to show');
      assert(door.progress() < 0.85 && door.locked && door.blocks(), `the door at ${door.progress().toFixed(2)} must stay locked and blocking (stepped into, not through)`);
      const lamp = inst.lights.find((s) => s.id === 'ajar_wide');
      assert(lamp && !lamp.off, 'the ajar door\'s second lamp is on');
    }],
    ['director.s4: S4 H -- at the far door the drive ends: the evidence is at its foot, he goes through, the bulb comes on, and TAKE THE PAPERS arms', async ({ G, inst, waitFor, put }) => {
      put(0, 1.5, 0);
      await waitFor(() => G.director._debug().drives[0].ended, 'the drive to end');
      assert(inst.room.named.get('evidence_h').visible, 'the evidence shows at the far door');
      await waitFor(() => G.director._debug().reached.includes('manager'), 'the end beats to play');
      assert(!inst.room.named.get('manager').visible, 'the manager has gone through the far door');
      assert(inst.room.named.get('end_cage_on').visible, 'the end bulb is lit');
      assert(G.director._debug().targets.find((t) => t.zone === 'far_end').armed, 'TAKE THE PAPERS is armed');
    }]
  ]);

  await inGame('start=S4&render=C', [
    ['director.s4: S4 C -- past the cross aisle, looking back down the aisle he came by, it stays as it was (and its hidden workstations do not block)', async ({ G, inst, put }) => {
      const fill = inst.room.named.get('aisle_fill');
      assert(fill && !fill.visible, 'aisle_fill hidden at the start');
      assert(!inst.room.blocking().some((m) => m.userData.shownWith === fill), 'hidden, the workstations do not collide');
      put(0, -1.6, 180); // in past_cross, facing the entry
      await sleep(2500);
      const d = G.director._debug();
      assert(d.reached.includes('past_cross'), 'he stood past the cross aisle');
      assert(!fill.visible && d.unseen[0] === false, 'the aisle changed while he was looking at it');
    }],
    ['director.s4: S4 C -- turned toward the manager, the aisle behind him closes up out of his view, and only then blocks', async ({ G, inst, waitFor, put }) => {
      const fill = inst.room.named.get('aisle_fill');
      put(0, -1.6, 0);
      await waitFor(() => fill.visible, 'the aisle behind him to fill');
      assert(G.director._debug().unseen[0] === true, 'unseen done');
      assert(inst.room.blocking().some((m) => m.userData.shownWith === fill), 'shown, the workstations collide');
    }]
  ]);
}
