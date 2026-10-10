// src/world/anchors.js: the attach maths that line the continuous
// building's rooms up door to door. Pure (three.js maths, no renderer):
// every wall pairing joins entry onto exit facing back the way it came,
// chains through a connector carry the drop, vertical anchors (the water
// over the dive) coincide without the turn, and doorAnchor() puts each
// wall's outward frame where room.js cuts the opening.

import * as THREE from '../../vendor/three/three.module.js';
import { attachMatrix, anchorToWorld, doorAnchor, poseMatrix, poseToWorld, interiorBox } from '../../src/world/anchors.js';
import { runCase, assert, assertEqual } from '../harness.js';

const EPS = 1e-6;
const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;
const nearVec = (a, b, eps = 1e-5) => a.length === b.length && a.every((v, i) => near(v, b[i], eps));
const fmt = (v) => `[${v.map((n) => n.toFixed(3)).join(', ')}]`;
// controls.js convention: yaw 0 faces -z, 90 faces -x, -90 faces +x, 180 faces +z
const facing = (yawDeg) => { const y = yawDeg * Math.PI / 180; return [-Math.sin(y), 0, -Math.cos(y)]; };
const yawDiff = (a, b) => { const d = (((a - b) % 360) + 540) % 360 - 180; return Math.abs(d); };

const WALLS = ['N', 'S', 'E', 'W'];

// A placed room: matrix, size, and world helpers.
function centerOf(matrix, size, floorY = 0) {
  const c = new THREE.Vector3(0, floorY + size[1] / 2, 0).applyMatrix4(matrix);
  return [c.x, c.y, c.z];
}

export async function run() {
  await runCase('doorAnchor: the outward frame on each wall (outer face, at the sill, facing out)', () => {
    const size = [8, 3, 6];
    const cases = {
      N: { pos: [1, 0, -3.3], yaw: 0 },
      S: { pos: [1, 0, 3.3], yaw: 180 },
      E: { pos: [4.3, 0, 1], yaw: -90 },
      W: { pos: [-4.3, 0, 1], yaw: 90 }
    };
    for (const wall of WALLS) {
      const a = doorAnchor(size, { wall, x: 1 });
      assert(nearVec(a.pos, cases[wall].pos), `${wall}: pos ${fmt(a.pos)} != ${fmt(cases[wall].pos)}`);
      assertEqual(a.yaw, cases[wall].yaw, `${wall}: yaw`);
      // it faces out of the room: away from the centre
      const f = facing(a.yaw);
      assert(f[0] * a.pos[0] + f[2] * a.pos[2] > 0, `${wall}: anchor faces into the room`);
    }
    // the sill height and the wall depth carry through
    const raised = doorAnchor(size, { wall: 'N', x: -2, y: 1.5 }, 0.5);
    assert(nearVec(raised.pos, [-2, 1.5, -3.5]), `raised sill / thick wall: ${fmt(raised.pos)}`);
    let threw = false;
    try { doorAnchor(size, { wall: 'Q' }); } catch (e) { threw = true; }
    assert(threw, 'a bad wall must throw');
  });

  await runCase('attachMatrix: all 16 wall pairs (N/S/E/W exit x N/S/E/W entry) land entry on exit, facing the opposite way, room beyond the door', () => {
    const sizeA = [10, 3, 8], sizeB = [6, 2.6, 12];
    // place A somewhere awkward: turned and moved, as a room deep in the chain is
    const placements = [
      new THREE.Matrix4(),
      new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(14, -2.8, -30),
      new THREE.Matrix4().makeRotationY(-2.4).setPosition(-7, 0, 3)
    ];
    let n = 0;
    for (const MA of placements) {
      for (const exitWall of WALLS) {
        for (const entryWall of WALLS) {
          const exit = doorAnchor(sizeA, { wall: exitWall, x: 1.25 });
          const entry = doorAnchor(sizeB, { wall: entryWall, x: -0.75 });
          const MB = attachMatrix(MA, exit, entry);
          const ew = anchorToWorld(MA, exit);
          const nw = anchorToWorld(MB, entry);
          const tag = `exit ${exitWall} / entry ${entryWall}`;
          assert(nearVec(nw.pos, ew.pos), `${tag}: entry ${fmt(nw.pos)} not on exit ${fmt(ew.pos)}`);
          assert(near(yawDiff(nw.yaw, ew.yaw + 180), 0, 1e-4), `${tag}: entry yaw ${nw.yaw.toFixed(2)} not opposite exit yaw ${ew.yaw.toFixed(2)}`);
          const fe = facing(ew.yaw), fn = facing(nw.yaw);
          assert(near(fe[0] + fn[0], 0) && near(fe[2] + fn[2], 0), `${tag}: facings not opposite`);
          // B lies on the far side of the door, not overlapping A
          const cB = centerOf(MB, sizeB);
          const toB = [cB[0] - ew.pos[0], cB[2] - ew.pos[2]];
          assert(toB[0] * fe[0] + toB[1] * fe[2] > 0.5, `${tag}: the attached room is not beyond the door`);
          // rooms only ever turn about Y: no tilt
          const up = new THREE.Vector3(0, 1, 0).transformDirection(MB);
          assert(near(up.y, 1), `${tag}: the attached room is tilted`);
          // and the floors meet: both sills at the same height
          assert(near(new THREE.Vector3(0, 0, 0).applyMatrix4(MB).y, new THREE.Vector3(0, 0, 0).applyMatrix4(MA).y), `${tag}: floors do not meet`);
          n++;
        }
      }
    }
    assertEqual(n, 48);
  });

  await runCase('attachMatrix: a 3-link chain (room -> connector with a 3 m drop -> room) puts the third room\'s floor 3 m lower, door on door', () => {
    const sizeA = [12, 3.2, 10];
    const drop = 3.0;
    const sizeConn = [1.6, 2.6, 6.9];
    const sizeC = [32, 3.4, 44];
    const MA = new THREE.Matrix4().makeRotationY(0.7).setPosition(5, 0, -12);
    const exitA = doorAnchor(sizeA, { wall: 'E', x: 2.0 });
    const connEntry = doorAnchor(sizeConn, { wall: 'S', x: 0, y: 0 });
    const connExit = doorAnchor(sizeConn, { wall: 'N', x: 0, y: -drop });
    const entryC = doorAnchor(sizeC, { wall: 'S', x: 0, y: 0 });
    const MConn = attachMatrix(MA, exitA, connEntry);
    const MC = attachMatrix(MConn, connExit, entryC);
    const floorA = new THREE.Vector3(0, 0, 0).applyMatrix4(MA).y;
    const floorC = new THREE.Vector3(0, 0, 0).applyMatrix4(MC).y;
    assert(near(floorC, floorA - drop), `third room's floor at ${floorC.toFixed(3)}, expected ${(floorA - drop).toFixed(3)}`);
    assert(nearVec(anchorToWorld(MC, entryC).pos, anchorToWorld(MConn, connExit).pos), 'the third room\'s entry is not on the connector\'s exit');
    assert(nearVec(anchorToWorld(MConn, connEntry).pos, anchorToWorld(MA, exitA).pos), 'the connector\'s entry is not on the first room\'s exit');
    // carried through the chain the same way: the third room keeps going away from the first
    const cA = centerOf(MA, sizeA), cC = centerOf(MC, sizeC);
    const fe = facing(anchorToWorld(MA, exitA).yaw);
    assert((cC[0] - cA[0]) * fe[0] + (cC[2] - cA[2]) * fe[2] > sizeA[0] / 2, 'the chain doubles back toward the first room');
  });

  await runCase('attachMatrix with the real rooms: S4_C side -> CN_STAIRS_CONCRETE -> S5_H front lands 3 m down; S2_C inner -> CN_CORRIDOR_OFFICE -> S3_C side stays level', async () => {
    const rooms = await fetch('../data/rooms.json').then((r) => r.json());
    const rec = (k) => { const r = rooms.rooms[k]; return r.alias ? { ...rooms.rooms[r.alias], ...r } : r; };
    const anchorOf = (k, name) => {
      const r = rec(k);
      const d = (r.doors || []).find((x) => x.name === name);
      if (d) return doorAnchor(r.size, { ...d, y: d.y === undefined ? (r.floorY || 0) : d.y }, 0.3);
      const a = r.anchors[name];
      return { pos: a.pos, yaw: a.yaw || 0, vertical: !!a.vertical };
    };
    const chain = (fromKey, exitName, viaKey, toKey) => {
      const M0 = new THREE.Matrix4();
      const Mc = attachMatrix(M0, anchorOf(fromKey, exitName), anchorOf(viaKey, rec(viaKey).entry));
      const Md = attachMatrix(Mc, anchorOf(viaKey, 'exit'), anchorOf(toKey, rec(toKey).entry));
      return new THREE.Vector3(0, rec(toKey).floorY || 0, 0).applyMatrix4(Md).y;
    };
    assert(near(chain('S4_C', 'side', 'CN_STAIRS_CONCRETE', 'S5_H'), -rooms.rooms.CN_STAIRS_CONCRETE.drop, 1e-4), 'S5_H floor after the stairwell');
    assert(near(chain('S2_C', 'inner', 'CN_CORRIDOR_OFFICE', 'S3_C'), 0, 1e-4), 'S3_C floor after a level corridor');
    assert(near(chain('S5_H', 'ramp', 'CN_RAMP_DOWN', 'S6_H'), -rooms.rooms.CN_RAMP_DOWN.drop, 1e-4), 'S6_H floor after the ramp');
  });

  await runCase('attachMatrix: vertical anchors coincide without the turn (the water surface over the dive)', () => {
    const MA = new THREE.Matrix4().makeRotationY(0.3).setPosition(2, -6, 4);
    const exit = { pos: [0, -0.4, -10.5], yaw: 0, vertical: true };
    const entry = { pos: [0, 13.6, 0], yaw: 0, vertical: true };
    const MB = attachMatrix(MA, exit, entry, { vertical: true });
    const ew = anchorToWorld(MA, exit), nw = anchorToWorld(MB, entry);
    assert(nearVec(nw.pos, ew.pos), `vertical: ${fmt(nw.pos)} != ${fmt(ew.pos)}`);
    assert(near(yawDiff(nw.yaw, ew.yaw), 0, 1e-4), `vertical: yaw turned (${nw.yaw.toFixed(2)} vs ${ew.yaw.toFixed(2)})`);
    // the same pair joined as a doorway would turn 180
    const MT = attachMatrix(MA, exit, entry);
    assert(near(yawDiff(anchorToWorld(MT, entry).yaw, ew.yaw + 180), 0, 1e-4), 'a non-vertical join turns 180');
    // with a yawed vertical entry the frames still coincide exactly
    const entry2 = { pos: [1, 2, 3], yaw: 45, vertical: true };
    const exit2 = { pos: [4, 5, 6], yaw: -30, vertical: true };
    const MB2 = attachMatrix(MA, exit2, entry2, { vertical: true });
    assert(nearVec(anchorToWorld(MB2, entry2).pos, anchorToWorld(MA, exit2).pos), 'yawed vertical pos');
    assert(near(yawDiff(anchorToWorld(MB2, entry2).yaw, anchorToWorld(MA, exit2).yaw), 0, 1e-4), 'yawed vertical yaw');
  });

  await runCase('poseMatrix / poseToWorld / interiorBox', () => {
    const m = poseMatrix({ pos: [1, 2, 3], yaw: 90 });
    const p = new THREE.Vector3(0, 0, -1).applyMatrix4(m); // one metre "forward" of the anchor
    assert(nearVec([p.x, p.y, p.z], [0, 2, 3]), `poseMatrix forward ${fmt([p.x, p.y, p.z])}`);
    const M = new THREE.Matrix4().makeRotationY(Math.PI).setPosition(10, 0, 0);
    const w = poseToWorld(M, { pos: [1, 1.6, 2], look: [1, 1.6, 0], fov: 50 });
    assert(nearVec(w.pos, [9, 1.6, -2]) && nearVec(w.look, [9, 1.6, 0]) && w.fov === 50, `poseToWorld ${fmt(w.pos)} ${fmt(w.look)}`);
    const box = interiorBox({ size: [4, 3, 6], floorY: -2 });
    assert(box.containsPoint(new THREE.Vector3(1.9, -1, 2.9)) && !box.containsPoint(new THREE.Vector3(2.1, -1, 0)), 'interiorBox');
    assert(near(box.min.y, -2.5, EPS) && near(box.max.y, 3.5, EPS), 'interiorBox y range');
  });
}
