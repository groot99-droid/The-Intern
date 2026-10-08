// src/friction.js: friction from how the candidate walks to the choice
// (the mini-games that used to produce it are gone). Pure: a meter fed
// dt and which threshold's approach ring he is in. Hesitation is a
// smoothstep from t0 to t1 seconds of ACTIVE choosing; doubling counts
// alternations between the two rings, debounced; value() = 0.6 x
// hesitation + 0.4 x doubling, bounded 0..1 (Doc 1 §2.1's per-scene range).

import { createFrictionMeter } from '../../src/friction.js';
import { runCase, assert, assertEqual } from '../harness.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

function idle(meter, seconds, opts = {}, step = 0.1) {
  for (let t = 0; t < seconds - 1e-9; t += step) meter.tick(step, opts);
}

export async function run() {
  await runCase('friction: hesitation is 0 before t0 and saturates after t1 (0.6 of the value with no doubling)', () => {
    const m = createFrictionMeter({ t0: 20, t1: 90 });
    assertEqual(m.value(), 0, 'fresh meter');
    idle(m, 19.9);
    assertEqual(m.value(), 0, 'before t0');
    idle(m, 35.1); // ~55 s: the midpoint of 20..90
    assert(near(m.value(), 0.3, 0.01), `midpoint should be 0.6 x 0.5 = 0.3, got ${m.value()}`);
    idle(m, 40); // 95 s
    assert(near(m.value(), 0.6, 1e-6), `after t1 hesitation is full: 0.6, got ${m.value()}`);
    idle(m, 600);
    assert(near(m.value(), 0.6, 1e-6), 'stays full');
    assert(near(m.seconds(), 695, 0.01), `seconds() counts active time, got ${m.seconds()}`);
  });

  await runCase('friction: the hesitation curve is monotone and smooth (smoothstep), and custom t0/t1 move it', () => {
    const m = createFrictionMeter({ t0: 10, t1: 45 });
    let prev = -1;
    for (let i = 0; i < 600; i++) {
      m.tick(0.1);
      const v = m.value();
      assert(v >= prev - 1e-12, `not monotone at ${m.seconds()}s`);
      assert(v - prev < 0.01 || prev < 0, `jumps at ${m.seconds()}s`);
      prev = v;
    }
    assert(near(m.value(), 0.6, 1e-6), 'S2-style t1 of 45 s reached by 60 s');
  });

  await runCase('friction: alternations count ring changes between the two thresholds, debounced', () => {
    // The debounce runs from entering the previous ring: a change of ring
    // counts only if he went into the last one more than `debounce` ago.
    const quick = createFrictionMeter({ debounce: 1.5, doublingFull: 3 });
    idle(quick, 1, { ring: 'succumb' });
    idle(quick, 1, { ring: 'resist' });
    assertEqual(quick.alternations(), 0, '1 s in the first ring is inside the debounce');

    const m = createFrictionMeter({ debounce: 1.5, doublingFull: 3 });
    idle(m, 2, { ring: 'succumb' });
    assertEqual(m.alternations(), 0, 'the first ring is not an alternation');
    idle(m, 2, { ring: 'resist' });
    assertEqual(m.alternations(), 1, 'succumb -> resist after 2 s');
    m.tick(0.2, { ring: 'succumb' });
    assertEqual(m.alternations(), 2, 'resist -> succumb (2 s after entering resist)');
    // a quick flick back and forth inside the debounce does not count
    m.tick(0.2, { ring: 'resist' });
    m.tick(0.2, { ring: 'succumb' });
    assertEqual(m.alternations(), 2, 'flicks inside 1.5 s are debounced');
    // walking out of both rings and back into the same one is not doubling
    idle(m, 3, { ring: null });
    idle(m, 1, { ring: 'succumb' });
    assertEqual(m.alternations(), 2, 'out and back into the same ring');
    idle(m, 2, { ring: 'resist' });
    assertEqual(m.alternations(), 3, 'to the other one again');
    // doubling saturates at doublingFull: 0.4 of the value (hesitation still 0 at ~11 s)
    assert(near(m.value(), 0.4, 1e-9), `three alternations give the full 0.4 doubling share, value ${m.value()}`);
    idle(m, 3, { ring: 'succumb' });
    assert(near(m.value(), 0.4, 1e-9), 'a fourth alternation adds nothing');
  });

  await runCase('friction: value() is bounded 0..1 whatever is fed in', () => {
    const m = createFrictionMeter({ t0: 0, t1: 1, doublingFull: 1, debounce: 0 });
    for (let i = 0; i < 2000; i++) m.tick(0.37, { ring: i % 2 ? 'succumb' : 'resist' });
    assert(m.value() <= 1 && m.value() >= 0, `value ${m.value()}`);
    assert(near(m.value(), 1, 1e-9), `both shares full: 1, got ${m.value()}`);
    const z = createFrictionMeter({ t0: 50, t1: 50 }); // degenerate curve
    z.tick(10);
    assertEqual(z.value(), 0, 'before a step curve');
    z.tick(41);
    assert(near(z.value(), 0.6), 'after a step curve');
    const neg = createFrictionMeter();
    neg.tick(-5);
    assert(neg.value() >= 0, 'never below 0');
  });

  await runCase('friction: inactive time (carried, hidden window, not yet armed) is ignored', () => {
    const m = createFrictionMeter({ t0: 20, t1: 90, debounce: 1.5 });
    idle(m, 500, { active: false });
    assertEqual(m.seconds(), 0, 'inactive seconds counted');
    assertEqual(m.value(), 0, 'inactive time raised friction');
    // rings visited while inactive do not count either
    idle(m, 3, { ring: 'succumb', active: false });
    idle(m, 3, { ring: 'resist', active: false });
    assertEqual(m.alternations(), 0, 'alternations while inactive');
    idle(m, 10, { active: true });
    assert(near(m.seconds(), 10, 1e-6), `only active time: ${m.seconds()}`);
    assertEqual(m.value(), 0, 'still under t0');
  });
}
