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
  // first shot (C6). `reach` lifts them toward the camera (the dive);
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
      if (o.reach) { h.rotation.x = -0.9; h.position.y = 0.2 + (s > 0 ? 0.04 : 0); h.position.z = -0.1; }
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
  // A model from assets/glb/library.glb (the open-source catalog, imported
  // through the Higgsfield scene builder). Built by library.js when the
  // library is loaded; until then (or without it) the box fallback stands
  // in, so a room never waits on the download to exist.
  glb(mats, o, ctx) {
    const lib = ctx && ctx.library;
    const node = lib ? lib.instance(o.node, mats) : null;
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
