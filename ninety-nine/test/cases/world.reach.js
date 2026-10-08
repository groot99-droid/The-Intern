// Can the candidate actually walk to every choice? For every room a scene
// is played in (both renders), the ending rooms and the rooms on the way
// there (the street, the store), this builds the room with the real prop
// library and lays a 0.4 m navigation grid over it, raycasting the room's
// colliders the way src/walk/controls.js does: a cell needs a floor under
// it (a down-ray), and a step from one cell to the next along a world axis
// is taken only if rays at feet+0.45 and feet+1.0, the step's length plus
// the 0.35 m body radius long, hit nothing (controls.js tryMove /
// blockedAxis), and the floor rises no more than 0.45 m or drops no more
// than 1.0 m (STEP_UP / STEP_DOWN). The grid is flood-filled from 1.8 m
// inside the entry doorway (where every join and the dev ?start= put him;
// the spawn for S0_X, which has no entry, and for SET_DIVE, which is
// entered from above and swum in 3D -- there up and down are never
// blocked, as in controls.js's swim). Then every threshold zone of the
// branches played there, every beat zone, the ending zones and the inside
// approach of every exit door must be reachable -- and the doorway itself
// once that door is open. Unreachable ones are reported by name.
//
// One case per room. Doors stand as built (a holdEntry room's entry stays
// open, as it does in the game); actors stand at the end of their walk.

import * as THREE from '../../vendor/three/three.module.js';
import { runCase, assert } from '../harness.js';
import { createStage } from '../../src/stage/stage.js';
import { zonesOf } from '../../src/spine.js';
import { canWebGL, frames } from './stage.shots.js';

const CELL = 0.4;            // grid pitch (m)
const RADIUS = 0.35;         // controls.js COLLIDE_RADIUS
const HEIGHTS = [0.45, 1.0]; // controls.js blockedAxis: knee and chest
const STEP_UP = 0.45;        // controls.js STEP_UP
const STEP_DOWN = 1.0;       // controls.js STEP_DOWN
const MARGIN = 0.8;          // the grid reaches past the walls, over the door reveals
const TOL = 0.15;            // a zone counts as reached within r + TOL of a reachable cell centre
const APPROACH_IN = 0.8;     // a door's inside approach: this far in from its inner face
const SWIM_CELL = 0.5;
const EYE = 1.6;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DOWN = new THREE.Vector3(0, -1, 0);

// Colliders binned on the floor plan (2 m buckets, each mesh entered into
// every bucket within 1 m of its bounds, so any ray up to 1 m long from a
// point finds its candidates in that point's bucket).
function indexMeshes(meshes) {
  const BIN = 2;
  const bins = new Map();
  const key = (i, j) => `${i},${j}`;
  for (const m of meshes) {
    m.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(m);
    if (!Number.isFinite(box.min.x)) continue;
    for (let i = Math.floor((box.min.x - 1) / BIN); i <= Math.floor((box.max.x + 1) / BIN); i++) {
      for (let j = Math.floor((box.min.z - 1) / BIN); j <= Math.floor((box.max.z + 1) / BIN); j++) {
        const k = key(i, j);
        if (!bins.has(k)) bins.set(k, []);
        bins.get(k).push(m);
      }
    }
  }
  return { near: (x, z) => bins.get(key(Math.floor(x / BIN), Math.floor(z / BIN))) || [] };
}

const raycaster = new THREE.Raycaster();
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
function rayHits(meshes, x, y, z, dx, dy, dz, far) {
  if (!meshes.length) return false;
  raycaster.set(_o.set(x, y, z), _d.set(dx, dy, dz));
  raycaster.far = far;
  const hits = raycaster.intersectObjects(meshes, false);
  return hits.length > 0 && hits[0].distance < far;
}

// ---- walking: a 2D grid of floor heights, steps checked as controls.js would ----

function buildGrid(inst, walls, floors) {
  const [W, , D] = inst.rec.size;
  const y0 = inst.rec.floorY || 0;
  const nx = Math.ceil((W + 2 * MARGIN) / CELL), nz = Math.ceil((D + 2 * MARGIN) / CELL);
  const g = { inst, nx, nz, W, D, y0, walls, floors, floorY: new Float32Array(nx * nz).fill(NaN), pos: [] };
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const v = new THREE.Vector3(-W / 2 - MARGIN + (ix + 0.5) * CELL, 0, -D / 2 - MARGIN + (iz + 0.5) * CELL).applyMatrix4(inst.matrix);
      g.pos[ix * nz + iz] = [v.x, v.z];
      const near = floors.near(v.x, v.z);
      if (!near.length) continue;
      raycaster.set(_o.set(v.x, y0 + 1.5, v.z), DOWN);
      raycaster.far = 4.0;
      const hits = raycaster.intersectObjects(near, false);
      if (hits.length) g.floorY[ix * nz + iz] = hits[0].point.y;
    }
  }
  return g;
}

// controls.js: a move of `step` along an axis is blocked when a ray from
// where he stands, at knee or chest height, `step + RADIUS` long, hits a wall.
function canStep(g, walls, a, b, dx, dz) {
  const fa = g.floorY[a], fb = g.floorY[b];
  if (Number.isNaN(fb)) return false;
  const dy = fb - fa;
  if (dy > STEP_UP || dy < -STEP_DOWN) return false;
  const [x, z] = g.pos[a];
  const near = walls.near(x, z);
  for (const h of HEIGHTS) if (rayHits(near, x, fa + h, z, dx, 0, dz, CELL + RADIUS)) return false;
  return true;
}

function flood(g, walls, start) {
  const seen = new Uint8Array(g.nx * g.nz);
  const q = [start];
  seen[start] = 1;
  while (q.length) {
    const a = q.pop();
    const ax = Math.floor(a / g.nz), az = a % g.nz;
    for (const [dx, dz] of DIRS) {
      const bx = ax + dx, bz = az + dz;
      if (bx < 0 || bz < 0 || bx >= g.nx || bz >= g.nz) continue;
      const b = bx * g.nz + bz;
      if (seen[b] || !canStep(g, walls, a, b, dx, dz)) continue;
      seen[b] = 1;
      q.push(b);
    }
  }
  return seen;
}

function nearestFloorCell(g, p, maxM = 1.0) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < g.floorY.length; i++) {
    if (Number.isNaN(g.floorY[i])) continue;
    const d = Math.hypot(g.pos[i][0] - p[0], g.pos[i][1] - p[2]);
    if (d < bd && d <= maxM) { bd = d; best = i; }
  }
  return best;
}

// the smallest `measure(x, z, floorY)` over the reachable cells
function nearestReached(g, seen, measure) {
  let bd = Infinity;
  for (let i = 0; i < seen.length; i++) {
    if (!seen[i]) continue;
    const d = measure(g.pos[i][0], g.pos[i][1], g.floorY[i]);
    if (d < bd) bd = d;
  }
  return bd;
}

// ---- the dive: swum in 3D; up and down are never blocked -----------------------

function swimReach(inst, walls, startWant) {
  const rec = inst.rec;
  const [W, , D] = rec.size;
  const y0 = inst.matrix.elements[13];
  const ya = y0 + rec.swim.floorY, yb = y0 + rec.swim.ceilingY;
  const nx = Math.ceil(W / SWIM_CELL), nz = Math.ceil(D / SWIM_CELL), ny = Math.floor((yb - ya) / SWIM_CELL) + 1;
  const idx = (ix, iy, iz) => (ix * ny + iy) * nz + iz;
  const pos = (ix, iy, iz) => [-W / 2 + (ix + 0.5) * SWIM_CELL, ya + iy * SWIM_CELL, -D / 2 + (iz + 0.5) * SWIM_CELL];
  let start = null, bd = Infinity;
  for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) {
    const p = pos(ix, iy, iz);
    const d = Math.hypot(p[0] - startWant[0], p[1] - startWant[1], p[2] - startWant[2]);
    if (d < bd) { bd = d; start = [ix, iy, iz]; }
  }
  const seen = new Uint8Array(nx * ny * nz);
  const q = [start];
  seen[idx(...start)] = 1;
  while (q.length) {
    const [cx, cy, cz] = q.pop();
    const p = pos(cx, cy, cz);
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
      const nx2 = cx + dx, ny2 = cy + dy, nz2 = cz + dz;
      if (nx2 < 0 || ny2 < 0 || nz2 < 0 || nx2 >= nx || ny2 >= ny || nz2 >= nz) continue;
      const k = idx(nx2, ny2, nz2);
      if (seen[k]) continue;
      // controls.js swim: across is a ray at eye height; up and down are only clamped
      if (dy === 0 && rayHits(walls.near(p[0], p[2]), p[0], p[1], p[2], dx, 0, dz, SWIM_CELL + RADIUS)) continue;
      seen[k] = 1;
      q.push([nx2, ny2, nz2]);
    }
  }
  const reached = [];
  for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) if (seen[idx(ix, iy, iz)]) reached.push(pos(ix, iy, iz));
  return reached;
}

// ---- what must be reachable, per room -----------------------------------------------

function collectTargets(manifest, endings, rooms) {
  const baseOf = (k) => { const r = rooms.rooms[k]; return r && r.alias ? r.alias : k; };
  const rec = (k) => { const r = rooms.rooms[k]; return r.alias ? { ...rooms.rooms[r.alias], ...r } : r; };
  const byBase = new Map();
  const add = (roomKey, t) => {
    const base = baseOf(roomKey);
    if (!byBase.has(base)) byBase.set(base, { key: base, targets: [] });
    const list = byBase.get(base).targets;
    const same = list.find((x) => x.kind === t.kind && x.name === t.name);
    if (same) same.why.push(t.why); else list.push({ kind: t.kind, name: t.name, why: [t.why] });
  };
  const isDoor = (k, n) => (rec(k).doors || []).some((d) => d.name === n);
  for (const [sid, sc] of Object.entries(manifest.scenes)) {
    if (sid === 'S0') continue;
    for (const [letter, b] of Object.entries(sc.branches)) {
      for (const [key, th] of Object.entries(b.thresholds || {})) {
        const why = `${sid}.${letter} ${key} "${th.label}"`;
        for (const z of zonesOf(th)) add(b.room, { kind: 'zone', name: z, why });
        if (th.exit && th.via !== 'fall' && isDoor(b.room, th.exit)) add(b.room, { kind: 'exit', name: th.exit, why });
      }
      for (const bz of b.beatZones || []) add(b.room, { kind: 'zone', name: bz.zone, why: `${sid}.${letter} beat zone "${bz.label}"` });
    }
  }
  const x = manifest.scenes.S0.branches.X;
  add(x.room, { kind: 'zone', name: x.start.zone, why: `S0 "${x.start.label}"` });
  add(x.room, { kind: 'exit', name: x.out.exit, why: 'S0 the apartment door' });
  add(x.out.to, { kind: 'zone', name: x.report.zone, why: `S0 "${x.report.label}"` });
  add(x.out.to, { kind: 'exit', name: x.report.exit, why: 'S0 the tower doors' });
  for (const [id, e] of Object.entries(endings)) {
    if (id.startsWith('_')) continue;
    add(e.room, { kind: 'zone', name: e.zone, why: `ending ${id}` });
    for (const [from, route] of Object.entries(e.routes || {})) add(from, { kind: 'exit', name: route.exit, why: `ending ${id}: the way on from ${from}` });
  }
  return [...byBase.values()];
}

const facing = (yawDeg) => { const y = yawDeg * Math.PI / 180; return [-Math.sin(y), 0, -Math.cos(y)]; };

export async function run() {
  if (!canWebGL()) {
    await runCase('world.reach: (skipped: no WebGL in this browser)', () => {});
    return;
  }
  const [rooms, manifest, endings] = await Promise.all([
    fetch('../data/rooms.json').then((r) => r.json()),
    fetch('../data/scenes.json').then((r) => r.json()),
    fetch('../data/endings.json').then((r) => r.json())
  ]);
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:180px;opacity:0.01;pointer-events:none;';
  document.body.appendChild(container);
  const stage = createStage(container, { rooms }); // the real prop library: its colliders are the game's
  const libOk = await stage.ready;

  try {
    for (const room of collectTargets(manifest, endings, rooms)) {
      const zonesN = room.targets.filter((t) => t.kind === 'zone').length;
      const exitsN = room.targets.filter((t) => t.kind === 'exit').length;
      const from = room.key === 'S0_X' ? 'the spawn' : room.key === 'SET_DIVE' ? 'the surface' : 'the entry';
      await runCase(`world.reach: ${room.key} -- ${zonesN} zone(s) and ${exitsN} exit door(s) reachable from ${from}${libOk ? '' : ' (box fallbacks: no prop library)'}`, async () => {
        const inst = await stage.preview(room.key);
        const rec = inst.rec;
        // the room as the candidate finds it
        if (rec.holdEntry && inst.room.doors.get(rec.entry)) inst.room.doors.get(rec.entry).open(0.01);
        for (const a of Object.values(inst.room.actors)) a.set(1);
        inst.room.update(1, 0);
        inst.group.updateMatrixWorld(true);
        await frames(stage, 1);
        const zoneDef = (name) => inst.zonesWorld.find((z) => z.name === name);
        const fails = [];

        if (rec.swim) {
          const sink = rec.shots.sink && rec.shots.sink.to;
          const sp = rec.spawn || [0, 0];
          const reached = swimReach(inst, indexMeshes(inst.room.blocking()), [sp[0], sink ? sink.pos[1] : rec.swim.ceilingY - 1, sp[1]]);
          assert(reached.length > 100, `${room.key}: only ${reached.length} cells of water reachable`);
          for (const t of room.targets) {
            const z = zoneDef(t.name);
            if (!z) { fails.push(`${t.kind} ${t.name}: no such zone (${t.why.join('; ')})`); continue; }
            const zp = z.pos.length === 3 ? z.world : [z.world[0], z.world[1] + EYE, z.world[2]];
            let best = Infinity;
            for (const p of reached) best = Math.min(best, Math.hypot(p[0] - zp[0], p[1] - zp[1], p[2] - zp[2]));
            if (!(best < z.r + TOL)) fails.push(`zone ${t.name} (${t.why.join('; ')}): nearest reachable water ${best.toFixed(2)} m from its centre, radius ${z.r}`);
          }
          assert(fails.length === 0, fails.join(' | '));
          return;
        }

        const floors = indexMeshes(inst.room.floors);
        const walls = indexMeshes(inst.room.blocking());
        const g = buildGrid(inst, walls, floors);
        // where he starts: 1.8 m in from the entry doorway's outer face, or the spawn
        let startW;
        const e = rec.entry && inst.anchorsWorld[rec.entry];
        if (e && !inst.room.anchors[rec.entry].vertical) {
          const f = facing(e.yaw);
          startW = [e.pos[0] - f[0] * 1.8, e.pos[1], e.pos[2] - f[2] * 1.8];
        } else {
          const sp = inst.room.spawn;
          const v = new THREE.Vector3(sp.x, rec.floorY || 0, sp.z).applyMatrix4(inst.matrix);
          startW = [v.x, v.y, v.z];
        }
        const start = nearestFloorCell(g, startW);
        assert(start >= 0, `${room.key}: no floor within 1 m of the start [${startW.map((n) => n.toFixed(1))}]`);
        const seen = flood(g, walls, start);
        const reachedN = seen.reduce((n, s) => n + s, 0);
        assert(reachedN > 20, `${room.key}: only ${reachedN} cells reachable from the start`);
        // controls on the flood itself: it never leaves the shell (past a door's
        // reveal) and never stands inside a solid box at knee or chest height
        const solids = inst.room.blocking().filter((m) => m.geometry && m.geometry.type === 'BoxGeometry').map((m) => {
          m.updateWorldMatrix(true, false);
          if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
          return { m, inv: m.matrixWorld.clone().invert(), bb: m.geometry.boundingBox, wb: new THREE.Box3().setFromObject(m) };
        });
        const pt = new THREE.Vector3();
        let leaks = 0, inSolid = 0, sample = '';
        for (let i = 0; i < seen.length; i++) {
          if (!seen[i]) continue;
          const [x, z] = g.pos[i];
          const fy = g.floorY[i];
          const l = new THREE.Vector3(x, fy, z).applyMatrix4(inst.inv);
          if (Math.abs(l.x) > g.W / 2 + 0.45 || Math.abs(l.z) > g.D / 2 + 0.45) { leaks++; sample = sample || `[${x.toFixed(1)}, ${z.toFixed(1)}]`; }
          for (const h of HEIGHTS) {
            for (const s of solids) {
              if (!s.wb.containsPoint(pt.set(x, fy + h, z))) continue;
              if (s.bb.containsPoint(pt.applyMatrix4(s.inv))) { inSolid++; sample = sample || `[${x.toFixed(1)}, ${z.toFixed(1)}] in ${s.m.parent ? s.m.parent.name : '?'}`; break; }
            }
          }
        }
        assert(leaks === 0, `${room.key}: ${leaks} reachable cells outside the shell, e.g. ${sample}`);
        assert(inSolid === 0, `${room.key}: ${inSolid} reachable cells inside a solid, e.g. ${sample}`);

        const y0 = rec.floorY || 0;
        for (const t of room.targets) {
          if (t.kind === 'zone') {
            const z = zoneDef(t.name);
            if (!z) { fails.push(`zone ${t.name}: no such zone (${t.why.join('; ')})`); continue; }
            let d;
            if (z.actor) {
              // the zone walks with its actor (S4 C's manager): where he stops
              const [ax, az] = inst.room.actors[z.actor].at();
              const off = z.offset || [0, 0];
              const c = new THREE.Vector3(ax + off[0], y0, az + off[1]).applyMatrix4(inst.matrix);
              d = nearestReached(g, seen, (x, zz) => Math.hypot(x - c.x, zz - c.z)) - z.r;
            } else if (z.box) {
              const [[x0, z0], [x1, z1]] = z.box;
              d = nearestReached(g, seen, (x, zz, fy) => {
                const p = new THREE.Vector3(x, fy, zz).applyMatrix4(inst.inv);
                if (Math.abs(p.y - y0) >= 2.6) return Infinity;
                return Math.hypot(Math.max(x0 - p.x, 0, p.x - x1), Math.max(z0 - p.z, 0, p.z - z1));
              });
            } else {
              const w = z.world;
              d = nearestReached(g, seen, (x, zz, fy) => (Math.abs(fy - w[1]) < 2.6 ? Math.hypot(x - w[0], zz - w[2]) : Infinity)) - z.r;
            }
            if (!(d < TOL)) fails.push(`zone ${t.name} (${t.why.join('; ')}): ${Number.isFinite(d) ? `the nearest reachable spot is ${(d + (z.box ? 0 : z.r)).toFixed(2)} m from it${z.box ? ' (a box zone)' : ` (radius ${z.r})`}` : 'nothing reachable on its floor'}`);
          } else {
            const door = inst.room.doors.get(t.name);
            const a = inst.anchorsWorld[t.name];
            if (!door || !a) { fails.push(`exit ${t.name}: no such door (${t.why.join('; ')})`); continue; }
            const f = facing(a.yaw);
            const inward = 0.3 + APPROACH_IN; // outer face -> inner face -> the approach
            const ap = [a.pos[0] - f[0] * inward, a.pos[2] - f[2] * inward];
            const d = nearestReached(g, seen, (x, zz) => Math.hypot(x - ap[0], zz - ap[1]));
            if (!(d < 0.45)) { fails.push(`exit door ${t.name} (${t.why.join('; ')}): its inside approach is unreachable (nearest ${d.toFixed(2)} m)`); continue; }
            // and through it once it opens: the doorway (the wall's centre plane) can be walked into
            const was = door.progress();
            door.open(0.01);
            inst.room.update(1, 0);
            const seen2 = flood(g, indexMeshes(inst.room.blocking()), start);
            const rv = [a.pos[0] - f[0] * 0.15, a.pos[2] - f[2] * 0.15];
            const d2 = nearestReached(g, seen2, (x, zz) => Math.hypot(x - rv[0], zz - rv[1]));
            if (!(d2 < 0.3)) fails.push(`exit door ${t.name} (${t.why.join('; ')}): the open doorway cannot be walked into (nearest ${d2.toFixed(2)} m from the reveal)`);
            if (was < 0.5) { door.close(0.01); inst.room.update(1, 0); }
          }
        }
        assert(fails.length === 0, fails.join(' | '));
      });
    }
  } finally {
    stage.destroy();
    container.remove();
  }
}
