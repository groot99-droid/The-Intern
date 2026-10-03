// Threshold labels: the choice's words, standing in the room over the
// place you walk to. They fade in on approach and stamp when the zone is
// stepped into. Company typeface; company text never says "you" (C4 --
// test/cases/canon.text.js scans every label in scenes.json).

export function createLabels(container, stage) {
  const items = new Map(); // id -> { el, world, opacity }

  function ensure(id, text) {
    let it = items.get(id);
    if (!it) {
      const el = document.createElement('div');
      el.className = 'threshold-label';
      const rule = document.createElement('span');
      rule.className = 'threshold-label-rule';
      const words = document.createElement('span');
      words.className = 'threshold-label-text';
      el.append(words, rule);
      container.appendChild(el);
      it = { el, words, world: [0, 0, 0], opacity: 0, target: 0 };
      items.set(id, it);
    }
    if (it.words.textContent !== text) it.words.textContent = text;
    return it;
  }

  return {
    // set(id, text, worldPoint, opacity 0..1)
    set(id, text, world, opacity) {
      const it = ensure(id, text);
      it.world = world;
      it.target = opacity;
    },
    stamp(id) {
      const it = items.get(id);
      if (!it) return;
      it.el.classList.add('stamped');
      it.target = 0;
      setTimeout(() => this.remove(id), 1400);
    },
    remove(id) {
      const it = items.get(id);
      if (!it) return;
      it.el.remove();
      items.delete(id);
    },
    clear() { for (const id of [...items.keys()]) this.remove(id); },
    // per frame: follow the camera
    update(dt) {
      for (const it of items.values()) {
        it.opacity += (it.target - it.opacity) * Math.min(1, dt * 6);
        const p = stage.project(it.world);
        const off = p.behind || p.x < -0.1 || p.x > 1.1 || p.y < -0.1 || p.y > 1.1;
        it.el.style.opacity = off ? 0 : it.opacity.toFixed(3);
        if (!off) it.el.style.transform = `translate(${(p.x * 100).toFixed(2)}vw, ${(p.y * 100).toFixed(2)}vh) translate(-50%, -100%)`;
      }
    },
    _debug() { return [...items.entries()].map(([id, it]) => ({ id, text: it.words.textContent, opacity: +it.opacity.toFixed(2) })); }
  };
}
