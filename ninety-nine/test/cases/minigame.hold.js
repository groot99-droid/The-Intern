// The hold-to-act mini-games (MG-05 H THE RUN, MG-07 H THE BREATH) against a
// stub scene service. The defect this pins down: #minigame-layer is
// pointer-events:none (style.css) and both modes listened for pointerdown
// on the layer itself, so a press landed nowhere unless it hit the hint
// text -- "hold to run does nothing, the video just loops". Each mode must
// now mount a full-layer child that takes the press, must NOT complete on
// its own inside the first seconds, must drive the scene (pause on mount,
// resume while held, pause on release), and must complete once stamina /
// depth runs out. Timers are accelerated 40x so a 45 s run takes ~1.1 s.

import { runCase, assert } from '../harness.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function accelerate(factor) {
  const origI = window.setInterval, origT = window.setTimeout;
  window.setInterval = (fn, ms, ...rest) => origI.call(window, fn, Math.max(1, ms / factor), ...rest);
  window.setTimeout = (fn, ms, ...rest) => origT.call(window, fn, Math.max(0, (ms || 0) / factor), ...rest);
  return () => { window.setInterval = origI; window.setTimeout = origT; };
}

function stubServices() {
  const calls = [];
  return {
    calls,
    services: {
      audio: { duckDrone() {}, restoreDrone() {} },
      sfx: { play(name) { calls.push(['sfx', name]); } },
      scene: {
        pause() { calls.push(['pause']); },
        resume() { calls.push(['resume']); },
        setRate(r) { calls.push(['rate', r]); },
        hold(pose) { calls.push(['hold', pose]); },
        setEffect(n, on) { calls.push(['fx', n, on]); }
      }
    }
  };
}

async function mountH(modName, services, container) {
  const factory = (await import(`../../src/minigames/${modName}.js`)).default;
  const instance = factory('H');
  let payload = null;
  const snapshot = Object.freeze({ conformance: 0, dissonance: 0, friction: 0, flags: new Set(), formAnswers: {} });
  instance.mount(container, snapshot, (p) => { payload = p; }, {}, services);
  return { instance, done: () => payload };
}

function press(el) { el.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true, cancelable: true })); }
function releaseAll() { window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); }

export async function run() {
  await runCase('MG-05 H: mounts a full-layer zone (the layer itself takes no pointer events)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { services } = stubServices();
    const { instance } = await mountH('mg05-requisition', services, container);
    const zone = container.querySelector('.mg05-run-zone');
    assert(zone, 'no .mg05-run-zone child');
    assert(zone.querySelector('.mg05-run-hint'), 'hint text missing');
    assert(zone.querySelector('.mg05-run-toggle'), 'toggle-to-run alternative missing (Doc 3 accessibility)');
    instance.unmount();
    container.remove();
  });

  await runCase('MG-05 H: does not complete on its own; the loop is frozen until he runs', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { services, calls } = stubServices();
    const { instance, done } = await mountH('mg05-requisition', services, container);
    await sleep(600);
    assert(done() === null, `completed with nothing held: ${JSON.stringify(done())}`);
    assert(calls.some((c) => c[0] === 'pause'), 'scene not paused on mount');
    assert(!calls.some((c) => c[0] === 'resume'), 'scene resumed with nothing held');
    instance.unmount();
    container.remove();
  });

  await runCase('MG-05 H: a press on the zone runs (scene resumes, footsteps); release rests (scene pauses)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { services, calls } = stubServices();
    const { instance, done } = await mountH('mg05-requisition', services, container);
    const zone = container.querySelector('.mg05-run-zone');
    press(zone);
    await sleep(900);
    assert(calls.some((c) => c[0] === 'resume'), 'press did not resume the scene');
    assert(calls.some((c) => c[0] === 'sfx' && c[1] === 'footstep'), 'no footsteps while running');
    assert(calls.some((c) => c[0] === 'fx' && c[1] === 'run-bob' && c[2] === true), 'no run-bob effect');
    assert(zone.classList.contains('mg05-running'), 'zone not flagged running');
    const resumes = calls.filter((c) => c[0] === 'resume').length;
    releaseAll();
    await sleep(300);
    assert(calls.filter((c) => c[0] === 'pause').length >= 2, 'release did not pause the scene');
    assert(!zone.classList.contains('mg05-running'), 'zone still flagged running after release');
    assert(done() === null, 'completed after a short run');
    press(zone);
    await sleep(300);
    assert(calls.filter((c) => c[0] === 'resume').length > resumes, 'second press did not resume');
    releaseAll();
    instance.unmount();
    container.remove();
  });

  await runCase('MG-05 H: held to depletion (40x clock) -> parks on the dead-flat out pose, then completes with friction 0.3', async () => {
    const restore = accelerate(40);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { services, calls } = stubServices();
    let payload = null;
    try {
      const factory = (await import('../../src/minigames/mg05-requisition.js')).default;
      const instance = factory('H');
      instance.mount(container, Object.freeze({ conformance: 0, dissonance: 0, friction: 0, flags: new Set(), formAnswers: {} }), (p) => { payload = p; }, {}, services);
      press(container.querySelector('.mg05-run-zone'));
      const t0 = performance.now();
      while (payload === null && performance.now() - t0 < 6000) await sleep(50);
      assert(payload !== null, 'never completed after a continuous hold');
      assert(Math.abs(payload.friction - 0.3) < 1e-9, `friction ${payload.friction}, expected 0.3 for an unbroken run`);
      assert(calls.some((c) => c[0] === 'hold' && c[1] === 'out'), 'the dead-flat out pose was never held for the silence');
      assert(container.querySelector('.mg05-run-zone').classList.contains('mg05-spent'), 'zone not flagged spent');
      instance.unmount();
      releaseAll();
    } finally {
      restore();
      container.remove();
    }
  });

  await runCase('MG-05 H: rests raise friction (0.3 + 0.15 per rest, capped 0.9)', async () => {
    const restore = accelerate(40);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { services } = stubServices();
    let payload = null;
    try {
      const factory = (await import('../../src/minigames/mg05-requisition.js')).default;
      const instance = factory('H');
      instance.mount(container, Object.freeze({ conformance: 0, dissonance: 0, friction: 0, flags: new Set(), formAnswers: {} }), (p) => { payload = p; }, {}, services);
      const zone = container.querySelector('.mg05-run-zone');
      press(zone); await sleep(200); releaseAll(); await sleep(60);
      press(zone); await sleep(200); releaseAll(); await sleep(60);
      press(zone);
      const t0 = performance.now();
      while (payload === null && performance.now() - t0 < 8000) await sleep(50);
      assert(payload !== null, 'never completed');
      assert(Math.abs(payload.friction - 0.6) < 1e-9, `friction ${payload.friction}, expected 0.6 after two rests`);
      instance.unmount();
      releaseAll();
    } finally {
      restore();
      container.remove();
    }
  });

  await runCase('MG-07 H: mounts a full-layer zone; a press descends, release surfaces', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { services } = stubServices();
    const { instance, done } = await mountH('mg07-handoff', services, container);
    const zone = container.querySelector('.mg07-breath-zone');
    assert(zone, 'no .mg07-breath-zone child');
    press(zone);
    await sleep(450);
    const depth = parseFloat(zone.style.getPropertyValue('--depth'));
    assert(depth > 0, `depth did not increase while held (${depth})`);
    assert(zone.classList.contains('mg07-descending'), 'zone not flagged descending');
    releaseAll();
    await sleep(150);
    assert(parseFloat(zone.style.getPropertyValue('--depth')) === 0, 'release did not surface (Doc 3: you lose all depth)');
    assert(done() === null, 'completed early');
    instance.unmount();
    container.remove();
  });
}
