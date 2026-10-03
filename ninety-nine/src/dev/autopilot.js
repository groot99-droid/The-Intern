// Dev-only: walks the candidate through the game by himself, for the
// headless walkthrough (tools/walkthrough.cjs) and for watching a path
// play out. Loaded by main.js only when the page URL has ?autopilot=...
//
//   ?autopilot=SSRRSSRR    one letter per scene S1..S8: S succumb, R resist
//   &seed=H                answer the application NOT WILLING (hostile start)
//   &bail=S4               press EXIT on reaching that scene
//   &speed=2.5             walking speed multiplier
//
// It steers the real controls (setLook / setMoveAxis), so it walks through
// exactly what a player would -- the same colliders, the same zones, the
// same doors. Routes inside a room come from a navigation grid built by
// raycasting the room's own colliders (the same rays controls.js uses),
// with A* over it; connectors are walked straight down their middle.
// Everything it does is logged as `[autopilot] ...` lines.

import * as THREE from '../../vendor/three/three.module.js';

const CELL = 0.45;
const RADIUS = 0.36;

export function startAutopilot({ director, stage, plan = '', seed = 'C', bailAt = null, speed = 2.5, log = (m) => console.log(`[autopilot] ${m}`) }) {
  const world = stage.world;
  const player = stage.player;
  const controls = player.controls;
  const ray = new THREE.Raycaster();
  const grids = new Map(); // inst.id -> grid
  let route = null;        // { goal, points, i, instId }
  let lastPos = null;
  let stuckT = 0;
  let lastScene = null;
  let formDone = false;
  let stopped = false;
  let jitter = 0;
  controls.setSpeedScale(speed);

  const choiceFor = (sceneId) => {
    const i = parseInt(String(sceneId).slice(1), 10) - 1;
    const c = (plan[i] || 'S').toUpperCase();
    return c === 'R' ? 'resist' : 'succumb';
  };

  // ---- the navigation grid ---------------------------------------------------

  function buildGrid(inst) {
    const rec = inst.rec;
    const [W, , D] = rec.size;
    const y0 = rec.floorY || 0;
    const nx = Math.ceil(W / CELL), nz = Math.ceil(D / CELL);
    const walk = new Uint8Array(nx * nz);
    const { walls, floors } = world.collidables();
    const v = new THREE.Vector3();
    const dirs = [];
    for (let k = 0; k < 8; k++) dirs.push(new THREE.Vector3(Math.cos(k * Math.PI / 4), 0, Math.sin(k * Math.PI / 4)));
    const rotOnly = new THREE.Matrix4().extractRotation(inst.matrix);
    const worldDirs = dirs.map((d) => d.clone().applyMatrix4(rotOnly));
    const down = new THREE.Vector3(0, -1, 0);
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const lx = -W / 2 + (ix + 0.5) * CELL, lz = -D / 2 + (iz + 0.5) * CELL;
        v.set(lx, y0 + 1.2, lz).applyMatrix4(inst.matrix);
        ray.set(v, down); ray.far = 3.0;
        const fh = ray.intersectObjects(floors, false);
        if (!fh.length) continue;
        const fy = fh[0].point.y;
        let ok = true;
        for (const h of [0.45, 1.0]) {
          const o = new THREE.Vector3(v.x, fy + h, v.z);
          for (const d of worldDirs) {
            ray.set(o, d); ray.far = RADIUS;
            if (ray.intersectObjects(walls, false).length) { ok = false; break; }
          }
          if (!ok) break;
        }
        if (ok) walk[ix * nz + iz] = 1;
      }
    }
    return { inst, nx, nz, W, D, walk };
  }

  function gridOf(inst) {
    if (!grids.has(inst.id)) {
      const t0 = performance.now();
      grids.set(inst.id, buildGrid(inst));
      log(`grid ${inst.key} ${Math.round(performance.now() - t0)}ms`);
    }
    return grids.get(inst.id);
  }

  function toCell(g, worldPos) {
    const p = new THREE.Vector3(worldPos[0], worldPos[1], worldPos[2]).applyMatrix4(g.inst.inv);
    return [Math.floor((p.x + g.W / 2) / CELL), Math.floor((p.z + g.D / 2) / CELL)];
  }
  function toWorld(g, ix, iz) {
    const p = new THREE.Vector3(-g.W / 2 + (ix + 0.5) * CELL, g.inst.rec.floorY || 0, -g.D / 2 + (iz + 0.5) * CELL).applyMatrix4(g.inst.matrix);
    return [p.x, p.y, p.z];
  }
  const ok = (g, ix, iz) => ix >= 0 && iz >= 0 && ix < g.nx && iz < g.nz && g.walk[ix * g.nz + iz];

  function nearestOk(g, c) {
    if (ok(g, c[0], c[1])) return c;
    for (let r = 1; r < 12; r++) {
      let best = null, bd = Infinity;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (ok(g, c[0] + dx, c[1] + dz)) { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [c[0] + dx, c[1] + dz]; } }
      }
      if (best) return best;
    }
    return null;
  }

  function astar(g, a, b) {
    const key = (x, z) => x * g.nz + z;
    const open = new Map();
    const came = new Map();
    const gs = new Map();
    const h = (x, z) => Math.hypot(x - b[0], z - b[1]);
    const start = key(a[0], a[1]);
    gs.set(start, 0);
    open.set(start, h(a[0], a[1]));
    let guard = 0;
    while (open.size && guard++ < 60000) {
      let cur = null, cf = Infinity;
      for (const [k, f] of open) if (f < cf) { cf = f; cur = k; }
      open.delete(cur);
      const cx = Math.floor(cur / g.nz), cz = cur % g.nz;
      if (cx === b[0] && cz === b[1]) {
        const path = [[cx, cz]];
        let k = cur;
        while (came.has(k)) { k = came.get(k); path.unshift([Math.floor(k / g.nz), k % g.nz]); }
        return path;
      }
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!ok(g, nx, nz)) continue;
        if (dx && dz && (!ok(g, cx + dx, cz) || !ok(g, cx, cz + dz))) continue;
        const nk = key(nx, nz);
        const ng = gs.get(cur) + Math.hypot(dx, dz);
        if (ng < (gs.has(nk) ? gs.get(nk) : Infinity)) {
          gs.set(nk, ng); came.set(nk, cur); open.set(nk, ng + h(nx, nz));
        }
      }
    }
    return null;
  }

  function planTo(goal, inst) {
    const pos = player.position();
    if (!inst) return { goal, points: [goal], i: 0 };
    const g = gridOf(inst);
    const a = nearestOk(g, toCell(g, pos));
    const b = nearestOk(g, toCell(g, goal));
    if (!a || !b) { log(`no grid cell near ${!a ? 'player' : 'goal'} in ${inst.key}`); return { goal, points: [goal], i: 0 }; }
    const path = astar(g, a, b);
    if (!path) { log(`no path in ${inst.key} to [${goal.map((n) => n.toFixed(1))}]`); return { goal, points: [goal], i: 0, failed: true }; }
    const pts = [];
    for (let k = 0; k < path.length; k += 2) pts.push(toWorld(g, path[k][0], path[k][1]));
    pts.push(goal);
    return { goal, points: pts, i: 0, instId: inst.id };
  }

  // ---- steering --------------------------------------------------------------

  function steerTo(p, { swim = false } = {}) {
    const c = player.position();
    const dx = p[0] - c[0], dz = p[2] - c[2];
    const d = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dx, -dz);
    let pitch = 0;
    if (swim) pitch = Math.atan2(p[1] - c[1], Math.max(0.3, d));
    controls.setLook(yaw + jitter, Math.max(-1.2, Math.min(1.2, pitch)));
    controls.setMoveAxis(0, 1);
    return swim ? Math.hypot(dx, dz, p[1] - c[1]) : d;
  }
  function halt() { controls.setMoveAxis(0, 0); }

  // ---- the form ---------------------------------------------------------------

  async function fillForm() {
    formDone = true;
    const refuse = seed === 'H';
    for (let field = 0; field < 3; field++) {
      let tiles = [];
      for (let t = 0; t < 60 && tiles.length < 2; t++) { await new Promise((r) => setTimeout(r, 100)); tiles = [...document.querySelectorAll('#screen-layer .application-tile:not(.application-tile-landed):not(.application-tile-withdrawn)')]; }
      const slot = document.querySelector('#screen-layer .application-slot');
      if (tiles.length < 2 || !slot) { log('form: tiles not found'); return; }
      const tile = refuse ? tiles[1] : tiles[0];
      const tr = tile.getBoundingClientRect(), sr = slot.getBoundingClientRect();
      const opt = (x, y) => ({ bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0 });
      tile.dispatchEvent(new PointerEvent('pointerdown', opt(tr.left + tr.width / 2, tr.top + tr.height / 2)));
      window.dispatchEvent(new PointerEvent('pointermove', opt(sr.left + sr.width / 2, sr.top + sr.height / 2)));
      window.dispatchEvent(new PointerEvent('pointerup', opt(sr.left + sr.width / 2, sr.top + sr.height / 2)));
      log(`form: field ${field + 1} ${refuse ? 'NOT WILLING' : 'WILLING'}`);
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  // ---- the loop ----------------------------------------------------------------

  function chooseGoal(dbg) {
    // a doorway being walked through comes first
    const L = dbg.links.find((l) => !l.seal2);
    if (L) {
      const cur = world.current();
      const curKey = cur ? cur.key : null;
      if (curKey === L.from) return { kind: 'exit', point: L.exit, inst: cur, through: true };
      if (curKey === L.conn) return { kind: 'conn', point: L.connExit, inst: null, through: true };
      return { kind: 'enter', point: L.destEntry, inst: null, through: true, beyond: true };
    }
    const armed = dbg.targets.filter((t) => t.kind !== 'threshold' || t.armed);
    const beat = armed.find((t) => t.kind === 'beat');
    if (beat) return { kind: 'beat', point: beat.world, inst: world.current(), label: beat.label };
    const ending = armed.find((t) => t.kind === 'ending');
    if (ending) return { kind: 'ending', point: ending.world, inst: world.current() };
    if (dbg.scene && dbg.armed) {
      const want = choiceFor(dbg.scene);
      const t = armed.find((x) => x.kind === 'threshold' && x.key === want);
      if (t) return { kind: 'threshold', key: want, point: t.world, inst: world.current(), label: t.label, zone: t.zone };
      // a zone that arms later (TURN BACK after the edge, the cab's doorway)
      const later = dbg.targets.find((x) => x.kind === 'threshold' && x.key === want && x.armAfter);
      if (later) {
        const pre = (world.current().zonesWorld || []).find((z) => z.name === later.armAfter);
        if (pre) return { kind: 'arm', point: pre.world, inst: world.current() };
      }
    }
    return null;
  }

  // Push a doorway target a little past its anchor so he walks through it.
  function past(point, inst, metres) {
    if (!inst || !point) return point;
    const c = player.position();
    const dx = point[0] - c[0], dz = point[2] - c[2];
    const d = Math.hypot(dx, dz) || 1;
    return [point[0] + (dx / d) * metres, point[1], point[2] + (dz / d) * metres];
  }

  function tick(dt) {
    if (stopped) return;
    const dbg = director._debug();
    if (dbg.ended) { halt(); log(`ENDED ${dbg.ending || ''}`); stopped = true; return; }
    if (dbg.scene !== lastScene) {
      lastScene = dbg.scene;
      route = null;
      grids.clear();
      log(`scene ${dbg.scene} ${dbg.render} conformance=${dbg.state.conformance} dissonance=${dbg.state.dissonance} friction=${dbg.state.friction}`);
      if (bailAt && dbg.scene === bailAt) { log('bail'); director.bail(); stopped = true; return; }
    }
    if (!formDone && document.querySelector('#screen-layer:not([hidden]) .application-tile')) { fillForm(); return; }
    if (!dbg.playerEnabled) { halt(); route = null; return; }
    const goal = chooseGoal(dbg);
    if (!goal || !goal.point) { halt(); return; }
    const swim = controls.isSwimming();
    let target = goal.point;
    if (goal.kind === 'exit') {
      // route to the doorway, then through it
      const key = `exit:${goal.point.map((n) => n.toFixed(1)).join(',')}`;
      if (!route || route.key !== key) { route = planTo(goal.point, goal.inst); route.key = key; }
    } else if (goal.kind === 'conn' || goal.kind === 'enter') {
      route = { key: goal.kind, points: [goal.kind === 'enter' ? past(goal.point, true, 2.5) : past(goal.point, true, 0.8)], i: 0 };
    } else if (!swim) {
      const key = `${goal.kind}:${goal.point.map((n) => n.toFixed(1)).join(',')}`;
      if (!route || route.key !== key || (goal.kind === 'threshold' && goal.zone === 'manager')) { route = planTo(goal.point, goal.inst); route.key = key; }
    } else {
      route = { key: 'swim', points: [goal.point], i: 0 };
    }
    while (route.i < route.points.length - 1 && Math.hypot(route.points[route.i][0] - player.position()[0], route.points[route.i][2] - player.position()[2]) < 0.5) route.i++;
    target = route.points[route.i];
    if (goal.kind === 'exit' && route.i === route.points.length - 1) target = past(goal.point, true, 1.5);
    const d = steerTo(target, { swim });
    // stuck?
    const p = player.position();
    if (lastPos && Math.hypot(p[0] - lastPos[0], p[2] - lastPos[2]) < 0.02 * speed && d > 0.4) stuckT += dt; else { stuckT = 0; jitter *= 0.9; }
    lastPos = p;
    if (stuckT > 2.5) {
      stuckT = 0;
      jitter = (Math.random() - 0.5) * 1.6;
      route = null;
      log(`stuck near [${p.map((n) => n.toFixed(1))}] going ${goal.kind} ${goal.label || goal.key || ''}`);
    }
  }

  const off = stage.onFrame(tick);
  log(`plan=${plan} seed=${seed} bail=${bailAt || '-'} speed=${speed}`);
  return { stop() { stopped = true; off(); halt(); } };
}
