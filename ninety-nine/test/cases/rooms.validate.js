// data/rooms.json (walk mode) integrity: every key names a real
// scene+render, every alias resolves, every prop type has a builder, the
// spawn sits inside the room, and canon C3 holds (no room opens to a
// sky: an `open` side must be closed by a box or fog).

import { runCase, assert } from '../harness.js';
import { choiceEntryIndex } from '../../src/router.js';

export async function run() {
  const [rooms, scenes, props] = await Promise.all([
    fetch('../data/rooms.json').then((r) => r.json()),
    fetch('../data/scenes.json').then((r) => r.json()),
    import('../../src/walk/props.js')
  ]);
  const types = new Set(props.PROP_TYPES);

  await runCase('rooms.json: every key is S{n}_{C|H} for a scene with that branch', () => {
    for (const key of Object.keys(rooms.rooms)) {
      const m = /^(S\d)_([CH])$/.exec(key);
      assert(m, `bad key ${key}`);
      const scene = scenes.scenes[m[1]];
      assert(scene && scene.branches[m[2]], `${key}: no such scene/branch`);
    }
  });

  await runCase('rooms.json: aliases resolve to built rooms', () => {
    for (const [key, rec] of Object.entries(rooms.rooms)) {
      if (!rec.alias) continue;
      const target = rooms.rooms[rec.alias];
      assert(target && !target.alias, `${key}: alias ${rec.alias} must be a built room`);
    }
  });

  await runCase('rooms.json: every prop type has a builder and every spawn is inside the shell', () => {
    for (const [key, rec0] of Object.entries(rooms.rooms)) {
      const rec = rec0.alias ? { ...rooms.rooms[rec0.alias], ...rec0 } : rec0;
      const [W, H, D] = rec.size;
      assert(W > 0 && H > 0 && D > 0, `${key}: size`);
      for (const p of rec.props || []) assert(types.has(p.type), `${key}: unknown prop "${p.type}"`);
      const [sx, sz] = rec.spawn || [0, 0];
      assert(Math.abs(sx) < W / 2 && Math.abs(sz) < D / 2, `${key}: spawn (${sx}, ${sz}) outside ${W}x${D}`);
    }
  });

  await runCase('rooms.json: C3 -- an open side is closed by fog or a box, never a sky', () => {
    for (const [key, rec] of Object.entries(rooms.rooms)) {
      if (!rec.open) continue;
      assert(rec.fog || (rec.boxes && rec.boxes.length), `${key}: open side with nothing closing it`);
      assert(!rec.sky && !rec.skybox, `${key}: no skies after the lobby doors`);
    }
  });

  await runCase('rooms.json: C8 -- every built room has exactly one handless clock', () => {
    for (const [key, rec] of Object.entries(rooms.rooms)) {
      if (rec.alias) continue;
      const clocks = (rec.props || []).filter((p) => p.type === 'clock').length;
      assert(clocks === 1, `${key}: ${clocks} clocks`);
    }
  });

  await runCase('Track C motif 2: at most one 99 slip per built room after S1', () => {
    for (const [key, rec] of Object.entries(rooms.rooms)) {
      if (rec.alias || key.startsWith('S1_')) continue;
      const slips = (rec.props || []).filter((p) => p.type === 'slip').length;
      assert(slips <= 1, `${key}: ${slips} slips`);
    }
  });

  await runCase('choiceEntryIndex: default is the last entry; S8-H asks after entry 0; out-of-range clamps', () => {
    assert(choiceEntryIndex({ sequence: [1, 2, 3] }) === 2);
    assert(choiceEntryIndex(scenes.scenes.S8.branches.H) === 0);
    assert(choiceEntryIndex(scenes.scenes.S8.branches.C) === 1);
    assert(choiceEntryIndex({ sequence: [1, 2], choiceAfterEntry: 9 }) === 1);
  });
}
