// Doc 4 §4.2's validator, adapted to run in-browser (no Node fs -- "file
// exists" becomes "fetch(url, {method:'HEAD'}) returns 200"). In the
// walkable build the "assets" a scene references are rooms, zones, doors
// and connectors in data/rooms.json, props and shots the director's beats
// name, audio beds and one-shots, and text keys. A video-era or mini-game
// key anywhere in scenes.json or endings.json is a failure.

import { runCase, assert, assertEqual } from '../harness.js';
import { REAL_SFX_FILES, createSfx } from '../../src/sfx.js';
import { createState, commitChoice, renderFor, resolveEnding, seedRenderFromIntake } from '../../src/state.js';
import { zonesOf } from '../../src/spine.js';

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

const DEAD_KEYS = ['minigame', 'sequence', 'choice', 'preGesture', 'choiceAfterEntry', 'mount', 'video', 'imgIn', 'imgOut', 'transitions', 'transitionsSwap', 'transitionsSplit', 'endingTransitions', 'npcSprite', 'sfxOneShot', 'ambienceSecondary'];

function findKeys(obj, keys, path, hits) {
  if (Array.isArray(obj)) { obj.forEach((v, i) => findKeys(v, keys, `${path}[${i}]`, hits)); return; }
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_')) continue;
    if (keys.includes(k)) hits.push(`${path}.${k}`);
    findKeys(v, keys, `${path}.${k}`, hits);
  }
}

export async function run() {
  const [manifest, endings, rooms, systemText, endingsText] = await Promise.all([
    loadJSON('../../data/scenes.json'),
    loadJSON('../../data/endings.json'),
    loadJSON('../../data/rooms.json'),
    loadJSON('../../text/system.json'),
    loadJSON('../../text/endings.json')
  ]);
  const resolve = (k) => { const r = rooms.rooms[k]; return r && r.alias ? { ...rooms.rooms[r.alias], ...r } : r; };
  const baseOf = (k) => { const r = rooms.rooms[k]; return r && r.alias ? r.alias : k; };
  const zoneNames = (k) => new Set(((resolve(k) || {}).zones || []).map((z) => z.name));
  const doorNames = (k) => new Set(((resolve(k) || {}).doors || []).map((d) => d.name));
  const anchorNames = (k) => new Set(Object.keys((resolve(k) || {}).anchors || {}));
  const isDoorOrAnchor = (k, n) => doorNames(k).has(n) || anchorNames(k).has(n);
  const propNames = (k) => new Set(((resolve(k) || {}).props || []).filter((p) => p.name).map((p) => p.name));
  const isConnector = (k) => /^CN_[A-Z_]+$/.test(k || '') && !!(rooms.rooms[k] && rooms.rooms[k].connector);
  const branches = () => Object.entries(manifest.scenes).flatMap(([sid, sc]) => Object.entries(sc.branches).map(([letter, b]) => ({ sid, letter, b })));

  await runCase('Assertion 1: every scene has one `next` (per branch, the same across renders, none per threshold)', () => {
    for (const [sceneId, scene] of Object.entries(manifest.scenes)) {
      const nextValues = new Set();
      for (const branch of Object.values(scene.branches)) {
        nextValues.add(branch.next);
        for (const th of Object.values(branch.thresholds || {})) assert(th.next === undefined, `${sceneId}: a threshold names its own next`);
      }
      assert(nextValues.size === 1 && typeof [...nextValues][0] === 'string', `${sceneId}: expected one unique "next" value, got ${[...nextValues].join(', ')}`);
    }
  });

  await runCase('Assertion 1b: the schema -- branch, threshold, beat zone and beat keys are ones the director reads (a typo is a silent no-op in the game)', () => {
    const BRANCH = new Set(['room', 'next', 'ambience', 'ambienceSequence', 'music', 'captions', 'onEnter', 'thresholds', 'beatZones', 'sfxCue', 'friction', 'keepHeld', 'bumpCount', 'start', 'out', 'report']);
    const THRESHOLD = new Set(['label', 'zone', 'exit', 'via', 'to', 'setFlag', 'sfxCue', 'beat', 'approach', 'fallShot']);
    const BEAT_ZONE = new Set(['zone', 'label', 'beat', 'once']);
    // director.js runBeats(), in its order
    const BEAT = new Set(['sfxCue', 'oneShot', 'caption', 'holdMs', 'className', 'rattle', 'show', 'hide', 'light', 'screen', 'setFlag', 'hold', 'drop', 'actor', 'seal', 'open', 'close', 'seconds', 'await', 'lookAt', 'lookY', 'sit', 'moveTo', 'shot', 'ride', 'shake', 'waitMs']);
    const bad = [];
    const keysOf = (o) => Object.keys(o || {}).filter((k) => !k.startsWith('_'));
    const beats = (list, where) => {
      if (list === undefined) return;
      if (!Array.isArray(list)) { bad.push(`${where}: beats must be a list`); return; }
      list.forEach((bt, i) => { for (const k of keysOf(bt)) if (!BEAT.has(k)) bad.push(`${where}[${i}]: unknown beat key ${k}`); });
    };
    for (const { sid, letter, b } of branches()) {
      const where = `${sid}.${letter}`;
      for (const k of keysOf(b)) if (!BRANCH.has(k)) bad.push(`${where}: unknown branch key ${k}`);
      beats(b.onEnter, `${where}.onEnter`);
      for (const bz of b.beatZones || []) {
        for (const k of keysOf(bz)) if (!BEAT_ZONE.has(k)) bad.push(`${where}.beatZone: unknown key ${k}`);
        beats(bz.beat, `${where}.beatZone.${bz.zone}`);
      }
      for (const [key, th] of Object.entries(b.thresholds || {})) {
        const tw = `${where}.${key}`;
        if (!['succumb', 'resist'].includes(key)) bad.push(`${tw}: a threshold is succumb or resist`);
        for (const k of keysOf(th)) if (!THRESHOLD.has(k)) bad.push(`${tw}: unknown threshold key ${k}`);
        if (!(typeof th.label === 'string' && th.label.trim())) bad.push(`${tw}: no label`);
        if (!zonesOf(th).length) bad.push(`${tw}: no zone`);
        if (th.exit && !th.via && !th.to) bad.push(`${tw}: an exit without a via`);
        if (th.via && !th.exit) bad.push(`${tw}: a via without an exit`);
        beats(th.beat, `${tw}.beat`);
        beats(th.approach, `${tw}.approach`);
      }
    }
    assert(bad.length === 0, bad.join(' | '));
  });

  await runCase('Assertion 2: every branch room exists in rooms.json; every threshold zone exists in its room (aliases resolved; each zone of a list counts)', () => {
    const missing = [];
    for (const { sid, letter, b } of branches()) {
      if (!rooms.rooms[b.room]) { missing.push(`${sid}.${letter}: room ${b.room}`); continue; }
      const zones = zoneNames(b.room);
      for (const [key, th] of Object.entries(b.thresholds || {})) {
        const names = zonesOf(th);
        if (!names.length) missing.push(`${sid}.${letter}.${key}: no zone`);
        for (const z of names) if (!zones.has(z)) missing.push(`${sid}.${letter}.${key}: zone ${z} not in ${b.room} (${baseOf(b.room)})`);
      }
      for (const bz of b.beatZones || []) if (!zones.has(bz.zone)) missing.push(`${sid}.${letter} beatZone ${bz.zone} not in ${b.room}`);
    }
    const x = manifest.scenes.S0.branches.X;
    if (!zoneNames(x.room).has(x.start.zone)) missing.push(`S0 start zone ${x.start.zone} not in ${x.room}`);
    if (!zoneNames(x.out.to).has(x.report.zone)) missing.push(`S0 report zone ${x.report.zone} not in ${x.out.to}`);
    assert(missing.length === 0, missing.join(' | '));
  });

  await runCase('Assertion 2b: a threshold that leaves its room has an exit door/anchor and a CN_* connector (or falls, or names `to`)', () => {
    // Which rooms can actually lie behind each threshold: every path x both
    // S0 seeds, played the way the director plays them.
    const behind = new Map(); // "S2.C.resist" -> Set(room)
    for (const seed of ['C', 'H']) {
      for (let mask = 0; mask < 256; mask++) {
        const state = createState();
        seedRenderFromIntake(state, seed === 'H' ? 2 : 0);
        let prev = null;
        for (let i = 0; i < 8; i++) {
          const sid = manifest.spineOrder[i + 1];
          const letter = renderFor(state);
          const b = manifest.scenes[sid].branches[letter];
          if (prev) behind.get(prev).add(b.room);
          const key = mask & (1 << i) ? 'succumb' : 'resist';
          const th = b.thresholds[key];
          commitChoice(state, key === 'succumb' ? 1 : -1);
          if (th.setFlag) state.flags.add(th.setFlag);
          prev = `${sid}.${letter}.${key}`;
          if (!behind.has(prev)) behind.set(prev, new Set());
        }
        const th = manifest.scenes.S8.branches[prev.split('.')[1]].thresholds[prev.split('.')[2]];
        behind.get(prev).add(th.to || endings[resolveEnding(state)].room);
      }
    }
    const bad = [];
    let leaving = 0;
    for (const [id, set] of behind) {
      const [sid, letter, key] = id.split('.');
      const b = manifest.scenes[sid].branches[letter];
      const th = b.thresholds[key];
      const leaves = [...set].some((r) => baseOf(r) !== baseOf(b.room));
      if (!leaves) continue;
      leaving++;
      if (th.to) {
        if (!rooms.rooms[th.to]) bad.push(`${id}: to ${th.to} is no room`);
        continue;
      }
      if (!isDoorOrAnchor(b.room, th.exit)) bad.push(`${id}: exit ${th.exit} is no door/anchor of ${b.room}`);
      if (th.via === 'fall') {
        if (!anchorNames(b.room).has(th.exit)) bad.push(`${id}: a fall leaves through an anchor, ${th.exit} is not one`);
      } else if (!isConnector(th.via)) bad.push(`${id}: via ${th.via} is no CN_* connector`);
    }
    assert(leaving >= 10, `only ${leaving} leaving thresholds found`);
    // S0's two doorways and the endings' onward routes, too
    const x = manifest.scenes.S0.branches.X;
    if (!isDoorOrAnchor(x.room, x.out.exit) || !isConnector(x.out.via) || !rooms.rooms[x.out.to]) bad.push(`S0 out: ${x.out.exit} / ${x.out.via} / ${x.out.to}`);
    if (!isDoorOrAnchor(x.out.to, x.report.exit) || !isConnector(x.report.via)) bad.push(`S0 report: ${x.report.exit} / ${x.report.via}`);
    for (const [id, e] of Object.entries(endings)) {
      if (id.startsWith('_')) continue;
      for (const [from, route] of Object.entries(e.routes || {})) {
        if (!isDoorOrAnchor(from, route.exit) || !isConnector(route.via)) bad.push(`${id} route from ${from}: ${route.exit} / ${route.via}`);
      }
    }
    assert(bad.length === 0, bad.join(' | '));
  });

  await runCase('Assertion 2c: every door, prop, light, actor and shot a beat names exists in the room it plays in; every sfxCue is a known cue', () => {
    const cues = new Set([...createSfx(null).availableCues, ...Object.keys(REAL_SFX_FILES)]);
    const bad = [];
    const checkBeats = (where, room, beats) => {
      const rec = resolve(room);
      if (!rec) { bad.push(`${where}: no room ${room}`); return; }
      const props = propNames(room), doors = doorNames(room);
      const lights = new Set((rec.lights || []).map((l) => l.id).filter(Boolean));
      for (const bt of beats || []) {
        for (const c of [].concat(bt.sfxCue || [])) if (!cues.has(c)) bad.push(`${where}: unknown sfxCue ${c}`);
        for (const k of ['rattle', 'open', 'close']) if (bt[k] && !doors.has(bt[k])) bad.push(`${where}: ${k} ${bt[k]} is no door of ${room}`);
        for (const k of ['show', 'hide', 'lookAt']) if (bt[k] && !props.has(bt[k])) bad.push(`${where}: ${k} ${bt[k]} is no named prop of ${room}`);
        if (bt.screen && !props.has(bt.screen.prop)) bad.push(`${where}: screen ${bt.screen.prop} is no named prop of ${room}`);
        if (bt.light && !lights.has(bt.light.id)) bad.push(`${where}: light ${bt.light.id} not in ${room}`);
        if (bt.actor) { const n = typeof bt.actor === 'string' ? bt.actor : bt.actor.name; if (!(rec.actors || {})[n]) bad.push(`${where}: actor ${n} not in ${room}`); }
        if (bt.shot && !(rec.shots || {})[bt.shot]) bad.push(`${where}: shot ${bt.shot} not in ${room}`);
      }
    };
    for (const { sid, letter, b } of branches()) {
      for (const c of [].concat(b.sfxCue || [])) if (!cues.has(c)) bad.push(`${sid}.${letter}: unknown sfxCue ${c}`);
      if (b.bumpCount) {
        // pushes on a locked door, counted by the director's bump handler
        const bc = b.bumpCount;
        if (!doorNames(b.room).has(bc.door)) bad.push(`${sid}.${letter}: bumpCount door ${bc.door} is no door of ${b.room}`);
        if (!(Number.isInteger(bc.at) && bc.at > 0)) bad.push(`${sid}.${letter}: bumpCount.at must be a positive count`);
      }
      checkBeats(`${sid}.${letter}.onEnter`, b.room, b.onEnter);
      for (const bz of b.beatZones || []) checkBeats(`${sid}.${letter}.beatZone.${bz.zone}`, b.room, bz.beat);
      for (const [key, th] of Object.entries(b.thresholds || {})) {
        for (const c of [].concat(th.sfxCue || [])) if (!cues.has(c)) bad.push(`${sid}.${letter}.${key}: unknown sfxCue ${c}`);
        checkBeats(`${sid}.${letter}.${key}.beat`, b.room, th.beat);
        checkBeats(`${sid}.${letter}.${key}.approach`, b.room, th.approach);
        if (th.via === 'fall' && !(resolve(b.room).shots || {})[th.fallShot || 'fall']) bad.push(`${sid}.${letter}.${key}: no ${th.fallShot || 'fall'} shot`);
      }
    }
    // S0's carried shots, and the names the director hard-codes (fallInto,
    // chuteTo): the dive's sink/grate shots and grate anchor, the chute's
    // top/exit anchors, the store's land shot.
    const x = manifest.scenes.S0.branches.X;
    for (const s of [x.start.sit, x.start.lean, x.start.stand]) if (!resolve(x.room).shots[s]) bad.push(`S0: no shot ${s}`);
    if (!propNames(x.room).has('terminal') || !propNames(x.room).has('hands')) bad.push('S0: terminal/hands props');
    const dive = resolve('SET_DIVE');
    for (const s of ['sink', 'grate']) if (!dive.shots[s]) bad.push(`SET_DIVE: no ${s} shot`);
    if (!anchorNames('SET_DIVE').has('grate')) bad.push('SET_DIVE: no grate anchor');
    if (!dive.swim) bad.push('SET_DIVE: no swim bounds');
    if (!anchorNames('CN_CHUTE').has('top') || !doorNames('CN_CHUTE').has('exit')) bad.push('CN_CHUTE: top/exit');
    if (!resolve('S8_H').shots.land) bad.push('S8_H: no land shot');
    assert(bad.length === 0, bad.join(' | '));
  });

  await runCase('Assertion 2d: every audio file referenced (beds, the street bed, ending beds, oneShot beats) exists in /assets/aud', async () => {
    const files = new Map();
    const add = (f, where) => { if (f) files.set(f, where); };
    const beatFiles = (beats, where) => { for (const bt of beats || []) add(bt.oneShot, where); };
    for (const { sid, letter, b } of branches()) {
      const where = `${sid}.${letter}`;
      add(b.ambience, where);
      for (const f of b.ambienceSequence || []) add(f, where);
      if (b.out) add(b.out.ambience, `${where}.out`);
      beatFiles(b.onEnter, where);
      for (const bz of b.beatZones || []) beatFiles(bz.beat, where);
      for (const th of Object.values(b.thresholds || {})) { beatFiles(th.beat, where); beatFiles(th.approach, where); }
    }
    for (const [id, e] of Object.entries(endings)) if (!id.startsWith('_')) add(e.ambience, id);
    add('S8_H_AMB_STORE.wav', 'director.chuteTo');
    assert(files.size >= 15, `only ${files.size} audio files referenced`);
    const results = await Promise.all([...files].map(async ([f, where]) => [f, where, await headOk(`../../assets/aud/${f}`)]));
    const missing = results.filter((r) => !r[2]).map((r) => `${r[1]}: ${r[0]}`);
    assert(missing.length === 0, `missing: ${missing.join(', ')}`);
  });

  await runCase('Assertion 2e: every text key a caption or caption beat uses exists in /text/system.json', () => {
    const missing = [];
    const keys = [];
    const beatKeys = (beats, where) => { for (const bt of beats || []) if (bt.caption) keys.push([bt.caption, where]); };
    for (const { sid, letter, b } of branches()) {
      const where = `${sid}.${letter}`;
      for (const c of b.captions || []) if (c.textKey) keys.push([c.textKey, where]);
      if (b.bumpCount && b.bumpCount.caption) keys.push([b.bumpCount.caption, `${where}.bumpCount`]);
      beatKeys(b.onEnter, where);
      for (const bz of b.beatZones || []) beatKeys(bz.beat, where);
      for (const th of Object.values(b.thresholds || {})) { beatKeys(th.beat, where); beatKeys(th.approach, where); }
    }
    assert(keys.length >= 8, `only ${keys.length} caption keys found`);
    for (const [k, where] of keys) if (!(k in systemText)) missing.push(`${where}: ${k}`);
    // the director's screen pages read these (director.js PAGES)
    for (const k of ['posting.title', 'posting.employer', 'posting.body', 'portal.confirm', 'portal.accept', 'harlowe.session', 'harlowe.draft', 'requisition.title', 'requisition.harlowe']) if (!(k in systemText)) missing.push(`PAGES: ${k}`);
    assert(missing.length === 0, missing.join(', '));
  });

  await runCase('Assertion 3: no video-era or mini-game keys anywhere in scenes.json / endings.json; src/minigames/ is gone', async () => {
    const hits = [];
    findKeys(manifest, DEAD_KEYS, 'scenes', hits);
    findKeys(endings, DEAD_KEYS, 'endings', hits);
    assert(hits.length === 0, `dead keys: ${hits.join(', ')}`);
    const res = await fetch('../../src/minigames/_contract.js', { method: 'HEAD' });
    assertEqual(res.status, 404, 'src/minigames/_contract.js should be gone');
  });

  await runCase('Assertion 4: every scene has exactly one C and one H branch, except S0 (X only)', () => {
    for (const [sceneId, scene] of Object.entries(manifest.scenes)) {
      const keys = Object.keys(scene.branches).sort();
      if (sceneId === 'S0') {
        assert(keys.length === 1 && keys[0] === 'X', `S0: expected only branch "X", got ${keys.join(',')}`);
        assert(!scene.branches.X.thresholds, 'S0 is branchless: no thresholds');
      } else {
        assertEqual(keys.join(','), 'C,H', `${sceneId}: expected branches C and H`);
        for (const [l, b] of Object.entries(scene.branches)) assertEqual(Object.keys(b.thresholds || {}).sort().join(','), 'resist,succumb', `${sceneId}.${l}: thresholds`);
      }
    }
  });

  await runCase('Assertion 5: the spine reaches E in 9 scenes (S0-S8)', () => {
    let current = 'S0';
    const visited = new Set();
    let steps = 0;
    while (current !== 'E') {
      assert(!visited.has(current), `cycle detected at ${current}`);
      visited.add(current);
      const scene = manifest.scenes[current];
      assert(scene, `scene ${current} not found in manifest`);
      current = Object.values(scene.branches)[0].next;
      steps++;
      assert(steps <= 20, 'exceeded max spine length without reaching E');
    }
    assertEqual(visited.size, 9, 'expected exactly 9 scenes (S0-S8) before reaching E');
    assertEqual(manifest.spineOrder.join(','), [...visited].join(','), 'spineOrder is the walk');
  });

  await runCase('Assertion 6: every ending textKey exists in /text/endings.json', () => {
    for (const [endingId, ending] of Object.entries(endings)) {
      if (endingId.startsWith('_')) continue;
      assert(ending.textKey in endingsText, `${endingId}: textKey "${ending.textKey}" not found in endings.json`);
    }
  });

  await runCase('Assertion 7: every ending has room/zone/shot/holdSeconds; its zone, shot, preShot and named props exist in its room', () => {
    const bad = [];
    for (const id of ['ASSIMILATION', 'PENDING', 'RETAINED', 'EXPULSION']) {
      const e = endings[id];
      assert(e && e.room && e.zone && e.shot, `${id}: no room/zone/shot`);
      assert(Number.isFinite(e.holdSeconds) && e.holdSeconds >= 0, `${id}: holdSeconds`);
      const rec = resolve(e.room);
      if (!rec) { bad.push(`${id}: no room ${e.room}`); continue; }
      if (!zoneNames(e.room).has(e.zone)) bad.push(`${id}: zone ${e.zone} not in ${e.room}`);
      if (!rec.shots[e.shot]) bad.push(`${id}: shot ${e.shot} not in ${e.room}`);
      if (e.preShot && !rec.shots[e.preShot]) bad.push(`${id}: preShot ${e.preShot} not in ${e.room}`);
      for (const n of e.show || []) if (!propNames(e.room).has(n)) bad.push(`${id}: show ${n} not in ${e.room}`);
      for (const o of e.flagOverlays || []) for (const n of o.hide || []) if (!propNames(e.room).has(n)) bad.push(`${id}: overlay hides ${n}, not in ${e.room}`);
    }
    assert(bad.length === 0, bad.join(' | '));
  });

  await runCase('Assertion 8: every real SFX file (sfx.js REAL_SFX_FILES) exists in /assets/aud', async () => {
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
