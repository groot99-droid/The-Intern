// data/rooms.json integrity for the continuous building: every key names a
// real scene+render, an ending, an extra set or a connector; every alias
// resolves and changes nothing but the camera; every prop type has a
// builder; every room is entered through a doorway; and canon holds -- C3
// (no room opens to a sky), C6 (the hands only where they belong), C8 (one
// handless clock per set). tools/build_rooms.py check_room() asserts most
// of this when it writes the file; this re-checks the file as shipped.

import { runCase, assert, assertEqual } from '../harness.js';
import { doorAnchor } from '../../src/world/anchors.js';

export async function run() {
  const [rooms, scenes, props] = await Promise.all([
    fetch('../data/rooms.json').then((r) => r.json()),
    fetch('../data/scenes.json').then((r) => r.json()),
    import('../../src/walk/props.js')
  ]);
  const types = new Set(props.PROP_TYPES);
  const resolved = (key) => { const rec0 = rooms.rooms[key]; return rec0.alias ? { ...rooms.rooms[rec0.alias], ...rec0 } : rec0; };
  const built = Object.entries(rooms.rooms).filter(([, r]) => !r.alias);
  const sets = built.filter(([, r]) => !r.connector);
  const connectors = built.filter(([, r]) => r.connector);

  await runCase('rooms.json: every key is a scene+render, an ending, an extra set or a CN_* connector, and every scene branch has its room', () => {
    for (const key of Object.keys(rooms.rooms)) {
      const m = /^(S\d)_([CHX])$/.exec(key);
      if (m) {
        const scene = scenes.scenes[m[1]];
        assert(scene && scene.branches[m[2]], `${key}: no such scene/branch`);
      } else {
        assert(/^(SE_(ASSIM|EXPUL|PEND|RETAINED)|SET_[A-Z]+|CN_[A-Z_]+)$/.test(key), `bad key ${key}`);
      }
    }
    for (const [sid, scene] of Object.entries(scenes.scenes)) {
      for (const [letter, branch] of Object.entries(scene.branches)) assert(rooms.rooms[branch.room], `${sid}.${letter}: room ${branch.room} missing`);
    }
    assert(connectors.length >= 6, `expected the CN_* connectors, found ${connectors.length}`);
  });

  await runCase('rooms.json: every set has in/out/loop/leave/arrive shots and every shot\'s poses sit inside its shell', () => {
    for (const [key] of Object.entries(rooms.rooms)) {
      const rec = resolved(key);
      const [W, H, D] = rec.size;
      assert(rec.shots, `${key}: no shots`);
      if (!rec.connector) for (const name of ['in', 'out', 'loop', 'leave', 'arrive']) assert(rec.shots[name], `${key}: no ${name}`);
      const y0 = rec.floorY || 0;
      const poseOf = (p) => (typeof p === 'string' ? rec.shots[p] : p);
      for (const [name, s] of Object.entries(rec.shots)) {
        const poses = s.pos ? [s] : [poseOf(s.from), poseOf(s.to)];
        for (const p of poses) {
          assert(p && p.pos && p.look, `${key}.${name}: incomplete pose`);
          assert(Math.abs(p.pos[0]) <= W / 2 + 2 && Math.abs(p.pos[2]) <= D / 2 + 40 && p.pos[1] <= Math.max(H, y0 + H) + 2, `${key}.${name}: pose outside ${W}x${H}x${D}`);
        }
        if (!s.pos) assert(s.seconds > 0, `${key}.${name}: seconds`);
      }
    }
  });

  await runCase('rooms.json: every catalog placement names a library node and has a buildable fallback', () => {
    for (const [key, rec] of Object.entries(rooms.rooms)) {
      for (const p of rec.props || []) {
        if (p.type !== 'glb') continue;
        assert(rooms.catalog && rooms.catalog[p.node], `${key}: unknown catalog node ${p.node}`);
        if (p.fallback) assert(types.has(p.fallback), `${key}: fallback ${p.fallback} has no builder`);
      }
    }
  });

  await runCase('rooms.json: aliases resolve to built rooms and change only spawn/shots/name/_note (the world builds one room per base set)', () => {
    const allowed = new Set(['alias', 'id', 'spawn', 'shots', 'name', '_note']);
    for (const [key, rec] of Object.entries(rooms.rooms)) {
      if (!rec.alias) continue;
      const target = rooms.rooms[rec.alias];
      assert(target && !target.alias, `${key}: alias ${rec.alias} must be a built room`);
      const extra = Object.keys(rec).filter((k) => !allowed.has(k));
      assert(extra.length === 0, `${key}: an alias may not change the room (${extra.join(', ')})`);
      assert(!target.connector, `${key}: an alias of a connector`);
    }
  });

  await runCase('rooms.json: every prop type has a builder and every spawn is inside the shell', () => {
    for (const [key] of Object.entries(rooms.rooms)) {
      const rec = resolved(key);
      const [W, H, D] = rec.size;
      assert(W > 0 && H > 0 && D > 0, `${key}: size`);
      for (const p of rec.props || []) assert(types.has(p.type), `${key}: unknown prop "${p.type}"`);
      const [sx, sz] = rec.spawn || [0, 0];
      assert(rec.noWalls || !rec.noCeiling || rec.fog, `${key}: no ceiling and no fog`);
      assert(Math.abs(sx) < W / 2 && Math.abs(sz) < D / 2, `${key}: spawn (${sx}, ${sz}) outside ${W}x${D}`);
    }
  });

  await runCase('props.js: no builder name is defined twice (the polish blocks share one table; a later key silently replaces an earlier one)', async () => {
    const src = (await fetch('../src/walk/props.js').then((r) => r.text())).split('\n');
    const start = src.findIndex((l) => /^const BUILDERS = \{/.test(l));
    const end = src.findIndex((l, i) => i > start && /^\};/.test(l));
    assert(start >= 0 && end > start, 'BUILDERS table not found');
    const seen = new Map();
    for (let i = start + 1; i < end; i++) {
      const m = /^(?: {2}| {6})([A-Za-z_]\w*)\s*(?:\(\s*mats\b|:\s*\(\s*mats\b)/.exec(src[i]);
      if (!m) continue;
      assert(!seen.has(m[1]), `builder "${m[1]}" defined at props.js:${seen.get(m[1])} and again at props.js:${i + 1}`);
      seen.set(m[1], i + 1);
    }
    assert(seen.size > 50, `only ${seen.size} builders found -- the scan has gone stale`);
  });

  await runCase('rooms.json: every built room except S0_X is entered through a door or an anchor of its own', () => {
    for (const [key, rec] of built) {
      if (key === 'S0_X') { assert(!rec.entry, 'S0_X is where the game starts: no entry'); continue; }
      assert(rec.entry, `${key}: no entry`);
      const doors = new Set((rec.doors || []).map((d) => d.name));
      assert(doors.has(rec.entry) || (rec.anchors && rec.anchors[rec.entry]), `${key}: entry ${rec.entry} is no door or anchor`);
    }
  });

  await runCase('rooms.json: doors fit their walls -- unique names, closed walls, inside the run, no overlaps, under the ceiling -- and each yields an outward anchor', () => {
    const WALL_T = 0.3; // room.js
    for (const [key, rec] of built) {
      const names = new Set();
      const spans = {};
      const [W, H, D] = rec.size;
      for (const d of rec.doors || []) {
        assert(!names.has(d.name), `${key}: two doors named ${d.name}`);
        names.add(d.name);
        assert('NSEW'.includes(d.wall) && d.wall.length === 1, `${key}: door ${d.name} on wall ${d.wall}`);
        assert(!(rec.open || []).includes(d.wall), `${key}: door ${d.name} on an open side`);
        assert(!(rec.anchors && rec.anchors[d.name]), `${key}: door ${d.name} shadows an anchor of the same name`);
        const len = 'NS'.includes(d.wall) ? W : D;
        const x = d.x || 0, w = d.w || 1.2;
        assert(Math.abs(x) + w / 2 <= len / 2 - 0.05 + ('NS'.includes(d.wall) ? WALL_T : 0) + 1e-9, `${key}: door ${d.name} runs off its wall`);
        const y = d.y === undefined ? (rec.floorY || 0) : d.y;
        assert(y + (d.h || 2.2) < H + 1e-6 || rec.noWalls || rec.noCeiling, `${key}: door ${d.name} taller than the room`);
        for (const [s0, s1] of spans[d.wall] || []) assert(x + w / 2 <= s0 + 1e-9 || x - w / 2 >= s1 - 1e-9, `${key}: door ${d.name} overlaps another on wall ${d.wall}`);
        (spans[d.wall] = spans[d.wall] || []).push([x - w / 2, x + w / 2]);
        assert(['door', 'glass', 'curtain', 'shutter', 'slide', 'open'].includes(d.kind || 'door'), `${key}: door ${d.name} of unknown kind ${d.kind}`);
        const a = doorAnchor(rec.size, { ...d, y });
        assert(Number.isFinite(a.pos[0]) && Number.isFinite(a.pos[2]), `${key}: door ${d.name} anchor`);
      }
    }
  });

  await runCase('rooms.json: no prop has `reach`; the hands appear only in S0_X and SE_PEND (C6)', () => {
    for (const [key, rec] of built) {
      for (const p of rec.props || []) assert(!p.reach, `${key}: a prop with reach (${p.type})`);
      const hands = (rec.props || []).filter((p) => p.type === 'hands').length;
      if (key === 'S0_X' || key === 'SE_PEND') assert(hands >= 1, `${key}: the hands are missing`);
      else assert(hands === 0, `${key}: ${hands} hands outside the apartment and the pending room`);
    }
  });

  await runCase('rooms.json: CN_* records are connectors with entry and exit anchors (a seal on the way in, an opening on the way out)', () => {
    for (const [key, rec] of built) {
      if (key.startsWith('CN_')) assertEqual(rec.connector, true, `${key}: connector flag`);
      else assert(!rec.connector, `${key}: only CN_* records are connectors`);
    }
    for (const [key, rec] of connectors) {
      const doors = new Map((rec.doors || []).map((d) => [d.name, d]));
      const anchors = rec.anchors || {};
      assert(doors.has('exit') || anchors.exit, `${key}: no exit`);
      assert(doors.has('entry') || anchors.entry, `${key}: no entry doorway`);
      assert(doors.has(rec.entry) || anchors[rec.entry], `${key}: entry ${rec.entry} is no door/anchor`);
      if (doors.has('entry')) assert(doors.get('entry').open === true, `${key}: the entry seal must stand open until he is through`);
      if (doors.has('exit')) assertEqual(doors.get('exit').kind, 'open', `${key}: the far end is a bare opening`);
      assert((rec.floorY || 0) <= 0, `${key}: a connector that climbs (C3: only descent after the lobby)`);
    }
  });

  await runCase('rooms.json: zones -- unique names, on the floor and out of solid boxes, ring >= r, armAfter names a zone, actor zones name an actor', () => {
    for (const [key, rec] of built) {
      const [W, , D] = rec.size;
      const names = new Set((rec.zones || []).map((z) => z.name));
      assertEqual(names.size, (rec.zones || []).length, `${key}: duplicate zone names`);
      const solids = (rec.boxes || []).filter((b) => b.collide !== false && !b.floor);
      for (const z of rec.zones || []) {
        const x = z.pos[0], zz = z.pos[z.pos.length - 1];
        assert(Math.abs(x) <= W / 2 && Math.abs(zz) <= D / 2 + 0.4, `${key}: zone ${z.name} outside the room`);
        if (!z.actor) {
          for (const b of solids) {
            const inPlan = b.min[0] + 0.05 <= x && x <= b.max[0] - 0.05 && b.min[2] + 0.05 <= zz && zz <= b.max[2] - 0.05;
            const inHeight = z.pos.length !== 3 || (b.min[1] <= z.pos[1] && z.pos[1] <= b.max[1]);
            assert(!(inPlan && inHeight), `${key}: zone ${z.name} inside a solid box`);
          }
        }
        assert(z.ring >= z.r || z.silent, `${key}: zone ${z.name} ring inside its radius`);
        if (z.armAfter) assert(names.has(z.armAfter), `${key}: zone ${z.name} arms after missing ${z.armAfter}`);
        if (z.actor) assert(rec.actors && rec.actors[z.actor], `${key}: zone ${z.name} follows missing actor ${z.actor}`);
        if (z.box) assert(z.box[0][0] < z.box[1][0] && z.box[0][1] < z.box[1][1], `${key}: zone ${z.name} box`);
      }
    }
  });

  await runCase('rooms.json: C3 -- an open side is closed by fog or a box, never a sky', () => {
    for (const [key, rec] of Object.entries(rooms.rooms)) {
      if (!rec.open) continue;
      assert(rec.fog || (rec.boxes && rec.boxes.length), `${key}: open side with nothing closing it`);
      assert(!rec.sky && !rec.skybox, `${key}: no skies after the lobby doors`);
    }
  });

  await runCase('rooms.json: C8 -- every set has exactly one handless clock (connectors have none)', () => {
    for (const [key, rec] of built) {
      const clocks = (rec.props || []).filter((p) => p.type === 'clock').length;
      if (rec.connector) assertEqual(clocks, 0, `${key}: a clock in a connector`);
      else assert(clocks === 1, `${key}: ${clocks} clocks`);
    }
  });

  // ---- the look follow-ups: material slots, doors, catalog tints, controls, labels ----

  await runCase('rooms.json: the look keys name real things -- glass, curtain cloth, leaf and frame slots exist; `jib` only on a hinged door; `labelInk` is an ink labels.js draws; `swim.sink` a rate >= 0; `tintMapped` a flag; no runtime dressing (dress / dressGlass) left', async () => {
    const [{ createMaterialLibrary }, { LABEL_INKS }] = await Promise.all([import('../../src/walk/materials.js'), import('../../src/labels.js')]);
    const slots = new Set(createMaterialLibrary().slots());
    const bad = [];
    for (const [key, rec] of built) {
      for (const d of rec.doors || []) {
        for (const k of ['glass', 'mat', 'frame', 'panel', 'sill']) if (d[k] !== undefined && !slots.has(d[k])) bad.push(`${key}: door ${d.name} ${k} "${d[k]}" is no material slot`);
        if (d.jib !== undefined) {
          if (d.jib !== true && d.jib !== false) bad.push(`${key}: door ${d.name} jib must be true or false`);
          if (d.jib && (d.kind || 'door') !== 'door') bad.push(`${key}: door ${d.name} is a jib ${d.kind} (only a hinged door can be flush)`);
          if (d.jib && d.frame) bad.push(`${key}: door ${d.name} is a jib door with a frame`);
        }
        if (d.sway !== undefined && !(d.sway >= 0)) bad.push(`${key}: door ${d.name} sway`);
      }
      if (rec.labelInk !== undefined && !LABEL_INKS.includes(rec.labelInk)) bad.push(`${key}: labelInk "${rec.labelInk}" (labels.js draws ${LABEL_INKS.join(', ')})`);
      if (rec.swim && rec.swim.sink !== undefined && !(typeof rec.swim.sink === 'number' && rec.swim.sink >= 0)) bad.push(`${key}: swim.sink must be a rate >= 0`);
      for (const p of rec.props || []) {
        if (p.dress !== undefined || p.dressGlass !== undefined) bad.push(`${key}: ${p.type} still dresses a doorway at runtime (use the door's own mat / glass)`);
        if (p.tintMapped !== undefined && typeof p.tintMapped !== 'boolean') bad.push(`${key}: ${p.type} tintMapped must be a flag`);
      }
    }
    assert(bad.length === 0, bad.join(' | '));
    const door = (k, n) => (rooms.rooms[k].doors || []).find((d) => d.name === n) || {};
    assertEqual(door('S3_C', 'curtain').mat, 'velvet', 'S3 C: the curtain doorway hangs the velvet');
    assertEqual(door('S3_H', 'curtain').mat, 'velvet', 'S3 H: the curtain doorway hangs the velvet');
    assertEqual(door('S3_H', 'front').glass, 'glass_clear', 'S3 H: the dead street is seen through clear glass');
    assertEqual(door('S3_C', 'service').jib, true, 'S3 C: the service door is flush in the plaster (Scene Flow)');
    assertEqual(rooms.rooms.S1_H.labelInk, 'dark', 'S1 H: the threshold words dark over the blown-out walls');
  });

  await runCase('materials.js: glass_clear is a pane seen through (about 7 % tint, glossy, no specular lobe to read as a lamp beyond it), velvet a sheened physical cloth hung both sides, wood a grain that runs along u, and cardboard_wet the soaked-cardboard stain', async () => {
    const THREE = await import('../../vendor/three/three.module.js');
    const { createMaterialLibrary } = await import('../../src/walk/materials.js');
    const mats = createMaterialLibrary();
    const g = mats.get('glass_clear');
    assert(g.transparent && g.opacity >= 0.04 && g.opacity <= 0.1, `glass_clear opacity ${g.opacity}`);
    assert(g.roughness <= 0.06, `glass_clear roughness ${g.roughness}`);
    assert(g.isMeshPhysicalMaterial && g.specularIntensity === 0, 'glass_clear: no specular lobe');
    assert(g.depthWrite === false, 'glass_clear: a transparent pane writes no depth');
    const v = mats.get('velvet');
    assert(v.isMeshPhysicalMaterial && v.sheen > 0 && v.sheenColor.r > v.sheenColor.b, 'velvet: a red sheen');
    assertEqual(v.side, THREE.DoubleSide, 'velvet: both faces');
    assert(!mats.isLowPoly('velvet') && !mats.isLowPoly('glass_clear') && !mats.isLowPoly('cardboard_wet'), 'the building\'s slots are photoreal (C1)');
    // the grain runs along u: neighbours along a row differ less than neighbours down a column
    const cv = mats.get('wood').map.image;
    const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let du = 0, dv = 0;
    for (let y = 0; y < cv.height - 1; y += 3) for (let x = 0; x < cv.width - 1; x += 3) {
      const i = (y * cv.width + x) * 4;
      du += Math.abs(px[i] - px[i + 4]);
      dv += Math.abs(px[i] - px[i + cv.width * 4]);
    }
    assert(du * 1.3 < dv, `wood: no grain along u (row change ${du}, column change ${dv})`);
    assert(mats.get('cardboard_wet').map !== mats.get('wood').map, 'cardboard_wet is its own slot');
    mats.dispose();
  });

  await runCase('library.js: a catalog model keeps its vertex colours (windows, tyres, rust) and its palette slot multiplies into them; palette and cardoor can find what the library made', async () => {
    const THREE = await import('../../vendor/three/three.module.js');
    const { createLibrary, catalogPaint } = await import('../../src/stage/library.js');
    const lib = createLibrary();
    if (!(await lib.ready)) { assert(lib.failed(), 'library neither loaded nor failed'); return; }
    const tint = new THREE.Color('#5a3f2e');
    const mats = (g) => { const out = []; g.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };
    const plain = mats(lib.instance('lib_car_sedan'));
    const tinted = mats(lib.instance('lib_car_sedan', tint));
    assert(plain.length && tinted.length, 'lib_car_sedan: no meshes');
    for (const m of tinted) {
      assert(m.geometry.attributes.color, 'the catalog car is vertex-painted');
      assert(m.material.vertexColors === true, 'vertex colours kept');
      assert(m.material.flatShading && m.material.customProgramCacheKey && m.material.customProgramCacheKey() === 'snap', 'C1: flat-shaded and vertex-snapped');
      assert(m.material.userData.catalog === true, 'marked for props.js palette');
      const base = plain[0].material.color;
      assert(Math.abs(m.material.color.r - base.r * tint.r) < 1e-6 && Math.abs(m.material.color.g - base.g * tint.g) < 1e-6, 'the slot multiplies the model\'s colour (no 80 % lerp)');
    }
    const cp = catalogPaint(tint);
    assert(cp.r < tint.r && cp.r > tint.r * 0.3, 'catalogPaint: the slot multiplied into the catalog\'s light grey');
  });

  await runCase('controls.js: a blocked step is clamped to the wall (a slow frame still reaches its face); swimming never rises (C3) and `sink` takes him down to the swim floor', async () => {
    const THREE = await import('../../vendor/three/three.module.js');
    const { createControls } = await import('../../src/walk/controls.js');
    const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 100);
    const dom = document.createElement('div');
    const m = new THREE.MeshBasicMaterial();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.2), m);
    wall.position.set(0, 1.5, -1.1); // its face at z = -1.0
    const floor = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 20), m);
    floor.position.set(0, -0.1, 0);
    wall.updateMatrixWorld(true); floor.updateMatrixWorld(true);
    let bumps = 0;
    const c = createControls(cam, dom, () => ({ walls: [wall], floors: [floor] }), { onBump: () => { bumps++; } });
    try {
      c.teleport(0, 0, 0, 0); // facing -z, the wall a metre ahead
      c.setMoveAxis(0, 1);
      c.update(0.5); // a 1.3 m step at walking pace: the old code cancelled it 0.65 m short of the wall
      assert(Math.abs(cam.position.z - (-1.0 + 0.35)) < 0.01, `stopped at z ${cam.position.z.toFixed(3)}, not at the wall's face less his radius`);
      assert(bumps > 0, 'the push into the wall is reported (bumpCount)');
      c.update(0.5);
      assert(cam.position.z > -0.66, 'he never passes into the wall');
      // swimming, clear of the wall
      c.setSwim({ floorY: -5, ceilingY: 5 });
      cam.position.set(3, 2, 0);
      c.setLook(0, 0.6); // looking up and swimming forward
      c.update(0.25);
      assert(Math.abs(cam.position.y - 2) < 1e-9, `rose to ${cam.position.y} (C3: no ascent)`);
      assert(cam.position.z < -0.1, 'still swims forward');
      c.setLook(0, -0.6);
      c.update(0.25);
      assert(cam.position.y < 1.9, 'swims down');
      c.setMoveAxis(0, 0);
      c.setSwim({ floorY: -5, ceilingY: 5, sink: 0.5 });
      const y0 = cam.position.y;
      c.update(1);
      assert(Math.abs(cam.position.y - (y0 - 0.5)) < 1e-6, 'sink: half a metre in a second');
      cam.position.y = -4.8;
      c.update(1);
      assert(Math.abs(cam.position.y + 5) < 1e-9, 'the swim floor stops the sink');
    } finally {
      c.setSwim(null);
      c.dispose();
    }
  });

  await runCase('Track C motif 2: at most one 99 slip per set after S1', () => {
    for (const [key, rec] of sets) {
      if (key.startsWith('S1_') || key === 'S0_X' || key === 'SE_PEND') continue;
      const slips = (rec.props || []).filter((p) => p.type === 'slip').length;
      assert(slips <= 1, `${key}: ${slips} slips`);
    }
  });
}
