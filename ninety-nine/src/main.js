// Doc 4 §2: boot, preflight, kick off S0.

import { createState, DEBUG_RESUME } from './state.js';
import { createRouter } from './router.js';
import { loadTextLibrary, endingFor } from './text.js';
import { createAudio } from './audio.js';
import { createSfx } from './sfx.js';
import { initBail } from './bail.js';
import { initSoundToggle } from './soundToggle.js';

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`main.js: failed to load ${path} (${res.status})`);
  return res.json();
}

function renderEndingCard(endingId, state, library) {
  const card = endingFor(library, endingId);
  const root = document.getElementById('ending-card');
  root.innerHTML = '';
  root.hidden = false;

  const title = document.createElement('p');
  title.className = 'ending-title';
  title.textContent = card.title;

  const body = document.createElement('p');
  body.className = 'ending-body';
  body.textContent = card.body;

  root.append(title, body);

  // Doc 1 §2.5: SAW_HARLOWE "gains one extra line" on ending cards. Doc 1
  // says the line exists but never says what it is; text/endings.json's
  // _harloweNote records what was written and the constraints it had to
  // meet. It sits between the body and the signoff so the company's card
  // still gets the last word -- and it must never contain "you", which
  // belongs to the signoff alone (C4, asserted by canon.text.js).
  // Still guarded on a truthy line: a card with none simply omits it.
  const harloweLine = card.harloweExtraLine;
  if (state.flags.has('SAW_HARLOWE') && harloweLine) {
    const extra = document.createElement('p');
    extra.className = 'ending-harlowe-line';
    extra.textContent = harloweLine;
    root.appendChild(extra);
  }

  const signoff = document.createElement('p');
  signoff.className = 'ending-signoff';
  signoff.textContent = card.signoff;
  root.appendChild(signoff);
}

async function boot() {
  if (DEBUG_RESUME) {
    // Doc 4 §3.7: must never be true in a deployed build. No CI enforces
    // this in the no-Node environment -- fail loud at boot instead.
    throw new Error('DEBUG_RESUME must be false in any build.');
  }

  const [manifest, endings, library] = await Promise.all([
    loadJSON('./data/scenes.json'),
    loadJSON('./data/endings.json'),
    loadTextLibrary('./text')
  ]);

  const state = createState();
  const audio = createAudio();
  const sfx = createSfx(audio);

  const mount = {
    scene: document.getElementById('scene-layer'),
    choice: document.getElementById('choice-layer'),
    minigame: document.getElementById('minigame-layer')
  };

  const router = createRouter({
    manifest,
    endings,
    state,
    mount,
    audio,
    sfx,
    onEnding(endingId) {
      renderEndingCard(endingId, state, library);
    }
  });

  window.__NINETY_NINE__ = { state, router, manifest, endings, library, audio }; // dev inspection only

  initBail(router);
  initSoundToggle(audio);
  router.start('S0');
}

boot().catch((err) => {
  console.error(err);
  const root = document.getElementById('boot-error');
  root.hidden = false;
  root.textContent = `Boot failed: ${err.message}`;
});
