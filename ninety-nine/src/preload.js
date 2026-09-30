// Doc 4 §8.1: "While scene N plays, prefetch both branches of scene N+1,
// plus both transitions into it." Fire-and-forget: router.js does not await
// this, it just warms the browser HTTP cache so canplaythrough resolves
// fast when the real crossfade starts.

export function createPreloader(manifest, endings, { base = './assets' } = {}) {
  const fetched = new Set();

  function fetchAsset(kind, file) {
    if (!file || fetched.has(file)) return Promise.resolve();
    fetched.add(file);
    return fetch(`${base}/${kind}/${file}`).catch(() => {});
  }

  function branchAssetTasks(branch) {
    const tasks = [];
    for (const entry of branch.sequence) {
      tasks.push(fetchAsset(entry.type === 'still' ? 'img' : 'vid', entry.file));
    }
    if (branch.ambience) tasks.push(fetchAsset('aud', branch.ambience));
    if (branch.ambienceSequence) {
      for (const f of branch.ambienceSequence) tasks.push(fetchAsset('aud', f));
    }
    return tasks;
  }

  function branchTransitionTasks(branch) {
    const tasks = [];
    if (branch.transitions) {
      for (const file of Object.values(branch.transitions)) tasks.push(fetchAsset('vid', file));
    }
    // Swap clips (router.js pickTransition) -- only present once they exist.
    if (branch.transitionsSwap) {
      for (const file of Object.values(branch.transitionsSwap)) tasks.push(fetchAsset('vid', file));
    }
    if (branch.endingTransitions) {
      for (const file of Object.values(branch.endingTransitions)) tasks.push(fetchAsset('vid', file));
    }
    return tasks;
  }

  async function prefetchNext(currentSceneId, nextSceneId) {
    const tasks = [];
    const current = manifest.scenes[currentSceneId];
    if (current) {
      for (const branch of Object.values(current.branches)) tasks.push(...branchTransitionTasks(branch));
    }
    const next = manifest.scenes[nextSceneId];
    if (next) {
      for (const branch of Object.values(next.branches)) tasks.push(...branchAssetTasks(branch));
    }
    // S8 doesn't know which ending resolves yet -- prefetch all three.
    if (currentSceneId === 'S8' && endings) {
      for (const ending of Object.values(endings)) {
        tasks.push(fetchAsset('vid', ending.video));
      }
    }
    return Promise.all(tasks);
  }

  return { prefetchNext };
}
