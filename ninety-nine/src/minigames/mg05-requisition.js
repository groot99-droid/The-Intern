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
const STANDING_STILL_TIMEOUT_S = 90; // Doc 3 MG-05 mode H
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

function mountModeH(container, state, onComplete, sceneAssets, tracked) {
  const dwell = createDwellTimer();
  dwell.start();

  const hud = el('div', 'mg05-run-hint', 'HOLD TO RUN');
  container.appendChild(hud);

  let resolved = false;
  let stamina = 1.0;
  let holding = false;
  let everHeld = false;
  let restCount = 0;
  const DRAIN_PER_TICK = 1 / (45 * 10); // ~45s continuous run to depletion, 100ms ticks
  const RECOVER_PER_TICK = DRAIN_PER_TICK * 0.5;

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

  const tickId = tracked.setInterval(() => {
    if (resolved) return;
    if (holding) {
      stamina = Math.max(0, stamina - DRAIN_PER_TICK);
      if (stamina <= 0) {
        finish();
      }
    } else if (everHeld) {
      stamina = Math.min(1, stamina + RECOVER_PER_TICK);
    }
  }, 100);

  tracked.on(container, 'pointerdown', () => {
    if (!everHeld) everHeld = true;
    else if (!holding) restCount++; // a rest just ended, about to hold again
    holding = true;
  });
  tracked.on(window, 'pointerup', () => {
    holding = false;
  });
  tracked.on(window, 'keydown', (e) => {
    if (e.code === 'Space' && !holding) {
      if (!everHeld) everHeld = true;
      else restCount++;
      holding = true;
    }
  });
  tracked.on(window, 'keyup', (e) => {
    if (e.code === 'Space') holding = false;
  });

  // Doc 3 MG-05 mode H: "Never ran at all, just stood still: after 90
  // seconds the camera slumps, stamina drains from standing, and the bay
  // ends." friction 1.0.
  hardTimeout(tracked, STANDING_STILL_TIMEOUT_S, () => {
    if (!everHeld) finish();
  });
  hardTimeout(tracked, HARD_CAP_TIMEOUT_S, finish);

  return { dispose() {} }; // tracked.disposeAll() (called by unmount below) covers everything here
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
        : mountModeH(container, state, onComplete, sceneAssets, tracked);
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
