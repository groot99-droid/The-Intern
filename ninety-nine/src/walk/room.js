// Builds one walkable room from a data/rooms.json record, the way the
// Earth_Worldbuild museum builds galleries from museum-layout.json: no GLB,
// no Blender export -- the building is boxes with world-tiled procedural
// textures, the company's things are low-poly props (props.js), and the
// record decides sizes, surfaces, lights, spawn. tools/build_rooms.py
// writes the records; this file only reads them.
//
// Coordinate convention: origin on the floor at the room's centre, +x right,
// +y up, +z toward the entrance (where the player spawns), -z toward the
// building's core. Canon C2 -- every shadow falls toward the core -- is
// enforced here, not per room: the one shadow-casting light always sits on
// the entrance side and aims at the core, whatever the room's own fixtures
// are doing.
//
// Record keys beyond the shell (all optional):
//   skirt   {mat, h, t}          a band low on every closed wall (painted
//                                concrete, wainscot, a rubber kick)
//   cornice {mat, h, t}          the same band up at the ceiling
//   beams   {axis, every, w, h,  ceiling beams / soffits under the slab,
//            mat, offset}         running along `axis` ('x' or 'z')
//   lights[].flicker  0..1       a sodium/fluorescent buzz on that light
//   exposure, grain, vignette    read by walk.js's composite pass

import * as THREE from '../../vendor/three/three.module.js';
import { applyWorldUV } from './materials.js';
import { buildProp } from './props.js';

const WALL_T = 0.3;
const FLOOR_T = 0.2;

function archBox(mats, slot, min, max, tile, { collide = true, castShadow = true, receiveShadow = true } = {}) {
  const w = max[0] - min[0], h = max[1] - min[1], d = max[2] - min[2];
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(min[0] + w / 2, min[1] + h / 2, min[2] + d / 2); // world-space geometry so UVs tile across boxes
  applyWorldUV(geo, tile);
  const mesh = new THREE.Mesh(geo, mats.get(slot));
  mesh.castShadow = castShadow && !mats.isGlow(slot);
  mesh.receiveShadow = receiveShadow;
  mesh.userData.collide = collide;
  return mesh;
}

// Deterministic per-light phase so a row of fixtures never flickers in
// unison.
function hash01(n) { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }

export function buildRoom(mats, rec, ctx = null) {
  const group = new THREE.Group();
  const named = new Map(); // prop name -> group (actors, the terminal screen, the hands)
  const animated = []; // { group, spec }: curtains that swing, hands that drift
  group.name = rec.id || rec.name || 'room';
  const walls = [];
  const floors = [];
  const lights = [];
  const flickers = []; // { light, base, amount, phase }
  const [W, H, D] = rec.size;
  const tile = Object.assign({ floor: 2, wall: 2, ceiling: 2, box: 2 }, rec.tile || {});
  const open = new Set(rec.open || []);

  // Shell
  const floor = archBox(mats, rec.floor || 'concrete', [-W / 2, -FLOOR_T, -D / 2], [W / 2, 0, D / 2], tile.floor, { collide: false, castShadow: false });
  group.add(floor);
  floors.push(floor);
  if (!rec.noCeiling) {
    group.add(archBox(mats, rec.ceiling || rec.wall || 'plaster', [-W / 2, H, -D / 2], [W / 2, H + FLOOR_T, D / 2], tile.ceiling, { collide: false, castShadow: false }));
  }
  const wallMat = rec.wall || 'plaster';
  const shell = {
    N: [[-W / 2 - WALL_T, 0, -D / 2 - WALL_T], [W / 2 + WALL_T, H, -D / 2]],
    S: [[-W / 2 - WALL_T, 0, D / 2], [W / 2 + WALL_T, H, D / 2 + WALL_T]],
    E: [[W / 2, 0, -D / 2], [W / 2 + WALL_T, H, D / 2]],
    W: [[-W / 2 - WALL_T, 0, -D / 2], [-W / 2, H, D / 2]]
  };
  // Inner face of each closed wall, for the skirt / cornice bands.
  const inner = {
    N: (y0, y1, t) => [[-W / 2, y0, -D / 2], [W / 2, y1, -D / 2 + t]],
    S: (y0, y1, t) => [[-W / 2, y0, D / 2 - t], [W / 2, y1, D / 2]],
    E: (y0, y1, t) => [[W / 2 - t, y0, -D / 2], [W / 2, y1, D / 2]],
    W: (y0, y1, t) => [[-W / 2, y0, -D / 2], [-W / 2 + t, y1, D / 2]]
  };
  for (const side of Object.keys(shell)) {
    if (open.has(side) || rec.noWalls) continue;
    const m = archBox(mats, wallMat, shell[side][0], shell[side][1], tile.wall);
    group.add(m);
    walls.push(m);
    if (rec.skirt) {
      const sk = rec.skirt;
      const [a, b] = inner[side](0, sk.h || 0.9, sk.t || 0.03);
      group.add(archBox(mats, sk.mat || 'plaster_dark', a, b, sk.tile || tile.wall, { collide: false, castShadow: false }));
    }
    if (rec.cornice) {
      const co = rec.cornice;
      const [a, b] = inner[side](H - (co.h || 0.3), H, co.t || 0.06);
      group.add(archBox(mats, co.mat || wallMat, a, b, co.tile || tile.wall, { collide: false, castShadow: false }));
    }
  }

  // Ceiling beams / soffits: the slab reads as poured, not as a lid.
  if (rec.beams && !rec.noCeiling) {
    const bm = rec.beams;
    const bw = bm.w || 0.5, bh = bm.h || 0.6, every = bm.every || 8, off = bm.offset || 0;
    const mat = bm.mat || rec.ceiling || 'concrete';
    if (bm.axis === 'z') {
      for (let x = -W / 2 + off; x <= W / 2 + 1e-6; x += every) {
        group.add(archBox(mats, mat, [x - bw / 2, H - bh, -D / 2], [x + bw / 2, H, D / 2], bm.tile || tile.ceiling, { collide: false, castShadow: false }));
      }
    } else {
      for (let z = -D / 2 + off; z <= D / 2 + 1e-6; z += every) {
        group.add(archBox(mats, mat, [-W / 2, H - bh, z - bw / 2], [W / 2, H, z + bw / 2], bm.tile || tile.ceiling, { collide: false, castShadow: false }));
      }
    }
    // perimeter downstand so the beams land on something -- not across an
    // open side (the edge room's slab just stops there)
    const pw = bw * 0.8;
    const perimeter = {
      N: [[-W / 2, H - bh, -D / 2], [W / 2, H, -D / 2 + pw]], S: [[-W / 2, H - bh, D / 2 - pw], [W / 2, H, D / 2]],
      W: [[-W / 2, H - bh, -D / 2], [-W / 2 + pw, H, D / 2]], E: [[W / 2 - pw, H - bh, -D / 2], [W / 2, H, D / 2]]
    };
    for (const side of Object.keys(perimeter)) {
      if (open.has(side)) continue;
      const [a, b] = perimeter[side];
      group.add(archBox(mats, mat, a, b, bm.tile || tile.ceiling, { collide: false, castShadow: false }));
    }
  }

  // Extra architecture (pillars, counters, water, ledges, barriers).
  for (const b of rec.boxes || []) {
    const m = archBox(mats, b.mat || 'concrete', b.min, b.max, b.tile || tile.box, { collide: b.collide !== false, castShadow: b.shadow !== false });
    if (b.invisible) m.visible = false;
    if (b.floor) floors.push(m);
    group.add(m);
    if (m.userData.collide) walls.push(m);
  }

  // Company property.
  for (const p of rec.props || []) {
    const g = buildProp(mats, p, ctx);
    if (!g) continue;
    group.add(g);
    g.updateMatrixWorld(true);
    g.traverse((o) => { if (o.userData && o.userData.collide) walls.push(o); });
    if (p.name) named.set(p.name, g);
    if (p.swing || p.reach) animated.push({ group: g, spec: p, base: g.position.clone(), baseRot: g.rotation.clone() });
  }
  // Actors: named props with a path the stage drives (MG-03 C's manager
  // walks the aisle). t=0 is the first point, t=1 the last.
  const actors = {};
  for (const [name, a] of Object.entries(rec.actors || {})) {
    const g = named.get(name);
    if (!g || !a.path || a.path.length < 2) continue;
    const carry = (a.carry || []).map((n) => named.get(n)).filter(Boolean);
    const offsets = carry.map((c) => c.position.clone().sub(g.position));
    actors[name] = {
      set(t) {
        const u = Math.min(1, Math.max(0, t)) * (a.path.length - 1);
        const i = Math.min(a.path.length - 2, Math.floor(u));
        const f = u - i;
        const [x0, z0] = a.path[i], [x1, z1] = a.path[i + 1];
        g.position.x = x0 + (x1 - x0) * f;
        g.position.z = z0 + (z1 - z0) * f;
        carry.forEach((c, k) => { c.position.x = g.position.x + offsets[k].x; c.position.z = g.position.z + offsets[k].z; });
      }
    };
  }

  // Lights. `sun` is the C2 light: on the entrance (+z) side, aimed at the core.
  const amb = rec.ambient || { color: '#ffffff', intensity: 0.3 };
  const ambient = new THREE.AmbientLight(new THREE.Color(amb.color), amb.intensity);
  group.add(ambient);
  lights.push(ambient);
  if (rec.hemisphere) {
    const hemi = new THREE.HemisphereLight(new THREE.Color(rec.hemisphere.sky), new THREE.Color(rec.hemisphere.ground), rec.hemisphere.intensity || 0.4);
    group.add(hemi);
    lights.push(hemi);
  }
  const sunRec = rec.sun || { intensity: 0.9, color: '#ffffff' };
  if (sunRec.intensity > 0) {
    const sun = new THREE.DirectionalLight(new THREE.Color(sunRec.color || '#ffffff'), sunRec.intensity);
    const from = sunRec.from || [W * 0.15, H * 1.6, D * 0.6];
    sun.position.set(from[0], from[1], from[2]);
    const core = rec.core || [0, 0, -D / 2];
    sun.target.position.set(core[0], core[1], core[2]);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const ext = Math.max(W, D) * 0.75;
    sun.shadow.camera.left = -ext; sun.shadow.camera.right = ext;
    sun.shadow.camera.top = ext; sun.shadow.camera.bottom = -ext;
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = Math.max(W, D, H) * 3;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    group.add(sun, sun.target);
    lights.push(sun);
  }
  (rec.lights || []).forEach((l, i) => {
    let light;
    if (l.type === 'spot') {
      light = new THREE.SpotLight(new THREE.Color(l.color || '#ffffff'), l.intensity || 20, l.distance || 15, THREE.MathUtils.degToRad(l.angle || 40), l.penumbra || 0.5, l.decay === undefined ? 1.5 : l.decay);
      light.position.set(...l.pos);
      const t = l.target || [l.pos[0], 0, l.pos[2]];
      light.target.position.set(t[0], t[1], t[2]);
      group.add(light.target);
    } else {
      light = new THREE.PointLight(new THREE.Color(l.color || '#ffffff'), l.intensity || 10, l.distance || 12, l.decay === undefined ? 1.5 : l.decay);
      light.position.set(...l.pos);
    }
    group.add(light);
    lights.push(light);
    if (l.flicker) flickers.push({ light, base: light.intensity, amount: l.flicker, phase: hash01(i + 1) * 100, rate: 6 + hash01(i + 7) * 6 });
  });

  const spawn = rec.spawn || [0, D / 2 - 1.5, 0];
  return {
    group,
    walls,
    floors,
    lights,
    spawn: { x: spawn[0], z: spawn[1], yaw: spawn[2] || 0 },
    fog: rec.fog || null,
    background: rec.background || (rec.fog && rec.fog.color) || '#000000',
    footstep: rec.footstep || null,
    named,
    actors,
    // Per-frame: the sodium buzz -- a slow sag plus a fast jitter, per
    // light, never in unison.
    update(dt, t) {
      for (const f of flickers) {
        const slow = Math.sin(t * 0.7 + f.phase) * 0.5 + 0.5;
        const fast = hash01(Math.floor((t + f.phase) * f.rate)) ;
        const sag = 1 - f.amount * (0.25 * slow + 0.75 * (fast > 0.85 ? (fast - 0.85) * 6 : 0));
        f.light.intensity = f.base * sag;
      }
      for (const a of animated) {
        if (a.spec.swing) a.group.rotation.x = a.baseRot.x + Math.sin(t * 1.3) * 0.05 * Math.exp(-t * 0.03);
        if (a.spec.reach) a.group.position.y = a.base.y + Math.sin(t * 0.9) * 0.04;
      }
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      group.clear();
    }
  };
}
