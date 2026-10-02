// Doc 4 §11.1 acceptance tests, plus Doc 1 §7.2's four worked runs and the
// full 256-path sweep. Pure state.js logic -- no assets, no DOM needed
// beyond what the harness provides, buildable in Phase 1.

import { createState, commitChoice, resolveEnding, renderFor, peekRenderFor, seedRenderFromIntake, DEBUG_RESUME } from '../../src/state.js';
import { planTransition, entryRoom, exitRoom } from '../../src/router.js';
import { runCase, assertEqual, assert } from '../harness.js';

function runPath(bits) {
  const state = createState();
  for (const p of bits) commitChoice(state, p);
  return { conformance: state.conformance, dissonance: state.dissonance, ending: resolveEnding(state), state };
}

// Bit index 7 is S8. renderFor() must be read BEFORE that scene's choice is
// committed (Doc 1 §2.2: render is resolved at the top of the scene) --
// mirrors router.js's playScene(), where renderFor(state) runs before
// choiceUI.present()/commitChoice(). OPENED_BOX (Doc 1 §2.5) is only ever
// set by S8-C's resist option ("OPEN THE BOX"); S8-H's resist option ("SWIM
// FOR THE PILLARS") does not set it.
function runPathWithRenderTracking(bits) {
  const state = createState();
  for (let i = 0; i < bits.length; i++) {
    const branch = renderFor(state);
    const polarity = bits[i];
    commitChoice(state, polarity);
    if (i === 7 && branch === 'C' && polarity === -1) state.flags.add('OPENED_BOX');
  }
  return { conformance: state.conformance, dissonance: state.dissonance, ending: resolveEnding(state), state };
}

export async function run() {
  await runCase('Doc 1 §7.2 Run A (SSSSSSSS): conf +8, diss 0, ASSIMILATION', () => {
    const r = runPath([1, 1, 1, 1, 1, 1, 1, 1]);
    assertEqual(r.conformance, 8);
    assertEqual(r.dissonance, 0);
    assertEqual(r.ending, 'ASSIMILATION');
  });

  await runCase('Doc 1 §7.2 Run B (RRRRRRRR): conf -8, diss 0, EXPULSION', () => {
    const r = runPath([-1, -1, -1, -1, -1, -1, -1, -1]);
    assertEqual(r.conformance, -8);
    assertEqual(r.dissonance, 0);
    assertEqual(r.ending, 'EXPULSION');
  });

  await runCase('Doc 1 §7.2 Run C (SSSRRRRR): conf -2, diss 1, PENDING', () => {
    const r = runPath([1, 1, 1, -1, -1, -1, -1, -1]);
    assertEqual(r.conformance, -2);
    assertEqual(r.dissonance, 1);
    assertEqual(r.ending, 'PENDING');
  });

  await runCase('Doc 1 §7.2 Run D (SRSRSRSR): conf 0, diss 7, PENDING', () => {
    const r = runPath([1, -1, 1, -1, 1, -1, 1, -1]);
    assertEqual(r.conformance, 0);
    assertEqual(r.dissonance, 7);
    assertEqual(r.ending, 'PENDING');
  });

  await runCase('Exhaustive 256-path sweep: 27 ASSIMILATION / 27 EXPULSION / 202 PENDING', () => {
    const counts = { ASSIMILATION: 0, EXPULSION: 0, PENDING: 0 };
    for (let mask = 0; mask < 256; mask++) {
      const bits = [];
      for (let i = 0; i < 8; i++) bits.push(mask & (1 << i) ? 1 : -1);
      const r = runPath(bits);
      counts[r.ending]++;
      assert(r.conformance % 2 === 0, `conformance not even for mask ${mask} (got ${r.conformance})`);
    }
    assertEqual(counts.ASSIMILATION, 27, 'ASSIMILATION count');
    assertEqual(counts.EXPULSION, 27, 'EXPULSION count');
    assertEqual(counts.PENDING, 202, 'PENDING count');
  });

  await runCase('RETAINED: exhaustive 256-path sweep with render-branch tracking: 19 ASSIMILATION / 27 EXPULSION / 202 PENDING / 8 RETAINED', () => {
    // Unlike the sweep above, this one tracks which render (C/H) is live at
    // each scene so it can tell whether S8's resist choice was actually
    // "OPEN THE BOX" (S8-C) and not "SWIM FOR THE PILLARS" (S8-H). The
    // untracked sweep above is intentionally left asserting the original
    // Doc 1 §7.1 numbers -- it never sets OPENED_BOX, so it still describes
    // the pre-RETAINED game exactly, and stays a useful regression check
    // that resolveEnding()'s base three-way math didn't move.
    const counts = { ASSIMILATION: 0, EXPULSION: 0, PENDING: 0, RETAINED: 0 };
    for (let mask = 0; mask < 256; mask++) {
      const bits = [];
      for (let i = 0; i < 8; i++) bits.push(mask & (1 << i) ? 1 : -1);
      const r = runPathWithRenderTracking(bits);
      counts[r.ending]++;
    }
    assertEqual(counts.ASSIMILATION, 19, 'ASSIMILATION count (down from 27: 8 of those runs now open the box)');
    assertEqual(counts.EXPULSION, 27, 'EXPULSION count (unaffected -- OPENED_BOX only exists on the C branch)');
    assertEqual(counts.PENDING, 202, 'PENDING count (unaffected -- RETAINED is carved out of ASSIMILATION only)');
    assertEqual(counts.RETAINED, 8, 'RETAINED count');
    assertEqual(counts.ASSIMILATION + counts.EXPULSION + counts.PENDING + counts.RETAINED, 256, 'all 256 paths accounted for');
  });

  await runCase('peekRenderFor matches the next renderFor on all 256 paths and never writes lastRender', () => {
    for (let mask = 0; mask < 256; mask++) {
      const state = createState();
      for (let i = 0; i < 8; i++) {
        renderFor(state);
        commitChoice(state, mask & (1 << i) ? 1 : -1);
        const before = state.lastRender;
        const peeked = peekRenderFor(state);
        assertEqual(state.lastRender, before, `peek mutated lastRender (mask ${mask}, step ${i})`);
        assertEqual(peeked, renderFor(state), `peek disagrees with renderFor (mask ${mask}, step ${i})`);
      }
    }
  });

  await runCase('Transitions: a change of set is leave + arrive; the same set (S1 -> S2) is no transition', () => {
    const baseOf = (k) => ({ S2_C: 'S1_C', S2_H: 'S1_H', S7_H: 'S6_H' }[k] || k);
    assertEqual(JSON.stringify(planTransition({ fromRoom: 'S1_C', toRoom: 'S2_C', baseOf })), '[]');
    assertEqual(JSON.stringify(planTransition({ fromRoom: 'S6_H', toRoom: 'S7_H', baseOf })), '[]');
    assertEqual(JSON.stringify(planTransition({ fromRoom: 'S2_C', toRoom: 'S3_H', baseOf })), JSON.stringify([{ room: 'S2_C', shot: 'leave' }, { room: 'S3_H', shot: 'arrive' }]));
    assertEqual(JSON.stringify(planTransition({ fromRoom: 'S2_C', toRoom: 'S3_C', baseOf, override: { leave: 'call', arrive: 'in' } })), JSON.stringify([{ room: 'S2_C', shot: 'call' }, { room: 'S3_C', shot: 'in' }]));
    assertEqual(JSON.stringify(planTransition({ fromRoom: null, toRoom: 'S1_C' })), '[]');
  });

  await runCase('Transitions: a render flip lands in the destination render by construction', () => {
    // S R S R R R: conformance 1,0,1,0,-1,-2 -- C holds through S6 (the
    // tie/near-tie keeps the last render), then S6's resist drops it to -2,
    // so S7 renders H. The S6 -> S7 edge is the flip: the plan leaves S6_C
    // and arrives in S7_H, never S7_C.
    const state = createState();
    const bits = [1, -1, 1, -1, -1, -1];
    const played = [];
    for (const p of bits) {
      const from = renderFor(state);
      commitChoice(state, p);
      played.push([from, peekRenderFor(state)]);
    }
    assertEqual(played[4].join('>'), 'C>C', 'S5 -> S6 should not flip (conformance -1, tie-hold)');
    assertEqual(played[5].join('>'), 'C>H', 'S6 -> S7 should flip');
    const steps = planTransition({ fromRoom: `S6_${played[5][0]}`, toRoom: `S7_${played[5][1]}` });
    assertEqual(steps[steps.length - 1].room, 'S7_H');
    assertEqual(steps[0].room, 'S6_C');
  });

  await runCase('Transitions: every room a sequence entry names has leave/arrive shots and every edge resolves', async () => {
    const [manifest, rooms] = await Promise.all([
      fetch('../../data/scenes.json').then((r) => r.json()),
      fetch('../../data/rooms.json').then((r) => r.json())
    ]);
    const resolve = (k) => { const r = rooms.rooms[k]; return r && r.alias ? { ...rooms.rooms[r.alias], ...r } : r; };
    const baseOf = (k) => { const r = rooms.rooms[k]; return r && r.alias ? r.alias : k; };
    for (const [sceneId, scene] of Object.entries(manifest.scenes)) {
      for (const [letter, branch] of Object.entries(scene.branches)) {
        for (const entry of branch.sequence) {
          const key = entry.room || branch.room;
          const rec = resolve(key);
          assert(rec, `${sceneId}.${letter}: no room ${key}`);
          assert(rec.shots && rec.shots[entry.shot || 'loop'], `${sceneId}.${letter}: ${key} has no shot ${entry.shot || 'loop'}`);
          for (const name of ['leave', 'arrive', 'in', 'out']) assert(rec.shots[name], `${key}: no ${name} shot`);
        }
      }
    }
    // Which spine edges can flip at all, per renderFor()'s +/-2 threshold and
    // the S0 seed: S0->S1 (H seed), S2->S3, S4->S5, S6->S7. Nothing else.
    const edges = new Set();
    for (const seed of ['C', 'H']) {
      for (let mask = 0; mask < 256; mask++) {
        const state = createState();
        seedRenderFromIntake(state, seed === 'H' ? 2 : 0);
        let prev = 'X';
        for (let i = 0; i < 8; i++) {
          const r = renderFor(state);
          const landsIn = prev === 'X' ? 'C' : prev;
          if (r !== landsIn) edges.add(`S${i}->S${i + 1}`);
          commitChoice(state, mask & (1 << i) ? 1 : -1);
          prev = r;
        }
      }
    }
    assertEqual([...edges].sort().join(','), 'S0->S1,S2->S3,S4->S5,S6->S7');
    for (const edge of edges) {
      const [from, to] = edge.split('->');
      for (const [letter, dest] of from === 'S0' ? [['X', 'C'], ['X', 'H']] : [['C', 'H'], ['H', 'C']]) {
        const a = manifest.scenes[from].branches[letter], b = manifest.scenes[to].branches[dest];
        const fromRoom = exitRoom(a), toRoom = entryRoom(b);
        const steps = planTransition({ fromRoom, toRoom, baseOf });
        assert(steps.length === 2, `${edge} ${letter}->${dest}: expected leave + arrive, got ${steps.length}`);
        assertEqual(steps[1].room, toRoom, `${edge} ${letter}->${dest}: must end in the destination render`);
      }
    }
  });

  await runCase('S0 intake seed: 2+ refusals reach S1_H and hold it through S2', () => {
    // The defect this closes: conformance is 0 at S1 and +/-1 at S2, so
    // renderFor()'s +/-2 threshold could never produce H there and the
    // shipped S1_H/S2_H assets were unreachable.
    for (const refusals of [0, 1]) {
      const state = createState();
      seedRenderFromIntake(state, refusals);
      assertEqual(renderFor(state), 'C', `${refusals} refusals should open in C`);
    }
    for (const refusals of [2, 3]) {
      const state = createState();
      seedRenderFromIntake(state, refusals);
      assertEqual(renderFor(state), 'H', `${refusals} refusals should open in S1_H`);
      commitChoice(state, 1); // S1: even succumbing only reaches +1
      assertEqual(renderFor(state), 'H', 'S2 should still render H (tie-hold)');
      commitChoice(state, 1); // S2: +2 clears the threshold
      assertEqual(renderFor(state), 'C', 'S3 should flip back to C once conformance reaches +2');
    }
  });

  await runCase('S0 intake seed is render-only: conformance and every ending are untouched', () => {
    for (const refusals of [0, 1, 2, 3]) {
      const state = createState();
      seedRenderFromIntake(state, refusals);
      assertEqual(state.conformance, 0, `${refusals} refusals must not move conformance`);
      assertEqual(state.dissonance, 0, `${refusals} refusals must not move dissonance`);
    }
    // The full sweep, re-run against the most extreme seed: every path must
    // land on exactly the ending it landed on before the seed existed.
    const counts = { ASSIMILATION: 0, EXPULSION: 0, PENDING: 0 };
    for (let mask = 0; mask < 256; mask++) {
      const state = createState();
      seedRenderFromIntake(state, 3);
      for (let i = 0; i < 8; i++) commitChoice(state, mask & (1 << i) ? 1 : -1);
      counts[resolveEnding(state)]++;
    }
    assertEqual(counts.ASSIMILATION, 27, 'ASSIMILATION count unchanged by the seed');
    assertEqual(counts.EXPULSION, 27, 'EXPULSION count unchanged by the seed');
    assertEqual(counts.PENDING, 202, 'PENDING count unchanged by the seed');
  });

  await runCase('EARLY_EXIT flag forces PENDING regardless of score', () => {
    const state = createState();
    for (const p of [1, 1, 1, 1, 1, 1, 1, 1]) commitChoice(state, p);
    state.flags.add('EARLY_EXIT');
    assertEqual(resolveEnding(state), 'PENDING');
  });

  await runCase('DEBUG_RESUME constant is false', () => {
    assertEqual(DEBUG_RESUME, false);
  });
}
