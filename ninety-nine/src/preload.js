// Doc 4 §8.1: "While scene N plays, prefetch both branches of scene N+1."
// There are no clips to fetch any more: a scene is a set the stage builds
// (geometry, procedural textures, the prop library), so prefetching means
// asking the stage to build both renders' rooms ahead of time, plus
// warming the browser cache for their ambience beds. Fire-and-forget:
// router.js never awaits this.

export function createPreloader(manifest, endings, { base = './assets', stage = null } = {}) {
  const fetched = new Set();

  function fetchAsset(kind, file) {
    if (!file || fetched.has(file)) return Promise.resolve();
    fetched.add(file);
    return fetch(`${base}/${kind}/${file}`).catch(() => {});
  }

  function roomsOf(branch) {
    const keys = new Set();
    for (const entry of branch.sequence) keys.add(entry.room || branch.room);
    return [...keys].filter(Boolean);
  }

  function branchTasks(branch) {
    const tasks = [];
    if (stage) for (const key of roomsOf(branch)) stage.prefetch(key);
    if (branch.ambience) tasks.push(fetchAsset('aud', branch.ambience));
    if (branch.ambienceSequence) for (const f of branch.ambienceSequence) tasks.push(fetchAsset('aud', f));
    if (branch.sfxOneShot) tasks.push(fetchAsset('aud', branch.sfxOneShot));
    return tasks;
  }

  async function prefetchNext(currentSceneId, nextSceneId) {
    const tasks = [];
    const next = manifest.scenes[nextSceneId];
    if (next) for (const branch of Object.values(next.branches)) tasks.push(...branchTasks(branch));
    // S8 doesn't know which ending resolves yet -- build all of them.
    if (currentSceneId === 'S8' && endings && stage) {
      for (const [id, ending] of Object.entries(endings)) {
        if (id.startsWith('_') || !ending.room) continue;
        stage.prefetch(ending.room);
      }
    }
    return Promise.all(tasks);
  }

  return { prefetchNext, roomsOf };
}
