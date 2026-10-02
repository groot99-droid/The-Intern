// WALK THE ROOM: the third, unscored affordance at every choice. The stage
// already has the room up (it is the scene), so walking is the stage's own
// free-walk mode over the same set and camera -- no second renderer, no
// second copy of the room. router.js talks only to this.

export function createWalkLauncher({ mount, rooms, stage }) {
  let active = false;

  // Room lookup for a scene entry's room key; aliases must resolve.
  function roomFor(key) {
    if (!rooms || !rooms.rooms || !key) return null;
    const rec = rooms.rooms[key];
    if (!rec) return null;
    if (rec.alias && !rooms.rooms[rec.alias]) return null;
    return key;
  }

  return {
    roomFor,
    isActive: () => active,

    async enter(key, { state } = {}) {
      if (!rooms || active) return;
      active = true;
      document.body.classList.add('walking');
      try {
        await stage.walk(key, { overlay: mount.walk });
      } catch (e) {
        console.warn('walk: could not enter room', key, e);
      } finally {
        active = false;
        document.body.classList.remove('walking');
      }
    },

    abort() {
      stage.abortWalk();
    }
  };
}
