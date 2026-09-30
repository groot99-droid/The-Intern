// Choice UI: renders the two branch-invariant buttons for a scene's choice
// (Doc 1 §4 spine table) and records dwell timing (Doc 1 §2.1 dwell[]).
// Diegetic styling (Doc 4 §14 "every interactive element is an object in the
// world") lands in Phase 6; Phase 1 uses plain <button> elements so the state
// machine can be exercised end to end.

export function createChoiceUI(container) {
  let wrap = null;

  return {
    // choiceSpec: { succumb: {label, next, setFlag?}, resist: {label, next, setFlag?} }
    // Resolves with 'succumb' | 'resist'.
    present(choiceSpec) {
      return new Promise((resolve) => {
        wrap = document.createElement('div');
        wrap.className = 'choice-ui';
        for (const key of ['succumb', 'resist']) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'choice-btn';
          btn.textContent = choiceSpec[key].label;
          btn.addEventListener('click', () => {
            this.clear();
            resolve(key);
          }, { once: true });
          wrap.appendChild(btn);
        }
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
