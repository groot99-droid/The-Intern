// The director: plays the spine (Doc 1 §4) as one continuous walk through
// one continuous building (src/world/). It replaces the old router, which
// cut from set to set through black and asked each choice with buttons.
//
// A scene is a room the candidate stands in, with two THRESHOLDS -- places
// to walk to (data/scenes.json `thresholds`, zones in data/rooms.json).
// Stepping into one commits the choice (state.js commitChoice, the only
// writer of the score), its beats play (a door rattles, a line is spoken,
// the cab descends), and the way on opens: either the next scene starts in
// the same room (S1 -> S2: the call comes in the waiting room) or the
// threshold's exit door opens onto a connector with the next scene's room
// joined behind it. The render of that room was decided by the score after
// the choice (the spine never forks; only the render does) and the room was
// built ahead of time (spine.js outcomesFor). Crossing the connector is the
// scene boundary: the drone detunes (C7: advanceScene, never restarted),
// the ambience crossfades, the room behind is sealed and dropped. There is
// no going back (C3).
//
// The candidate is walked by the camera only for CARRIED moments: sitting
// down at the computer, the call, the cab's descent, the fall into the
// pool, the chute, the ending's pull-back.

import * as THREE from '../vendor/three/three.module.js';
import { renderFor, peekRenderFor, resolveEnding, commitChoice, fracture, seedRenderFromIntake } from './state.js';
import { createApplicationUI } from './application.js';
import { createFractureOverlay } from './fracture.js';
import { createCaptions } from './captions.js';
import { createLabels } from './labels.js';
import { createFrictionMeter } from './friction.js';
import { drawScreen, screenPower } from './screens.js';
import { outcomesFor, zonesOf } from './spine.js';
import { stringFor } from './text.js';
import { buildProp } from './walk/props.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / ((b - a) || 1))); return t * t * (3 - 2 * t); };
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const ENTRY_SEAL_M = 1.2;   // past the door plane before the door behind shuts
const ARRIVE_SEAL_M = 1.6;  // into the next room before its entry shuts
const ZONE_Y_TOLERANCE = 2.6;

export function createDirector({ manifest, endings, state, stage, audio = null, sfx = null, library = null, mount, onEnding = () => {} }) {
  const world = stage.world;
  const player = stage.player;
  const captions = createCaptions(mount.hud, library);
  const labels = createLabels(mount.hud, stage);
  const fractureOverlay = createFractureOverlay(mount.scene);
  const sfxPlay = (name, opts) => { if (sfx && name) for (const n of [].concat(name)) sfx.play(n, opts || {}); };
  let bailedOut = false;
  let ended = false;
  let scene = null;        // the scene being played
  let links = [];          // doorways being walked through
  let beatZones = [];      // non-choice zones: APPLY, the street's door, picking up the package
  let endingWatch = null;  // the ending room, waiting for its zone
  let endedWith = null;    // the ending the card shows, once it does
  let held = null;         // a prop in the candidate's hands (the package)
  let actorRuns = [];      // actors walking their paths
  let ride = null;         // the cab, descending
  let hint = null;
  const gone = () => bailedOut || ended;

  // ---- zones -------------------------------------------------------------

  function findZone(inst, name) { return inst ? inst.zonesWorld.find((z) => z.name === name) || null : null; }

  const _v = new THREE.Vector3();
  function zoneState(inst, z, pos, feet) {
    if (z.actor) {
      const a = inst.room.actors[z.actor];
      const [ax, az] = a ? a.at() : [z.pos[0], z.pos[z.pos.length - 1]];
      const off = z.offset || [0, 0];
      _v.set(ax + off[0], inst.rec.floorY || 0, az + off[1]).applyMatrix4(inst.matrix);
      const d = Math.hypot(pos[0] - _v.x, pos[2] - _v.z);
      return { dist: d, inside: d < z.r, inRing: d < z.ring, label: [_v.x, _v.y + 2.2, _v.z] };
    }
    if (z.box) {
      _v.set(pos[0], feet, pos[2]).applyMatrix4(inst.inv);
      const [[x0, z0], [x1, z1]] = z.box;
      const dx = Math.max(x0 - _v.x, 0, _v.x - x1), dz = Math.max(z0 - _v.z, 0, _v.z - z1);
      const d = Math.hypot(dx, dz);
      const vy = Math.abs(_v.y - (inst.rec.floorY || 0)) < ZONE_Y_TOLERANCE;
      return { dist: vy ? d : Infinity, inside: vy && d === 0, inRing: vy && d < z.ring, label: z.labelWorld };
    }
    const w = z.world;
    if (z.pos.length === 3) {
      const d = Math.hypot(pos[0] - w[0], pos[1] - w[1], pos[2] - w[2]);
      return { dist: d, inside: d < z.r, inRing: d < z.ring, label: z.labelWorld };
    }
    const d = Math.hypot(pos[0] - w[0], pos[2] - w[2]);
    const vy = Math.abs(feet - w[1]) < ZONE_Y_TOLERANCE;
    return { dist: vy ? d : Infinity, inside: vy && d < z.r, inRing: vy && d < z.ring, label: z.labelWorld };
  }

  // ---- props, lights, screens ------------------------------------------------

  function setVisible(inst, name, on) {
    if (!inst) return;
    const g = inst.room.named.get(name) || (inst.room.boxesById && inst.room.boxesById.get(name));
    if (g) g.visible = on;
  }
  function setLight(inst, id, on, seconds = 0) {
    for (const s of inst.lights) if (s.id === id) { s.off = !on; s.fadeS = seconds || 0; }
  }

  function holdProp(type, from = null) {
    dropHeld();
    const base = typeof type === 'string' ? { type } : { ...type };
    // handed over: keep the material of the prop it replaces (`hide` in the
    // same beat) -- the evidence stays photoreal paper (C1), not company paper
    if (from && from.type === base.type && from.mat && !base.mat) base.mat = from.mat;
    const g = buildProp(stage.mats, { ...base, pos: [0, 0, 0] });
    if (!g) return;
    // carried low and to the right, small in the frame
    g.position.set(0.24, -0.5, -0.75);
    g.rotation.set(0.35, -0.4, 0);
    g.scale.setScalar(0.55);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 2; } });
    stage.camera.add(g);
    held = g;
  }
  function dropHeld() {
    if (!held) return;
    stage.camera.remove(held);
    held.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    held = null;
  }

  function text(key) { return library ? stringFor(library, key) : key; }

  const PAGES = {
    posting: () => ({ bg: '#c0c0c0', fg: '#000080', font: '"Times New Roman", serif', lines: [
      { text: '[ image ]', size: 16, color: '#666', gap: 18 },
      { text: text('posting.title'), size: 34, bold: true, align: 'center', color: '#000080' },
      { text: text('posting.employer'), size: 22, align: 'center', color: '#202020', gap: 24 },
      { text: text('posting.body'), size: 17, color: '#202020' }
    ] }),
    confirm: () => ({ bg: '#c0c0c0', fg: '#202020', font: '"Times New Roman", serif', lines: [{ text: text('portal.confirm'), size: 22 }] }),
    countdown: (label, bar) => ({ bg: '#c0c0c0', fg: '#202020', font: '"Times New Roman", serif', lines: [{ text: text('portal.confirm'), size: 18, gap: 30 }, { text: label, size: 34, bold: true, align: 'center' }], bar }),
    accept: () => ({ bg: '#c0c0c0', fg: '#600000', font: '"Times New Roman", serif', lines: [{ text: text('portal.accept'), size: 24, bold: true }] }),
    harlowe: () => ({ bg: '#1d3b5a', fg: '#e0e8f0', size: 16, lines: [
      { text: text('harlowe.session'), size: 15, color: '#9fb8d0', gap: 20 },
      { text: 'resignation_final_v7.docx', size: 18, bold: true, gap: 10 },
      { text: text('harlowe.draft'), size: 18, color: '#ffffff' }
    ] }),
    requisition: () => {
      // Doc 1 §6.3: the mundane rows run all the way down; row 019 is
      // Harlowe's, in another hand, only for a candidate who read his draft.
      // The company copy never names him (text/endings.json _harloweNote).
      const m = (library && library.manifest) || {};
      const rows = m.rows || [];
      const hr = m.harloweRow;
      const lines = [{ text: text('requisition.title'), size: 15, bold: true, gap: 6 }]
        .concat(rows.map((r) => ({ text: `${r.num}  ${r.item}  ${r.qty} ${r.unit}`, size: 11, gap: 1 })));
      if (hr && state.flags.has(hr.requiresFlag || 'SAW_HARLOWE')) lines.push({ text: `${hr.num}  ${hr.item}`, size: 14, color: '#f0e0a0', font: '"Bradley Hand", "Segoe Script", "Comic Sans MS", cursive', gap: 0 });
      return { bg: '#0a0f0c', fg: '#9fe8bf', size: 11, lines };
    }
  };

  // ---- beats -------------------------------------------------------------------

  function cameraLookPose(targetWorld, { eye = null } = {}) {
    const c = stage.camera.position;
    return { pos: [c.x, eye === null ? c.y : eye, c.z], look: targetWorld, fov: stage.camera.fov, space: 'world' };
  }

  let carriedDepth = 0;
  async function carried(fn) {
    const was = carriedDepth > 0 ? true : player.isEnabled();
    carriedDepth++;
    player.disable();
    stage.setPlayerActive(false);
    try { await fn(); } finally {
      carriedDepth--;
      // nested carried beats (a `together` group) hand the camera on
      // without giving it back: re-enabling snaps him to standing height
      if (!gone() && carriedDepth === 0) {
        stage.releaseShot();
        if (was || scene) { player.enable(); stage.setPlayerActive(true); }
      }
    }
  }

  async function runBeats(beats, inst, ctx = {}) {
    for (const b of beats || []) {
      if (gone()) return;
      if (b.sfxCue) sfxPlay(b.sfxCue, b.sfxOpts);
      if (b.oneShot && audio) audio.playOneShot(b.oneShot);
      if (b.music !== undefined && audio) audio.setMusic(b.music, b.musicRender || 'C');
      if (b.caption) captions.show(b.caption, { holdMs: b.holdMs || 3000, className: b.className || '' });
      if (b.rattle) { const d = inst.room.doors.get(b.rattle); if (d) d.rattle(); }
      if (b.show) setVisible(inst, b.show, true);
      if (b.hide) setVisible(inst, b.hide, false);
      if (b.light) setLight(inst, b.light.id, b.light.on !== false, b.light.seconds);
      if (b.screen) {
        if (b.screen.page) drawScreen(inst, b.screen.prop, PAGES[b.screen.page]());
        else screenPower(inst, b.screen.prop, b.screen.on !== false, stage.mats);
      }
      if (b.setFlag) state.flags.add(b.setFlag);
      if (b.hold) { const src = b.hide && inst.room.named.get(b.hide); holdProp(b.hold, src && src.userData ? src.userData.spec : null); }
      if (b.drop) dropHeld();
      if (b.actor) startActor(inst, b.actor);
      if (b.seal) sealHeldEntry(inst);
      if (b.open) { const d = inst.room.doors.get(b.open); if (d) { const p = d.open(b.seconds || 1.2); if (b.await) await p; } }
      if (b.close) { const d = inst.room.doors.get(b.close); if (d) { const p = d.close(b.seconds || 1.0); if (b.await) await p; } }
      if (b.lookAt) {
        const g = inst.room.named.get(b.lookAt);
        if (g) {
          const p = new THREE.Vector3(); g.getWorldPosition(p);
          const target = [p.x, p.y + (b.lookY === undefined ? 1.2 : b.lookY), p.z];
          await carried(async () => {
            await stage.carry(cameraLookPose(target), { seconds: b.seconds || 1.4 });
            if (b.holdMs) await wait(b.holdMs);
          });
        }
      }
      if (b.sit) {
        const sit = b.sit === true ? {} : b.sit;
        await carried(async () => {
          const c = stage.camera.position.clone();
          const fwd = new THREE.Vector3(); stage.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
          const feet = c.y - player.eyeHeight;
          const seat = sit.into && ctx.zone && ctx.zone.seatWorld;
          if (seat) {
            // into the chair he walked up to: turn round and sit down in it
            const eye = seat.pos[1] + (sit.eye || 1.12);
            await stage.carry({ pos: [seat.pos[0], eye, seat.pos[2]], look: [seat.look[0], eye - 0.15, seat.look[2]], space: 'world' }, { seconds: sit.seconds || 1.6 });
            await wait(sit.holdMs || 1800);
            // and up again where he stood, facing the way he came in
            if (sit.stand !== false) await stage.carry({ pos: [c.x, feet + player.eyeHeight, c.z], look: [seat.look[0], feet + player.eyeHeight - 0.1, seat.look[2]], space: 'world' }, { seconds: 1.2 });
          } else {
            const eye = feet + (sit.eye || 1.12);
            const look = [c.x + fwd.x * 3, eye - 0.15, c.z + fwd.z * 3];
            await stage.carry({ pos: [c.x, eye, c.z], look, space: 'world' }, { seconds: sit.seconds || 1.2 });
            await wait(sit.holdMs || 1800);
            if (sit.stand !== false) await stage.carry({ pos: [c.x, feet + player.eyeHeight, c.z], look: [look[0], feet + player.eyeHeight - 0.1, look[2]], space: 'world' }, { seconds: 1.0 });
          }
        });
      }
      if (b.moveTo) {
        // a step taken for him (the cab's doors are closing: back inside)
        const m = b.moveTo;
        await carried(async () => {
          const c = stage.camera.position;
          const p = new THREE.Vector3(m.pos[0], inst.rec.floorY || 0, m.pos[1]).applyMatrix4(inst.matrix);
          const f = lookPoint();
          const dx = p.x - c.x, dz = p.z - c.z;
          await stage.carry({ pos: [p.x, c.y, p.z], look: [f[0] + dx, f[1], f[2] + dz], space: 'world' }, { seconds: m.seconds || 0.8 });
        });
      }
      if (b.shot) await carried(() => shotFromHere(inst, b.shot));
      if (b.ride) await rideCab(inst, b.ride);
      if (b.shake) await carried(() => stage.carry(cameraLookPose(lookPoint()), { seconds: b.shake.seconds || 0.8, shake: b.shake.amount || 0.03 }));
      // several carried beats as one move: sit {stand: false}, a thud, a
      // look, then stand -- without the controls snapping him up between
      if (b.together) await carried(() => runBeats(b.together, inst, ctx));
      if (b.waitMs) await wait(b.waitMs);
    }
  }

  function lookPoint() {
    const f = new THREE.Vector3(); stage.camera.getWorldDirection(f);
    const c = stage.camera.position;
    return [c.x + f.x * 3, c.y + f.y * 3, c.z + f.z * 3];
  }

  // A named shot, carried smoothly from wherever the camera is to the
  // shot's first pose (no jump), then played.
  async function shotFromHere(inst, name, seconds = 1.2) {
    const def = inst.rec.shots && inst.rec.shots[name];
    if (!def) return;
    if (def.from) {
      const from = typeof def.from === 'string' ? inst.rec.shots[def.from] : def.from;
      await stage.carry(from, { inst, seconds });
    }
    if (!gone()) await stage.playShot(inst, name);
  }

  function startActor(inst, spec) {
    const name = typeof spec === 'string' ? spec : spec.name;
    const a = inst.room.actors[name];
    if (!a) return;
    const speed = spec.speed || 0.6;
    // `from: 'here'` carries on from wherever he stands now
    const from = spec.from === 'here' ? (a.t === undefined ? 0 : a.t) : spec.from === undefined ? 0 : spec.from;
    const to = spec.to === undefined ? 1 : spec.to;
    actorRuns = actorRuns.filter((r) => r.actor !== a);
    // rate in path-fraction per second: `speed` metres per second along a path `length` long
    actorRuns.push({ inst, actor: a, t: from, to, rate: speed / Math.max(0.1, a.length), dir: Math.sign(to - from) || 1, stopNear: spec.stopNear || 0, resumeAt: spec.resumeAt || (spec.stopNear ? spec.stopNear + 0.8 : 0), held: false });
    a.set(from);
    a.t = from;
  }

  // The freight cab: it really goes down. The cab (and the candidate in it)
  // moves; the connector it was entered from is gone above.
  // `stops`: [{at: 0..1, show, hide, sfxCue, light, caption}] -- beats run
  // as the ride passes them (the floor indicator counting down), inside one
  // continuous eased drop and one motor cue.
  function rideCab(inst, { drop = 14, seconds = 12, shake = 0.012, stops = [], motor = true } = {}) {
    return carried(() => new Promise((resolve) => {
      if (motor) sfxPlay('elevator-motor', { durationMs: seconds * 1000 });
      const m0 = inst.matrix.clone();
      const y0 = m0.elements[13];
      const camY0 = stage.camera.position.y;
      stage.carry(cameraLookPose(lookPoint()), { seconds: 0.01 });
      ride = { inst, m0, y0, camY0, drop, seconds, shake, t: 0, resolve, stops: stops.slice().sort((a, b) => a.at - b.at) };
    }));
  }
  function stepRide(dt) {
    const r = ride;
    r.t += dt / r.seconds;
    const u = Math.min(1, r.t);
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const dy = -r.drop * e;
    const m = r.m0.clone();
    m.elements[13] = r.y0 + dy;
    world.move(r.inst, m);
    stage.camera.position.y = r.camY0 + dy + Math.sin(stage.elapsed() * 31) * r.shake * (1 - Math.abs(2 * u - 1));
    while (r.stops.length && u >= r.stops[0].at) runBeats([r.stops.shift()], r.inst);
    if (u >= 1) {
      ride = null;
      // the ride's held pose is from the top of the shaft: hold the camera
      // where it has arrived, so a carried beat after it (inside a
      // `together`) does not put him back up there
      stage.carry(cameraLookPose(lookPoint()), { seconds: 0.01 });
      r.resolve();
    }
  }

  // ---- links: walking from one room into the next ------------------------------

  function openWay(fromInst, exitName, viaKey, toKey, opts = {}) {
    const conn = world.attach(fromInst, exitName, viaKey);
    const dest = world.attach(conn, 'exit', toKey, { entry: opts.entry || null });
    conn.link = { from: fromInst, to: dest, fromEnv: fromInst.env };
    dest.lightLevel = 0;
    dest.lightTarget = 0;
    conn.lightLevel = 0;
    conn.lightTarget = opts.viaDark ? 0 : 1;
    const entryDoor = dest.room.doors.get(dest.entryName);
    if (entryDoor) entryDoor.open(0.01);
    const exitDoor = fromInst.room.doors.get(exitName);
    const L = { from: fromInst, conn, dest, exitName, seal1: false, seal2: false, boundary: false, enteredConn: false, opts, hiddenSeal: null };
    const seal = conn.room.doors.get('entry');
    if (exitDoor && exitDoor.kind !== 'open' && seal && seal.kind !== 'open') {
      seal.group.visible = false;
      L.hiddenSeal = seal;
    }
    links.push(L);
    stage.warm();
    if (exitDoor) exitDoor.open(opts.openSeconds || 1.3);
    return L;
  }

  function dropRoom(inst) {
    beatZones = beatZones.filter((b) => b.inst !== inst);
    actorRuns = actorRuns.filter((r) => r.inst !== inst);
    for (const L of links.slice()) {
      if (L.from === inst && L.seal1) continue;
      if (L.from === inst) { world.remove(L.conn); world.remove(L.dest); links.splice(links.indexOf(L), 1); }
    }
    world.remove(inst);
  }

  function stepLink(L, pos) {
    const cur = world.current();
    if (cur === L.conn && !L.enteredConn) {
      L.enteredConn = true;
      L.conn.lightTarget = 1;
      L.dest.lightTarget = 1;
      if (L.opts.onEnterConn) L.opts.onEnterConn(L);
    }
    const entry = L.conn.anchorsWorld.entry;
    if (!L.seal1 && cur === L.conn && entry && dist2(pos, entry.pos) > ENTRY_SEAL_M) {
      L.seal1 = true;
      const seal = L.conn.room.doors.get('entry');
      const exitDoor = L.from.room.doors.get(L.exitName);
      if (exitDoor) exitDoor.close(0.9);
      L.from.lightTarget = 0;
      sfxPlay('door-thud');
      (seal && seal.kind !== 'open' ? seal.close(0.9) : wait(900)).then(() => {
        if (gone()) return;
        dropRoom(L.from);
        if (L.hiddenSeal) { L.hiddenSeal.group.visible = true; L.hiddenSeal = null; }
        if (L.opts.onSeal1) L.opts.onSeal1(L);
      });
    }
    if (!L.boundary && L.opts.boundaryAt !== 'seal2' && cur === L.conn && world.progress(L.conn, pos) >= 0.5) {
      L.boundary = true;
      if (L.opts.onBoundary) L.opts.onBoundary(L.dest, L);
    }
    if (!L.seal2 && cur === L.dest) {
      const e = L.dest.anchorsWorld[L.dest.entryName];
      // a room that holds its entry open (the cab) holds it from the moment
      // he is inside: DESCEND is nearer the doorway than the seal distance
      if (L.dest.rec.holdEntry || !e || dist2(pos, e.pos) > ARRIVE_SEAL_M) {
        L.seal2 = true;
        if (L.dest.rec.holdEntry) {
          L.held = true; // the cab's doors stay open until the choice
        } else {
          const door = L.dest.room.doors.get(L.dest.entryName);
          if (L.opts.onSeal2) L.opts.onSeal2(L);
          (door && door.kind !== 'open' ? door.close(1.1) : wait(800)).then(() => {
            if (gone()) return;
            world.remove(L.conn);
            links = links.filter((x) => x !== L);
          });
          if (door && door.kind !== 'open') sfxPlay('door-thud');
        }
        if (!L.boundary) {
          L.boundary = true;
          if (L.opts.onBoundary) L.opts.onBoundary(L.dest, L);
        }
      }
    }
  }

  // A room that holds its entry open (the cab) closes it when the choice is made.
  function sealHeldEntry(inst) {
    for (const L of links.slice()) {
      if (L.dest !== inst || !(L.held || (!L.seal2 && inst.rec.holdEntry))) continue;
      L.seal2 = true;
      const door = inst.room.doors.get(inst.entryName);
      if (door && door.kind !== 'open') door.close(1.0);
      L.held = false;
      wait(1100).then(() => { world.remove(L.conn); links = links.filter((x) => x !== L); });
    }
  }

  // ---- scenes ----------------------------------------------------------------

  function oppositeRecord(sceneId, letter) {
    const sc = manifest.scenes[sceneId];
    const other = letter === 'C' ? 'H' : 'C';
    const b = sc && sc.branches[other];
    return b ? world.record(b.room) : null;
  }

  function prefetchOutcomes(sceneId, branch) {
    const outs = outcomesFor(state, manifest, endings, sceneId, branch);
    const keys = new Set();
    for (const o of Object.values(outs)) {
      if (o.room) keys.add(o.room);
      if (o.endingRoom) keys.add(o.endingRoom);
    }
    let delay = 400;
    for (const k of keys) {
      if (world.baseOf(k) === (scene && scene.inst.base)) continue;
      setTimeout(() => { if (!gone()) world.prebuild(k).catch((e) => console.warn('director: prebuild failed', k, e)); }, delay);
      delay += 700;
    }
    return outs;
  }

  function enterScene(sceneId, inst) {
    if (gone()) return;
    const sc = manifest.scenes[sceneId];
    const letter = renderFor(state);
    const branch = sc.branches[letter];
    if (world.baseOf(branch.room) !== inst.base) console.warn(`director: ${sceneId} ${letter} expects ${branch.room}, standing in ${inst.key}`);
    state.sceneIndex = manifest.spineOrder.indexOf(sceneId);
    captions.clear();
    labels.clear();
    if (!branch.keepHeld) dropHeld();
    if (audio) {
      audio.resumeIfSuspended();
      audio.advanceScene(state.sceneIndex);
      if (branch.ambience) audio.playAmbience(branch.ambience, { crossfadeMs: 2500 });
      const music = branch.music !== undefined ? branch.music : sc.music;
      audio.setMusic(music === undefined ? null : music, letter);
    }
    sfxPlay(branch.sfxCue);
    captions.schedule(branch.captions);
    fractureOverlay.apply(fracture(state), oppositeRecord(sceneId, letter));
    const pos = player.position();
    const feet = pos[1] - player.eyeHeight;
    const thresholds = ['succumb', 'resist'].filter((k) => branch.thresholds && branch.thresholds[k]).map((key) => {
      const th = branch.thresholds[key];
      const zones = zonesOf(th).map((n) => findZone(inst, n)).filter(Boolean);
      if (!zones.length) console.warn(`director: ${sceneId} ${letter} ${key}: no zone ${th.zone} in ${inst.key}`);
      return { id: `${sceneId}:${key}`, key, th, zones, approached: false };
    });
    const startInside = new Set();
    for (const T of thresholds) for (const z of T.zones) if (zoneState(inst, z, pos, feet).inside) startInside.add(z.name);
    scene = { id: sceneId, letter, branch, inst, meter: createFrictionMeter(branch.friction || {}), reached: new Set(), armed: false, committing: false, thresholds, startInside, armedT: 0, idleDone: false, stillT: 0, stillDone: false, lastPos: null };
    for (const bz of branch.beatZones || []) beatZones.push({ inst, zone: bz.zone, label: bz.label || null, beats: bz.beat, once: bz.once !== false, done: false, scene: sceneId });
    const outs = prefetchOutcomes(sceneId, branch);
    scene.outcomes = outs;
    const mine = scene;
    runBeats(branch.onEnter, inst).then(() => { if (scene === mine && !gone()) mine.armed = true; });
  }

  async function commit(key, zone = null) {
    const sc = scene;
    if (!sc || sc.committing) return;
    sc.committing = true;
    sc.armed = false;
    const th = sc.branch.thresholds[key];
    for (const T of sc.thresholds) { if (T.key === key) labels.stamp(T.id); else labels.remove(T.id); }
    commitChoice(state, key === 'succumb' ? 1 : -1);
    if (th.setFlag) state.flags.add(th.setFlag);
    state.friction = Math.min(8, state.friction + sc.meter.value());
    state.dwell[state.sceneIndex] = sc.meter.seconds();
    sfxPlay(th.sfxCue);
    await runBeats(th.beat, sc.inst, { zone });
    if (gone()) return;
    const next = sc.branch.next;
    if (next === 'E') { toEnding(sc, th); return; }
    const letter = peekRenderFor(state);
    const nb = manifest.scenes[next].branches[letter];
    if (th.via === 'fall') { fallInto(sc, th, nb, next); return; }
    if (world.baseOf(nb.room) === sc.inst.base) { enterScene(next, sc.inst); return; }
    sealHeldEntry(sc.inst);
    openWay(sc.inst, th.exit, th.via, nb.room, {
      viaDark: !!th.viaDark,
      onEnterConn: () => { captions.clear(); if (audio) audio.stopOneShots({ ms: 400 }); },
      onBoundary: (dest) => enterScene(next, dest)
    });
  }

  // S7 H -> S8 H: off the lip, into the water; the dive is joined under the
  // edge's water and the candidate falls into it. Splashing in is the
  // scene boundary.
  async function fallInto(sc, th, nb, next) {
    const edge = sc.inst;
    const dive = world.attach(edge, th.exit || 'drop', nb.room);
    dive.lightLevel = 0;
    dive.lightTarget = 1;
    player.disable();
    stage.setPlayerActive(false);
    await shotFromHere(edge, th.fallShot || 'fall', 1.4);
    if (gone()) return;
    sfxPlay('splash');
    if (audio) audio.duckDrone({ lowpassHz: 500, gain: 0.7, ms: 900 }); // underwater: filtered, never stopped (C7)
    world.setCurrent(dive);
    enterScene(next, dive);
    await stage.playShot(dive, 'sink');
    if (gone()) return;
    dropRoom(edge);
    startSwim(dive);
  }

  function startSwim(inst) {
    const sw = inst.rec.swim;
    const y0 = inst.matrix.elements[13];
    if (sw) player.setSwim({ floorY: y0 + sw.floorY, ceilingY: y0 + sw.ceilingY });
    stage.releaseShot();
    player.enable();
    stage.setPlayerActive(true);
  }

  // S8 H: through the grate, down the chute, out onto the store's linoleum.
  async function chuteTo(dive, storeKey) {
    player.disable();
    stage.setPlayerActive(false);
    player.setSwim(null);
    await world.prebuild(storeKey);
    if (gone()) return null;
    const chute = world.attach(dive, 'grate', 'CN_CHUTE', { entry: 'top' });
    const store = world.attach(chute, 'exit', storeKey);
    chute.link = { from: dive, to: store };
    store.lightLevel = 0;
    store.lightTarget = 1;
    await shotFromHere(dive, 'grate', 1.6);
    if (gone()) return store;
    if (audio) audio.restoreDrone({ ms: 1500 });
    sfxPlay('chute-scrape');
    const top = chute.anchorsWorld.top.pos;
    const ex = chute.anchorsWorld.exit.pos;
    await stage.carry({ pos: [top[0], top[1] - 0.2, top[2]], look: [ex[0], ex[1] + 0.4, ex[2]], space: 'world' }, { seconds: 0.7, ease: 'in' });
    if (gone()) return store;
    dropRoom(dive);
    world.setCurrent(chute);
    const land = store.rec.shots.land;
    const landFrom = world.poseToWorld(store, land.from);
    await stage.carry({ pos: [ex[0], ex[1] + 0.45, ex[2]], look: landFrom.look, space: 'world' }, { seconds: 1.5, ease: 'in' });
    if (gone()) return store;
    if (audio) audio.playAmbience('S8_H_AMB_STORE.wav', { crossfadeMs: 900 });
    world.setCurrent(store);
    await stage.playShot(store, 'land');
    if (gone()) return store;
    world.remove(chute);
    stage.releaseShot();
    player.enable();
    stage.setPlayerActive(true);
    return store;
  }

  // ---- endings -------------------------------------------------------------

  async function toEnding(sc, th) {
    const endingId = resolveEnding(state);
    const ending = endings[endingId];
    if (th.to && world.baseOf(th.to) !== sc.inst.base) {
      const store = await chuteTo(sc.inst, th.to);
      if (store && !gone()) arriveForEnding(store, endingId, ending);
      return;
    }
    if (world.baseOf(ending.room) === sc.inst.base) { arriveForEnding(sc.inst, endingId, ending); return; }
    sealHeldEntry(sc.inst);
    openWay(sc.inst, th.exit, th.via, ending.room, {
      onEnterConn: () => captions.clear(),
      onBoundary: (dest) => arriveForEnding(dest, endingId, ending)
    });
  }

  function arriveForEnding(inst, endingId, ending) {
    if (gone()) return;
    if (world.baseOf(ending.room) !== inst.base) {
      // a way on first (the store's staff door, toward the waiting room)
      const route = ending.routes && ending.routes[inst.base];
      if (route) {
        openWay(inst, route.exit, route.via, ending.room, { onBoundary: (dest) => arriveForEnding(dest, endingId, ending) });
        return;
      }
    }
    scene = null;
    labels.clear();
    if (audio) {
      audio.setMusic(null);
      if (ending.ambience) audio.playAmbience(ending.ambience, { crossfadeMs: 2000 });
    }
    for (const o of ending.flagOverlays || []) {
      if (o.flag && state.flags.has(o.flag)) for (const n of o.hide || []) setVisible(inst, n, false);
    }
    endingWatch = { inst, endingId, ending, zone: findZone(inst, ending.zone), t: 0, playing: false };
  }

  async function playEnding(w) {
    w.playing = true;
    endingWatch = null;
    labels.clear();
    player.disable({ releasePointer: true });
    stage.setPlayerActive(false);
    const inst = w.inst;
    const ending = w.ending;
    // whatever he carried in (the package, after DELIVER) is gone before he
    // sits; ASSIMILATION's own copy of it is the room's, under flagOverlays
    dropHeld();
    if (ending.preShot) await shotFromHere(inst, ending.preShot, 1.0);
    if (gone()) return;
    // seated, the props are in place before anything happens (PENDING: the
    // 99 slip already in his hands); not before the preShot, or they would
    // float over the empty chair while he walks up to it
    for (const n of ending.show || []) setVisible(inst, n, true);
    // the room's own last moment (PENDING: the speaker clicks, "One hundred.",
    // the Muzak starts its eight bars again)
    if (ending.beats) await runBeats(ending.beats, inst);
    if (gone()) return;
    await shotFromHere(inst, ending.shot, ending.carrySeconds || 2.0);
    if (gone()) return;
    await wait((ending.holdSeconds || 4) * 1000);
    jumpToEnding(w.endingId);
  }

  async function jumpToEnding(endingId) {
    if (ended) return;
    ended = true;
    endedWith = endingId;
    scene = null;
    endingWatch = null;
    captions.stop();
    labels.clear();
    if (hint) hint.remove();
    if (audio) audio.fadeOutForEnding();
    fractureOverlay.destroy && fractureOverlay.destroy();
    await stage.blackout(1.2);
    onEnding(endingId);
  }

  // ---- S0: the apartment, the computer, the stairs, the street ----------------

  function positionLayer(layer, rect) {
    if (!rect) return;
    // clipped to the viewport: on a portrait phone the CRT is wider than the
    // screen, and the answers must stay readable
    const x0 = Math.max(0, rect.x), y0 = Math.max(0, rect.y);
    const x1 = Math.min(1, rect.x + rect.w), y1 = Math.min(1, rect.y + rect.h);
    if (x1 <= x0 || y1 <= y0) return;
    layer.style.left = `${(x0 * 100).toFixed(2)}%`;
    layer.style.top = `${(y0 * 100).toFixed(2)}%`;
    layer.style.width = `${((x1 - x0) * 100).toFixed(2)}%`;
    layer.style.height = `${((y1 - y0) * 100).toFixed(2)}%`;
  }

  function showHint() {
    hint = document.createElement('div');
    hint.className = 'walk-hint';
    const touch = player.touchEnabled();
    hint.textContent = touch ? 'LEFT THUMB WALKS · RIGHT THUMB LOOKS' : 'CLICK TO LOOK · W A S D WALKS · SHIFT HURRIES';
    mount.hud.appendChild(hint);
    setTimeout(() => hint && hint.classList.add('walk-hint-out'), 9000);
  }

  // A touch's pointerdown/touchstart do not grant user activation (only
  // pointerup / touchend / click / keydown do), so listen for all of them
  // and stop only once the context is actually running.
  function unlockOnGesture(branch) {
    const types = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
    const off = () => types.forEach((t) => document.removeEventListener(t, on, true));
    const on = () => {
      if (!audio) { off(); return; }
      audio.unlock();
      if (!gone() && scene && scene.id === 'S0' && world.current() && world.current().base === world.baseOf(branch.room)) audio.playAmbience(branch.ambience);
      const ctx = audio.getContext && audio.getContext();
      if (!ctx || ctx.state === 'running') off();
      else if (ctx.resume) ctx.resume().then(() => { if (ctx.state === 'running') off(); }).catch(() => {});
    };
    types.forEach((t) => document.addEventListener(t, on, true));
  }

  async function startS0() {
    const branch = manifest.scenes.S0.branches.X;
    state.sceneIndex = 0;
    await world.prebuild(branch.room);
    if (gone()) return;
    const apt = world.spawn(branch.room);
    world.setCurrent(apt);
    const sp = apt.room.spawn;
    player.teleport(sp.x, apt.rec.floorY || 0, sp.z, sp.yaw);
    player.enable();
    stage.setPlayerActive(true);
    drawScreen(apt, 'terminal', PAGES.posting());
    showHint();
    unlockOnGesture(branch);
    if (audio) audio.setMusic(null, 'C');
    scene = { id: 'S0', letter: 'X', branch, inst: apt, meter: createFrictionMeter(), reached: new Set(), armed: false, committing: false, thresholds: [], startInside: new Set() };
    beatZones.push({ inst: apt, zone: branch.start.zone, label: branch.start.label, once: true, done: false, run: () => applicationBeat(apt, branch) });
    setTimeout(() => { if (!gone()) world.prebuild(branch.out.to).catch(() => {}); }, 2500);
  }

  async function applicationBeat(apt, branch) {
    player.disable({ releasePointer: true });
    stage.setPlayerActive(false);
    if (hint) hint.classList.add('walk-hint-out');
    setVisible(apt, 'hands', true);
    await stage.carry(apt.rec.shots[branch.start.sit], { inst: apt, seconds: 1.6 });
    if (gone()) return;
    await stage.carry(apt.rec.shots[branch.start.lean], { inst: apt, seconds: 1.2 });
    if (gone()) return;
    // The form, laid over the CRT's screen (application.js).
    const layer = mount.screen;
    layer.hidden = false;
    const unfollow = stage.onFrame(() => positionLayer(layer, stage.screenRect(apt, 'terminal')));
    const ui = createApplicationUI(layer);
    const { answers, refusals } = await ui.presentForm({
      onSubmitGesture: () => {
        if (audio) { audio.unlock(); audio.playAmbience(branch.ambience); }
        sfxPlay('keyboard-press');
      }
    });
    if (gone()) return;
    state.formAnswers = { ...state.formAnswers, ...answers };
    seedRenderFromIntake(state, refusals);
    const s1 = manifest.scenes.S1.branches[peekRenderFor(state)].room;
    setTimeout(() => { if (!gone()) world.prebuild(s1).catch(() => {}); }, 300);
    layer.replaceChildren();
    layer.hidden = true;
    unfollow();
    await stage.carry(apt.rec.shots[branch.start.sit], { inst: apt, seconds: 1.0 });
    if (gone()) return;
    // The portal answers on the screen itself (Doc 1 §5 S0): received, three
    // seconds of nothing, ACCEPTED. The window cannot be closed.
    drawScreen(apt, 'terminal', PAGES.confirm());
    await wait(2400);
    const steps = ui.countdownSteps();
    for (let i = 0; i < steps.length; i++) {
      drawScreen(apt, 'terminal', PAGES.countdown(steps[i], i / (steps.length - 1)));
      await wait(ui.countdownStepMs());
    }
    drawScreen(apt, 'terminal', PAGES.accept());
    await wait(2600);
    if (gone()) return;
    await world.prebuild(branch.out.to);
    if (gone()) return;
    sfxPlay('deadbolt');
    await stage.carry(apt.rec.shots[branch.start.stand], { inst: apt, seconds: 2.2 });
    if (gone()) return;
    setVisible(apt, 'hands', false);
    stage.releaseShot();
    player.enable();
    stage.setPlayerActive(true);
    openWay(apt, branch.out.exit, branch.out.via, branch.out.to, {
      onEnterConn: () => { if (audio) audio.playAmbience(branch.out.ambience, { crossfadeMs: 4000 }); },
      onBoundary: (street) => {
        scene = { ...scene, inst: street };
        beatZones.push({ inst: street, zone: branch.report.zone, label: branch.report.label, once: true, done: false, run: () => reportBeat(street, branch) });
      }
    });
  }

  async function reportBeat(street, branch) {
    const letter = peekRenderFor(state);
    const s1 = manifest.scenes.S1.branches[letter].room;
    await world.prebuild(s1);
    if (gone()) return;
    sfxPlay('door-buzz');
    openWay(street, branch.report.exit, branch.report.via, s1, {
      openSeconds: 1.0,
      boundaryAt: 'seal2',
      // C7: the drone begins when the lobby doors close behind him, and
      // never restarts. One start() for the whole game (audio.js).
      onSeal2: () => { if (audio) audio.startDrone(); },
      onBoundary: (lobby) => enterScene('S1', lobby)
    });
  }

  // ---- per frame ---------------------------------------------------------------

  function tick(dt) {
    labels.update(dt);
    if (gone()) return;
    const pos = player.position();
    const feet = pos[1] - player.eyeHeight;
    for (const r of actorRuns.slice()) {
      if (r.stopNear) {
        // he stops when the candidate is near and walks on once he is clear
        const [ax, az] = r.actor.at();
        _v.set(ax, r.inst.rec.floorY || 0, az).applyMatrix4(r.inst.matrix);
        const d = Math.hypot(pos[0] - _v.x, pos[2] - _v.z);
        if (r.held ? d < r.resumeAt : d < r.stopNear) { r.held = true; continue; }
        r.held = false;
      }
      r.t += r.dir * r.rate * dt;
      const done = r.dir > 0 ? r.t >= r.to : r.t <= r.to;
      r.actor.set(done ? r.to : r.t);
      r.actor.t = done ? r.to : r.t;
      if (done) actorRuns.splice(actorRuns.indexOf(r), 1);
    }
    for (const L of links.slice()) stepLink(L, pos);

    // beat zones (APPLY, the street door, the package)
    for (const B of beatZones) {
      if (B.done || !B.inst || !world.instances().includes(B.inst)) continue;
      const z = findZone(B.inst, B.zone);
      if (!z) continue;
      if (z.armAfter && !(scene && scene.reached.has(z.armAfter))) continue;
      const st = zoneState(B.inst, z, pos, feet);
      if (B.label) labels.set(`beat:${B.zone}`, B.label, st.label, 1 - smoothstep(z.r + 0.3, z.ring, st.dist));
      if (st.inside && player.isEnabled()) {
        if (scene) scene.reached.add(B.zone);
        if (B.once) B.done = true;
        if (B.label) labels.stamp(`beat:${B.zone}`);
        if (B.run) B.run(); else runBeats(B.beats, B.inst);
      }
    }

    // the scene's thresholds
    if (scene && scene.inst && scene.thresholds.length) {
      const sc = scene;
      const inst = sc.inst;
      for (const z of inst.zonesWorld) {
        const st = zoneState(inst, z, pos, feet);
        if (st.inside) sc.reached.add(z.name);
        else sc.startInside.delete(z.name);
      }
      let ringKey = null;
      let commitKey = null;
      let commitZone = null;
      if (sc.armed && !sc.committing) {
        for (const T of sc.thresholds) {
          let best = null;
          for (const z of T.zones) {
            if (z.armAfter && !sc.reached.has(z.armAfter)) continue;
            const st = zoneState(inst, z, pos, feet);
            if (!best || st.dist < best.dist) best = { ...st, z };
          }
          if (!best) { labels.set(T.id, T.th.label, [0, -999, 0], 0); continue; }
          labels.set(T.id, T.th.label, best.label, best.z.silent ? 0 : 1 - smoothstep(best.z.r + 0.3, best.z.ring, best.dist));
          if (best.inRing) {
            ringKey = T.key;
            if (!T.approached) { T.approached = true; if (T.th.approach) runBeats(T.th.approach, inst); }
          }
          if (best.inside && !sc.startInside.has(best.z.name) && player.isEnabled() && !commitKey) { commitKey = T.key; commitZone = best.z; }
        }
      }
      sc.meter.tick(dt, { ring: ringKey, active: sc.armed && player.isEnabled() && !document.hidden });
      if (commitKey) commit(commitKey, commitZone);
      else if (sc.armed && !sc.committing && player.isEnabled()) timers(sc, dt, pos);
    }

    // the ending room
    if (endingWatch && !endingWatch.playing) {
      const w = endingWatch;
      w.t += dt;
      const st = w.zone ? zoneState(w.inst, w.zone, pos, feet) : { inside: false, dist: Infinity };
      if (w.zone && w.ending.label) labels.set('ending', w.ending.label, st.label, 1 - smoothstep(w.zone.r + 0.3, w.zone.ring, st.dist));
      if ((st.inside && player.isEnabled()) || w.t > (w.ending.autoSeconds || 90)) playEnding(w);
    }
  }
  // `idle`: {seconds, beat, commit} -- nothing chosen for that long: the
  // speaker repeats the line, or the choice is made for him (the cab's 25 s
  // gives REFUSE). `stillness`: {seconds, beat} -- he has not moved for that
  // long (S4 H: a door swings wider).
  function timers(sc, dt, pos) {
    const b = sc.branch;
    // `idle.after`: the clock only runs once he has reached that zone (S7 C:
    // inside the cab, not in the corridor still walking to it)
    if (b.idle && !sc.idleDone && (!b.idle.after || sc.reached.has(b.idle.after))) {
      sc.armedT += dt;
      if (sc.armedT >= b.idle.seconds) {
        sc.idleDone = true;
        runBeats(b.idle.beat, sc.inst);
        if (b.idle.commit && b.thresholds[b.idle.commit]) commit(b.idle.commit);
      }
    }
    if (b.stillness && !sc.stillDone) {
      const moved = sc.lastPos ? Math.hypot(pos[0] - sc.lastPos[0], pos[2] - sc.lastPos[2]) : 0;
      sc.lastPos = pos;
      sc.stillT = moved > 0.02 ? 0 : sc.stillT + dt;
      if (sc.stillT >= b.stillness.seconds) { sc.stillDone = true; runBeats(b.stillness.beat, sc.inst); }
    }
  }

  stage.onFrame(tick);
  stage.onPreFrame((dt) => { if (ride && !gone()) stepRide(dt); });

  // Walking into a locked door: it shudders and rattles. A branch may count
  // the pushes (S3 H: thirty-one and the building remarks on it).
  let lastBump = { door: null, at: -10 };
  const bumpCounts = new Map();
  stage.setBumpHandler((obj) => {
    if (gone() || !obj || !obj.userData || !obj.userData.doorBody) return;
    const inst = world.instances().find((i) => i.room.walls.includes(obj));
    if (!inst) return;
    const name = obj.userData.doorBody;
    const door = inst.room.doors.get(name);
    if (!door || !door.locked) return;
    const now = stage.elapsed();
    if (lastBump.door === door && now - lastBump.at < 0.6) { lastBump.at = now; return; }
    lastBump = { door, at: now };
    door.rattle();
    sfxPlay('door-rattle', { gain: 0.6 });
    const bc = scene && scene.branch && scene.branch.bumpCount;
    if (bc && bc.door === name && scene.inst === inst) {
      const n = (bumpCounts.get(scene.id) || 0) + 1;
      bumpCounts.set(scene.id, n);
      // `show`: {count: propName} -- more handprints on the glass as he pushes
      for (const [k, prop] of Object.entries(bc.show || {})) if (n === Number(k)) setVisible(inst, prop, true);
      if (n === bc.at) {
        if (bc.setFlag) state.flags.add(bc.setFlag);
        if (bc.friction) state.friction = Math.min(8, state.friction + bc.friction);
        if (bc.caption) captions.show(bc.caption, { holdMs: 3200, className: 'scene-caption-receptionist' });
      }
    }
  });

  // Dev only: a room that holds its entry open (the cab, the store) is
  // normally walked into, its doors open behind him until the choice. Put a
  // connector from the previous scene behind it, as if he had just come in.
  function devArrival(sceneId, letter, inst) {
    const prev = manifest.scenes[manifest.spineOrder[manifest.spineOrder.indexOf(sceneId) - 1]];
    const branches = prev ? [prev.branches[letter], ...Object.values(prev.branches)].filter(Boolean) : [];
    let via = null;
    for (const b of branches) for (const th of Object.values(b.thresholds || {})) if (!via && th.via) via = th.via;
    if (!via) return;
    let conn;
    try { conn = world.attach(inst, inst.entryName, via, { entry: 'exit' }); } catch (err) { console.warn('[director] dev arrival:', err.message); return; }
    conn.link = { from: null, to: inst };
    const far = conn.room.doors.get('entry');
    if (far && far.kind !== 'open') far.close(0.01);
    const door = inst.room.doors.get(inst.entryName);
    if (door) door.open(0.01);
    links.push({ from: null, conn, dest: inst, exitName: null, seal1: true, seal2: true, boundary: true, enteredConn: true, held: true, opts: {} });
  }

  // Dev only (?start=S5&render=H): put the candidate straight into a scene,
  // standing just inside its room's entry, with a score that gives that
  // render. The rest of the game plays on from there as normal.
  async function startAt(sceneId, letter = 'C') {
    const sc = manifest.scenes[sceneId];
    if (!sc || sceneId === 'S0') return startS0();
    const L = sc.branches[letter] ? letter : 'C';
    const n = manifest.spineOrder.indexOf(sceneId);
    state.lastRender = L;
    state.conformance = (n - 1) % 2 === 1 ? (L === 'C' ? 1 : -1) : 0;
    state.lastPolarity = state.conformance === 0 ? null : (L === 'C' ? 1 : -1);
    const branch = sc.branches[L];
    await world.prebuild(branch.room);
    const inst = world.spawn(branch.room);
    inst.entryName = inst.entryName || inst.rec.entry;
    world.setCurrent(inst);
    if (inst.rec.holdEntry) devArrival(sceneId, L, inst);
    const e = inst.anchorsWorld[inst.entryName];
    if (inst.rec.swim) {
      const y0 = inst.matrix.elements[13];
      player.teleport(0, y0 + inst.rec.size[1] - 3, 0, 0);
      startSwim(inst);
    } else if (e && !inst.room.anchors[inst.entryName].vertical) {
      const y = (e.yaw + 180) * Math.PI / 180;
      player.teleport(e.pos[0] - Math.sin(y) * 1.8, e.pos[1], e.pos[2] - Math.cos(y) * 1.8, e.yaw + 180);
    } else {
      const sp = inst.room.spawn;
      player.teleport(sp.x, inst.rec.floorY || 0, sp.z, sp.yaw);
    }
    player.enable();
    stage.setPlayerActive(true);
    unlockOnGesture(manifest.scenes.S0.branches.X);
    if (audio) { audio.unlock(); audio.startDrone({ fadeMs: 400 }); }
    enterScene(sceneId, inst);
  }

  return {
    start(sceneId = 'S0', letter = 'C') {
      if (sceneId !== 'S0') return startAt(sceneId, letter);
      return startS0();
    },
    bail() {
      if (ended) return;
      state.flags.add('EARLY_EXIT');
      // Doc 4 §9: "quitting is an ending, not an exit" -- PENDING REVIEW.
      jumpToEnding(resolveEnding(state));
    },
    jumpToEnding,
    // Dev / test hooks: where the thresholds are, what state the scene is in.
    _debug() {
      const pos = player.position();
      const feet = pos[1] - player.eyeHeight;
      const targets = [];
      if (scene && scene.inst) {
        for (const T of scene.thresholds) for (const z of T.zones) {
          const st = zoneState(scene.inst, z, pos, feet);
          const p = z.actor ? st.label : z.world;
          targets.push({ kind: 'threshold', key: T.key, label: T.th.label, zone: z.name, world: z.box ? centerOfBox(scene.inst, z) : p, armed: scene.armed && (!z.armAfter || scene.reached.has(z.armAfter)), armAfter: z.armAfter || null, dist: st.dist });
        }
      }
      for (const B of beatZones) {
        if (B.done) continue;
        const z = findZone(B.inst, B.zone);
        if (z) targets.push({ kind: 'beat', zone: z.name, label: B.label, world: z.world, armAfter: z.armAfter || null });
      }
      if (endingWatch && endingWatch.zone) targets.push({ kind: 'ending', zone: endingWatch.zone.name, world: endingWatch.zone.world });
      return {
        scene: scene ? scene.id : null,
        render: scene ? scene.letter : null,
        armed: scene ? scene.armed : false,
        committing: scene ? scene.committing : false,
        reached: scene ? [...scene.reached] : [],
        links: links.map((L) => {
          const a = (inst, name) => (inst && name && inst.anchorsWorld[name] ? { pos: inst.anchorsWorld[name].pos, yaw: inst.anchorsWorld[name].yaw } : null);
          return { from: L.from ? L.from.key : null, conn: L.conn.key, dest: L.dest.key, seal1: L.seal1, seal2: L.seal2, boundary: L.boundary, held: !!L.held, exit: a(L.from, L.exitName), connExit: a(L.conn, 'exit'), destEntry: a(L.dest, L.dest.entryName) };
        }),
        targets,
        ending: endedWith || (endingWatch ? endingWatch.endingId : null),
        ended,
        playerEnabled: player.isEnabled(),
        position: pos,
        state: { conformance: state.conformance, dissonance: state.dissonance, friction: +state.friction.toFixed(3), flags: [...state.flags], lastRender: state.lastRender, sceneIndex: state.sceneIndex },
        world: world._debug(),
        labels: labels._debug()
      };
    }
  };

  function centerOfBox(inst, z) {
    const [[x0, z0], [x1, z1]] = z.box;
    const p = new THREE.Vector3((x0 + x1) / 2, inst.rec.floorY || 0, (z0 + z1) / 2).applyMatrix4(inst.matrix);
    return [p.x, p.y, p.z];
  }
}
