// Company-owned things, built from boxes (canon C1: everything the company
// owns is low-poly). Every builder returns a THREE.Group whose meshes use
// the flat-shaded, vertex-snapped lp_* materials from materials.js -- the
// archetypes mirror blender/prop_builders.py (build_chair, build_door,
// build_shelving_bay, add_car_details, ...) so the walkable rooms read as
// the same props the Blender pilots were built from.
//
// Spec: { type, pos: [x, y, z], rot: yawDeg, scale?, mat?, ...typeOpts }.
// Props that need collision (desks, cars, shelves, pillars) mark their
// footprint mesh with userData.collide so room.js can add it to the wall
// list. NPC figures never blink and never look up (C5): they are static.

import * as THREE from '../../vendor/three/three.module.js';
import { applyWorldUV } from './materials.js';

function box(mats, slot, w, h, d, x = 0, y = 0, z = 0, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mats.get(slot));
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = opts.castShadow !== false;
  mesh.receiveShadow = true;
  if (opts.collide) mesh.userData.collide = true;
  return mesh;
}

function cylinder(mats, slot, r, h, x = 0, y = 0, z = 0, seg = 8, opts = {}) {
  const geo = new THREE.CylinderGeometry(r, r, h, seg);
  const mesh = new THREE.Mesh(geo, mats.get(slot));
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (opts.collide) mesh.userData.collide = true;
  return mesh;
}

const BUILDERS = {
  // Seat with cushion lip, rail-frame backrest with gapped slats (build_chair).
  chair(mats, o) {
    const g = new THREE.Group();
    const m = o.mat || 'lp_red';
    g.add(box(mats, m, 0.5, 0.08, 0.5, 0, 0.42, 0));
    g.add(box(mats, m, 0.5, 0.03, 0.06, 0, 0.5, -0.22)); // cushion lip
    for (const [x, z] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) g.add(box(mats, 'lp_dark', 0.04, 0.42, 0.04, x, 0, z));
    g.add(box(mats, m, 0.04, 0.5, 0.04, -0.23, 0.5, -0.23));
    g.add(box(mats, m, 0.04, 0.5, 0.04, 0.23, 0.5, -0.23));
    for (let i = 0; i < 3; i++) g.add(box(mats, m, 0.46, 0.07, 0.03, 0, 0.58 + i * 0.13, -0.235));
    return g;
  },
  // Desk slab, four legs, drawer front (add_desk_drawer).
  desk(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 1.6, d = o.d || 0.8, m = o.mat || 'lp_wood';
    g.add(box(mats, m, w, 0.05, d, 0, 0.72, 0, { collide: true }));
    for (const [x, z] of [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]]) g.add(box(mats, m, 0.06, 0.72, 0.06, x, 0, z));
    g.add(box(mats, m, 0.42, 0.14, 0.02, w / 2 - 0.3, 0.55, d / 2 - 0.02)); // drawer front
    g.add(box(mats, 'lp_dark', 0.08, 0.02, 0.01, w / 2 - 0.3, 0.61, d / 2));
    const body = box(mats, m, w, 0.72, d, 0, 0, 0, { castShadow: false });
    body.visible = false; body.userData.collide = true; g.add(body);
    return g;
  },
  // CRT housing on a stand (add_monitor_stand). `on` lights the screen.
  monitor(mats, o) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_beige', 0.42, 0.34, 0.36, 0, 0.1, 0));
    const screen = box(mats, o.on ? 'lp_screen' : 'lp_screen_off', 0.32, 0.24, 0.02, 0, 0.15, 0.18);
    screen.userData.screen = true; // stage.screenRect(): where MG-05 C's requisition sheet is projected
    g.add(screen);
    g.add(box(mats, 'lp_beige', 0.24, 0.1, 0.24, 0, 0, 0));
    g.add(box(mats, 'lp_beige', 0.3, 0.02, 0.3, 0, -0.02, 0));
    return g;
  },
  stapler(mats) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_dark', 0.06, 0.03, 0.18, 0, 0, 0));
    g.add(box(mats, 'lp_dark', 0.05, 0.03, 0.17, 0, 0.035, -0.01));
    return g;
  },
  // A stack of papers: the only photoreal paper in the game is the
  // manager's evidence (Doc 1 §5 S4) -- pass mat 'plaster_blown' for it.
  papers(mats, o) {
    const g = new THREE.Group();
    g.add(box(mats, o.mat || 'lp_paper', 0.21, o.h || 0.04, 0.3, 0, 0, 0));
    return g;
  },
  // The 99 slip. Never more than one per room after S1 (Track C motif 2).
  slip(mats) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_paper', 0.08, 0.004, 0.05, 0, 0, 0));
    return g;
  },
  // C8: the same handless clock in every room.
  clock(mats) {
    const g = new THREE.Group();
    const face = cylinder(mats, 'lp_white', 0.22, 0.03, 0, 0, 0, 16);
    face.rotation.x = Math.PI / 2;
    face.position.set(0, 0, 0);
    g.add(face);
    const rim = cylinder(mats, 'lp_dark', 0.24, 0.02, 0, 0, 0, 16);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 0, -0.01);
    g.add(rim);
    return g;
  },
  // Cubicle partition run (S4_C): panels on a base rail.
  partition(mats, o) {
    const g = new THREE.Group();
    const len = o.len || 2.0, h = o.h || 1.3;
    g.add(box(mats, o.mat || 'lp_grey', len, h, 0.06, 0, 0, 0, { collide: true }));
    g.add(box(mats, 'lp_dark', len, 0.05, 0.08, 0, 0, 0));
    g.add(box(mats, 'lp_dark', len, 0.03, 0.08, 0, h - 0.03, 0));
    return g;
  },
  // Utility / office door in a frame (build_door).
  door(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 0.9, h = o.h || 2.1, m = o.mat || 'lp_beige';
    g.add(box(mats, 'lp_dark', w + 0.12, h + 0.06, 0.1, 0, 0, 0));
    g.add(box(mats, m, w, h, 0.05, 0, 0, 0.04));
    g.add(box(mats, 'lp_dark', w - 0.2, h * 0.4, 0.015, 0, h * 0.5, 0.07));
    g.add(box(mats, 'lp_brass', 0.03, 0.03, 0.1, w / 2 - 0.1, h * 0.47, 0.08)); // handle
    return g;
  },
  // Locked lobby glass doors (S3_H): two leaves, push bars, dark frame.
  glassdoors(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 2.4, h = o.h || 2.8;
    g.add(box(mats, 'lp_dark', w + 0.2, h + 0.1, 0.12, 0, 0, 0, { collide: true }));
    for (const s of [-1, 1]) {
      g.add(box(mats, 'lp_glass', w / 2 - 0.08, h - 0.1, 0.03, s * w / 4, 0.05, 0));
      g.add(box(mats, 'lp_dark', 0.05, h, 0.14, s * (w / 2 - 0.03), 0, 0));
      g.add(box(mats, 'lp_brass', w / 2 - 0.3, 0.04, 0.06, s * w / 4, 1.0, 0.1)); // push bar
    }
    g.add(box(mats, 'lp_dark', 0.05, h, 0.14, 0, 0, 0));
    return g;
  },
  // Heavy red velvet curtain across an opening (S3_C).
  curtain(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 3.0, h = o.h || 3.0;
    const folds = Math.max(4, Math.round(w / 0.25));
    for (let i = 0; i < folds; i++) {
      const x = -w / 2 + (i + 0.5) * (w / folds);
      g.add(box(mats, 'lp_curtain', w / folds, h, 0.08 + (i % 2) * 0.06, x, 0, 0, { collide: true }));
    }
    g.add(box(mats, 'lp_brass', w + 0.2, 0.06, 0.12, 0, h, 0));
    return g;
  },
  // Green ENTER sign housing above the curtain: lit, wordless (canon: no legible text).
  sign(mats, o) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_dark', (o.w || 0.9) + 0.06, (o.h || 0.3) + 0.06, 0.12, 0, 0, 0));
    g.add(box(mats, 'lp_sign', o.w || 0.9, o.h || 0.3, 0.02, 0, 0.03, 0.06));
    return g;
  },
  // Badge reader with a red laser slot.
  badgereader(mats) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_grey', 0.16, 0.24, 0.05, 0, 0, 0));
    g.add(box(mats, 'lp_red', 0.1, 0.01, 0.02, 0, 0.1, 0.04));
    return g;
  },
  // Reception counter + glass (S1): counter slab, kick, glass pane.
  counter(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 4.0, d = o.d || 0.8, h = o.h || 1.1;
    g.add(box(mats, o.mat || 'lp_dark', w, h, d, 0, 0, 0, { collide: true }));
    g.add(box(mats, 'lp_beige', w + 0.1, 0.06, d + 0.1, 0, h, 0));
    if (o.glass !== false) g.add(box(mats, 'lp_glass', w, 1.4, 0.03, 0, h + 0.06, -d / 2 + 0.1));
    return g;
  },
  // Ticket dispenser on a post.
  dispenser(mats) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_dark', 0.06, 1.1, 0.06, 0, 0, 0));
    g.add(box(mats, 'lp_red', 0.22, 0.28, 0.18, 0, 1.1, 0));
    g.add(box(mats, 'lp_paper', 0.06, 0.01, 0.06, 0, 1.2, 0.1));
    return g;
  },
  // Static figure: blocky torso, head, arms, legs. `face` 'blur' tints the head grey.
  figure(mats, o) {
    const g = new THREE.Group();
    const suit = o.suit || 'lp_suit';
    g.add(box(mats, suit, 0.44, 0.6, 0.24, 0, 0.9, 0));
    g.add(box(mats, suit, 0.56, 0.1, 0.26, 0, 1.44, 0)); // shoulders
    g.add(box(mats, 'lp_skin', 0.1, 0.06, 0.1, 0, 1.5, 0)); // neck
    g.add(box(mats, o.face === 'blur' ? 'lp_grey' : 'lp_skin', 0.22, 0.24, 0.22, 0, 1.56, 0));
    g.add(box(mats, 'lp_dark', 0.24, 0.08, 0.24, 0, 1.78, 0)); // hair
    for (const s of [-1, 1]) {
      g.add(box(mats, suit, 0.12, 0.58, 0.12, s * 0.3, 0.92, 0));
      g.add(box(mats, 'lp_skin', 0.1, 0.12, 0.1, s * 0.3, 0.8, 0)); // low-poly hands (C6)
      g.add(box(mats, 'lp_dark', 0.16, 0.9, 0.16, s * 0.12, 0, 0));
    }
    if (o.tie) g.add(box(mats, 'lp_red', 0.06, 0.4, 0.01, 0, 1.05, 0.125)); // four flat polygons
    if (o.seated) { for (const c of g.children) c.position.y -= 0.45; } // legs into the seat: the torso sits at chair height
    return g;
  },
  // Rusted low-poly car (add_car_details): body, hood and trunk decks,
  // cabin with a glass band, bumpers, 8-sided wheels, lit tail lights.
  // `hero` adds the rust panel and an open driver's door (S5-H's fifth
  // car, "door open, key in the ignition"). Nothing here is textured (C1).
  car(mats, o) {
    const g = new THREE.Group();
    const m = o.mat || 'lp_car';
    const L = o.len || 4.4, W = o.w || 1.8;
    const sill = 0.32; // underbody clearance
    g.add(box(mats, m, W, 0.5, L * 0.98, 0, sill, 0, { collide: true }));            // body tub
    g.add(box(mats, m, W - 0.1, 0.16, L * 0.3, 0, sill + 0.5, L * 0.32));              // hood
    g.add(box(mats, m, W - 0.1, 0.2, L * 0.24, 0, sill + 0.5, -L * 0.36));             // trunk deck
    g.add(box(mats, m, W - 0.28, 0.14, L * 0.44, 0, sill + 0.5 + 0.44, -L * 0.03));    // roof
    g.add(box(mats, 'lp_glass', W - 0.34, 0.34, L * 0.44 + 0.02, 0, sill + 0.5 + 0.1, -L * 0.03)); // glass band
    for (const s of [-1, 1]) g.add(box(mats, 'lp_dark', 0.03, 0.34, L * 0.44, s * (W / 2 - 0.16), sill + 0.5 + 0.1, -L * 0.03)); // pillars
    g.add(box(mats, 'lp_chrome', W + 0.04, 0.12, 0.1, 0, sill - 0.02, L / 2 - 0.02));   // bumpers
    g.add(box(mats, 'lp_chrome', W + 0.04, 0.12, 0.1, 0, sill - 0.02, -L / 2 + 0.02));
    for (const s of [-1, 1]) {
      g.add(box(mats, 'lp_taillight', 0.28, 0.1, 0.03, s * (W / 2 - 0.25), sill + 0.3, -L / 2 - 0.005));
      g.add(box(mats, 'lp_headlight', 0.24, 0.12, 0.03, s * (W / 2 - 0.25), sill + 0.28, L / 2 - 0.005));
      g.add(box(mats, 'lp_dark', 0.06, 0.05, 0.16, s * (W / 2 + 0.02), sill + 0.62, L * 0.12)); // mirrors
    }
    for (const [x, z] of [[-W / 2 + 0.08, L * 0.32], [W / 2 - 0.08, L * 0.32], [-W / 2 + 0.08, -L * 0.32], [W / 2 - 0.08, -L * 0.32]]) {
      const wheel = cylinder(mats, 'lp_black', 0.32, 0.22, x, 0, z, 8);
      wheel.rotation.z = Math.PI / 2; wheel.position.y = 0.32;
      g.add(wheel);
      const hub = cylinder(mats, 'lp_grey', 0.14, 0.24, x, 0, z, 8);
      hub.rotation.z = Math.PI / 2; hub.position.y = 0.32;
      g.add(hub);
      g.add(box(mats, m, 0.1, 0.36, 0.8, x + (x < 0 ? 0.02 : -0.02), sill + 0.2, z)); // arch
    }
    if (o.hero) {
      g.add(box(mats, 'lp_rust', W * 0.5, 0.1, L * 0.3, 0.12, sill + 0.55, L * 0.15)); // one rust panel
      const door = box(mats, m, 0.05, 0.62, L * 0.22, 0, sill + 0.1, 0);
      door.position.set(W / 2 + L * 0.09, sill + 0.41, -L * 0.02);
      door.rotation.y = -Math.PI / 3; // hanging open
      g.add(door);
    }
    return g;
  },
  // Elevator button panel: 66 unlabelled buttons, one lit (motif 6).
  panel(mats, o) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_grey', 0.42, 1.2, 0.04, 0, 0, 0));
    const cols = 6, rows = 11, lit = o.lit === undefined ? 41 : o.lit;
    for (let i = 0; i < 66; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      g.add(box(mats, i === lit ? 'lp_sign' : 'lp_dark', 0.04, 0.04, 0.02, -0.15 + c * 0.06, 0.1 + r * 0.095, 0.03));
    }
    return g;
  },
  // Steel shelving bay (build_shelving_bay): uprights + tiers.
  shelf(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 2.0, d = o.d || 0.6, tiers = o.tiers || 4, h = o.h || 1.8;
    const body = box(mats, 'lp_grey', w, h, d, 0, 0, 0, { castShadow: false, collide: true });
    body.visible = false; // invisible collision body; the visible bay is the uprights + tiers below
    g.add(body);
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) g.add(box(mats, 'lp_grey', 0.05, h, 0.05, x, 0, z));
    for (let t = 0; t < tiers; t++) {
      const y = 0.15 + t * ((h - 0.2) / (tiers - 1));
      g.add(box(mats, 'lp_grey', w, 0.03, d, 0, y, 0));
      // goods: a few beige/red boxes per tier
      for (let k = 0; k < 4; k++) g.add(box(mats, k % 3 === 0 ? 'lp_red' : 'lp_beige', 0.28, 0.22, 0.25, -w / 2 + 0.3 + k * (w / 4.2), y + 0.03, 0));
    }
    return g;
  },
  // Cooler wall unit with lit glass doors (store).
  cooler(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 4.0;
    g.add(box(mats, 'lp_grey', w, 2.2, 0.8, 0, 0, 0, { collide: true }));
    const n = Math.round(w / 0.9);
    for (let i = 0; i < n; i++) g.add(box(mats, 'lp_screen', 0.75, 1.8, 0.02, -w / 2 + 0.45 + i * (w / n), 0.2, 0.41));
    return g;
  },
  // Cardboard tower: stacked boxes with slight offsets (MR_BoxTowers).
  boxtower(mats, o) {
    const g = new THREE.Group();
    const n = o.n || 6;
    let y = 0;
    for (let i = 0; i < n; i++) {
      const s = 0.7 + ((i * 37) % 5) * 0.06;
      g.add(box(mats, 'cardboard', s, 0.5, s, ((i * 13) % 3 - 1) * 0.06, y, ((i * 7) % 3 - 1) * 0.06, { collide: i === 0 }));
      y += 0.5;
    }
    return g;
  },
  // Soggy package on a counter (S8_C): dark, wet, a ring under it.
  package(mats) {
    const g = new THREE.Group();
    g.add(box(mats, 'cardboard', 0.5, 0.32, 0.36, 0, 0.01, 0));
    g.add(box(mats, 'lp_black', 0.62, 0.005, 0.46, 0, 0, 0));
    return g;
  },
  // Mop sink: a squat basin.
  mopsink(mats) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_grey', 0.7, 0.3, 0.7, 0, 0, 0, { collide: true }));
    g.add(box(mats, 'lp_dark', 0.6, 0.02, 0.6, 0, 0.3, 0));
    g.add(box(mats, 'lp_grey', 0.04, 0.5, 0.04, -0.2, 0.3, -0.3));
    return g;
  },
  // Floor drain disc.
  drain(mats) {
    const g = new THREE.Group();
    const d = cylinder(mats, 'lp_black', 0.18, 0.01, 0, 0, 0, 8);
    g.add(d);
    return g;
  },
  // Structural column: photoreal (building-owned) unless mat is lp_*. A
  // plinth and a cap so it meets floor and ceiling like poured concrete,
  // and an optional painted band (`band`, `bandH`) low down the way the
  // garage's columns carry the bay colour.
  pillar(mats, o) {
    const g = new THREE.Group();
    const m = o.mat || 'concrete';
    const w = o.w || 0.6, h = o.h || 3.2;
    const p = box(mats, m, w, h, w, 0, 0, 0, { collide: true });
    applyWorldUV(p.geometry, o.tile || 1.5);
    g.add(p);
    const plinth = box(mats, m, w + 0.12, 0.12, w + 0.12, 0, 0, 0, { castShadow: false });
    applyWorldUV(plinth.geometry, o.tile || 1.5);
    g.add(plinth);
    if (o.cap !== false) {
      const cap = box(mats, m, w + 0.3, 0.3, w + 0.3, 0, h - 0.3, 0, { castShadow: false });
      applyWorldUV(cap.geometry, o.tile || 1.5);
      g.add(cap);
    }
    if (o.band) {
      const band = box(mats, o.band, w + 0.02, o.bandH || 1.0, w + 0.02, 0, 0.12, 0, { castShadow: false });
      applyWorldUV(band.geometry, 1.5);
      g.add(band);
    }
    return g;
  },
  // Ceiling fluorescent: recessed housing, lit diffuser, a soft additive
  // glow plate hanging just under it -- the building's light (C1).
  fluoro(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 1.2, d = o.d || 0.3;
    g.add(box(mats, 'lp_grey', w + 0.08, 0.05, d + 0.08, 0, 0.02, 0, { castShadow: false }));
    g.add(box(mats, 'lp_fluoro', w, 0.04, d, 0, 0, 0, { castShadow: false }));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.6, d * 2.6), mats.get('glow_fluoro'));
    glow.rotation.x = Math.PI / 2; glow.position.y = -0.06;
    g.add(glow);
    return g;
  },
  // Sodium fixture (garage): a hooded housing on a stem, the orange tube,
  // and a glow plate. `flicker` is read by room.js's light pass.
  sodium(mats) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_dark', 0.06, 0.25, 0.06, 0, 0.12, 0, { castShadow: false }));      // stem
    g.add(box(mats, 'lp_dark', 0.7, 0.1, 0.32, 0, 0.02, 0, { castShadow: false }));        // hood
    g.add(box(mats, 'lp_sodium', 0.56, 0.06, 0.16, 0, -0.03, 0, { castShadow: false }));   // tube
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.7), mats.get('glow_sodium'));
    glow.rotation.x = Math.PI / 2; glow.position.y = -0.08;
    g.add(glow);
    return g;
  },
  // Pendant bulb (the run's ceiling lamps): cord, shade, bulb, glow.
  pendant(mats, o) {
    const g = new THREE.Group();
    const drop = o.drop || 0.6;
    g.add(box(mats, 'lp_black', 0.02, drop, 0.02, 0, -drop, 0, { castShadow: false }));
    const shade = cylinder(mats, 'lp_dark', 0.22, 0.16, 0, -drop - 0.16, 0, 10);
    g.add(shade);
    g.add(box(mats, 'lp_fluoro', 0.1, 0.08, 0.1, 0, -drop - 0.2, 0, { castShadow: false }));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mats.get('glow_fluoro'));
    glow.rotation.x = Math.PI / 2; glow.position.y = -drop - 0.25;
    g.add(glow);
    return g;
  },
  // Wall-mounted signage plate: a blank painted rectangle (the garage's
  // red bay markers). Wordless (canon: no legible text in the world).
  wallplate(mats, o) {
    const g = new THREE.Group();
    g.add(box(mats, o.mat || 'lp_red', o.w || 1.2, o.h || 0.5, 0.03, 0, 0, 0, { castShadow: false }));
    return g;
  },
  // Exposed services along a ceiling: a run of pipe / cable tray.
  pipe(mats, o) {
    const g = new THREE.Group();
    const len = o.len || 6, r = o.r || 0.08;
    const pipe = cylinder(mats, o.mat || 'lp_grey', r, len, 0, 0, 0, 8);
    pipe.rotation.z = Math.PI / 2; pipe.position.y = 0;
    g.add(pipe);
    for (let x = -len / 2 + 0.5; x < len / 2; x += 2.0) g.add(box(mats, 'lp_dark', 0.06, 0.25, 0.06, x, 0, 0, { castShadow: false }));
    return g;
  },
  // Floor emblem: the V&A monogram as a gold disc set in the marble.
  emblem(mats, o) {
    const g = new THREE.Group();
    const r = o.r || 1.4;
    const outer = cylinder(mats, 'lp_brass', r, 0.01, 0, 0, 0, 24);
    const inner = cylinder(mats, 'lp_dark', r * 0.72, 0.012, 0, 0, 0, 24);
    g.add(outer, inner);
    return g;
  },
  // Placard: a small wordless plate on the wall (text is engine-side).
  placard(mats) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_beige', 0.6, 0.18, 0.02, 0, 0, 0));
    return g;
  },
  // ---- Added for the 3D-only build (every scene is a live set now) ----
  // Keyboard under his hands (S0): a slab with a key field, low-poly (C6).
  keyboard(mats) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_beige', 0.46, 0.025, 0.16, 0, 0, 0));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) g.add(box(mats, 'lp_dark', 0.028, 0.012, 0.028, -0.2 + c * 0.036, 0.025, -0.055 + r * 0.036, { castShadow: false }));
    return g;
  },
  // His hands: blocky, four-fingered, untextured, low-poly from the very
  // first shot (C6). (No longer in the pool scenes: removed at the
  // author's request, with the `reach` pose that lifted them in the dive.)
  // `slip` puts the 99 slip between the fingers (PENDING REVIEW).
  hands(mats, o) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const h = new THREE.Group();
      h.add(box(mats, 'lp_skin', 0.09, 0.035, 0.11, 0, 0, 0));
      for (let f = 0; f < 4; f++) h.add(box(mats, 'lp_skin', 0.018, 0.022, 0.07, -0.032 + f * 0.021, 0.004, -0.08));
      h.add(box(mats, 'lp_skin', 0.02, 0.022, 0.05, s * 0.055, 0.004, -0.01)); // thumb
      h.add(box(mats, 'lp_suit', 0.1, 0.05, 0.1, 0, -0.008, 0.09)); // cuff
      h.position.set(s * 0.11, 0, 0);
      g.add(h);
    }
    if (o.slip) g.add(box(mats, 'lp_paper', 0.08, 0.003, 0.05, 0.0, 0.03, -0.06));
    return g;
  },
  mug(mats) {
    const g = new THREE.Group();
    const m = cylinder(mats, 'lp_white', 0.04, 0.09, 0, 0, 0, 8);
    g.add(m);
    g.add(box(mats, 'lp_white', 0.015, 0.05, 0.03, 0.05, 0.02, 0));
    return g;
  },
  // Desk lamp: base, stem, shade, a lit bulb face.
  lamp(mats) {
    const g = new THREE.Group();
    g.add(cylinder(mats, 'lp_dark', 0.08, 0.02, 0, 0, 0, 8));
    g.add(box(mats, 'lp_dark', 0.02, 0.36, 0.02, 0, 0.02, 0));
    const shade = cylinder(mats, 'lp_brass', 0.1, 0.12, 0, 0.3, 0, 8);
    g.add(shade);
    g.add(box(mats, 'lp_fluoro', 0.08, 0.01, 0.08, 0, 0.3, 0, { castShadow: false }));
    return g;
  },
  // A facade block (the street's fallback for the catalog buildings and
  // the tower): photoreal brick/plaster, dark window bands, no interior.
  building(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 10, h = o.h || 16, d = o.d || 9;
    const m = o.mat || 'plaster_dark';
    const body = box(mats, m, w, h, d, 0, 0, 0, { collide: true });
    applyWorldUV(body.geometry, 3.0);
    g.add(body);
    for (let y = 3.0; y < h - 1.0; y += 3.4) {
      const band = box(mats, 'glass_dark', w + 0.04, 1.3, d + 0.04, 0, y, 0, { castShadow: false });
      g.add(band);
    }
    return g;
  },
  // Street lamp post (fallback for the catalog lamps): a pole, an arm, a lit head.
  lamppost(mats) {
    const g = new THREE.Group();
    g.add(cylinder(mats, 'lp_dark', 0.08, 5.0, 0, 0, 0, 8));
    g.add(box(mats, 'lp_dark', 0.08, 0.08, 1.2, 0, 4.9, -0.6));
    g.add(box(mats, 'lp_fluoro', 0.3, 0.12, 0.5, 0, 4.82, -1.1, { castShadow: false }));
    return g;
  },
  // The boardroom table: a long dark glass slab on two plinths.
  table(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 2.0, d = o.d || 10.0;
    g.add(box(mats, 'glass_dark', w, 0.05, d, 0, 0.74, 0, { collide: true }));
    g.add(box(mats, 'lp_dark', w - 0.6, 0.72, 0.5, 0, 0, -d / 2 + 1.2));
    g.add(box(mats, 'lp_dark', w - 0.6, 0.72, 0.5, 0, 0, d / 2 - 1.2));
    const body = box(mats, 'lp_dark', w, 0.74, d, 0, 0, 0, { castShadow: false });
    body.visible = false; body.userData.collide = true; g.add(body);
    return g;
  },
  // A bench against the garage wall (S6 H: STOP sits him down on it).
  bench(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 1.8;
    g.add(box(mats, o.mat || 'lp_wood', w, 0.05, 0.4, 0, 0.44, 0, { collide: true }));
    g.add(box(mats, o.mat || 'lp_wood', w, 0.3, 0.04, 0, 0.55, -0.2));
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) g.add(box(mats, 'lp_dark', 0.06, 0.44, 0.36, x, 0, 0));
    const body = box(mats, 'lp_dark', w, 0.6, 0.45, 0, 0, 0, { castShadow: false, collide: true });
    body.visible = false; g.add(body);
    return g;
  },
  // Pneumatic tube station (S6 C: ORDER sends the requisition down it).
  tubestation(mats, o) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_grey', 0.7, 1.9, 0.45, 0, 0, 0, { collide: true }));
    g.add(box(mats, 'lp_dark', 0.5, 0.3, 0.05, 0, 1.15, 0.24));
    g.add(cylinder(mats, 'lp_glass', 0.09, 1.3, 0, 1.9, 0.0));
    g.add(box(mats, 'lp_brass', 0.22, 0.06, 0.12, 0, 0.98, 0.26));
    g.add(box(mats, 'lp_sign', 0.08, 0.08, 0.04, 0.22, 1.6, 0.24)); // the green lamp
    return g;
  },
  // A red box on a post with a handset (S6 C: FLAG objects to the requisition).
  flagbox(mats, o) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_dark', 0.08, 1.2, 0.08, 0, 0, 0, { collide: true }));
    g.add(box(mats, 'lp_red', 0.42, 0.5, 0.26, 0, 1.15, 0));
    g.add(box(mats, 'lp_black', 0.08, 0.26, 0.06, 0.12, 1.25, 0.16)); // handset
    g.add(box(mats, 'lp_taillight', 0.06, 0.06, 0.03, -0.12, 1.5, 0.14)); // the red lamp
    return g;
  },
  // Box cutter on the sorting table (S8 C: OPEN THE BOX).
  boxcutter(mats) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_brass', 0.14, 0.02, 0.03, 0, 0, 0));
    g.add(box(mats, 'lp_chrome', 0.04, 0.008, 0.015, 0.09, 0.006, 0));
    return g;
  },
  // ---- polish: S0 + street -- begin (that scene's new props go between these lines) ----
  // ---- polish: S0 + street -- end ----
  //
  // ---- polish: S1-S2 waiting room -- begin (that scene's new props go between these lines) ----
  // ---- polish: S1-S2 waiting room -- end ----
  //
  // ---- polish: S3 threshold -- begin (that scene's new props go between these lines) ----
  // ---- polish: S3 threshold -- end ----
  //
  // ---- polish: S4 floor -- begin (that scene's new props go between these lines) ----
  // ---- polish: S4 floor -- end ----
  //
  // ---- polish: S5-S6 desk / garage -- begin (that scene's new props go between these lines) ----
  // ---- polish: S5-S6 desk / garage -- end ----
  //
  // ---- polish: S7 descent -- begin (that scene's new props go between these lines) ----
  // ---- polish: S7 descent -- end ----
  //
  // ---- polish: S8 + endings -- begin (that scene's new props go between these lines) ----
  // A few of these animate themselves from onBeforeRender (the throb, the
  // spreading stain, the curtain, the particulate): room.js has no per-prop
  // animation beyond `swing`, and these must start when they are first SEEN,
  // not when the page loaded. onBeforeRender only fires for what the camera
  // actually draws, so "first rendered" is "first seen".
  //
  // The soggy package (S8 C): low-poly cardboard with a wet stain soaking up
  // through it, taped shut, and a throb -- an arrhythmic swell of the box
  // itself (Doc 1 §5 S8: "It throbs."). `open` is the box after OPEN THE
  // BOX: flaps up, the application inside (his handwriting; Doc 1). There is
  // no ring here: that is `wetring`, a prop of its own, so it stays on the
  // counter when the package is lifted. Held in the hands it throbs too.
  soggypackage(mats, o) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const w = 0.5, h = 0.32, d = 0.36;
    const wet = 'wood'; // the photoreal dark-brown blotch of soaked cardboard
    if (!o.open) {
      body.add(box(mats, 'cardboard', w, h, d, 0, 0, 0));
      body.add(box(mats, 'lp_beige', w + 0.006, 0.004, 0.07, 0, h, 0, { castShadow: false })); // tape over the lid seam
      body.add(box(mats, 'lp_beige', 0.07, h * 0.4, d + 0.006, 0, h * 0.6, 0, { castShadow: false })); // and down the ends
    } else {
      body.add(box(mats, 'cardboard', w, 0.012, d, 0, 0, 0)); // bottom
      for (const s of [-1, 1]) {
        body.add(box(mats, 'cardboard', w, h, 0.012, 0, 0, s * (d / 2 - 0.006)));
        body.add(box(mats, 'cardboard', 0.012, h, d, s * (w / 2 - 0.006), 0, 0));
        // the flaps, folded back open (the tape slit down the middle)
        const fz = box(mats, 'cardboard', w, 0.008, d / 2, 0, 0, 0);
        fz.position.set(0, h + Math.sin(1.1) * d / 4, s * (d / 2 + Math.cos(1.1) * d / 4));
        fz.rotation.x = -s * 1.1;
        body.add(fz);
        const fx = box(mats, 'cardboard', w / 2.2, 0.008, d, 0, 0, 0);
        fx.position.set(s * (w / 2 + Math.cos(1.25) * w / 4.4), h + Math.sin(1.25) * w / 4.4, 0);
        fx.rotation.z = s * 1.25;
        body.add(fx);
      }
      // inside: the intake form, his answers, received six months ago --
      // leaning up against the far wall so it is read from standing, and a
      // second sheet slid out onto the table in front of the box
      const sheet = (tilt, x, y, z, ry) => {
        const sh = new THREE.Group();
        sh.add(box(mats, 'lp_paper', 0.21, 0.004, 0.297, 0, 0, 0, { castShadow: false }));
        for (let i = 0; i < 7; i++) sh.add(box(mats, 'lp_dark', 0.15 - (i % 3) * 0.03, 0.002, 0.007, -0.02 + (i % 3) * 0.008, 0.004, -0.115 + i * 0.036, { castShadow: false })); // the lines of his hand
        sh.position.set(x, y, z);
        sh.rotation.set(tilt, ry, 0, 'YXZ');
        body.add(sh);
      };
      sheet(1.0, 0.03, 0.012 + 0.1485 * Math.sin(1.0), -d / 2 + 0.014 + 0.1485 * Math.cos(1.0), 0.06);
      sheet(0, -0.06, 0.0, d / 2 + 0.1, -0.35);
      body.add(box(mats, wet, w * 0.7, 0.002, d * 0.6, -0.04, 0.013, 0.03, { castShadow: false })); // the wet has gone through to the floor of the box
    }
    // the stain: dark and wet from the base up, creeping higher in tongues
    body.add(box(mats, wet, w + 0.008, h * 0.42, d + 0.008, 0, -0.002, 0, { castShadow: false }));
    for (const [x, z, sh] of [[-0.12, 1, 0.66], [0.15, 1, 0.55], [0.02, -1, 0.72], [-0.2, -1, 0.5]]) {
      body.add(box(mats, wet, 0.09 + Math.abs(x) * 0.2, h * sh, 0.004, x, -0.002, z * (d / 2 + 0.005), { castShadow: false }));
    }
    for (const [z, s, sh] of [[0.05, 1, 0.62], [-0.08, -1, 0.7]]) {
      body.add(box(mats, wet, 0.004, h * sh, 0.1, s * (w / 2 + 0.005), -0.002, z, { castShadow: false }));
    }
    if (!o.open && o.throb !== false) {
      const amount = typeof o.throb === 'number' ? o.throb : 0.035;
      body.children[0].onBeforeRender = () => {
        const t = performance.now() / 1000;
        // two pulses that never quite line up: arrhythmic, like something inside
        const a = Math.pow(Math.max(0, Math.sin(t * 4.3)), 12) * 0.65 + Math.pow(Math.max(0, Math.sin(t * 2.7 + 1.3)), 16) * 0.45;
        const k = amount * a;
        body.scale.set(1 + k, 1 + k * 0.7, 1 + k);
      };
    }
    return g;
  },
  // The dark wet ring the package leaves (Doc 1 §5 S8, Doc 2 S8_C): the
  // outline of a soggy box bottom, and a fainter seep inside it. It spreads
  // from the moment it is first seen (`spread`: how far, as a fraction;
  // Doc 2: by a few millimetres on the counter, visibly across the glass).
  wetring(mats, o) {
    const g = new THREE.Group();
    const ring = new THREE.Group();
    g.add(ring);
    const w = o.w || 0.6, d = o.d || 0.46, t = o.t || 0.04;
    const m = o.mat || 'concrete_wet';
    const flat = { castShadow: false };
    ring.add(box(mats, m, w, 0.003, t, 0, 0, -d / 2 + t / 2, flat));
    ring.add(box(mats, m, w, 0.003, t, 0, 0, d / 2 - t / 2, flat));
    ring.add(box(mats, m, t, 0.003, d - 2 * t, -w / 2 + t / 2, 0, 0, flat));
    ring.add(box(mats, m, t, 0.003, d - 2 * t, w / 2 - t / 2, 0, 0, flat));
    ring.add(box(mats, m, w * 0.62, 0.0012, d * 0.5, 0.03, 0, 0.02, flat)); // the seep inside
    ring.add(box(mats, m, t * 1.6, 0.003, t * 2.2, w / 2 + t * 0.4, 0, d * 0.18, flat)); // where it ran
    const k = o.spread === undefined ? 0.06 : o.spread;
    if (k > 0) {
      let t0 = null;
      ring.children[0].onBeforeRender = () => {
        const now = performance.now() / 1000;
        if (t0 === null) t0 = now;
        const s = 1 + k * (1 - Math.exp(-(now - t0) / 30));
        ring.scale.set(s, 1, s);
      };
    }
    return g;
  },
  // A figure whose face is a blurred texture map (Doc 1 §5 S8 and §6.4; Doc
  // 2 S8_C: "a clerk ... whose face is a smeared unreadable texture map"):
  // the usual figure, a smeared portrait laid over the front of its head --
  // something that was a face, run sideways until nothing can be read. Every
  // blurfigure shares one small canvas texture. Static (C5).
  blurfigure(mats, o) {
    const g = BUILDERS.figure(mats, { ...o, face: 'blur' });
    const self = BUILDERS.blurfigure;
    if (!self._mat && typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const x = c.getContext('2d');
      x.fillStyle = '#9c9187'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = '#b8aa9a'; x.fillRect(10, 8, 44, 50);          // the lit oval of a face
      x.fillStyle = '#4a403a'; x.fillRect(16, 24, 11, 6); x.fillRect(37, 24, 11, 6); // eyes
      x.fillStyle = '#8a7a6e'; x.fillRect(29, 28, 6, 14);         // nose
      x.fillStyle = '#5a3a36'; x.fillRect(22, 46, 20, 4);         // mouth
      // smeared: blurred, then dragged sideways over itself
      const copy = document.createElement('canvas');
      copy.width = 64; copy.height = 64;
      const cx = copy.getContext('2d');
      cx.filter = 'blur(4px)';
      cx.drawImage(c, 0, 0);
      x.clearRect(0, 0, 64, 64);
      x.drawImage(copy, 0, 0);
      for (let i = -4; i <= 6; i++) { if (i) { x.globalAlpha = 0.3; x.drawImage(copy, i * 2.6, (i % 2) * 1.5 - 0.5); } }
      x.globalAlpha = 1;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.LinearFilter;
      self._mat = new THREE.MeshLambertMaterial({ map: tex });
    }
    if (self._mat) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.23), self._mat);
      face.position.set(0, 1.68 - (o.seated ? 0.45 : 0), 0.1115);
      g.add(face);
    }
    return g;
  },
  // A tower of cartons stacked by hand up into the mailroom's fog (Doc 1 §5
  // S8: "towers of photoreal cardboard fading into real volumetric fog"):
  // `n` boxes, each a little off square and off true, as ONE instanced mesh
  // (a 12 m tower is one draw call), with an invisible collider at its foot.
  cartontower(mats, o) {
    const g = new THREE.Group();
    const n = Math.max(1, o.n || 12);
    let seed = (o.seed || 1) * 7919 + n;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mats.get(o.mat || 'cardboard'), n);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    let y = 0, base = 0.8;
    for (let i = 0; i < n; i++) {
      const h = 0.42 + rnd() * 0.18;
      const w = (0.68 + rnd() * 0.16) * (i === 0 ? 1.04 : 1), d = w * (0.85 + rnd() * 0.25);
      if (i === 0) base = Math.max(w, d);
      e.set(0, (rnd() - 0.5) * 0.22, 0);
      q.setFromEuler(e);
      p.set((rnd() - 0.5) * 0.12, y + h / 2, (rnd() - 0.5) * 0.12);
      s.set(w, h, d);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      y += h;
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    g.add(mesh);
    const body = box(mats, 'cardboard', base, Math.min(y, 1.6), base, 0, 0, 0, { castShadow: false, collide: true });
    body.visible = false;
    g.add(body);
    return g;
  },
  // The boardroom's vast glass table (Doc 2 S8_C_IMG_OUT: "a vast glass
  // table with real refraction and reflection"): a clear photoreal slab with
  // a dark bevelled edge, on two slim chrome trestles and a spine, so the
  // twelve seated figures read through it. Top at 0.79 (as `table`).
  glasstable(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 2.2, d = o.d || 12.0, top = 0.79, t = 0.04;
    g.add(box(mats, o.glass || 'glass', w, t, d, 0, top - t, 0, { castShadow: false }));
    g.add(box(mats, 'glass_dark', w + 0.01, t * 0.5, 0.02, 0, top - t * 0.75, -d / 2, { castShadow: false })); // the edge, seen end on
    g.add(box(mats, 'glass_dark', w + 0.01, t * 0.5, 0.02, 0, top - t * 0.75, d / 2, { castShadow: false }));
    g.add(box(mats, 'glass_dark', 0.02, t * 0.5, d, -w / 2, top - t * 0.75, 0, { castShadow: false }));
    g.add(box(mats, 'glass_dark', 0.02, t * 0.5, d, w / 2, top - t * 0.75, 0, { castShadow: false }));
    g.add(box(mats, 'lp_chrome', 0.08, 0.05, d - 1.6, 0, top - t - 0.05, 0)); // the spine under the glass
    for (const z of [-d / 2 + 1.4, d / 2 - 1.4]) {
      g.add(box(mats, 'lp_chrome', w - 0.7, 0.04, 0.08, 0, top - t - 0.04, z)); // trestle head
      for (const s of [-1, 1]) g.add(box(mats, 'lp_chrome', 0.05, top - t - 0.04, 0.05, s * (w / 2 - 0.4), 0, z));
      g.add(box(mats, 'lp_chrome', w - 0.7, 0.03, 0.42, 0, 0, z, { castShadow: false })); // foot
    }
    const body = box(mats, 'lp_dark', w, top, d, 0, 0, 0, { castShadow: false, collide: true });
    body.visible = false;
    g.add(body);
    return g;
  },
  // A steel sorting table (S8 C: OPEN THE BOX): top, cutting mat, legs, a
  // lower shelf of flattened cartons, a roll of tape. Top at `h`.
  sortingtable(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 2.0, d = o.d || 0.9, h = o.h || 0.9;
    g.add(box(mats, 'lp_grey', w, 0.04, d, 0, h - 0.04, 0));
    g.add(box(mats, 'lp_dark', w * 0.55, 0.004, d * 0.72, -w * 0.12, h, 0, { castShadow: false })); // cutting mat
    for (const [x, z] of [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]]) g.add(box(mats, 'lp_grey', 0.05, h - 0.04, 0.05, x, 0, z));
    g.add(box(mats, 'lp_grey', w - 0.08, 0.025, d - 0.08, 0, 0.2, 0));
    g.add(box(mats, 'cardboard', w * 0.46, 0.09, d * 0.7, -w * 0.2, 0.225, 0.02));
    g.add(box(mats, 'cardboard', w * 0.3, 0.05, d * 0.6, w * 0.25, 0.225, -0.05));
    g.add(cylinder(mats, 'lp_beige', 0.055, 0.05, w * 0.36, h, -d * 0.25, 10)); // tape
    g.add(box(mats, 'lp_paper', 0.22, 0.012, 0.3, w * 0.36, h, d * 0.12)); // a pad of slips
    const body = box(mats, 'lp_grey', w, h, d, 0, 0, 0, { castShadow: false, collide: true });
    body.visible = false;
    g.add(body);
    return g;
  },
  // A warehouse high-bay: a cable up into the dark, a driver box, a spun
  // reflector, a lit lens and a glow plate (Doc 2 S8_C: "high bay lighting
  // with real falloff"). `hang`: how far the cable rises out of sight.
  highbay(mats, o) {
    const g = new THREE.Group();
    const hang = o.hang || 3.0;
    g.add(box(mats, 'lp_black', 0.014, hang, 0.014, 0, 0.26, 0, { castShadow: false }));
    g.add(box(mats, 'lp_dark', 0.18, 0.12, 0.18, 0, 0.14, 0, { castShadow: false }));
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.42, 0.3, 10), mats.get('lp_grey'));
    shade.position.y = 0.0;
    g.add(shade);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.02, 10), mats.get('lp_fluoro'));
    lens.position.y = -0.16;
    g.add(lens);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), mats.get('glow_fluoro'));
    glow.rotation.x = Math.PI / 2; glow.position.y = -0.2;
    g.add(glow);
    return g;
  },
  // A work lamp on a long cord from high in the dark: shade and bulb. `lit`
  // false is the same lamp switched off (a beat swaps the two and turns the
  // light spec on: picking up the package lights the back of the hall).
  worklamp(mats, o) {
    const g = new THREE.Group();
    const drop = o.drop || 1.0;
    g.add(box(mats, 'lp_black', 0.014, drop, 0.014, 0, -drop, 0, { castShadow: false }));
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 0.2, 8), mats.get('lp_dark'));
    shade.position.y = -drop - 0.1;
    g.add(shade);
    g.add(box(mats, o.lit ? 'lp_fluoro' : 'lp_grey', 0.09, 0.07, 0.09, 0, -drop - 0.26, 0, { castShadow: false }));
    if (o.lit) g.add(box(mats, 'lp_sodium', 0.4, 0.004, 0.4, 0, -drop - 0.2, 0, { castShadow: false })); // the shade's lit underside
    return g;
  },
  // Mail pigeonholes: a frame of cubbies with letters and small parcels
  // left in some of them.
  pigeonholes(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 1.8, h = o.h || 1.9, d = o.d || 0.42, cols = o.cols || 6, rows = o.rows || 5;
    const m = o.mat || 'lp_wood';
    g.add(box(mats, m, w, h, 0.02, 0, 0, -d / 2 + 0.01));
    for (let c = 0; c <= cols; c++) g.add(box(mats, m, 0.025, h, d, -w / 2 + c * (w / cols), 0, 0));
    for (let r = 0; r <= rows; r++) g.add(box(mats, m, w + 0.025, 0.025, d, 0, r * (h - 0.025) / rows, 0));
    const cw = w / cols, ch = (h - 0.025) / rows;
    for (let i = 0; i < 13; i++) {
      const c = (i * 5 + 2) % cols, r = (i * 3 + 1) % rows;
      const parcel = i % 4 === 0;
      g.add(box(mats, parcel ? 'cardboard' : 'lp_paper', cw * (parcel ? 0.7 : 0.8), parcel ? ch * 0.55 : 0.012 + (i % 3) * 0.02, d * 0.7, -w / 2 + (c + 0.5) * cw, r * ch + 0.025, 0.02));
    }
    const body = box(mats, m, w, h, d, 0, 0, 0, { castShadow: false, collide: true });
    body.visible = false;
    g.add(body);
    return g;
  },
  // A store gondola: kick base, spine, tiers of product in blocks of colour
  // (both faces, or one with `single` against a wall). Low-poly (C1).
  gondola(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 2.4, d = o.d || 0.9, h = o.h || 1.5, tiers = o.tiers || 4;
    const single = !!o.single;
    g.add(box(mats, 'lp_grey', w, h, 0.04, 0, 0, single ? -d / 2 + 0.02 : 0));
    g.add(box(mats, 'lp_dark', w, 0.12, d, 0, 0, 0));
    for (const s of [-1, 1]) g.add(box(mats, 'lp_grey', 0.03, h, d, s * (w / 2 - 0.015), 0, 0)); // end panels
    const colours = ['lp_red', 'lp_beige', 'lp_blue', 'lp_white', 'lp_car6', 'lp_paper', 'lp_car2', 'lp_red', 'lp_car3', 'lp_beige'];
    let k = o.seed || 0;
    const runs = 4;
    for (const s of single ? [1] : [-1, 1]) {
      const sd = single ? d - 0.06 : d / 2 - 0.03;
      const zc = single ? 0.02 : s * (d / 4 + 0.01);
      for (let t = 0; t < tiers; t++) {
        const y = 0.12 + t * ((h - 0.16) / tiers);
        g.add(box(mats, 'lp_grey', w - 0.04, 0.02, sd, 0, y, zc));
        // runs of product, one colour each, a gap here and there where it sold
        const pitch = (w - 0.1) / runs;
        for (let r = 0; r < runs; r++) {
          const gap = (k % 5 === 0) ? pitch * 0.45 : 0.04;
          const rw = pitch - gap;
          const rh = 0.11 + ((k * 7) % 4) * 0.035;
          g.add(box(mats, colours[k % colours.length], rw, rh, sd * (0.7 + ((k * 3) % 3) * 0.1), -w / 2 + 0.05 + r * pitch + rw / 2, y + 0.02, zc));
          k += 3;
        }
        k += 1;
      }
    }
    const body = box(mats, 'lp_grey', w, h, d, 0, 0, 0, { castShadow: false, collide: true });
    body.visible = false;
    g.add(body);
    return g;
  },
  // A chest cooler (Doc 2 S8_H_IMG_OUT): a white tub, a grey rim, a lit
  // well of boxed product under two sliding glass lids.
  chestcooler(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 1.8, d = o.d || 0.85, h = o.h || 0.85;
    g.add(box(mats, 'lp_white', w, h - 0.06, d, 0, 0, 0, { collide: true }));
    g.add(box(mats, 'lp_grey', w + 0.02, 0.06, d + 0.02, 0, h - 0.06, 0));
    g.add(box(mats, 'lp_fluoro', w - 0.14, 0.01, d - 0.14, 0, h - 0.07, 0, { castShadow: false }));
    for (let i = 0; i < 6; i++) g.add(box(mats, ['lp_blue', 'lp_red', 'lp_white'][i % 3], 0.22, 0.05, 0.3, -w / 2 + 0.24 + i * ((w - 0.48) / 5), h - 0.06, (i % 2 ? 0.12 : -0.12), { castShadow: false }));
    for (const s of [-1, 1]) g.add(box(mats, 'lp_glass', w / 2 - 0.05, 0.012, d - 0.06, s * w / 4, h, 0, { castShadow: false }));
    return g;
  },
  // The storefront door (S8 H / SE_EXPUL), standing as it was left: open
  // outward (Doc 1 §6.4). `leaves` [left, right] in degrees out of the
  // frame (toward local +z, the street). Static: the room's threshold box
  // is what stops him, not the glass.
  storedoor(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 1.8, h = o.h || 2.25;
    const open = o.leaves || [70, 70];
    g.add(box(mats, 'lp_dark', 0.06, h + 0.06, 0.12, -w / 2 - 0.03, 0, 0));
    g.add(box(mats, 'lp_dark', 0.06, h + 0.06, 0.12, w / 2 + 0.03, 0, 0));
    g.add(box(mats, 'lp_dark', w + 0.12, 0.06, 0.12, 0, h, 0));
    [-1, 1].forEach((s, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * w / 2, 0, 0);
      const lw = w / 2 - 0.015;
      const cx = -s * lw / 2;
      pivot.add(box(mats, 'lp_dark', 0.05, h, 0.05, -s * 0.025, 0, 0));
      pivot.add(box(mats, 'lp_dark', 0.05, h, 0.05, -s * (lw - 0.025), 0, 0));
      pivot.add(box(mats, 'lp_dark', lw, 0.1, 0.05, cx, 0, 0));
      pivot.add(box(mats, 'lp_dark', lw, 0.06, 0.05, cx, h - 0.06, 0));
      pivot.add(box(mats, 'glass', lw - 0.09, h - 0.18, 0.012, cx, 0.1, 0));
      pivot.add(box(mats, 'lp_chrome', lw * 0.55, 0.035, 0.035, cx, 1.0, 0.05)); // push bar
      pivot.rotation.y = s * THREE.MathUtils.degToRad(open[i] || 0);
      g.add(pivot);
    });
    return g;
  },
  // His reflection in the storefront glass: a faceless cluster of static,
  // untextured polygons roughly where a person's reflection should be
  // (Doc 1 §6.4, Doc 2 S8_H_IMG_OUT). Present from the first frame; never
  // moves. Flat chips, so it reads from either side of the glass.
  polycluster(mats, o) {
    const g = new THREE.Group();
    const h = o.h || 1.75, w = o.w || 0.55;
    let seed = o.seed || 99;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const slots = ['lp_grey', 'lp_dark', 'lp_white', 'lp_grey', 'lp_black', 'lp_suit'];
    const n = o.n || 20;
    for (let i = 0; i < n; i++) {
      const y = (i / n) * h * 0.9 + rnd() * 0.1;
      const k = y > 1.5 ? 0.45 : y > 1.38 ? 0.3 : y > 0.85 ? 1.0 : 0.5; // head, neck, shoulders and chest, legs
      const pw = (0.1 + rnd() * 0.2) * k * (w / 0.55);
      const ph = 0.08 + rnd() * 0.2;
      const chip = box(mats, slots[Math.floor(rnd() * slots.length)], pw, ph, 0.004, (rnd() - 0.5) * w * k * 0.8, y, (rnd() - 0.5) * 0.03, { castShadow: false });
      chip.rotation.z = (rnd() - 0.5) * 1.6;
      g.add(chip);
    }
    return g;
  },
  // An underwater pool lamp set in a tile face: chrome ring and lens, the
  // one warm thing in the water. `lit` false is the same lamp gone dark.
  poollamp(mats, o) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16), mats.get('lp_chrome'));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16), mats.get(o.lit === false ? 'lp_dark' : 'lp_fluoro'));
    lens.rotation.x = Math.PI / 2; lens.position.z = 0.01;
    g.add(lens);
    if (o.lit !== false) {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), mats.get('glow_sodium'));
      glow.position.z = 0.05;
      g.add(glow);
    }
    return g;
  },
  // A floor grate of rusted bars in a frame (the dive): the building's, so
  // photoreal rust (C1). Hinged on its -z edge; `open` swings it up (deg).
  floorgrate(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 2.4, d = o.d || 2.4, bars = o.bars || 9;
    const hinge = new THREE.Group();
    hinge.position.z = -d / 2;
    g.add(hinge);
    const m = o.mat || 'rust';
    hinge.add(box(mats, m, w, 0.08, 0.08, 0, 0, 0.04));
    hinge.add(box(mats, m, w, 0.08, 0.08, 0, 0, d - 0.04));
    hinge.add(box(mats, m, 0.08, 0.08, d, -w / 2 + 0.04, 0, d / 2));
    hinge.add(box(mats, m, 0.08, 0.08, d, w / 2 - 0.04, 0, d / 2));
    for (let i = 1; i <= bars; i++) hinge.add(box(mats, m, 0.045, 0.06, d - 0.1, -w / 2 + i * (w / (bars + 1)), 0.01, d / 2));
    for (const f of [1 / 3, 2 / 3]) hinge.add(box(mats, m, w - 0.1, 0.04, 0.04, 0, 0.02, d * f));
    hinge.rotation.x = -THREE.MathUtils.degToRad(o.open || 0);
    return g;
  },
  // A red curtain that is still swinging: from the moment it is first seen
  // it sways from its rod, dying down to a stir that never quite stops
  // (Doc 2 SE_PEND: "the curtain at the far end still swinging"). It
  // swings about its own rod, whichever wall it hangs on.
  swaycurtain(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 2.2, h = o.h || 3.0;
    const pivot = new THREE.Group();
    pivot.position.y = h;
    g.add(pivot);
    const folds = Math.max(4, Math.round(w / 0.22));
    for (let i = 0; i < folds; i++) {
      const x = -w / 2 + (i + 0.5) * (w / folds);
      pivot.add(box(mats, o.mat || 'lp_curtain', w / folds + 0.012, h - 0.04, 0.08 + (i % 2) * 0.06, x, -h + 0.02, (i % 2) * 0.03, { collide: true }));
    }
    g.add(box(mats, 'lp_brass', w + 0.24, 0.06, 0.12, 0, h, 0.02));
    let t0 = null;
    pivot.children[0].onBeforeRender = () => {
      const now = performance.now() / 1000;
      if (t0 === null) t0 = now;
      const t = now - t0;
      const amp = 0.014 + 0.075 * Math.exp(-t / 16);
      pivot.rotation.x = Math.sin(t * 1.2) * amp;
      pivot.rotation.z = Math.sin(t * 0.77 + 0.6) * amp * 0.22;
    };
    return g;
  },
  // Particulate drifting upward through the water (Doc 2 KLING H: "drifts
  // upward past camera"): one Points cloud, wrapping from the top of its
  // box back to the bottom.
  motes(mats, o) {
    const g = new THREE.Group();
    const n = o.n || 400, w = o.w || 16, h = o.h || 10, d = o.d || 16, rise = o.rise || 0.05;
    let seed = o.seed || 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const base = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { base[i * 3] = (rnd() - 0.5) * w; base[i * 3 + 1] = rnd() * h; base[i * 3 + 2] = (rnd() - 0.5) * d; }
    const pos = base.slice();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: o.color || '#a8d8e0', size: o.size || 0.03, transparent: true, opacity: o.opacity || 0.55, depthWrite: false });
    mat.userData.owned = true; // room.js dispose() frees it with the room
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.onBeforeRender = () => {
      const t = performance.now() / 1000;
      for (let i = 0; i < n; i++) {
        const y = base[i * 3 + 1] + t * rise * (0.6 + (i % 7) * 0.12);
        pos[i * 3 + 1] = y - Math.floor(y / h) * h;
        pos[i * 3] = base[i * 3] + Math.sin(t * 0.3 + i) * 0.06;
      }
      geo.attributes.position.needsUpdate = true;
    };
    g.add(pts);
    return g;
  },
  // ---- polish: S8 + endings -- end ----
  //
  // A model from assets/glb/library.glb (the open-source catalog, imported
  // through the Higgsfield scene builder). Built by library.js when the
  // library is loaded; until then (or without it) the box fallback stands
  // in, so a room never waits on the download to exist.
  glb(mats, o, ctx) {
    const lib = ctx && ctx.library;
    // the prop's palette slot (a low-poly colour) tints the model's light surfaces
    const tint = o.mat && mats.isLowPoly(o.mat) ? mats.get(o.mat).color : null;
    const node = lib ? lib.instance(o.node, tint) : null;
    if (node) {
      node.userData.catalog = o.node;
      if (o.collide) {
        // an invisible collision box from the model's own bounds
        const bb = new THREE.Box3().setFromObject(node);
        const size = new THREE.Vector3(); bb.getSize(size);
        const c = new THREE.Vector3(); bb.getCenter(c);
        const body = box(mats, 'lp_dark', Math.max(0.2, size.x), Math.max(0.2, size.y), Math.max(0.2, size.z), c.x, 0, c.z, { castShadow: false, collide: true });
        body.visible = false;
        node.add(body);
      }
      return node;
    }
    if (o.fallback && BUILDERS[o.fallback]) {
      const g = BUILDERS[o.fallback](mats, { ...o, type: o.fallback }, ctx);
      g.userData.fallbackFor = o.node;
      return g;
    }
    return new THREE.Group();
  }
};

export function buildProp(mats, spec, ctx = null) {
  const builder = BUILDERS[spec.type];
  if (!builder) {
    console.warn(`props.js: unknown prop type "${spec.type}"`);
    return null;
  }
  const g = builder(mats, spec, ctx);
  if (!g) return null;
  const [x = 0, y = 0, z = 0] = spec.pos || [];
  g.position.set(x, y, z);
  g.rotation.y = THREE.MathUtils.degToRad(spec.rot || 0);
  if (spec.scale) g.scale.setScalar(spec.scale);
  g.name = spec.name || spec.type;
  g.userData.spec = spec;
  return g;
}

export const PROP_TYPES = Object.keys(BUILDERS);
