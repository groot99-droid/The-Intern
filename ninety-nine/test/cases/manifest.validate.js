// Doc 4 §4.2's validator, adapted to run in-browser (no Node fs -- "file
// exists" becomes "fetch(url, {method:'HEAD'}) returns 200", which Python's
// http.server supports natively). In the 3D-only build the "assets" a
// scene references are sets and shots in data/rooms.json plus audio beds;
// a video-era key anywhere in scenes.json or endings.json is a failure.
//
// NOTE: assertion 3 (every minigame module exists) is expected to FAIL
// until Phase 5 lands all 7 mini-game files -- that's honest signal, not a
// bug in this test. Re-run after Phase 5 to confirm it goes green.

import { runCase, assert, assertEqual } from '../harness.js';
import { REAL_SFX_FILES } from '../../src/sfx.js';

async function headOk(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`failed to load ${path} (${res.status})`);
  return res.json();
}

export async function run() {
  const manifest = await loadJSON('../../data/scenes.json');
  const endings = await loadJSON('../../data/endings.json');
  const textFiles = await Promise.all([
    loadJSON('../../text/system.json'),
    loadJSON('../../text/form.json'),
    loadJSON('../../text/manifest.json'),
    loadJSON('../../text/endings.json')
  ]);
  const [systemText, formText, manifestText, endingsText] = textFiles;

  await runCase('Assertion 1: every "next" within a scene is identical across all choice entries', () => {
    for (const [sceneId, scene] of Object.entries(manifest.scenes)) {
      const nextValues = new Set();
      for (const branch of Object.values(scene.branches)) {
        if (branch.choice) {
          nextValues.add(branch.choice.succumb.next);
          nextValues.add(branch.choice.resist.next);
        } else if (branch.next) {
          nextValues.add(branch.next);
        }
      }
      assert(nextValues.size === 1, `${sceneId}: expected one unique "next" value, got ${[...nextValues].join(', ')}`);
    }
  });

  await runCase('Assertion 2: every sequence entry names a room and a shot in /data/rooms.json, and every audio file exists', async () => {
    const rooms = await loadJSON('../../data/rooms.json');
    const resolve = (k) => { const r = rooms.rooms[k]; return r && r.alias ? { ...rooms.rooms[r.alias], ...r } : r; };
    const missing = [];
    const checks = [];
    for (const [sceneId, scene] of Object.entries(manifest.scenes)) {
      for (const [letter, branch] of Object.entries(scene.branches)) {
        assert(branch.room && rooms.rooms[branch.room], `${sceneId}.${letter}: branch room ${branch.room} not in rooms.json`);
        for (const entry of branch.sequence) {
          const key = entry.room || branch.room;
          const rec = resolve(key);
          if (!rec) { missing.push(`${sceneId}.${letter}: room ${key}`); continue; }
          const shot = entry.shot || 'loop';
          if (!rec.shots || !rec.shots[shot]) missing.push(`${sceneId}.${letter}: ${key}.shots.${shot}`);
          assert(entry.type === undefined && entry.file === undefined, `${sceneId}.${letter}: video-era entry (${entry.file})`);
        }
        if (branch.ambience) checks.push([branch.ambience, `../../assets/aud/${branch.ambience}`]);
        if (branch.ambienceSequence) for (const f of branch.ambienceSequence) checks.push([f, `../../assets/aud/${f}`]);
        if (branch.ambienceSecondary) checks.push([branch.ambienceSecondary.file, `../../assets/aud/${branch.ambienceSecondary.file}`]);
        if (branch.sfxOneShot) checks.push([branch.sfxOneShot, `../../assets/aud/${branch.sfxOneShot}`]);
        for (const dead of ['imgIn', 'imgOut', 'transitions', 'transitionsSwap', 'transitionsSplit', 'endingTransitions', 'npcSprite']) {
          if (dead === 'transitions') continue; // a {leave, arrive} shot-name override is allowed
          assert(branch[dead] === undefined, `${sceneId}.${letter}: video-era key ${dead}`);
        }
      }
    }
    for (const [endingId, ending] of Object.entries(endings)) {
      if (endingId.startsWith('_')) continue;
      const rec = resolve(ending.room);
      if (!rec) { missing.push(`${endingId}: room ${ending.room}`); continue; }
      if (!rec.shots || !rec.shots[ending.shot]) missing.push(`${endingId}: ${ending.room}.shots.${ending.shot}`);
      assert(ending.video === undefined && ending.imgOut === undefined, `${endingId}: video-era keys`);
    }
    const results = await Promise.all(checks.map(async ([name, url]) => [name, await headOk(url)]));
    for (const [name, ok] of results) if (!ok) missing.push(name);
    assert(missing.length === 0, `missing: ${missing.join(', ')}`);
  });

  await runCase('Assertion 3: every referenced minigame module exists in /src/minigames (expected red until Phase 5)', async () => {
    const modules = new Set();
    for (const scene of Object.values(manifest.scenes)) {
      for (const branch of Object.values(scene.branches)) {
        if (branch.minigame) modules.add(branch.minigame.module);
      }
    }
    const missing = [];
    for (const mod of modules) {
      const ok = await headOk(`../../src/minigames/${mod}.js`);
      if (!ok) missing.push(mod);
    }
    assert(missing.length === 0, `missing minigame modules: ${missing.join(', ')}`);
  });

  await runCase('Assertion 4: every scene has exactly one C and one H branch, except S0', () => {
    for (const [sceneId, scene] of Object.entries(manifest.scenes)) {
      const keys = Object.keys(scene.branches).sort();
      if (sceneId === 'S0') {
        assert(keys.length === 1 && keys[0] === 'X', `S0: expected only branch "X", got ${keys.join(',')}`);
      } else {
        assertEqual(keys.join(','), 'C,H', `${sceneId}: expected branches C and H`);
      }
    }
  });

  await runCase('Assertion 5: every scene reachable from S0 terminates at the ending resolver', () => {
    let current = 'S0';
    const visited = new Set();
    let steps = 0;
    while (current !== 'E') {
      assert(!visited.has(current), `cycle detected at ${current}`);
      visited.add(current);
      const scene = manifest.scenes[current];
      assert(scene, `scene ${current} not found in manifest`);
      const branch = Object.values(scene.branches)[0];
      current = branch.choice ? branch.choice.succumb.next : branch.next;
      steps++;
      assert(steps <= 20, 'exceeded max spine length without reaching E');
    }
    assertEqual(visited.size, 9, 'expected exactly 9 scenes (S0-S8) before reaching E');
  });

  await runCase('Assertion 6: every ending textKey exists in /text/endings.json', () => {
    for (const [endingId, ending] of Object.entries(endings)) {
      if (endingId.startsWith('_')) continue; // skip _comment
      assert(ending.textKey in endingsText, `${endingId}: textKey "${ending.textKey}" not found in endings.json`);
    }
  });

  await runCase('Assertion 7 (extension): every ending resolveEnding() can return has a set and a shot', () => {
    for (const id of ['ASSIMILATION', 'PENDING', 'RETAINED', 'EXPULSION']) {
      assert(endings[id] && endings[id].room && endings[id].shot, `${id}: no room/shot`);
      assert(Number.isFinite(endings[id].holdSeconds) && endings[id].holdSeconds >= 0, `${id}: holdSeconds`);
    }
  });

  await runCase('Assertion 8 (extension): every real SFX file (sfx.js REAL_SFX_FILES) exists in /assets/aud', async () => {
    const missing = [];
    const results = await Promise.all(
      Object.entries(REAL_SFX_FILES).map(async ([cue, file]) => [cue, file, await headOk(`../../assets/aud/${file}`)])
    );
    for (const [cue, file, ok] of results) {
      if (!ok) missing.push(`${cue} -> ${file}`);
    }
    assert(missing.length === 0, `missing real SFX files: ${missing.join(', ')}`);
  });
}
