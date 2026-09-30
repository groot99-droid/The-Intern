// renderer.js against stubbed <video> elements. The defect this pins down:
// a choice clicked inside a soft-loop re-arm's 400ms settle let the re-arm
// hand its already-superseded "active" element -- by then the TRANSITION
// clip -- to armSoftLoop, which read the transition's own token and so
// passed the guard. 0.9s before the transition ended the old room loop was
// loaded over it, `ended` never fired, and the router sat out its fallback
// timer while the previous room played again. Reproduced in-game with
// Playwright at ~400ms/loop-length of clicks; asserted here without decoding
// anything.
//
// Fixture: the same three elements index.html gives the renderer. play() is
// stubbed to resolve, load() dispatches canplaythrough on the next tick, and
// currentTime/duration are instance-level accessors the test advances by
// hand, dispatching `timeupdate` the way the media engine would. Nothing is
// fetched (a headless shell has no H.264 anyway).

import { runCase, assert, assertEqual } from '../harness.js';
import { createRenderer } from '../../src/renderer.js';

const SETTLE_MS = 400; // renderer.js CROSSFADE_MS

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const srcOf = (el) => (el.getAttribute('src') || '').split('/').pop();

function fixture() {
  const container = document.createElement('div');
  container.innerHTML = '<video id="video-a" muted playsinline></video><video id="video-b" muted playsinline></video><img id="still-img" hidden alt="" />';
  document.body.appendChild(container);
  const loads = []; // [elementId, file] in call order
  const stubs = new Map();
  for (const el of container.querySelectorAll('video')) {
    const s = { t: 0, d: NaN, playing: false };
    stubs.set(el, s);
    Object.defineProperty(el, 'currentTime', { configurable: true, get: () => s.t, set: (v) => { s.t = v; } });
    Object.defineProperty(el, 'duration', { configurable: true, get: () => s.d });
    el.play = () => { s.playing = true; return Promise.resolve(); };
    el.pause = () => { s.playing = false; };
    el.load = () => {
      loads.push([el.id, srcOf(el)]);
      s.t = 0;
      setTimeout(() => el.dispatchEvent(new Event('canplaythrough')), 0);
    };
  }
  const byFile = (file) => [...container.querySelectorAll('video')].find((el) => srcOf(el) === file) || null;
  const tick = (el, t, d) => {
    const s = stubs.get(el);
    if (d !== undefined) s.d = d;
    s.t = t;
    el.dispatchEvent(new Event('timeupdate'));
  };
  return { container, loads, stubs, byFile, tick, destroy() { container.remove(); } };
}

// Resolves true if `promise` settles within `ms`, false otherwise.
function settlesWithin(promise, ms) {
  return Promise.race([promise.then(() => true), sleep(ms).then(() => false)]);
}

export async function run() {
  await runCase('Soft loop: a transition started inside a re-arm settle is never clobbered by the old room loop', async () => {
    const f = fixture();
    const renderer = createRenderer(f.container);
    try {
      await renderer.playEntry({ file: 'ROOM.mp4', type: 'video', loop: true }, 'C');
      const roomA = f.byFile('ROOM.mp4');
      assert(roomA, 'room clip should be loaded');
      // Nearing the end of the loop: the soft loop re-arms the same file in
      // the idle element and starts its crossfade.
      f.tick(roomA, 5.2, 6.0);
      await sleep(60); // canplaythrough tick + play(): the re-arm has swapped and is now inside its 400ms settle
      const copies = [...f.container.querySelectorAll('video')].filter((el) => srcOf(el) === 'ROOM.mp4');
      assertEqual(copies.length, 2, 'both elements should hold the room clip mid re-arm');
      const loadsBefore = f.loads.length;

      // The player clicks a choice inside that settle window.
      const transition = renderer.playTransition('TRN.mp4');
      await sleep(SETTLE_MS + 200); // re-arm settle expired (superseded), transition swapped and settled
      const trn = f.byFile('TRN.mp4');
      assert(trn, 'transition clip should be the visible layer');
      assert(trn.classList.contains('visible'), 'transition element should be visible');

      // 0.9s before the transition ends: with the bug, a stale soft-loop
      // handler armed on this element re-loaded ROOM.mp4 over it here.
      f.tick(trn, 3.3, 4.0);
      await sleep(30);
      assertEqual(srcOf(trn), 'TRN.mp4', 'transition element must keep the transition clip');
      const roomLoadsAfter = f.loads.slice(loadsBefore).filter(([, file]) => file === 'ROOM.mp4');
      assertEqual(roomLoadsAfter.length, 0, `old room loop must not re-arm once a transition owns the renderer (saw ${JSON.stringify(roomLoadsAfter)})`);

      // And the transition still ends normally, so the router is not left
      // waiting on a fallback timer.
      trn.dispatchEvent(new Event('ended'));
      assert(await settlesWithin(transition, 500), 'playTransition must resolve on ended');
    } finally {
      renderer.destroy();
      f.destroy();
    }
  });

  await runCase('Soft loop: a re-arm superseded mid-settle hands nothing back (no stale arm on the new clip)', async () => {
    const f = fixture();
    const renderer = createRenderer(f.container);
    try {
      await renderer.playEntry({ file: 'ROOM.mp4', type: 'video', loop: true }, 'C');
      const roomA = f.byFile('ROOM.mp4');
      f.tick(roomA, 5.2, 6.0);
      await sleep(60);
      // A still (e.g. a flip's still-cut) supersedes the re-arm during its settle.
      renderer.primeStill('NEXT_IMG_IN.png');
      await sleep(SETTLE_MS + 100);
      const loadsBefore = f.loads.length;
      // Whatever element the re-arm produced: nearing its end must do nothing.
      for (const el of f.container.querySelectorAll('video')) f.tick(el, 5.3, 6.0);
      await sleep(30);
      assertEqual(f.loads.length, loadsBefore, 'no crossfade may start from a superseded re-arm');
    } finally {
      renderer.destroy();
      f.destroy();
    }
  });

  await runCase('waitForEnded: the source being replaced underneath (emptied) releases the wait', async () => {
    const f = fixture();
    const renderer = createRenderer(f.container);
    try {
      const p = renderer.playTransition('TRN.mp4');
      await sleep(SETTLE_MS + 100);
      const trn = f.byFile('TRN.mp4');
      f.stubs.get(trn).d = 30; // long clip: the wall-clock fallback is far away
      trn.dispatchEvent(new Event('emptied'));
      assert(await settlesWithin(p, 300), 'emptied must release playTransition immediately');
    } finally {
      renderer.destroy();
      f.destroy();
    }
  });

  await runCase('playTransition sub-range: startAt seeks before play, stopAt ends and freezes at the black-join', async () => {
    const f = fixture();
    const renderer = createRenderer(f.container);
    try {
      const p = renderer.playTransition('LEAVE.mp4', { stopAt: 2.92 });
      await sleep(SETTLE_MS + 100);
      const leave = f.byFile('LEAVE.mp4');
      f.stubs.get(leave).d = 6.08;
      f.tick(leave, 2.5);
      assertEqual(await settlesWithin(p, 50), false, 'must not end before stopAt');
      f.tick(leave, 2.95);
      assert(await settlesWithin(p, 300), 'must end once currentTime passes stopAt');
      assertEqual(f.stubs.get(leave).playing, false, 'the clip is paused (frozen on black) at stopAt');

      const q = renderer.playTransition('ARRIVE.mp4', { startAt: 3.04 });
      await sleep(SETTLE_MS + 100);
      const arrive = f.byFile('ARRIVE.mp4');
      assertEqual(arrive.currentTime, 3.04, 'startAt must seek before play');
      assert(arrive.classList.contains('visible'), 'arrival clip is the visible layer');
      arrive.dispatchEvent(new Event('ended'));
      assert(await settlesWithin(q, 300), 'arrival half ends normally');
    } finally {
      renderer.destroy();
      f.destroy();
    }
  });
}
