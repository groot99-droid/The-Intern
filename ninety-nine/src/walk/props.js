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
  // S3 THE THRESHOLD (Doc 1 §5 S3, Doc 2 S3): the velvet that hangs round
  // the curtain doorway, the green ENTER sign on its 2.3 s cycle, the badge
  // reader's red laser slot, his handprints on the lobby glass, and the
  // street seen through that glass with no sun and no shadows. Materials
  // made here belong to the room (userData.owned): room.js frees them when
  // the room is dropped. Helpers are kept private in this closure.
  ...(() => {
    const owned = (m) => { m.userData.owned = true; return m; };
    const canvasTex = (w, h, draw) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    // a soft round glow (white, alpha falling off), tinted by the material
    const haloTex = () => canvasTex(128, 128, (ctx, w, h) => {
      const gr = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
    });
    const additive = (color, opacity, map = null) => owned(new THREE.MeshBasicMaterial({
      color: new THREE.Color(color), map, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false
    }));
    // The light pool (src/world/lights.js) hands the room's light specs to
    // a fixed set of PointLights each frame. A lit prop that must pulse with
    // its light (the ENTER sign with its green) finds the pool light of that
    // colour nearest to it and follows its intensity, so the two can never
    // drift apart; without one it runs the same cycle on its own clock.
    const lightFollower = (mesh, { color, intensity, pattern }) => {
      const want = new THREE.Color(color);
      const here = new THREE.Vector3();
      let light = null;
      let frame = 0;
      return (scene) => {
        if (intensity && (frame++ % 30 === 0 || !light || !light.parent)) {
          mesh.getWorldPosition(here);
          light = null;
          let best = 3.0;
          for (const c of scene.children) {
            if (!c.isPointLight || c.intensity <= 0) continue;
            if (Math.abs(c.color.r - want.r) + Math.abs(c.color.g - want.g) + Math.abs(c.color.b - want.b) > 0.03) continue;
            const d = c.position.distanceTo(here);
            if (d < best) { best = d; light = c; }
          }
        }
        if (light) return Math.min(1.2, light.intensity / intensity);
        const p = pattern || { period: 2.3, duty: 0.86, low: 0.1 };
        const u = ((performance.now() / 1000) % p.period) / p.period;
        return u < p.duty ? 1 : p.low;
      };
    };
    // vertical pile for the velvet: dark streaks on deep red
    const pileTex = () => {
      const t = canvasTex(256, 64, (ctx, w, h) => {
        ctx.fillStyle = '#7a1424';
        ctx.fillRect(0, 0, w, h);
        let s = 7;
        const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        for (let x = 0; x < w; x++) {
          const v = rnd();
          ctx.fillStyle = v < 0.5 ? `rgba(20,0,6,${(0.5 - v) * 0.22})` : `rgba(255,140,150,${(v - 0.5) * 0.05})`;
          ctx.fillRect(x, 0, 1, h);
        }
      });
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    };
    const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

    return {
      // The velvet round a curtain doorway (S3 C's corridor end, the lobby's
      // far corner in S3 H): a fold-pleated drape either side of the
      // doorway (`gap`), a pelmet across the top hiding the doorway curtain's
      // rod, a brass trim. Photoreal (Doc 1 S3: "heavy red velvet curtain,
      // photoreal"), it sways a centimetre or two though there is no air.
      // `dress` names the doorway (doors.js kind curtain) that opens in the
      // middle: its two halves are hung with the same velvet (their stepped
      // box folds hidden), so the part that parts is the part that matches;
      // the halves still squash to the jambs when the door opens, and its
      // blocking body is untouched. Origin: the wall's inner face, centred;
      // +z into the room.
      velvetdrape(mats, o) {
        const g = new THREE.Group();
        const w = o.w || 4.0, h = o.h || 3.0, gap = o.gap || 0;
        const fold = o.fold || 0.22, depth = o.depth || 0.06;
        const pelH = o.pelmet === undefined ? 0.5 : o.pelmet;
        const off = o.off === undefined ? 0.02 : o.off; // clear of a wainscot or skirt
        const map = pileTex();
        map.repeat.set(2, 1);
        const mat = owned(new THREE.MeshPhysicalMaterial({
          color: new THREE.Color('#d0c4c4'), map, roughness: 0.88, metalness: 0,
          sheen: 0.75, sheenRoughness: 0.5, sheenColor: new THREE.Color('#b8344c'), side: THREE.DoubleSide
        }));
        const sways = [];
        // a pleated panel from x0 to x1 (folds `amp` deep, `z0` off its plane)
        const panel = (x0, x1, y0, y1, amp, z0, sway, parent = g) => {
          const pw = x1 - x0, ph = y1 - y0;
          const segX = Math.max(8, Math.round(Math.abs(pw) / fold * 6));
          const geo = new THREE.PlaneGeometry(Math.abs(pw), ph, segX, 8);
          const p = geo.attributes.position;
          const uv = geo.attributes.uv;
          const cx = (x0 + x1) / 2;
          for (let i = 0; i < p.count; i++) {
            const lx = p.getX(i) + cx;
            const v = (p.getY(i) + ph / 2) / ph; // 0 bottom .. 1 top
            const k = 0.8 + 0.2 * (1 - v);
            p.setZ(i, z0 + amp * k * (1 + Math.sin(lx / fold * Math.PI * 2 + 0.6 * Math.sin(lx * 1.7))));
            uv.setX(i, lx / 1.2);
          }
          geo.translate(cx, (y0 + y1) / 2, 0);
          geo.computeVertexNormals();
          const m = new THREE.Mesh(geo, mat);
          m.castShadow = true;
          m.receiveShadow = true;
          parent.add(m);
          if (sway) sways.push({ m, base: Float32Array.from(p.array), y0, ph });
          return m;
        };
        const top = h;
        if (gap > 0) {
          panel(-w / 2, -gap / 2, 0, top, depth, off, true);
          panel(gap / 2, w / 2, 0, top, depth, off, true);
        } else panel(-w / 2, w / 2, 0, top, depth, off, true);
        if (pelH > 0) {
          // pelmet: shallower pleats, standing proud of the drapes
          const pz = off + depth * 2 + 0.05;
          panel(-w / 2 - 0.04, w / 2 + 0.04, top - pelH, top, depth * 0.45, pz, false);
          g.add(box(mats, 'lp_brass', w + 0.1, 0.022, 0.025, 0, top - pelH - 0.012, pz + depth * 0.9 + 0.015, { castShadow: false }));
          g.add(box(mats, 'lp_dark', w + 0.1, 0.04, pz + depth + 0.03, 0, top - 0.02, (pz + depth + 0.03) / 2, { castShadow: false }));
        } else {
          g.add(box(mats, 'lp_brass', w + 0.1, 0.04, 0.04, 0, top, off + 0.04, { castShadow: false }));
        }
        // hang the doorway's two halves with the velvet (once it is in the room)
        const dress = () => {
          const door = g.parent && g.parent.children.find((c) => c.name === `door:${o.dress}`);
          if (!door) return;
          const plain = mats.get(o.dressMat || 'lp_curtain');
          for (const half of door.children) {
            if (!half.isGroup) continue;
            const folds = half.children.filter((c) => c.isMesh && c.material === plain);
            if (!folds.length) continue;
            const s = Math.sign(half.position.x) || 1; // which jamb this half hangs from
            const hw = Math.abs(half.position.x);
            const fh = folds[0].geometry.parameters ? folds[0].geometry.parameters.height : top;
            for (const f of folds) f.visible = false;
            panel(s * 0.06, -s * (hw + 0.04), 0, fh, depth, 0.02, true, half);
          }
        };
        const phase = (o.pos ? o.pos[0] * 1.3 : 0);
        let dressed = !o.dress;
        const swayAmp = o.sway === undefined ? 0.014 : o.sway;
        let lastFrame = -1;
        const tick = (renderer) => {
          const f = renderer.info.render.frame;
          if (f === lastFrame) return; // once a frame, whichever panel is drawn first
          lastFrame = f;
          if (!dressed && g.parent) { dressed = true; dress(); }
          if (!swayAmp) return;
          const t = performance.now() / 1000;
          for (const sw of sways) {
            const p = sw.m.geometry.attributes.position;
            for (let i = 0; i < p.count; i++) {
              const v = (sw.base[i * 3 + 1] - sw.y0) / sw.ph;
              const fall = Math.pow(1 - v, 1.6);
              const x = sw.base[i * 3];
              p.array[i * 3 + 2] = sw.base[i * 3 + 2] + swayAmp * fall * (Math.sin(t * 0.83 + x * 1.9 + phase) * 0.7 + Math.sin(t * 0.37 - x * 0.7) * 0.3);
            }
            p.needsUpdate = true;
          }
        };
        g.traverse((c) => { if (c.isMesh && c.material === mat) c.onBeforeRender = tick; });
        return g;
      },
      // The ENTER sign (Doc 1 S3: "a hyper-real green ENTER sign on a
      // 2.3-second flicker cycle"; Doc 2: "blocky housing with a crisp
      // photoreal glow"). The housing is company signage, low-poly (C1); the
      // letters and their glow are light. `sync: {color, intensity}` ties the
      // face to the room's light of that colour (see lightFollower). `on:
      // false` is the same sign, dead (S3 H). Text never says "you" (C4).
      entersign(mats, o) {
        const g = new THREE.Group();
        const w = o.w || 1.0, h = o.h || 0.26, lit = o.on !== false;
        g.add(box(mats, 'lp_dark', w + 0.1, h + 0.1, 0.12, 0, 0, 0));
        g.add(box(mats, 'lp_grey', w + 0.14, 0.025, 0.14, 0, h + 0.1, 0, { castShadow: false }));
        const tex = canvasTex(512, Math.max(64, Math.round(512 * h / w)), (ctx, cw, ch) => {
          ctx.fillStyle = lit ? '#031208' : '#0c100d';
          ctx.fillRect(0, 0, cw, ch);
          ctx.font = `900 ${Math.round(ch * 0.78)}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const word = (o.text || 'ENTER').split('').join(String.fromCharCode(8202));
          if (lit) {
            ctx.shadowColor = 'rgba(80,255,140,0.9)';
            ctx.shadowBlur = ch * 0.12;
            ctx.fillStyle = '#9dffbf';
          } else ctx.fillStyle = '#1d3326';
          ctx.fillText(word, cw / 2, ch * 0.54);
        });
        const faceMat = owned(new THREE.MeshBasicMaterial({ map: tex }));
        const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), faceMat);
        face.position.set(0, 0.05 + h / 2, 0.062);
        g.add(face);
        if (!lit) return g;
        const haloMat = additive('#2dff6e', 0.3, haloTex());
        const halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.4, h * 5.5), haloMat);
        halo.position.set(0, 0.05 + h / 2, 0.075);
        halo.renderOrder = 3;
        g.add(halo);
        const k = lightFollower(face, { color: (o.sync && o.sync.color) || '#33ff77', intensity: o.sync ? o.sync.intensity : 0, pattern: o.pattern });
        face.onBeforeRender = (renderer, scene) => {
          const v = k(scene);
          faceMat.color.setScalar(0.18 + 1.5 * v);
          haloMat.opacity = 0.34 * v;
        };
        return g;
      },
      // The badge reader beside the curtain: a low-poly box (C1) with a red
      // laser slot that is real light (Doc 1 S3) -- a bright slit, its bloom
      // on the photoreal wall, and a faint fan of red that sweeps the
      // corridor slowly (PRESENT CANDIDATE FOR READING). `fan: false` drops
      // the fan. Origin: on the wall at the reader's foot; +z out of the wall.
      badgescanner(mats, o) {
        const g = new THREE.Group();
        g.add(box(mats, 'lp_grey', 0.15, 0.27, 0.05, 0, 0, 0));
        g.add(box(mats, 'lp_dark', 0.12, 0.075, 0.012, 0, 0.165, 0.028, { castShadow: false }));
        g.add(box(mats, 'lp_black', 0.1, 0.08, 0.008, 0, 0.045, 0.026, { castShadow: false }));
        const red = owned(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a18').multiplyScalar(1.6) }));
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.008, 0.006), red);
        slot.position.set(0, 0.2, 0.036);
        g.add(slot);
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.006), red);
        led.position.set(0.05, 0.25, 0.028);
        g.add(led);
        const bloom = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.42), additive('#ff2a18', 0.26, haloTex()));
        bloom.position.set(0, 0.2, 0.004);
        bloom.renderOrder = 3;
        g.add(bloom);
        if (o.fan !== false) {
          // a horizontal sheet of red out of the slot, fading with distance
          const L = o.reach || 1.1, spread = o.spread || 0.45;
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -spread, 0, L, spread, 0, L], 3));
          geo.setAttribute('color', new THREE.Float32BufferAttribute([0.9, 0.08, 0.04, 0, 0, 0, 0, 0, 0], 3));
          const fanMat = additive('#ffffff', 0.22);
          fanMat.vertexColors = true;
          const fan = new THREE.Mesh(geo, fanMat);
          const pivot = new THREE.Group();
          pivot.position.set(0, 0.2, 0.04);
          pivot.add(fan);
          g.add(pivot);
          fan.renderOrder = 3;
          fan.onBeforeRender = () => {
            const t = performance.now() / 1000;
            pivot.rotation.x = 0.32 + Math.sin(t * 1.4) * 0.22; // tilted down toward a chest, sweeping
          };
        }
        return g;
      },
      // A smeared handprint on glass (Doc 2 S3_H_IMG_OUT: "a smeared
      // handprint on the glass at chest height, and one more further left,
      // and one further left again"). Fades in over half a second whenever it
      // is shown (a `show` beat). `flip` for the other hand. Origin: the print's
      // centre; it faces +z.
      handprint(mats, o) {
        const g = new THREE.Group();
        const tex = canvasTex(256, 256, (ctx, w, h) => {
          ctx.clearRect(0, 0, w, h);
          const blob = (x, y, rx, ry, a, rot = 0) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rot);
            const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
            gr.addColorStop(0, `rgba(235,238,240,${a})`);
            gr.addColorStop(0.7, `rgba(235,238,240,${a * 0.6})`);
            gr.addColorStop(1, 'rgba(235,238,240,0)');
            ctx.scale(rx, ry);
            ctx.fillStyle = gr;
            ctx.beginPath();
            ctx.arc(0, 0, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          };
          // a palm laid flat and dragged down: the heel, the ridge under the
          // fingers, the thumb, four fingertips -- greasy, soft, smeared
          if ('filter' in ctx) ctx.filter = 'blur(4px)';
          const hand = (dy, a) => {
            blob(130, 186 + dy, 44, 34, a);
            blob(122, 136 + dy, 56, 19, a * 0.7);
            blob(70, 160 + dy, 13, 24, a * 0.55, -0.7);
            [[88, 66, -0.2], [116, 50, -0.05], [144, 54, 0.08], [170, 74, 0.22]].forEach(([x, y, r]) => {
              blob(x, y + dy, 10, 15, a * 0.8, r);
              blob(x + 3, y + 34 + dy, 8, 13, a * 0.35, r);
            });
          };
          for (const [dy, a] of [[40, 0.05], [28, 0.08], [16, 0.12], [6, 0.18], [0, 0.26]]) hand(dy, a);
        });
        const base = o.opacity === undefined ? 0.45 : o.opacity;
        const mat = owned(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: base, depthWrite: false, fog: false }));
        const m = new THREE.Mesh(new THREE.PlaneGeometry(o.size || 0.22, (o.size || 0.22) * 1.2), mat);
        if (o.flip) m.scale.x = -1;
        m.rotation.z = THREE.MathUtils.degToRad(o.tilt || 0);
        m.renderOrder = 2;
        g.add(m);
        let last = -1e9, start = 0;
        m.onBeforeRender = () => {
          const now = performance.now();
          if (now - last > 400) start = now; // was hidden: fade in again
          last = now;
          mat.opacity = base * Math.min(1, (now - start) / 500);
        };
        return g;
      },
      // Dust hanging in a light (Doc 2 S3 C: "dust visible in the green
      // light"): a few hundred soft motes drifting slowly down and sideways
      // in a box `size` [x, y, z] above the origin, catching the light as
      // glow; with `sync` they dim and brighten with that light.
      dustmotes(mats, o) {
        const g = new THREE.Group();
        const [sx, sy, sz] = o.size || [3, 2.6, 1.6];
        const n = o.count || 180;
        const pos = new Float32Array(n * 3), seed = new Float32Array(n * 3);
        let sd = 11;
        const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
        for (let i = 0; i < n * 3; i++) seed[i] = rnd();
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const base = o.opacity || 0.3;
        const mat = owned(new THREE.PointsMaterial({
          color: new THREE.Color(o.color || '#9dffbb'), size: o.pointSize || 0.012, sizeAttenuation: true, map: haloTex(),
          transparent: true, opacity: base, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        const pts = new THREE.Points(geo, mat);
        pts.frustumCulled = false;
        const k = o.sync ? lightFollower(pts, { color: o.sync.color, intensity: o.sync.intensity, pattern: o.pattern }) : null;
        const step = (renderer, scene) => {
          if (k && scene) mat.opacity = base * k(scene);
          const t = performance.now() / 1000;
          for (let i = 0; i < n; i++) {
            const a = seed[i * 3], b = seed[i * 3 + 1], c = seed[i * 3 + 2];
            pos[i * 3] = (a - 0.5) * sx + Math.sin(t * 0.13 + b * 6.28) * 0.12;
            pos[i * 3 + 1] = sy * (1 - ((b + t * 0.005 * (0.4 + c)) % 1));
            pos[i * 3 + 2] = (c - 0.5) * sz + Math.cos(t * 0.11 + a * 6.28) * 0.1;
          }
          geo.attributes.position.needsUpdate = true;
        };
        step();
        pts.onBeforeRender = step;
        g.add(pts);
        return g;
      },
      // The street from S0, seen from inside the lobby's locked glass doors
      // (Doc 1 S3 H: "the street from S0, but with no sun and no shadows at
      // all"; Doc 2: "flat grey light, and no shadows whatsoever cast by any
      // object outside"). Not a room and not lit: one unlit mesh, every face
      // given a flat overcast shade, fading to grey with distance, closed on
      // every side and above by the same grey so no sky is ever in frame
      // (C3), nothing in it casting or taking a shadow, nothing that moves.
      // Laid out as SET_STREET is, the tower's doors on these doors: the
      // forecourt and step, the road running away with pavements, facades,
      // parked cars, dead lamps. No clock and no slip (C8, motif 2).
      // Origin: the outer face of the lobby wall at the doors' centre, floor
      // level; +z away from the building.
      deadstreet(mats, o) {
        const X = o.halfWidth || 12, Z = o.depth || 46, TOP = o.top || 18;
        const grey = new THREE.Color(o.grey || '#5e6164');
        const near = o.fadeNear === undefined ? 3 : o.fadeNear, far = o.fadeFar || 44;
        const pos = [], col = [], idx = [];
        const c = new THREE.Color();
        const add = (x0, y0, z0, x1, y1, z1, hex, { fade = true, seg = 4 } = {}) => {
          // long boxes are cut along z so the fade follows distance
          const n = Math.max(1, Math.ceil((z1 - z0) / seg));
          const base = new THREE.Color(hex);
          for (let k = 0; k < n; k++) {
            const za = z0 + (z1 - z0) * k / n, zb = z0 + (z1 - z0) * (k + 1) / n;
            const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, zb - za);
            geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (za + zb) / 2);
            const p = geo.attributes.position, nm = geo.attributes.normal;
            const off = pos.length / 3;
            for (let i = 0; i < p.count; i++) {
              const ny = nm.getY(i), nx = nm.getX(i);
              const shade = ny > 0.5 ? 1.0 : ny < -0.5 ? 0.62 : Math.abs(nx) > 0.5 ? 0.8 : 0.88;
              c.copy(base).multiplyScalar(shade);
              if (fade) c.lerp(grey, Math.pow(smooth(near, far, p.getZ(i)), 0.75));
              pos.push(p.getX(i), p.getY(i), p.getZ(i));
              col.push(c.r, c.g, c.b);
            }
            for (const q of geo.index.array) idx.push(q + off);
            geo.dispose();
          }
        };
        // ground: the forecourt and step (the tower's), the road, pavements
        add(-X, -0.3, 0, X, 0, 3.2, '#827f78');
        // the forecourt's paving joints: seen low through the glass, a plain
        // slab there read as a frosted panel, not as ground
        for (let z = 0.8; z < 3.2; z += 0.8) add(-X, 0, z - 0.015, X, 0.002, z + 0.015, '#5d5b56', { seg: 8 });
        for (let x = -X + 0.6; x < X; x += 1.2) add(x - 0.015, 0, 0, x + 0.015, 0.002, 3.2, '#5d5b56', { seg: 8 });
        add(-X, -0.3, 3.2, X, -0.15, 3.8, '#78756f');
        add(-6.4, -0.34, 3.8, 6.4, -0.3, Z, '#36373a');
        for (let z = 6; z < Z - 2; z += 5) add(-0.07, -0.3, z, 0.07, -0.296, z + 2.2, '#7a7974');
        for (const s of [-1, 1]) {
          add(s > 0 ? 6.4 : -X, -0.3, 3.8, s > 0 ? X : -6.4, -0.16, Z, '#6b6a66');
          add(s > 0 ? 6.4 : -6.55, -0.3, 3.8, s > 0 ? 6.55 : -6.4, -0.15, Z, '#7c7b76');
        }
        // facades either side, the street's inner faces at x = +-8
        const fac = ['#5a504a', '#64615b', '#56514d', '#605a54', '#5b5650'];
        let i = 0;
        for (let z = 0; z < Z + 5; z += 10, i++) {
          for (const s of [-1, 1]) {
            // the two sides' blocks are staggered by half a block
            const za = Math.max(0, s > 0 ? z - 5 : z), zb = Math.min(Z, (s > 0 ? z - 5 : z) + 10);
            if (zb - za < 1) continue;
            const ht = Math.min(TOP, 13 + ((i * 3 + (s > 0 ? 2 : 0)) % 4) * 2.5);
            const x0 = s > 0 ? 8 : -X, x1 = s > 0 ? X : -8;
            add(x0, -0.16, za, x1, ht, zb, fac[(i + (s > 0 ? 2 : 0)) % fac.length]);
            const face = s > 0 ? 8 : -8;
            for (let y = 3.0; y < ht - 1.2; y += 3.4) add(face - 0.03, y, za + 0.6, face + 0.03, y + 1.3, zb - 0.6, '#2c2f33');
            if (zb - za > 4) add(face - 0.04, -0.16, za + 1.2, face + 0.04, 2.5, za + 3.2, '#26282b'); // a street door
          }
        }
        // the tower's canopy over the doors, on two posts
        add(-4.6, 3.3, 0, 4.6, 3.6, 4.4, '#45474a', { fade: false });
        for (const s of [-1, 1]) add(s * 4.2 - 0.07, -0.3, 4.0, s * 4.2 + 0.07, 3.3, 4.14, '#393b3e', { fade: false });
        // parked cars, low-poly, colourless in this light
        const cars = [[5.3, 16, '#4c5155'], [-5.3, 30, '#62604e'], [5.3, 44, '#584846']];
        for (const [x, z, col0] of cars) {
          if (z > Z - 2) continue;
          add(x - 0.9, -0.12, z - 2.2, x + 0.9, 0.42, z + 2.2, col0);
          add(x - 0.75, 0.42, z - 1.0, x + 0.75, 0.9, z + 0.9, col0);
          add(x - 0.76, 0.5, z - 0.95, x + 0.76, 0.84, z + 0.85, '#2a2d30');
          for (const [wx, wz] of [[-0.82, -1.4], [0.82, -1.4], [-0.82, 1.4], [0.82, 1.4]]) add(x + wx - 0.12, -0.3, z + wz - 0.33, x + wx + 0.12, 0.06, z + wz + 0.33, '#1c1d1e');
        }
        // dead lamps, a traffic light, a hydrant, a bin
        const lamp = (x, z, s) => {
          add(x - 0.07, -0.16, z - 0.07, x + 0.07, 5.0, z + 0.07, '#2e3032');
          add(Math.min(x, x + s * 1.2), 4.9, z - 0.05, Math.max(x, x + s * 1.2), 5.0, z + 0.05, '#2e3032');
          add(x + s * 1.1 - 0.15, 4.75, z - 0.25, x + s * 1.1 + 0.15, 4.9, z + 0.25, '#3a3c3e');
        };
        for (const z of [10, 26, 42]) if (z < Z - 1) lamp(-7.6, z, 1);
        for (const z of [18, 34]) if (z < Z - 1) lamp(7.6, z, -1);
        add(7.3, -0.16, 8.93, 7.44, 3.6, 9.07, '#2e3032');
        add(7.2, 2.7, 8.8, 7.55, 3.6, 9.2, '#232527');
        add(-7.35, -0.16, 35.8, -7.05, 0.55, 36.1, '#4e3a35');
        add(6.85, -0.16, 28.7, 7.35, 0.75, 29.2, '#3a3d3a');
        // the grey that closes it: either side, the far end, overhead
        add(-X - 0.2, -0.4, 0, -X, TOP, Z, o.grey || '#5e6164', { fade: false });
        add(X, -0.4, 0, X + 0.2, TOP, Z, o.grey || '#5e6164', { fade: false });
        add(-X - 0.2, -0.4, Z, X + 0.2, TOP, Z + 0.2, o.grey || '#5e6164', { fade: false });
        add(-X - 0.2, TOP, 0, X + 0.2, TOP + 0.2, Z + 0.2, o.grey || '#5e6164', { fade: false });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        geo.setIndex(idx);
        const mat = owned(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
        const lvl = o.level === undefined ? 1 : o.level;
        mat.color.setScalar(lvl);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.visible = !o.showFrom; // until the hook below has seen where the eye is
        const g = new THREE.Group();
        g.add(mesh);
        // A hook drawn every frame (a degenerate triangle, culled never):
        // `showFrom` [x0, z0, x1, z1] is where, in the room's own frame, the
        // street may be seen from -- the lobby and its entry corridor. From
        // anywhere else (the lobby before this one, whose glass looks the
        // same way once this room is joined behind it) it is not drawn.
        // `dressGlass` names the doorway it is seen through: its panes (the
        // shared 'glass' slot, milky at 22 %) are given a clear pane of their
        // own, so the street is seen and the glass is still there in its
        // highlights. The panes keep casting shadow (no daylight patch).
        const hookGeo = new THREE.BufferGeometry();
        hookGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
        const hook = new THREE.Mesh(hookGeo, owned(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false })));
        hook.frustumCulled = false;
        hook.castShadow = false;
        g.add(hook);
        const rect = o.showFrom || null;
        const inv = new THREE.Matrix4();
        const eye = new THREE.Vector3();
        let dressed = !o.dressGlass;
        hook.onBeforeRender = (renderer, scene, camera) => {
          const room = g.parent;
          if (!room) return;
          if (!dressed) {
            dressed = true;
            const door = room.children.find((ch) => ch.name === `door:${o.dressGlass}`);
            if (door) {
              const milky = mats.get('glass');
              const clear = owned(new THREE.MeshStandardMaterial({
                // not mirror-smooth: the lobby's lamps make a soft sheen on
                // it, not two bright points that read as lamps lit outside
                color: new THREE.Color('#c9d6da'), roughness: o.glassRough || 0.2, metalness: 0.1,
                transparent: true, opacity: o.glassOpacity || 0.07, depthWrite: false
              }));
              door.traverse((ch) => { if (ch.isMesh && ch.material === milky) ch.material = clear; });
            }
          }
          if (rect) {
            inv.copy(room.matrixWorld).invert();
            eye.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inv);
            mesh.visible = eye.x >= rect[0] && eye.x <= rect[2] && eye.z >= rect[1] && eye.z <= rect[3];
          }
        };
        return g;
      }
    };
  })(),
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
