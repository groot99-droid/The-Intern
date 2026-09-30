// Doc 4 §11.1 acceptance tests, plus Doc 1 §7.2's four worked runs and the
// full 256-path sweep. Pure state.js logic -- no assets, no DOM needed
// beyond what the harness provides, buildable in Phase 1.

import { createState, commitChoice, resolveEnding, renderFor, peekRenderFor, seedRenderFromIntake, DEBUG_RESUME } from '../../src/state.js';
import { pickTransition } from '../../src/router.js';
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

  await runCase('Swap transitions: a C->H flip mid-spine selects the swap clip', () => {
    // S R S R R R: conformance 1,0,1,0,-1,-2 -- C holds through S6 (the
    // tie/near-tie keeps the last render), then S6's resist drops it to -2,
    // so S7 renders H. The S6 -> S7 edge is the flip.
    const branchC = {
      transitions: { S7: 'S6_C_TRN_S7.mp4' },
      transitionsSwap: { S7: 'S6_C_TRN_S7_H.mp4' }
    };
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
    assertEqual(pickTransition(branchC, played[5][0], played[5][1], 'S7'), 'S6_C_TRN_S7_H.mp4');
    assertEqual(pickTransition(branchC, played[4][0], played[4][1], 'S7'), 'S6_C_TRN_S7.mp4');
  });

  await runCase('Swap transitions: missing swap entry falls back to the plain clip', () => {
    const branch = { transitions: { S4: 'S3_H_TRN_S4.mp4' } };
    assertEqual(pickTransition(branch, 'H', 'C', 'S4'), 'S3_H_TRN_S4.mp4');
    assertEqual(pickTransition({ ...branch, transitionsSwap: {} }, 'H', 'C', 'S4'), 'S3_H_TRN_S4.mp4');
  });

  await runCase('Swap transitions: S0 (X) swaps only when S1 will render H', () => {
    const s0 = {
      transitions: { S1: 'S0_X_TRN_S1.mp4' },
      transitionsSwap: { S1: 'S0_X_TRN_S1_H.mp4' }
    };
    assertEqual(pickTransition(s0, 'X', 'C', 'S1'), 'S0_X_TRN_S1.mp4');
    assertEqual(pickTransition(s0, 'X', 'H', 'S1'), 'S0_X_TRN_S1_H.mp4');
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
