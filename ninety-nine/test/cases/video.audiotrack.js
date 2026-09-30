// Doc 4 §11.3: "Every video file contains no audio track" -- audio is
// engine-side only (Doc 4 §7), stripped from every source file per §8.3.
// Uses HTMLMediaElement.audioTracks (Chrome-only, unprefixed nowhere else);
// if unsupported in the browser running the harness, each file is marked
// "manual verification needed" rather than failed, per the plan.

import { runCase, assert } from '../harness.js';

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`failed to load ${path} (${res.status})`);
  return res.json();
}

function checkNoAudioTrack(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.src = `../../assets/vid/${file}`;
    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };
    video.addEventListener('loadedmetadata', () => {
      if (!('audioTracks' in video)) {
        cleanup();
        resolve({ file, status: 'unsupported' });
        return;
      }
      const hasAudio = video.audioTracks.length > 0;
      cleanup();
      resolve({ file, status: hasAudio ? 'has-audio' : 'clean' });
    }, { once: true });
    video.addEventListener('error', () => {
      cleanup();
      resolve({ file, status: 'load-error' });
    }, { once: true });
  });
}

export async function run() {
  await runCase('Every unique video file referenced by scenes.json/endings.json has no audio track', async () => {
    const manifest = await loadJSON('../../data/scenes.json');
    const endings = await loadJSON('../../data/endings.json');
    const files = new Set();
    for (const scene of Object.values(manifest.scenes)) {
      for (const branch of Object.values(scene.branches)) {
        for (const entry of branch.sequence) {
          if (entry.type === 'video') files.add(entry.file);
        }
        if (branch.transitions) for (const f of Object.values(branch.transitions)) files.add(f);
        if (branch.endingTransitions) for (const f of Object.values(branch.endingTransitions)) files.add(f);
      }
    }
    for (const [endingId, ending] of Object.entries(endings)) {
      if (endingId.startsWith('_')) continue; // skip _comment
      if (ending.video) files.add(ending.video); // RETAINED has no video (still-only ending)
    }

    const results = await Promise.all([...files].map(checkNoAudioTrack));
    const withAudio = results.filter((r) => r.status === 'has-audio');
    const loadErrors = results.filter((r) => r.status === 'load-error');
    const unsupported = results.filter((r) => r.status === 'unsupported');

    if (unsupported.length > 0) {
      console.warn(`video.audiotrack.js: audioTracks API unsupported in this browser -- ${unsupported.length} files need manual verification (e.g. via ffprobe)`, unsupported.map((r) => r.file));
    }
    assert(loadErrors.length === 0, `failed to load metadata for: ${loadErrors.map((r) => r.file).join(', ')}`);
    assert(withAudio.length === 0, `these files have an audio track and must be re-exported per Doc 4 §8.3: ${withAudio.map((r) => r.file).join(', ')}`);
  });
}
