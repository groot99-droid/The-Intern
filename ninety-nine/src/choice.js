// Choice UI: renders the two branch-invariant buttons for a scene's choice
// (Doc 1 §4 spine table) and records dwell timing (Doc 1 §2.1 dwell[]).
// Diegetic styling (Doc 4 §14 "every interactive element is an object in the
// world") lands in Phase 6; Phase 1 uses plain <button> elements so the state
// machine can be exercised end to end.
//
// Optional third affordance (`extra`): scenes with a walkable 3D room (see
// src/walk/) get a WALK THE ROOM button between the two real choices. It is
// not a choice -- it never resolves the promise, never touches conformance
// -- it just runs `extra.run()` with the buttons hidden and puts them back
// when the player returns.

export function createChoiceUI(container) {
  let wrap = null;

  return {
    // choiceSpec: { succumb: {label, next, setFlag?}, resist: {label, next, setFlag?} }
    // extra: { label, run: () => Promise } | null
    // Resolves with 'succumb' | 'resist'.
    present(choiceSpec, { extra = null } = {}) {
      return new Promise((resolve) => {
        wrap = document.createElement('div');
        wrap.className = 'choice-ui';
        const make = (key) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'choice-btn';
          btn.textContent = choiceSpec[key].label;
          btn.addEventListener('click', () => {
            this.clear();
            resolve(key);
          }, { once: true });
          return btn;
        };
        wrap.appendChild(make('succumb'));
        if (extra) {
          const walkBtn = document.createElement('button');
          walkBtn.type = 'button';
          walkBtn.className = 'choice-btn choice-btn-walk';
          walkBtn.textContent = extra.label;
          walkBtn.addEventListener('click', async () => {
            if (walkBtn.disabled) return;
            walkBtn.disabled = true;
            wrap.classList.add('choice-ui-hidden');
            try { await extra.run(); } catch (e) { console.warn('choice.js: extra affordance failed', e); }
            walkBtn.disabled = false;
            wrap.classList.remove('choice-ui-hidden');
          });
          wrap.appendChild(walkBtn);
        }
        wrap.appendChild(make('resist'));
        container.appendChild(wrap);
      });
    },

    // Single-button gesture (currently only S0's SUBMIT, Doc 1 §5 / Doc 4 §7.4).
    presentSingle(label) {
      return new Promise((resolve) => {
        wrap = document.createElement('div');
        wrap.className = 'choice-ui choice-ui-single';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choice-btn choice-btn-submit';
        btn.textContent = label;
        btn.addEventListener('click', () => {
          this.clear();
          resolve();
        }, { once: true });
        wrap.appendChild(btn);
        container.appendChild(wrap);
      });
    },

    clear() {
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      wrap = null;
    }
  };
}
