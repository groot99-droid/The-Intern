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
import { ENV_BEAT_KEYS } from '../../src/world/env.js';

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
    const BRANCH = new Set(['room', 'next', 'ambience', 'ambienceSequence', 'music', 'captions', 'onEnter', 'thresholds', 'beatZones', 'sfxCue', 'friction', 'keepHeld', 'bumpCount', 'idle', 'stillness', 'start', 'out', 'report', 'drive', 'unseen', 'hum', 'env']);
    const THRESHOLD = new Set(['label', 'zone', 'exit', 'via', 'viaDark', 'to', 'setFlag', 'sfxCue', 'beat', 'approach', 'fallShot']);
    const BEAT_ZONE = new Set(['zone', 'label', 'beat', 'once']);
    // director.js runBeats(), in its order
    const BEAT = new Set(['sfxCue', 'sfxOpts', 'oneShot', 'music', 'musicRender', 'caption', 'holdMs', 'className', 'rattle', 'show', 'hide', 'light', 'env', 'breath', 'footfall', 'screen', 'display', 'swing', 'setFlag', 'hold', 'drop', 'actor', 'seal', 'open', 'amount', 'close', 'seconds', 'await', 'lookAt', 'lookY', 'sit', 'moveTo', 'shot', 'ride', 'shake', 'together', 'waitMs']);
    const DISPLAY = new Set(['prop', 'text']);
    const SWING = new Set(['prop', 'amount', 'decay', 'axis', 'period']);
    const bad = [];
    const keysOf = (o) => Object.keys(o || {}).filter((k) => !k.startsWith('_'));
    const beats = (list, where) => {
      if (list === undefined) return;
      if (!Array.isArray(list)) { bad.push(`${where}: beats must be a list`); return; }
      list.forEach((bt, i) => {
        for (const k of keysOf(bt)) if (!BEAT.has(k)) bad.push(`${where}[${i}]: unknown beat key ${k}`);
        // `amount` swings an `open` door part-way (doors.js open(seconds, to))
        if (bt.amount !== undefined && !(bt.open && bt.amount > 0 && bt.amount <= 1)) bad.push(`${where}[${i}]: amount must be 0..1 on an open beat`);
        if (bt.display) {
          for (const k of keysOf(bt.display)) if (!DISPLAY.has(k)) bad.push(`${where}[${i}].display: unknown key ${k}`);
          if (typeof bt.display.prop !== 'string' || typeof bt.display.text !== 'string') bad.push(`${where}[${i}].display: {prop, text} strings`);
        }
        if (bt.swing) {
          const sw = bt.swing;
          for (const k of keysOf(sw)) if (!SWING.has(k)) bad.push(`${where}[${i}].swing: unknown key ${k}`);
          if (typeof sw.prop !== 'string') bad.push(`${where}[${i}].swing: no prop`);
          if (sw.amount !== undefined && !(sw.amount > 0 && sw.amount <= 0.3)) bad.push(`${where}[${i}].swing.amount: metres, 0..0.3`);
          if (sw.decay !== undefined && !(sw.decay > 0)) bad.push(`${where}[${i}].swing.decay: per second, > 0`);
          if (sw.period !== undefined && !(sw.period > 0)) bad.push(`${where}[${i}].swing.period: seconds, > 0`);
          if (sw.axis !== undefined && !['x', 'z'].includes(sw.axis)) bad.push(`${where}[${i}].swing.axis: 'x' or 'z'`);
        }
        if (bt.ride && bt.ride.stops) {
          // a stop is a beat plus `at`: where along the ride (0..1) it runs
          bt.ride.stops.forEach((st, k) => { if (!(st.at >= 0 && st.at <= 1)) bad.push(`${where}[${i}].ride.stops[${k}]: at must be 0..1`); });
          beats(bt.ride.stops.map(({ at, ...rest }) => rest), `${where}[${i}].ride.stops`);
        }
        if (bt.together) beats(bt.together, `${where}[${i}].together`);
      });
    };
    for (const { sid, letter, b } of branches()) {
      const where = `${sid}.${letter}`;
      for (const k of keysOf(b)) if (!BRANCH.has(k)) bad.push(`${where}: unknown branch key ${k}`);
      beats(b.onEnter, `${where}.onEnter`);
      if (b.idle) { beats(b.idle.beat, `${where}.idle`); if (!(b.idle.seconds > 0)) bad.push(`${where}: idle.seconds`); if (b.idle.commit && !(b.thresholds || {})[b.idle.commit]) bad.push(`${where}: idle.commit names no threshold`); if (b.idle.after && !zoneNames(b.room).has(b.idle.after)) bad.push(`${where}: idle.after ${b.idle.after} is no zone of ${b.room}`); }
      if (b.stillness) { beats(b.stillness.beat, `${where}.stillness`); if (!(b.stillness.seconds > 0)) bad.push(`${where}: stillness.seconds`); }
      if (b.drive) {
        // the beats of an actor driven by his progress (rooms.json actors.NAME.drive)
        for (const k of keysOf(b.drive)) if (!['actor', 'footstep', 'end'].includes(k)) bad.push(`${where}: unknown drive key ${k}`);
        const a = ((resolve(b.room) || {}).actors || {})[b.drive.actor];
        if (!a || !a.drive) bad.push(`${where}: drive.actor ${b.drive.actor} is no driven actor of ${b.room}`);
        else if (b.drive.footstep && !(a.drive.footsteps > 0)) bad.push(`${where}: drive.footstep never runs (${b.drive.actor}'s drive has no footsteps)`);
        beats(b.drive.footstep, `${where}.drive.footstep`);
        beats(b.drive.end, `${where}.drive.end`);
      }
      for (const u of [].concat(b.unseen || [])) {
        // changes made out of his view (director.js outOfView)
        for (const k of keysOf(u)) if (!['after', 'point', 'r', 'beat'].includes(k)) bad.push(`${where}: unknown unseen key ${k}`);
        if (u.after && !zoneNames(b.room).has(u.after)) bad.push(`${where}: unseen.after ${u.after} is no zone of ${b.room}`);
        if (u.point !== undefined && !(Array.isArray(u.point) && u.point.length === 2 && u.point.every(Number.isFinite))) bad.push(`${where}: unseen.point must be [x, z]`);
        if (u.r !== undefined && !(u.r > 0)) bad.push(`${where}: unseen.r must be > 0`);
        if (!(u.beat || []).length) bad.push(`${where}: unseen without beats`);
        beats(u.beat, `${where}.unseen`);
      }
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

  // Which rooms can actually lie behind each threshold: every path x both
  // S0 seeds, played the way the director plays them.
  function behindMap() {
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
    return behind;
  }

  await runCase('Assertion 2b: a threshold that leaves its room has an exit door/anchor and a CN_* connector (or falls, or names `to`)', () => {
    const behind = behindMap();
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

  await runCase('Assertion 2b2: every connector join fits -- the doorway it leaves by fits its entry wall, and the doorway it arrives through fits inside its mouth (no slot onto nothing beside or over a passage)', () => {
    const WALL_T = 0.3; // room.js
    const door = (k, n) => ((resolve(k) || {}).doors || []).find((d) => d.name === n);
    const bad = [];
    let joins = 0;
    const check = (id, from, exit, via, to) => {
      const conn = rooms.rooms[via];
      if (!conn || !conn.connector) return;
      joins++;
      const out = door(from, exit);
      if (out && (out.w > conn.size[0] + 2 * WALL_T + 1e-6 || out.h > conn.size[1] + 1e-6)) bad.push(`${id}: ${from}.${exit} ${out.w} x ${out.h} is bigger than ${via}'s entry wall ${conn.size[0] + 2 * WALL_T} x ${conn.size[1]}`);
      for (const r of to) {
        const rec = resolve(r);
        const inn = rec && door(r, rec.entry);
        if (!inn) continue; // an anchor (the chute's top), not a doorway
        const [mw, mh] = conn.mouth || [conn.size[0] + 2 * WALL_T, conn.size[1] - (conn.floorY || 0)];
        if (inn.w > mw + 1e-6 || inn.h > mh + 1e-6) bad.push(`${id}: ${r}.${rec.entry} ${inn.w} x ${inn.h} is bigger than ${via}'s mouth ${mw} x ${mh}`);
      }
    };
    for (const [id, set] of behindMap()) {
      const [sid, letter, key] = id.split('.');
      const b = manifest.scenes[sid].branches[letter];
      const th = b.thresholds[key];
      if (th.to || !th.via || th.via === 'fall') continue;
      check(id, b.room, th.exit, th.via, [...set].filter((r) => baseOf(r) !== baseOf(b.room)));
    }
    const x = manifest.scenes.S0.branches.X;
    check('S0 out', x.room, x.out.exit, x.out.via, [x.out.to]);
    check('S0 report', x.out.to, x.report.exit, x.report.via, Object.values(manifest.scenes.S1.branches).map((b) => b.room));
    for (const [id, e] of Object.entries(endings)) {
      if (id.startsWith('_')) continue;
      for (const [from, route] of Object.entries(e.routes || {})) check(`${id} route`, from, route.exit, route.via, [e.room]);
    }
    assert(joins >= 12, `only ${joins} joins checked`);
    assert(bad.length === 0, bad.join(' | '));
  });

  await runCase('Assertion 2c: every door, prop, light, actor and shot a beat names exists in the room it plays in; every sfxCue is a known cue', () => {
    const cues = new Set([...createSfx(null).availableCues, ...Object.keys(REAL_SFX_FILES)]);
    const bad = [];
    const checkBeats = (where, room, beats) => {
      const rec = resolve(room);
      if (!rec) { bad.push(`${where}: no room ${room}`); return; }
      // show/hide may name a prop or a box with an id
      const props = new Set([...propNames(room), ...(rec.boxes || []).map((b) => b.id).filter(Boolean)]), doors = doorNames(room);
      const lights = new Set((rec.lights || []).map((l) => l.id).filter(Boolean));
      for (const bt of beats || []) {
        for (const c of [].concat(bt.sfxCue || [])) if (!cues.has(c)) bad.push(`${where}: unknown sfxCue ${c}`);
        for (const k of ['rattle', 'open', 'close']) if (bt[k] && !doors.has(bt[k])) bad.push(`${where}: ${k} ${bt[k]} is no door of ${room}`);
        for (const k of ['show', 'hide', 'lookAt']) if (bt[k] && !props.has(bt[k])) bad.push(`${where}: ${k} ${bt[k]} is no named prop of ${room}`);
        if (bt.screen && !props.has(bt.screen.prop)) bad.push(`${where}: screen ${bt.screen.prop} is no named prop of ${room}`);
        if (bt.swing && !propNames(room).has(bt.swing.prop)) bad.push(`${where}: swing ${bt.swing.prop} is no named prop of ${room}`);
        if (bt.display) {
          // a reading needs a text-capable prop: props.js floorind
          const dp = (rec.props || []).find((p) => p.name === bt.display.prop);
          if (!dp || dp.type !== 'floorind') bad.push(`${where}: display ${bt.display.prop} is no floorind of ${room}`);
        }
        if (bt.light && !lights.has(bt.light.id)) bad.push(`${where}: light ${bt.light.id} not in ${room}`);
        if (bt.actor) { const n = typeof bt.actor === 'string' ? bt.actor : bt.actor.name; if (!(rec.actors || {})[n]) bad.push(`${where}: actor ${n} not in ${room}`); }
        if (bt.shot && !(rec.shots || {})[bt.shot]) bad.push(`${where}: shot ${bt.shot} not in ${room}`);
        if (bt.ride && bt.ride.stops) checkBeats(`${where}.ride.stops`, room, bt.ride.stops);
        if (bt.together) checkBeats(`${where}.together`, room, bt.together);
      }
    };
    for (const { sid, letter, b } of branches()) {
      for (const c of [].concat(b.sfxCue || [])) if (!cues.has(c)) bad.push(`${sid}.${letter}: unknown sfxCue ${c}`);
      if (b.bumpCount) {
        // pushes on a locked door, counted by the director's bump handler
        const bc = b.bumpCount;
        if (!doorNames(b.room).has(bc.door)) bad.push(`${sid}.${letter}: bumpCount door ${bc.door} is no door of ${b.room}`);
        if (!(Number.isInteger(bc.at) && bc.at > 0)) bad.push(`${sid}.${letter}: bumpCount.at must be a positive count`);
        for (const [k, pn] of Object.entries(bc.show || {})) {
          if (!(Number(k) > 0)) bad.push(`${sid}.${letter}: bumpCount.show key ${k} is not a count`);
          if (!propNames(b.room).has(pn)) bad.push(`${sid}.${letter}: bumpCount.show ${pn} is no named prop of ${b.room}`);
        }
      }
      checkBeats(`${sid}.${letter}.onEnter`, b.room, b.onEnter);
      if (b.idle) checkBeats(`${sid}.${letter}.idle`, b.room, b.idle.beat);
      if (b.stillness) checkBeats(`${sid}.${letter}.stillness`, b.room, b.stillness.beat);
      if (b.drive) { checkBeats(`${sid}.${letter}.drive.footstep`, b.room, b.drive.footstep); checkBeats(`${sid}.${letter}.drive.end`, b.room, b.drive.end); }
      for (const u of [].concat(b.unseen || [])) checkBeats(`${sid}.${letter}.unseen`, b.room, u.beat);
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

  await runCase('Assertion 2c2: an `unseen` change stays in its own area -- every prop it shows or hides lies within r of its point, and the area keeps clear of every threshold zone, exit door and actor path of the scene (nothing appears in the way of a choice)', () => {
    const bad = [];
    let n = 0;
    const segDist = (p, a, b) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
    };
    for (const { sid, letter, b } of branches()) {
      const rec = resolve(b.room);
      for (const u of [].concat(b.unseen || [])) {
        const where = `${sid}.${letter}.unseen`;
        const [W, , D] = rec.size;
        const entry = (rec.doors || []).find((d) => d.name === rec.entry);
        const doorAt = (d) => (d.wall === 'N' ? [d.x, -D / 2] : d.wall === 'S' ? [d.x, D / 2] : d.wall === 'E' ? [W / 2, d.x] : [-W / 2, d.x]);
        const c = u.point || (entry ? doorAt(entry) : null);
        if (!c) { bad.push(`${where}: no point and no entry doorway`); continue; }
        const r = u.r === undefined ? 1.5 : u.r;
        for (const bt of u.beat || []) {
          for (const name of [bt.show, bt.hide].filter(Boolean)) {
            const p = (rec.props || []).find((q) => q.name === name);
            if (!p) continue; // Assertion 2c names it
            n++;
            // a propgroup's parts in its frame (yawed by its rot); each part's
            // origin within r - 0.15 (the director keeps him r + 0.6 away)
            const th = ((p.rot || 0) * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th);
            const parts = p.parts ? p.parts.map((q) => [p.pos[0] + q.pos[0] * cs + q.pos[2] * sn, p.pos[2] - q.pos[0] * sn + q.pos[2] * cs]) : [[p.pos[0], p.pos[2]]];
            for (const q of parts) if (Math.hypot(q[0] - c[0], q[1] - c[1]) > r - 0.15) bad.push(`${where}: ${name} reaches [${q.map((v) => v.toFixed(2))}], outside ${r} m of [${c}]`);
          }
        }
        for (const [key, th] of Object.entries(b.thresholds || {})) {
          for (const zn of zonesOf(th)) {
            const z = (rec.zones || []).find((q) => q.name === zn);
            if (!z || z.actor) continue; // an actor's zone walks his path, checked below
            const zp = [z.pos[0], z.pos[z.pos.length - 1]];
            const d = z.box ? Math.hypot(Math.max(z.box[0][0] - c[0], 0, c[0] - z.box[1][0]), Math.max(z.box[0][1] - c[1], 0, c[1] - z.box[1][1])) : Math.hypot(zp[0] - c[0], zp[1] - c[1]) - z.r;
            if (d < r) bad.push(`${where}: threshold ${key} zone ${zn} within its area`);
          }
          const door = th.exit && (rec.doors || []).find((d) => d.name === th.exit);
          if (door) { const dp = doorAt(door); if (Math.hypot(dp[0] - c[0], dp[1] - c[1]) < r + 1.0) bad.push(`${where}: threshold ${key}'s exit ${th.exit} within its area`); }
        }
        for (const [an, a] of Object.entries(rec.actors || {})) {
          for (let i = 0; i + 1 < a.path.length; i++) if (segDist(c, a.path[i], a.path[i + 1]) < r + 0.6) bad.push(`${where}: actor ${an}'s path crosses its area`);
        }
      }
    }
    assert(bad.length === 0, bad.join(' | '));
    assert(n >= 1, 'no unseen change found (S4 C closes the aisle behind him)');
  });

  await runCase('Assertion 2c3: a ride reads the landings it passes -- every floor a `display` stop shows is a fixed landing of its room at the drop the ride has reached by then, and every fixed landing is read (S7 C: B1, B2, B7, B12, the glyph)', () => {
    // director.js stepRide: one eased drop (in-out quad) of ride.drop metres
    const dropAt = (ride, u) => (ride.drop === undefined ? 14 : ride.drop) * (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
    const norm = (t) => String(t).replace(/\s+/g, '').toUpperCase();
    const bad = [];
    let rides = 0, reads = 0;
    const walk = (beats, room, where) => {
      for (const bt of beats || []) {
        if (bt.together) walk(bt.together, room, `${where}.together`);
        if (!bt.ride) continue;
        const landings = ((resolve(room) || {}).props || []).filter((p) => p.fixed && p.type === 'landingdoors' && p.label !== undefined);
        if (!landings.length) continue;
        rides++;
        const read = new Set();
        for (const st of bt.ride.stops || []) {
          if (!st.display) continue;
          const t = norm(st.display.text);
          const at = landings.filter((p) => norm(p.label) === t);
          if (!at.length) { if (t && t !== '--') bad.push(`${where}: reads ${t}, no landing of ${room} is ${t}`); continue; }
          const d = dropAt(bt.ride, st.at);
          const near = at.some((p) => Math.abs(d + p.pos[1]) <= 0.5);
          if (!near) bad.push(`${where}: reads ${t} at ${st.at} (${d.toFixed(2)} m down), the landing is ${at.map((p) => (-p.pos[1]).toFixed(2)).join('/')} m down`);
          read.add(t);
          reads++;
        }
        for (const p of landings) if (!read.has(norm(p.label))) bad.push(`${where}: passes landing ${norm(p.label)} without reading it`);
        if (Math.max(...landings.map((p) => -p.pos[1])) > dropAt(bt.ride, 1) + 1e-6) bad.push(`${where}: a landing below where the ride stops`);
      }
    };
    for (const { sid, letter, b } of branches()) {
      walk(b.onEnter, b.room, `${sid}.${letter}.onEnter`);
      if (b.idle) walk(b.idle.beat, b.room, `${sid}.${letter}.idle`);
      if (b.stillness) walk(b.stillness.beat, b.room, `${sid}.${letter}.stillness`);
      for (const bz of b.beatZones || []) walk(bz.beat, b.room, `${sid}.${letter}.beatZone.${bz.zone}`);
      for (const [key, th] of Object.entries(b.thresholds || {})) { walk(th.beat, b.room, `${sid}.${letter}.${key}`); walk(th.approach, b.room, `${sid}.${letter}.${key}.approach`); }
    }
    assert(rides >= 2 && reads >= 10, `only ${rides} rides / ${reads} readings past landings found`);
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
      if (b.drive) { beatFiles(b.drive.footstep, `${where}.drive`); beatFiles(b.drive.end, `${where}.drive`); }
      if (b.stillness) beatFiles(b.stillness.beat, `${where}.stillness`);
      for (const u of [].concat(b.unseen || [])) beatFiles(u.beat, `${where}.unseen`);
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
      if (b.idle) beatKeys(b.idle.beat, `${where}.idle`);
      if (b.stillness) beatKeys(b.stillness.beat, `${where}.stillness`);
      if (b.drive) { beatKeys(b.drive.footstep, `${where}.drive`); beatKeys(b.drive.end, `${where}.drive`); }
      for (const u of [].concat(b.unseen || [])) beatKeys(u.beat, `${where}.unseen`);
    }
    for (const [id, e] of Object.entries(endings)) if (!id.startsWith('_')) beatKeys(e.beats, `ending.${id}`);
    assert(keys.length >= 8, `only ${keys.length} caption keys found`);
    for (const [k, where] of keys) if (!(k in systemText)) missing.push(`${where}: ${k}`);
    // the director's screen pages read these (director.js PAGES)
    for (const k of ['posting.title', 'posting.employer', 'posting.body', 'portal.confirm', 'portal.accept', 'harlowe.session', 'harlowe.draft', 'requisition.title']) if (!(k in systemText)) missing.push(`PAGES: ${k}`);
    assert(missing.length === 0, missing.join(', '));
  });

  await runCase('Assertion 2f: env / breath / footfall beats and hum settings are well-formed (keys the director reads, colours, numbers); every light `sync` names a named prop of its room', () => {
    const bad = [];
    const ENV = new Set(ENV_BEAT_KEYS);
    const BREATH = new Set(['every', 'gain', 'filterHz', 'durationMs', 'inhale']);
    const FOOTFALL = new Set(['gain', 'filterHz', 'durationMs']);
    const HUM = new Set(['hz', 'gain', 'lowpassHz', 'followDrone', 'room']);
    const colour = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
    const num = (v) => v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
    const keysOf = (o) => Object.keys(o || {}).filter((k) => !k.startsWith('_'));
    let envs = 0, layers = 0, hums = 0;
    // an env beat, or a branch's `env` (the same pieces: its room's atmosphere for the scene)
    const checkEnv = (e, w) => {
      envs++;
      for (const k of keysOf(e)) if (!ENV.has(k)) bad.push(`${w}.env: unknown key ${k}`);
      if (e.fog) { if (e.fog.color !== undefined && !colour(e.fog.color)) bad.push(`${w}.env.fog.color`); if (!num(e.fog.near) || !num(e.fog.far) || (e.fog.near !== undefined && e.fog.far !== undefined && e.fog.far <= e.fog.near)) bad.push(`${w}.env.fog near/far`); }
      if (e.background !== undefined && !colour(e.background)) bad.push(`${w}.env.background`);
      for (const k of ['ambient', 'sun']) if (e[k] && ((e[k].color !== undefined && !colour(e[k].color)) || !num(e[k].intensity))) bad.push(`${w}.env.${k}`);
      for (const k of ['exposure', 'grain', 'vignette', 'seconds']) if (!num(e[k])) bad.push(`${w}.env.${k}: a number >= 0`);
      if (!keysOf(e).some((k) => k !== 'seconds')) bad.push(`${w}.env: moves nothing`);
    };
    const checkBeats = (list, where) => {
      for (const [i, bt] of (list || []).entries()) {
        const w = `${where}[${i}]`;
        if (bt.env) checkEnv(bt.env, w);
        for (const [k, set] of [['breath', BREATH], ['footfall', FOOTFALL]]) {
          if (bt[k] === undefined) continue;
          layers++;
          if (bt[k] === false) continue;
          if (!bt[k] || typeof bt[k] !== 'object') { bad.push(`${w}.${k}: an object, or false to stop it`); continue; }
          for (const kk of keysOf(bt[k])) if (!set.has(kk)) bad.push(`${w}.${k}: unknown key ${kk}`);
          for (const kk of ['every', 'gain', 'filterHz', 'durationMs']) if (!num(bt[k][kk])) bad.push(`${w}.${k}.${kk}: a number >= 0`);
        }
        if (bt.breath && !(bt.breath.every > 0.5)) bad.push(`${w}.breath.every: seconds between breaths (> 0.5)`);
        if (bt.together) checkBeats(bt.together, `${w}.together`);
        if (bt.ride && bt.ride.stops) checkBeats(bt.ride.stops, `${w}.ride.stops`);
      }
    };
    const checkHum = (h, where) => {
      hums++;
      for (const k of keysOf(h)) if (!HUM.has(k)) bad.push(`${where}.hum: unknown key ${k}`);
      for (const k of ['hz', 'gain', 'lowpassHz']) if (!num(h[k])) bad.push(`${where}.hum.${k}: a number >= 0`);
      if (h.gain > 0.05) bad.push(`${where}.hum.gain ${h.gain}: a hum under the drone (<= 0.05)`);
      if (h.room && !rooms.rooms[h.room]) bad.push(`${where}.hum.room ${h.room} is no room`);
    };
    for (const { sid, letter, b } of branches()) {
      const where = `${sid}.${letter}`;
      checkBeats(b.onEnter, `${where}.onEnter`);
      for (const bz of b.beatZones || []) checkBeats(bz.beat, `${where}.beatZone.${bz.zone}`);
      for (const [key, th] of Object.entries(b.thresholds || {})) { checkBeats(th.beat, `${where}.${key}.beat`); checkBeats(th.approach, `${where}.${key}.approach`); }
      if (b.idle) checkBeats(b.idle.beat, `${where}.idle`);
      if (b.stillness) checkBeats(b.stillness.beat, `${where}.stillness`);
      if (b.hum) checkHum(b.hum, where);
      if (b.env) checkEnv(b.env, where);
    }
    for (const [id, e] of Object.entries(endings)) {
      if (id.startsWith('_')) continue;
      checkBeats(e.beats, `ending.${id}`);
      if (e.hum) checkHum(e.hum, `ending.${id}`);
    }
    // what the env group's data uses, so a lost edit fails here: S6 H's run
    // (warm haze in, the pool's teal toward the edge, the breath layer that
    // stops at the commit) and the store's hum (S8 H's store, EXPULSION)
    assert(envs >= 2 && layers >= 6 && hums >= 2, `only ${envs} env beats, ${layers} breath/footfall beats, ${hums} hums`);
    const s6 = manifest.scenes.S6.branches.H;
    assert(s6.env && s6.env.fog, 'S6 H: the run takes the garage\'s sodium haze (branch `env`)');
    assert((s6.beatZones || []).some((bz) => (bz.beat || []).some((bt) => bt.env && bt.env.base)), 'S6 H: no beat zone hands the run back to the room\'s own (pool) atmosphere');
    assert(!(s6.beatZones || []).some((bz) => bz.label), 'S6 H: the run\'s beat zones are silent (no label)');
    for (const th of Object.values(s6.thresholds)) assert((th.beat || []).some((bt) => bt.breath === false), 'S6 H: a threshold leaves the breath layer running');
    const h8 = manifest.scenes.S8.branches.H.hum;
    assert(h8 && baseOf(h8.room) === baseOf(endings.EXPULSION.room) && endings.EXPULSION.hum, 'S8 H / EXPULSION: the hum belongs to the store');
    // light sync: the prop a light drives must exist (a typo is a sign that never flickers)
    for (const [k, r] of Object.entries(rooms.rooms)) {
      if (r.alias) continue;
      const named = new Set((r.props || []).filter((p) => p.name).map((p) => p.name));
      for (const l of r.lights || []) for (const n of [].concat(l.sync || [])) if (!named.has(n)) bad.push(`${k}: a light syncs ${n}, no named prop`);
    }
    const syncs = Object.values(rooms.rooms).flatMap((r) => (r.lights || []).flatMap((l) => [].concat(l.sync || [])));
    assert(syncs.includes('entersign') && syncs.includes('dustmotes'), 'S3 C: the ENTER sign and its dust follow the green light (`sync`)');
    assert(bad.length === 0, bad.join(' | '));
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
      for (const bt of e.beats || []) for (const k of ['show', 'hide', 'lookAt']) if (bt[k] && !propNames(e.room).has(bt[k])) bad.push(`${id}: beat ${k} ${bt[k]} not in ${e.room}`);
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
