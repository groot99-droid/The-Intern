// MG-01: THE TRAY. Replaces the deleted intake form (mg01-form.js) at the
// user's request -- the ten questions were already asked at S0, and asking
// them again in person was the weakest beat in the game. S1's waiting room
// now hands the candidate a tray of intake slips to fit into it.
//
// A deliberately plain falling-block puzzle: slips arrive, the candidate
// packs them, full rows are filed away. Shared between C and H (Doc 3's
// component index lists MG-01 mode H as "(shared)"); `mode` changes the
// tray's dressing only -- C is the ordered waiting room, H the scattered
// one -- never the rules, never the reading.
//
// Doc 3 §4 rule 1: it cannot be failed. There is no game-over. Filling the
// tray to the top ends the beat exactly like running the tray out does, and
// both end it the same way the hard timeout does.
//
// Friction (Doc 1 §2.1 / Doc 3 §1.1 -- friction only, never conformance) is
// read off the shape of the stack, not off winning: a hole is a slip filed
// somewhere nothing can reach. Packing tightly is compliance; leaving the
// tray full of gaps is not. Clearing rows is neither -- the building does
// not reward it, it just takes them away.
//
// Doc 3 §4 rule 5: the reduced-motion path must produce identical friction
// outcomes. It does -- friction is counted from the settled stack, and
// reduced motion only removes the automatic fall (the candidate places each
// slip with DROP instead), so the same stack reads the same either way.

import { defineMinigame, createFrictionAccumulator, createDwellTimer, createTrackedListeners, prefersReducedMotion, hardTimeout } from './_contract.js';

const COLS = 8;
const ROWS = 14;
const SLIPS_PER_RUN = 8;      // guaranteed exit: the tray runs out
const HARD_TIMEOUT_S = 150;   // Doc 3 §4 rule 1's hard ceiling
const GRAVITY_MS = 700;
const HOLE_FRICTION = 0.05;
const LONG_DWELL_SECONDS = 90;
const LONG_DWELL_BONUS = 0.15;

// Standard seven, as cell lists inside an n x n box so rotation is a single
// transform rather than seven hand-written rotation tables.
const SHAPES = [
  { n: 4, cells: [[1, 0], [1, 1], [1, 2], [1, 3]] }, // I
  { n: 2, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }, // O
  { n: 3, cells: [[0, 1], [1, 0], [1, 1], [1, 2]] }, // T
  { n: 3, cells: [[0, 1], [0, 2], [1, 0], [1, 1]] }, // S
  { n: 3, cells: [[0, 0], [0, 1], [1, 1], [1, 2]] }, // Z
  { n: 3, cells: [[0, 0], [1, 0], [1, 1], [1, 2]] }, // J
  { n: 3, cells: [[0, 2], [1, 0], [1, 1], [1, 2]] }  // L
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function rotate(cells, n) {
  return cells.map(([r, c]) => [c, n - 1 - r]);
}

function mount(container, state, onComplete, sceneAssets, tracked, mode) {
  const friction = createFrictionAccumulator();
  const dwell = createDwellTimer();
  dwell.start();

  let resolved = false;
  const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
  let piece = null;      // { cells, n, row, col }
  let slipsLeft = SLIPS_PER_RUN;

  const stage = el('div', `mg01-stack mg01-stack-${mode === 'H' ? 'h' : 'c'}`);
  const tray = el('div', 'mg01-tray');
  const counter = el('div', 'mg01-counter');
  const controls = el('div', 'mg01-controls');
  stage.append(counter, tray, controls);
  container.appendChild(stage);

  const cellNodes = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = el('div', 'mg01-cell');
      tray.appendChild(cell);
      cellNodes.push(cell);
    }
  }
  tray.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;

  function draw() {
    const live = new Set();
    if (piece) {
      for (const [r, c] of piece.cells) {
        const rr = piece.row + r;
        const cc = piece.col + c;
        if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) live.add(rr * COLS + cc);
      }
    }
    for (let i = 0; i < cellNodes.length; i++) {
      const filled = grid[Math.floor(i / COLS)][i % COLS];
      cellNodes[i].className = `mg01-cell${filled ? ' mg01-cell-filled' : ''}${live.has(i) ? ' mg01-cell-live' : ''}`;
    }
    counter.textContent = `SLIPS REMAINING: ${slipsLeft}`;
  }

  function collides(cells, row, col) {
    for (const [r, c] of cells) {
      const rr = row + r;
      const cc = col + c;
      if (cc < 0 || cc >= COLS || rr >= ROWS) return true;
      if (rr >= 0 && grid[rr][cc]) return true;
    }
    return false;
  }

  // A hole is an empty cell with anything stacked above it in that column:
  // a slip filed where nothing can reach it.
  function countHoles() {
    let holes = 0;
    for (let c = 0; c < COLS; c++) {
      let covered = false;
      for (let r = 0; r < ROWS; r++) {
        if (grid[r][c]) covered = true;
        else if (covered) holes++;
      }
    }
    return holes;
  }

  function finish() {
    if (resolved) return;
    resolved = true;
    dwell.stop();
    friction.set(countHoles() * HOLE_FRICTION + (dwell.elapsedSeconds() > LONG_DWELL_SECONDS ? LONG_DWELL_BONUS : 0));
    onComplete({ friction: friction.value(), dwell: dwell.elapsedSeconds(), flags: [] });
  }

  function clearFullRows() {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every(Boolean)) {
        grid.splice(r, 1);
        grid.unshift(new Array(COLS).fill(false));
        r++; // re-check this row index, it holds new contents now
      }
    }
  }

  function spawn() {
    if (slipsLeft <= 0) {
      finish();
      return;
    }
    slipsLeft--;
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const col = Math.floor((COLS - shape.n) / 2);
    if (collides(shape.cells, 0, col)) {
      // Tray full. Not a loss -- the beat simply ends (Doc 3 §4 rule 1).
      piece = null;
      draw();
      finish();
      return;
    }
    piece = { cells: shape.cells, n: shape.n, row: 0, col };
    draw();
  }

  function lock() {
    for (const [r, c] of piece.cells) {
      const rr = piece.row + r;
      const cc = piece.col + c;
      if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) grid[rr][cc] = true;
    }
    piece = null;
    clearFullRows();
    draw();
    spawn();
  }

  function step() {
    if (resolved || !piece) return;
    if (collides(piece.cells, piece.row + 1, piece.col)) lock();
    else {
      piece.row++;
      draw();
    }
  }

  function move(dx) {
    if (resolved || !piece) return;
    if (!collides(piece.cells, piece.row, piece.col + dx)) {
      piece.col += dx;
      draw();
    }
  }

  function turn() {
    if (resolved || !piece) return;
    const rotated = rotate(piece.cells, piece.n);
    // One nudge each way, so a rotation against the tray wall still lands.
    for (const dx of [0, -1, 1]) {
      if (!collides(rotated, piece.row, piece.col + dx)) {
        piece.cells = rotated;
        piece.col += dx;
        draw();
        return;
      }
    }
  }

  function drop() {
    if (resolved || !piece) return;
    while (!collides(piece.cells, piece.row + 1, piece.col)) piece.row++;
    lock();
  }

  const buttons = [
    ['LEFT', () => move(-1)],
    ['TURN', turn],
    ['RIGHT', () => move(1)],
    ['DROP', drop]
  ];
  for (const [label, fn] of buttons) {
    const btn = el('button', 'mg01-stack-btn', label);
    tracked.on(btn, 'click', fn);
    controls.appendChild(btn);
  }

  tracked.on(window, 'keydown', (e) => {
    const handled = { ArrowLeft: () => move(-1), ArrowRight: () => move(1), ArrowUp: turn, ArrowDown: step, ' ': drop };
    const fn = handled[e.key];
    if (!fn) return;
    e.preventDefault();
    fn();
  });

  // Reduced motion: no automatic fall. Every slip is placed with DROP, and
  // the stack it produces is scored identically.
  if (!prefersReducedMotion()) {
    tracked.setInterval(step, GRAVITY_MS);
  }

  hardTimeout(tracked, HARD_TIMEOUT_S, finish);

  spawn();

  return {
    dispose() {
      resolved = true; // stop any in-flight timer callback from resolving late
    }
  };
}

export default function createMg01(mode) {
  let tracked = null;
  let disposeFn = null;

  return defineMinigame({
    id: 'MG-01',
    mode: mode === 'H' ? 'H' : 'C',
    reducedMotion: true,
    mount(container, state, onComplete, sceneAssets, services) {
      tracked = createTrackedListeners();
      const result = mount(container, state, onComplete, sceneAssets, tracked, mode);
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
