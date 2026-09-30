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

import * as THREE from '../../vendor/three/three.module.js';
import { applyWorldUV } from './materials.js';
import { buildProp } from './props.js';

const WALL_T = 0.3;
const FLOOR_T = 0.2;

function archBox(mats, slot, min, max, tile, { collide = true, castShadow = true } = {}) {
  const w = max[0] - min[0], h = max[1] - min[1], d = max[2] - min[2];
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(min[0] + w / 2, min[1] + h / 2, min[2] + d / 2); // world-space geometry so UVs tile across boxes
  applyWorldUV(geo, tile);
  const mesh = new THREE.Mesh(geo, mats.get(slot));
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.userData.collide = collide;
  return mesh;
}

export function buildRoom(mats, rec) {
  const group = new THREE.Group();
  group.name = rec.id || rec.name || 'room';
  const walls = [];
  const floors = [];
  const lights = [];
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
  for (const side of Object.keys(shell)) {
    if (open.has(side)) continue;
    const m = archBox(mats, wallMat, shell[side][0], shell[side][1], tile.wall);
    group.add(m);
    walls.push(m);
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
    const g = buildProp(mats, p);
    if (!g) continue;
    group.add(g);
    g.updateMatrixWorld(true);
    g.traverse((o) => { if (o.userData && o.userData.collide) walls.push(o); });
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
    sun.shadow.mapSize.set(1024, 1024);
    const ext = Math.max(W, D) * 0.75;
    sun.shadow.camera.left = -ext; sun.shadow.camera.right = ext;
    sun.shadow.camera.top = ext; sun.shadow.camera.bottom = -ext;
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = Math.max(W, D, H) * 3;
    sun.shadow.bias = -0.0015;
    group.add(sun, sun.target);
    lights.push(sun);
  }
  for (const l of rec.lights || []) {
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
  }

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
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      group.clear();
    }
  };
}
