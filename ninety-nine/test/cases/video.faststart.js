// Every clip must carry its index (`moov`) ahead of its frames (`mdat`).
// Ten delivered transition clips did not: a <video> element had to open the
// file, find no index, abort and re-request the tail before it could show a
// frame -- and against a slow or range-less host that second request is
// where the clip died (a black frame after a choice, read as a failed
// connection). tools/faststart.py rewrites the container; this pins it.
//
// Reads only the first 64 KB of each file with a Range request (the dev
// server answers 206; a host that answers 200 with the whole body still
// works, just slower) and walks the top-level atoms in that window.

import { runCase, assert } from '../harness.js';

function topLevelAtoms(buf) {
  const view = new DataView(buf);
  const kinds = [];
  let pos = 0;
  while (pos + 8 <= buf.byteLength) {
    let size = view.getUint32(pos);
    const kind = String.fromCharCode(view.getUint8(pos + 4), view.getUint8(pos + 5), view.getUint8(pos + 6), view.getUint8(pos + 7));
    if (size === 1) {
      if (pos + 16 > buf.byteLength) break;
      size = Number(view.getBigUint64(pos + 8));
    } else if (size === 0) {
      kinds.push(kind);
      break;
    }
    kinds.push(kind);
    pos += size;
  }
  return kinds;
}

export async function run() {
  const [manifest, endings] = await Promise.all([
    fetch('../data/scenes.json').then((r) => r.json()),
    fetch('../data/endings.json').then((r) => r.json())
  ]);
  const files = new Set();
  for (const scene of Object.values(manifest.scenes)) {
    for (const branch of Object.values(scene.branches)) {
      for (const entry of branch.sequence || []) if (entry.type === 'video') files.add(entry.file);
      for (const f of Object.values(branch.transitions || {})) files.add(f);
      for (const f of Object.values(branch.transitionsSwap || {})) files.add(f);
      for (const f of Object.values(branch.endingTransitions || {})) files.add(f);
    }
  }
  for (const ending of Object.values(endings)) if (ending.video) files.add(ending.video);

  await runCase('video.faststart: every clip has moov ahead of mdat (index first, so a frame can show before the whole file lands)', async () => {
    const bad = [];
    for (const file of files) {
      const res = await fetch(`../assets/vid/${file}`, { headers: { Range: 'bytes=0-65535' } });
      assert(res.ok, `${file}: HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const kinds = topLevelAtoms(buf.byteLength > 65536 ? buf.slice(0, 65536) : buf);
      const moov = kinds.indexOf('moov'), mdat = kinds.indexOf('mdat');
      // moov must appear in the head window, and before mdat if mdat is in it too
      if (moov === -1 || (mdat !== -1 && mdat < moov)) bad.push(`${file} [${kinds.join(',')}]`);
    }
    assert(bad.length === 0, `moov not first in: ${bad.join('; ')}`);
  });
}
