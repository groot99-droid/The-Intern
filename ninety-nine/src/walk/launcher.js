// Thin, always-loaded front for the 3D walk mode. router.js talks only to
// this; the real thing (walk.js + three.js, ~1.3 MB) is imported on the
// first WALK THE ROOM click so the 2-second cold start (Doc 4 §8.2) is
// untouched for players who never press it.

export function createWalkLauncher({ mount, rooms, audio = null, sfx = null, renderer = null }) {
  let modPromise = null;
  let instance = null;
  let active = false;

  function load() {
    if (!modPromise) modPromise = import('./walk.js');
    return modPromise;
  }

  // Room lookup: "S4_C" etc. Entries may alias another room ({ alias: "S1_C" }).
  function roomFor(sceneId, branchLetter) {
    if (!rooms || !rooms.rooms) return null;
    const key = `${sceneId}_${branchLetter}`;
    const rec = rooms.rooms[key];
    if (!rec) return null;
    if (rec.alias && !rooms.rooms[rec.alias]) return null;
    return key;
  }

  function resolve(key) {
    const rec = rooms.rooms[key];
    if (rec.alias) return { ...rooms.rooms[rec.alias], ...rec, id: key };
    return { ...rec, id: key };
  }

  return {
    roomFor,
    isActive: () => active,
    // Warm the module while a scene plays (fire-and-forget).
    prefetch() { if (rooms) load().catch(() => {}); },

    async enter(key, { state } = {}) {
      if (!rooms || active) return;
      const rec = resolve(key);
      active = true;
      document.body.classList.add('walking');
      if (renderer) renderer.pause();
      try {
        const mod = await load();
        if (!instance) instance = mod.createWalk(mount.walk, { audio, sfx });
        await instance.enter(rec, { state });
      } catch (e) {
        console.warn('walk: could not enter room', key, e);
      } finally {
        active = false;
        document.body.classList.remove('walking');
        if (renderer) renderer.resume();
      }
    },

    abort() {
      if (instance) instance.abort();
    }
  };
}
