// Doc 3 MG-05: THE REQUISITION TERMINAL (mode C) / THE RUN (mode H).
// "The most important mini-game in the project" -- resistance is available,
// costs five times the effort, and is silently undone. Doc 4 §10 Phase 4
// gate: if this doesn't feel expensive and futile, stop before building the
// other six.
//
// Design decision (Doc 3 §6.2 is left as an open question -- "pick one"):
// this implementation ships the WITNESSABLE reversion variant. A row that
// reaches UNDER REVIEW reverts back to ORDERED after a delay WHILE the
// player may still be working other rows (visible in peripheral vision),
// not only in a single batch at scene end. This is the only reading under
// which MG-05's own friction formula ("+0.1 if any row was flagged more
// than once after seeing a reversion") is satisfiable within one mount --
// under the purely off-screen/end-of-scene variant, a player could never
// "see" a reversion before the terminal closes. Any row still UNDER REVIEW
// when the player finishes is still force-reverted at completion, so the
// documented end-state ("every UNDER REVIEW row reverts") holds either way.

import { defineMinigame, createFrictionAccumulator, createDwellTimer, createTrackedListeners, hardTimeout } from './_contract.js';

const REJECT_KEYS = ['flag.reject.1', 'flag.reject.2', 'flag.reject.3', 'flag.reject.4'];
const REVERSION_DELAY_MS = 9000;
const SLUMP_AT_MS = 90000;   // Doc 3 MG-05 mode H: never ran -> camera slumps at 90s
const SLUMP_HOLD_MS = 4000;  // ...and the bay ends shortly after
const SPENT_CUT_MS = 1500;   // depletion: the frozen loop, then the cut to the dead-flat still
const SPENT_HOLD_MS = 7000;  // total silence before the choice (Doc 3 says ten; shortened, see mountModeH)
const HARD_CAP_TIMEOUT_S = 200; // safety net above the documented "up to 3 minutes"

let textLibraryPromise = null;
async function loadTextLibrary() {
  if (!textLibraryPromise) {
    // Absolute paths: this module is mounted from both / (the real game)
    // and /test/ (the leak-test harness), which would otherwise resolve
    // relative fetches differently.
    textLibraryPromise = Promise.all([
      fetch('/text/system.json').then((r) => r.json()),
      fetch('/text/manifest.json').then((r) => r.json())
    ]).then(([system, manifest]) => ({ system, manifest }));
  }
  return textLibraryPromise;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function mountModeC(container, state, onComplete, sceneAssets, tracked, services) {
  const friction = createFrictionAccumulator();
  const dwell = createDwellTimer();
  dwell.start();
  let orderedRowCount = 0; // Doc 3: chime "detunes downward by 3 cents per row"

  const rect = sceneAssets && sceneAssets.screenRect ? sceneAssets.screenRect : { x: 0.37, y: 0.25, w: 0.28, h: 0.36 };

  const panel = el('div', 'mg05-terminal');
  panel.style.left = `${rect.x * 100}%`;
  panel.style.top = `${rect.y * 100}%`;
  panel.style.width = `${rect.w * 100}%`;
  panel.style.height = `${rect.h * 100}%`;
  container.appendChild(panel);

  const list = el('div', 'mg05-list');
  panel.appendChild(list);

  let flaggedRowCount = 0;
  let sawReversion = false;
  let flaggedAgainAfterSeeingReversion = false;
  let resolved = false;
  let cancelled = false; // set by unmount() if it fires before the async text load below resolves
  const rowStates = new Map(); // num -> {status, flagAttempts}
  const pendingReversionTimers = new Map(); // num -> timeoutId

  function checkAllResolved(totalRows) {
    if (rowStates.size >= totalRows && [...rowStates.values()].every((r) => r.status === 'ORDERED' || r.status === 'UNDER_REVIEW')) {
      finish();
    }
  }

  function finish() {
    if (resolved) return;
    resolved = true;
    dwell.stop();
    // Doc 3: "at the end of the scene every UNDER REVIEW row silently
    // reverts to ORDERED" -- force any still-pending ones now.
    for (const id of pendingReversionTimers.values()) tracked.clearTimeout(id);
    pendingReversionTimers.clear();
    for (const rs of rowStates.values()) {
      if (rs.status === 'UNDER_REVIEW') rs.status = 'ORDERED';
    }
    const flaggedFraction = flaggedRowCount / 18;
    friction.set(flaggedFraction * 0.9 + (flaggedAgainAfterSeeingReversion ? 0.1 : 0));
    onComplete({ friction: friction.value(), dwell: dwell.elapsedSeconds(), flags: [] });
  }

  loadTextLibrary().then(({ system, manifest }) => {
    if (resolved || cancelled) return;
    const totalRows = manifest.rows.length;

    for (const row of manifest.rows) {
      rowStates.set(row.num, { status: 'PENDING', flagAttempts: 0, everFlagged: false, revertedOnce: false });
      const rowEl = el('div', 'mg05-row');
      rowEl.dataset.num = row.num;

      const label = el('span', 'mg05-item', `${row.num}  ${row.item}  (${row.qty} ${row.unit})`);
      rowEl.appendChild(label);

      const actions = el('span', 'mg05-actions');
      const orderBtn = el('button', 'mg05-btn', 'ORDER');
      const flagBtn = el('button', 'mg05-btn', 'FLAG');
      actions.append(orderBtn, flagBtn);
      rowEl.appendChild(actions);

      const justify = el('div', 'mg05-justify');
      justify.hidden = true;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'mg05-justify-input';
      input.placeholder = 'justification';
      const submitBtn = el('button', 'mg05-btn', 'SUBMIT');
      const msg = el('span', 'mg05-msg');
      justify.append(input, submitBtn, msg);
      rowEl.appendChild(justify);

      tracked.on(input, 'keydown', () => {
        if (services && services.sfx) services.sfx.play('keyboard-press');
      });

      tracked.on(orderBtn, 'click', () => {
        const rs = rowStates.get(row.num);
        if (rs.status !== 'PENDING') return;
        if (services && services.sfx) {
          services.sfx.play('requisition-chime', { detuneCents: -3 * orderedRowCount });
          orderedRowCount++;
        }
        rs.status = 'ORDERED';
        rowEl.classList.add('mg05-row-ordered');
        orderBtn.disabled = true;
        flagBtn.disabled = true;
        checkAllResolved(totalRows);
      });

      tracked.on(flagBtn, 'click', () => {
        const rs = rowStates.get(row.num);
        // Flaggable while untouched, mid-review, or after a witnessed
        // reversion (status reset to ORDERED with revertedOnce set) --
        // never after a plain ORDER click.
        if (rs.status === 'ORDERED' && !rs.revertedOnce) return;
        justify.hidden = false;
        orderBtn.disabled = true;
        flagBtn.disabled = true;
      });

      tracked.on(submitBtn, 'click', () => {
        const rs = rowStates.get(row.num);
        rs.flagAttempts++;
        if (rs.flagAttempts < 5) {
          if (services && services.sfx) services.sfx.play('flag-reject-beep');
          msg.textContent = system[REJECT_KEYS[rs.flagAttempts - 1]];
          input.value = '';
        } else {
          if (!rs.everFlagged) {
            flaggedRowCount++;
            rs.everFlagged = true;
          }
          if (sawReversion) flaggedAgainAfterSeeingReversion = true;
          rs.status = 'UNDER_REVIEW';
          rs.flagAttempts = 0;
          rowEl.classList.add('mg05-row-review');
          rowEl.classList.remove('mg05-row-ordered');
          justify.hidden = true;
          msg.textContent = '';

          const timerId = tracked.setTimeout(() => {
            pendingReversionTimers.delete(row.num);
            if (resolved) return;
            const current = rowStates.get(row.num);
            if (current.status === 'UNDER_REVIEW') {
              current.status = 'ORDERED';
              current.revertedOnce = true;
              rowEl.classList.remove('mg05-row-review');
              rowEl.classList.add('mg05-row-ordered', 'mg05-row-reverted');
              sawReversion = true;
              orderBtn.disabled = true;
              flagBtn.disabled = false;
            }
          }, REVERSION_DELAY_MS);
          pendingReversionTimers.set(row.num, timerId);

          orderBtn.disabled = true;
          flagBtn.disabled = false; // Doc 3 §6.2 witnessable variant: player can re-flag after noticing a reversion
          checkAllResolved(totalRows);
        }
      });

      list.appendChild(rowEl);
    }

    if (state.flags.has('SAW_HARLOWE') && manifest.harloweRow) {
      const hr = manifest.harloweRow;
      const rowEl = el('div', 'mg05-row mg05-row-harlowe', `${hr.num}  ${hr.item}`);
      list.appendChild(rowEl);
    }
  });

  hardTimeout(tracked, HARD_CAP_TIMEOUT_S, finish);

  return { dispose() { cancelled = true; } };
}

function mountModeH(container, state, onComplete, sceneAssets, tracked, services) {
  const dwell = createDwellTimer();
  dwell.start();
  const scene = services && services.scene ? services.scene : null;
  const sfx = services && services.sfx ? services.sfx : null;

  // The mini-game layer itself is pointer-events:none (style.css) so the
  // choice buttons underneath stay clickable between mini-games -- only
  // its CHILDREN take input. The old build listened on the layer, so a
  // press landed nowhere unless it hit the 0.9rem hint text: "hold to run
  // does nothing, the video just loops". A full-layer zone is the child
  // that takes the press now (Doc 3 MG-05 H: "press and hold anywhere").
  const zone = el('div', 'mg05-run-zone');
  const hud = el('div', 'mg05-run-hint', 'HOLD TO RUN');
  // Doc 3 accessibility: "hold-to-run has a toggle-to-run alternative.
  // Stamina is unaffected."
  const toggleBtn = el('button', 'mg05-run-toggle', 'TOGGLE RUN');
  toggleBtn.type = 'button';
  zone.append(hud, toggleBtn);
  container.appendChild(zone);

  let resolved = false;
  let spent = false;       // stamina hit zero: the silence before the edge
  let stamina = 1.0;       // invisible to the player (Doc 3) -- the world shows it, not a bar
  let holding = false;     // pointer or key currently down
  let toggled = false;     // toggle-to-run alternative
  let wasRunning = false;
  let everHeld = false;
  let restCount = 0;
  let stillMs = 0;         // never-ran clock (90s camera slump)
  let footAcc = 0;
  let breathAcc = 0;
  const TICK_MS = 100;
  const DRAIN_PER_TICK = 1 / (45 * 10); // ~45s continuous run to depletion (Doc 3)
  const RECOVER_PER_TICK = DRAIN_PER_TICK * 0.5; // resting makes the corridor longer

  const running = () => !spent && (holding || toggled);

  function finish() {
    if (resolved) return;
    resolved = true;
    dwell.stop();
    let friction;
    if (!everHeld) friction = 1.0;
    else if (restCount === 0) friction = 0.3;
    else friction = Math.min(0.9, 0.3 + restCount * 0.15);
    onComplete({ friction, dwell: dwell.elapsedSeconds(), flags: [] });
  }

  // The garage only moves while he runs. Standing still freezes the loop
  // on its frame; running plays it, fast at first and dragging as stamina
  // goes, with footfalls and breathing that slow and deepen with it (Doc 3
  // MG-05 H audio). Nothing here touches the drone (C7).
  function onRunStart() {
    if (everHeld) restCount++; // a rest just ended
    everHeld = true;
    stillMs = 0;
    footAcc = 0; breathAcc = 0;
    zone.classList.add('mg05-running');
    if (scene) { scene.resume(); scene.setEffect && scene.setEffect('run-bob', true); }
  }
  function onRunStop() {
    zone.classList.remove('mg05-running');
    if (scene) { scene.pause(); scene.setEffect && scene.setEffect('run-bob', false); }
  }

  function deplete() {
    if (spent || resolved) return;
    spent = true;
    if (wasRunning) { wasRunning = false; onRunStop(); }
    holding = false; toggled = false;
    zone.classList.remove('mg05-running');
    zone.classList.add('mg05-spent');
    hud.textContent = '';
    toggleBtn.hidden = true;
    if (scene) {
      scene.setRate(1);
      scene.setEffect && scene.setEffect('run-bob', false);
      scene.setEffect && scene.setEffect('slump', false);
    }
    // Doc 3: "At depletion, ten full seconds of nothing but the drone and
    // the wet room tone of the pool below, before the edge is revealed."
    // The loop is left on its frame for a breath, then cuts to the
    // dead-flat IMG_OUT (MANIFEST: "engine holds on S6_H_IMG_OUT for the
    // silence") and the choice arrives only after the hold.
    tracked.setTimeout(() => {
      if (resolved) return;
      if (scene && sceneAssets && sceneAssets.imgOut) scene.showStill(sceneAssets.imgOut);
    }, SPENT_CUT_MS);
    tracked.setTimeout(finish, SPENT_HOLD_MS);
  }

  tracked.setInterval(() => {
    if (resolved || spent) return;
    const run = running();
    if (run && !wasRunning) onRunStart();
    if (!run && wasRunning) onRunStop();
    wasRunning = run;

    if (run) {
      stamina = Math.max(0, stamina - DRAIN_PER_TICK);
      const fatigue = 1 - stamina;
      zone.style.setProperty('--fatigue', fatigue.toFixed(3));
      if (scene) scene.setRate(0.7 + stamina * 0.6); // 1.3x fresh -> 0.7x spent
      footAcc += TICK_MS;
      breathAcc += TICK_MS;
      const stride = 360 + fatigue * 340;   // ms per footfall: quick, then dragging
      const breath = 1100 + fatigue * 1300; // ms per breath: even, then heaving
      if (footAcc >= stride) {
        footAcc -= stride;
        if (sfx) sfx.play('footstep', { filterHz: 820 - fatigue * 320, gain: 0.16 + fatigue * 0.06 });
      }
      if (breathAcc >= breath) {
        breathAcc -= breath;
        if (sfx) sfx.play('breath', { filterHz: 900 - fatigue * 500, durationMs: 260 + fatigue * 360, gain: 0.06 + fatigue * 0.1 });
      }
      if (stamina <= 0) deplete();
    } else if (everHeld) {
      stamina = Math.min(1, stamina + RECOVER_PER_TICK);
      zone.style.setProperty('--fatigue', (1 - stamina).toFixed(3));
    } else {
      // Doc 3: "Never ran at all, just stood still: after 90 seconds the
      // camera slumps, stamina drains from standing, and the bay ends."
      stillMs += TICK_MS;
      if (stillMs >= SLUMP_AT_MS && !zone.classList.contains('mg05-slump')) {
        zone.classList.add('mg05-slump');
        if (scene && scene.setEffect) scene.setEffect('slump', true);
        tracked.setTimeout(deplete, SLUMP_HOLD_MS);
      }
    }
  }, TICK_MS);

  // Input. pointerdown on the zone, released by ANY pointerup/cancel or a
  // window blur, so a finger that slides off or a tab switch never leaves
  // him running with nothing held.
  tracked.on(zone, 'pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target === toggleBtn) return;
    e.preventDefault();
    holding = true;
  });
  tracked.on(window, 'pointerup', () => { holding = false; });
  tracked.on(window, 'pointercancel', () => { holding = false; });
  tracked.on(window, 'blur', () => { holding = false; });
  tracked.on(zone, 'contextmenu', (e) => e.preventDefault());
  tracked.on(window, 'keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') { e.preventDefault(); holding = true; }
  });
  tracked.on(window, 'keyup', (e) => {
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') holding = false;
  });
  tracked.on(toggleBtn, 'pointerdown', (e) => e.stopPropagation());
  tracked.on(toggleBtn, 'click', (e) => {
    e.stopPropagation();
    if (spent) return;
    toggled = !toggled;
    toggleBtn.classList.toggle('mg05-run-toggle-on', toggled);
    toggleBtn.textContent = toggled ? 'STOP RUNNING' : 'TOGGLE RUN';
  });

  // Nothing moves until he does: the loop the router left playing is
  // frozen on its frame, the way a held frame reads as "waiting".
  if (scene) scene.pause();

  hardTimeout(tracked, HARD_CAP_TIMEOUT_S, finish);

  return {
    dispose() {
      // Runs from unmount(): the router resets the rate; the effects and
      // the paused loop are ours to undo (a bail mid-run must not leave the
      // scene layer bobbing).
      if (scene) {
        scene.setEffect && scene.setEffect('run-bob', false);
        scene.setEffect && scene.setEffect('slump', false);
        if (!spent) scene.resume();
      }
    }
  };
}

export default function createMg05(mode) {
  let tracked = null;
  let disposeFn = null;

  return defineMinigame({
    id: 'MG-05',
    mode,
    mount(container, state, onComplete, sceneAssets, services) {
      tracked = createTrackedListeners();
      const result = mode === 'C'
        ? mountModeC(container, state, onComplete, sceneAssets, tracked, services)
        : mountModeH(container, state, onComplete, sceneAssets, tracked, services);
      disposeFn = result && result.dispose;
    },
    unmount() {
      if (disposeFn) disposeFn();
      disposeFn = null;
      if (tracked) {
        tracked.disposeAll();
        tracked = null;
      }
    }
  });
}
