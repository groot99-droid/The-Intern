// Doc 4 §11.1 acceptance tests, plus Doc 1 §7.2's four worked runs and the
// full 256-path sweep. Pure state.js logic, plus spine.js -- what the
// director (src/director.js) predicts behind each threshold, checked
// against a simulated run of data/scenes.json. No WebGL, no DOM.

import { createState, commitChoice, resolveEnding, renderFor, peekRenderFor, seedRenderFromIntake, DEBUG_RESUME } from '../../src/state.js';
import { outcomesFor, zonesOf, baseOf, cloneState } from '../../src/spine.js';
import { runCase, assertEqual, assert } from '../harness.js';

function runPath(bits) {
  const state = createState();
  for (const p of bits) commitChoice(state, p);
  return { conformance: state.conformance, dissonance: state.dissonance, ending: resolveEnding(state), state };
}

// Bit index 7 is S8. renderFor() must be read BEFORE that scene's choice is
// committed (Doc 1 §2.2: render is resolved at the top of the scene) --
// mirrors director.js's enterScene(), where renderFor(state) runs before
// any threshold can commit(). OPENED_BOX (Doc 1 §2.5) is only ever
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

  // ---- spine.js: what the director builds behind each threshold --------------

  const [manifest, endings] = await Promise.all([
    fetch('../data/scenes.json').then((r) => r.json()),
    fetch('../data/endings.json').then((r) => r.json())
  ]);

  // One run the way the director plays it: the render at the top of each
  // scene (enterScene -> renderFor), outcomesFor() asked there, then
  // commitChoice() and the threshold's setFlag (commit()). Every prediction
  // is kept next to what actually happened at the top of the next scene.
  function simulate(mask, seed) {
    const state = createState();
    seedRenderFromIntake(state, seed === 'H' ? 2 : 0);
    const steps = [];
    let pending = null;
    for (let i = 0; i < 8; i++) {
      const sceneId = manifest.spineOrder[i + 1];
      const letter = renderFor(state);
      const branch = manifest.scenes[sceneId].branches[letter];
      if (pending) pending.actual = { render: letter, room: branch.room };
      const outs = outcomesFor(state, manifest, endings, sceneId, branch);
      const key = mask & (1 << i) ? 'succumb' : 'resist';
      const th = branch.thresholds[key];
      commitChoice(state, key === 'succumb' ? 1 : -1);
      if (th.setFlag) state.flags.add(th.setFlag);
      pending = { sceneId, letter, key, predicted: outs[key], all: outs };
      steps.push(pending);
    }
    pending.actual = { ending: resolveEnding(state) };
    return { steps, state };
  }

  await runCase('spine.js outcomesFor() agrees with a simulated run on all 256 paths x both S0 seeds', () => {
    let checked = 0;
    for (const seed of ['C', 'H']) {
      for (let mask = 0; mask < 256; mask++) {
        for (const st of simulate(mask, seed).steps) {
          const where = `seed ${seed} mask ${mask} ${st.sceneId}.${st.letter} ${st.key}`;
          assert(st.predicted, `${where}: no outcome for the threshold`);
          assertEqual(st.predicted.polarity, st.key === 'succumb' ? 1 : -1, `${where}: polarity`);
          if (st.sceneId === 'S8') {
            const th = manifest.scenes.S8.branches[st.letter].thresholds[st.key];
            assertEqual(st.predicted.next, 'E', `${where}: S8 leads to the ending`);
            assertEqual(st.predicted.ending, st.actual.ending, `${where}: ending`);
            assertEqual(st.predicted.room, th.to || endings[st.actual.ending].room, `${where}: room behind the threshold`);
            assertEqual(st.predicted.endingRoom, endings[st.actual.ending].room, `${where}: ending room`);
          } else {
            assertEqual(st.predicted.render, st.actual.render, `${where}: next render`);
            assertEqual(st.predicted.room, st.actual.room, `${where}: room behind the threshold`);
          }
          checked++;
        }
      }
    }
    assertEqual(checked, 2 * 256 * 8, 'every step checked');
  });

  await runCase('spine.js outcomesFor() leaves the live state alone (cloneState)', () => {
    const state = createState();
    commitChoice(state, 1);
    state.flags.add('NEVER_SAT');
    const snap = () => JSON.stringify({ ...state, flags: [...state.flags] });
    const before = snap();
    outcomesFor(state, manifest, endings, 'S2', manifest.scenes.S2.branches.C);
    outcomesFor(state, manifest, endings, 'S8', manifest.scenes.S8.branches.C);
    assertEqual(snap(), before, 'state changed');
  });

  await runCase('spine.js: the director-faithful sweep (OPENED_BOX from scenes.json setFlag) gives 19 / 27 / 202 / 8 RETAINED', () => {
    // The render-tracking sweep above sets OPENED_BOX by hand; this one takes
    // it from data/scenes.json (S8 C's resist threshold), as the director does.
    const counts = { ASSIMILATION: 0, EXPULSION: 0, PENDING: 0, RETAINED: 0 };
    for (let mask = 0; mask < 256; mask++) counts[resolveEnding(simulate(mask, 'C').state)]++;
    assertEqual(counts.ASSIMILATION, 19, 'ASSIMILATION');
    assertEqual(counts.EXPULSION, 27, 'EXPULSION');
    assertEqual(counts.PENDING, 202, 'PENDING');
    assertEqual(counts.RETAINED, 8, 'RETAINED');
  });

  await runCase('Renders only flip on S0->S1, S2->S3, S4->S5, S6->S7; only there can the two thresholds lead to different rooms', () => {
    // Which spine edges can flip at all, per renderFor()'s +/-2 threshold and
    // the S0 seed. S0 is branchless (X): it "lands in" C unless seeded H.
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
    const differ = new Set();
    for (const seed of ['C', 'H']) {
      for (let mask = 0; mask < 256; mask++) {
        for (const st of simulate(mask, seed).steps) {
          if (st.sceneId === 'S8') continue;
          if (new Set(Object.values(st.all).map((o) => o.room)).size > 1) differ.add(`${st.sceneId}->${st.predicted.next}`);
        }
      }
    }
    for (const e of differ) assert(['S2->S3', 'S4->S5', 'S6->S7'].includes(e), `thresholds lead to different rooms on ${e}`);
  });

  await runCase("Every branch's `next` is single-valued: one string per branch, the same for both renders, never per threshold", () => {
    for (const [sceneId, scene] of Object.entries(manifest.scenes)) {
      const nexts = new Set();
      for (const [letter, branch] of Object.entries(scene.branches)) {
        assert(typeof branch.next === 'string' && branch.next.length > 0, `${sceneId}.${letter}: next must be one string`);
        nexts.add(branch.next);
        for (const [key, th] of Object.entries(branch.thresholds || {})) assert(th.next === undefined, `${sceneId}.${letter}.${key}: a threshold may not name its own next (the spine never forks)`);
      }
      assertEqual(nexts.size, 1, `${sceneId}: next differs between renders`);
    }
  });

  await runCase('spine.js zonesOf / baseOf / cloneState', () => {
    assertEqual(JSON.stringify(zonesOf({ zone: 'a' })), '["a"]');
    assertEqual(JSON.stringify(zonesOf({ zone: ['a', 'b'] })), '["a","b"]');
    assertEqual(JSON.stringify(zonesOf({})), '[]');
    assertEqual(JSON.stringify(zonesOf(null)), '[]');
    const rooms = { rooms: { A: { size: [1, 1, 1] }, B: { alias: 'A' } } };
    assertEqual(baseOf(rooms, 'B'), 'A');
    assertEqual(baseOf(rooms, 'A'), 'A');
    assertEqual(baseOf(rooms, 'Z'), 'Z');
    const s = createState();
    s.flags.add('X');
    const c = cloneState(s);
    c.flags.add('Y');
    c.dwell.push(1);
    c.formAnswers.name = 'SHAUN';
    assert(!s.flags.has('Y') && s.dwell.length === 0 && s.formAnswers.name === undefined, 'the clone shares state with the original');
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
