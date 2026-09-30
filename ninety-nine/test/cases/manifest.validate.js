// Doc 4 §4.2's validator, adapted to run in-browser (no Node fs -- "file
// exists" becomes "fetch(url, {method:'HEAD'}) returns 200", which Python's
// http.server supports natively) plus a 7th assertion for the
// `endingTransitions` schema extension (see the plan's scenes.json §3.2).
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

  await runCase('Assertion 2: every referenced asset filename exists in /assets', async () => {
    const missing = [];
    const checks = [];
    for (const scene of Object.values(manifest.scenes)) {
      for (const branch of Object.values(scene.branches)) {
        for (const entry of branch.sequence) {
          const kind = entry.type === 'still' ? 'img' : 'vid';
          checks.push([entry.file, `../../assets/${kind}/${entry.file}`]);
        }
        if (branch.imgIn) checks.push([branch.imgIn, `../../assets/img/${branch.imgIn}`]);
        if (branch.imgOut) checks.push([branch.imgOut, `../../assets/img/${branch.imgOut}`]);
        if (branch.ambience) checks.push([branch.ambience, `../../assets/aud/${branch.ambience}`]);
        if (branch.ambienceSequence) {
          for (const f of branch.ambienceSequence) checks.push([f, `../../assets/aud/${f}`]);
        }
        if (branch.sfxOneShot) checks.push([branch.sfxOneShot, `../../assets/aud/${branch.sfxOneShot}`]);
        if (branch.npcSprite) {
          checks.push([branch.npcSprite.far.file, `../../assets/img/${branch.npcSprite.far.file}`]);
          checks.push([branch.npcSprite.near.file, `../../assets/img/${branch.npcSprite.near.file}`]);
        }
        if (branch.transitions) {
          for (const f of Object.values(branch.transitions)) checks.push([f, `../../assets/vid/${f}`]);
        }
        // A transitionsSwap entry must never be added ahead of its clip:
        // router.js's fallback only covers an absent key, not a missing file.
        if (branch.transitionsSwap) {
          for (const f of Object.values(branch.transitionsSwap)) checks.push([f, `../../assets/vid/${f}`]);
        }
        if (branch.endingTransitions) {
          for (const f of Object.values(branch.endingTransitions)) checks.push([f, `../../assets/vid/${f}`]);
        }
      }
    }
    for (const [endingId, ending] of Object.entries(endings)) {
      if (endingId.startsWith('_')) continue; // skip _comment
      // RETAINED has no video/imgIn -- only one still was ever generated for
      // it (data/endings.json's _note), so it renders as a static hold on
      // imgOut alone. video/imgIn are optional per ending; imgOut is not.
      if (ending.video) checks.push([ending.video, `../../assets/vid/${ending.video}`]);
      if (ending.imgIn) checks.push([ending.imgIn, `../../assets/img/${ending.imgIn}`]);
      checks.push([ending.imgOut, `../../assets/img/${ending.imgOut}`]);
    }
    const results = await Promise.all(checks.map(async ([name, url]) => [name, await headOk(url)]));
    for (const [name, ok] of results) {
      if (!ok) missing.push(name);
    }
    assert(missing.length === 0, `missing assets: ${missing.join(', ')}`);
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

  await runCase('Assertion 7 (extension): every ending reachable from a branch has a matching endingTransitions key', () => {
    // C branches can resolve ASSIMILATION, PENDING, or RETAINED; H branches
    // can resolve EXPULSION or PENDING (Doc 1 §2.4; RETAINED added post-launch).
    const s8 = manifest.scenes.S8;
    assert('ASSIMILATION' in s8.branches.C.endingTransitions, 'S8.C missing ASSIMILATION endingTransitions');
    assert('PENDING' in s8.branches.C.endingTransitions, 'S8.C missing PENDING endingTransitions');
    assert('RETAINED' in s8.branches.C.endingTransitions, 'S8.C missing RETAINED endingTransitions');
    assert('EXPULSION' in s8.branches.H.endingTransitions, 'S8.H missing EXPULSION endingTransitions');
    assert('PENDING' in s8.branches.H.endingTransitions, 'S8.H missing PENDING endingTransitions');
  });

  await runCase('Assertion 9 (extension): every transitionsSwap entry shadows a transitions key and follows S{n}_{R}_TRN_{target}_{dest}.mp4', () => {
    // The swap clip lands in the opposite room: C->H, H->C, and S0's X->H
    // (X's plain clip already lands in C).
    const opposite = { C: 'H', H: 'C', X: 'H' };
    for (const [sceneId, scene] of Object.entries(manifest.scenes)) {
      for (const [letter, branch] of Object.entries(scene.branches)) {
        if (!branch.transitionsSwap) continue;
        for (const [target, file] of Object.entries(branch.transitionsSwap)) {
          assert(branch.transitions && target in branch.transitions, `${sceneId}.${letter}: transitionsSwap.${target} has no plain transitions.${target} to fall back to`);
          const expected = `${sceneId}_${letter}_TRN_${target}_${opposite[letter]}.mp4`;
          assertEqual(file, expected, `${sceneId}.${letter}.transitionsSwap.${target}`);
        }
      }
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
