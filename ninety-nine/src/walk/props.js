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
  // The waiting room and the call (tools/build_rooms.py waiting_room(),
  // Doc 1 §5 S1/S2, Doc 2 S1/S2). Its helpers stay private to this block.
  ...(() => {
    const D2R = Math.PI / 180;
    const own = (m) => { m.userData.owned = true; return m; }; // freed with the room (room.js dispose)
    const unseen = (m) => { m.visible = false; return m; };
    const now = () => performance.now() / 1000;
    function canvasTexture(w, h, draw) {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      draw(cv.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    }
    function rng(seed) { // mulberry32
      let a = seed >>> 0;
      return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    // a flat inlay that stays on top of the floor under it
    const inlayMat = (color, extra = {}) => own(new THREE.MeshLambertMaterial({ color, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, ...extra }));
    // a bar lying in the floor plane from (x0, z0) to (x1, z1)
    function floorBar(mat, x0, z0, x1, z1, w, h = 0.003) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, w), mat);
      m.position.set((x0 + x1) / 2, 0.0015 + h / 2, (z0 + z1) / 2);
      m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      m.receiveShadow = true;
      return m;
    }
    // The 99 slip, printed (Doc 1 §5 S1: every one of them reads 99).
    let slipTex = null;
    function slipMaterial() {
      if (!slipTex) {
        slipTex = canvasTexture(64, 40, (c, w, h) => {
          c.fillStyle = '#e8e2d0'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#2b2b2b'; c.font = 'bold 26px Arial, Helvetica, sans-serif';
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('99', w / 2, h / 2 + 1);
        });
        slipTex.userData.shared = true;
      }
      // white sides; the print on top (BoxGeometry face order +x -x +y -y +z -z)
      const top = new THREE.MeshLambertMaterial({ map: slipTex, flatShading: true });
      const plain = new THREE.MeshLambertMaterial({ color: '#e8e2d0', flatShading: true });
      own(plain); own(top);
      return [plain, plain, top, plain, plain, plain];
    }
    const slipGeo = () => new THREE.BoxGeometry(0.08, 0.003, 0.05);

    // The receptionist's head, shared by her figure and her jaw so the two
    // line up: the neck pivot over a torso leaning in over the desk, bowed
    // `tilt` degrees. She faces +z (toward the counter and the candidate).
    const SEAT = 0.47, LEAN = 8 * D2R, NECK = 0.63, TORSO_Z = -0.06;
    function headFrame(o) {
      const f = new THREE.Group();
      f.position.set(0, (o.dais || 0) + SEAT + NECK * Math.cos(LEAN), TORSO_Z + NECK * Math.sin(LEAN));
      f.rotation.x = (o.tilt === undefined ? 26 : o.tilt) * D2R;
      return f;
    }
    const MOUTH_Y = 0.068; // on the face, above the pivot

    return {
      // Paints the catalog props placed before it in the same room that ask
      // for it (`paint: true`) wholly in their palette slot (`mat`): the
      // library only tints a model's light surfaces 80% of the way, which
      // turned Doc 2's one flat maroon into pink. Place it after them.
      palette(mats) {
        const g = new THREE.Group();
        g.addEventListener('added', () => {
          for (const c of (g.parent ? g.parent.children : [])) {
            const spec = c.userData && c.userData.spec;
            if (!spec || !spec.paint || !spec.mat || !mats.isLowPoly(spec.mat)) continue;
            const m = mats.get(spec.mat);
            c.traverse((x) => {
              if (!x.isMesh || !x.visible || Array.isArray(x.material) || !x.material.color) return;
              const k = x.material.color;
              if (0.2126 * k.r + 0.7152 * k.g + 0.0722 * k.b > 0.15) x.material = m; // its light (tinted) surfaces
            });
          }
        });
        return g;
      },

      // H's two overturned waiting chairs: the catalog chair on its back
      // (`tip: 'back'`) or its side (`'side'`), with a low collision body
      // where it lies. (Upright chairs stay plain `glb` props.)
      tipchair(mats, o, ctx) {
        const g = new THREE.Group();
        const inner = BUILDERS.glb(mats, { ...o, type: 'glb', node: o.node || 'lib_chair', collide: false, fallback: 'chair' }, ctx);
        const pivot = new THREE.Group();
        pivot.add(inner);
        g.add(pivot);
        let body;
        if (o.tip === 'side') {
          pivot.rotation.z = Math.PI / 2; // the top falls to -x
          pivot.position.y = 0.335;
          body = box(mats, 'lp_dark', 0.98, 0.7, 0.75, -0.49, 0, 0, { castShadow: false, collide: true });
        } else {
          pivot.rotation.x = -Math.PI / 2; // onto the backrest, legs toward where it faced
          pivot.position.y = 0.375;
          body = box(mats, 'lp_dark', 0.68, 0.75, 0.98, 0, 0, -0.49, { castShadow: false, collide: true });
        }
        g.add(unseen(body));
        return g;
      },

      // The reception counter: a dark low-poly body and ledge (company
      // furniture, C1) carrying the photoreal glass (the building's, Doc 1:
      // "behind photoreal glass") in dark mullions, a speaking grille at her
      // face, the slot tray, and fingerprints on the glass (Doc 2 S2).
      reception(mats, o) {
        const g = new THREE.Group();
        const w = o.w || 4.6, d = o.d || 0.8, h = o.h || 1.05;
        g.add(box(mats, o.mat || 'lp_dark', w, h, d, 0, 0, 0, { collide: true }));
        g.add(box(mats, 'lp_black', w - 0.04, 0.09, 0.02, 0, 0, d / 2 + 0.008));        // kick
        g.add(box(mats, 'lp_brass', w + 0.01, 0.025, 0.012, 0, h - 0.14, d / 2 + 0.006)); // a brass line under the ledge
        g.add(box(mats, 'lp_beige', w + 0.12, 0.05, d + 0.14, 0, h, 0.02));             // ledge
        const gz = -d / 2 + 0.26, gy = h + 0.05, gh = o.glassH || 1.42, panes = o.panes || 3;
        const pw = w / panes;
        // clearer than the shared 'glass' slot: the receptionist has to read through it
        const glass = own(new THREE.MeshStandardMaterial({ color: '#dfe7ea', roughness: 0.03, metalness: 0.1, transparent: true, opacity: o.glassOpacity || 0.12, depthWrite: false }));
        for (let i = 0; i < panes; i++) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(pw - 0.05, gh - 0.03, 0.018), glass);
          m.position.set(-w / 2 + (i + 0.5) * pw, gy + gh / 2, gz);
          m.receiveShadow = true;
          g.add(m);
        }
        for (let i = 0; i <= panes; i++) g.add(box(mats, 'lp_dark', 0.05, gh, 0.05, -w / 2 + i * pw, gy, gz));
        g.add(box(mats, 'lp_dark', w + 0.05, 0.06, 0.06, 0, gy + gh, gz));
        g.add(box(mats, 'lp_dark', w + 0.05, 0.025, 0.05, 0, gy, gz));
        // the speaking grille, at her face, and the tray in the ledge under it
        const grille = cylinder(mats, 'lp_chrome', 0.075, 0.012, 0, 0, 0, 12);
        grille.rotation.x = Math.PI / 2;
        grille.position.set(0, gy + 0.33, gz + 0.012);
        g.add(grille);
        for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) {
          if (Math.abs(r) + Math.abs(c) === 2) continue;
          g.add(box(mats, 'lp_black', 0.018, 0.018, 0.006, c * 0.03, gy + 0.33 - 0.009 + r * 0.03, gz + 0.019, { castShadow: false }));
        }
        g.add(box(mats, 'lp_chrome', 0.36, 0.022, 0.26, 0, h + 0.035, gz + 0.12, { castShadow: false }));
        g.add(box(mats, 'lp_dark', 0.3, 0.024, 0.2, 0, h + 0.037, gz + 0.12, { castShadow: false }));
        if (o.smudges) {
          // fingerprints: greasy ovals where hands have pressed, most of them
          // around the grille and the tray (photoreal, the glass's own)
          const tex = canvasTexture(512, 512, (c, W, H) => {
            const r = rng(o.seed || 7);
            const blot = (x, y, rx, ry, a) => {
              const gr = c.createRadialGradient(x, y, 0, x, y, rx);
              gr.addColorStop(0, `rgba(235,238,240,${a})`);
              gr.addColorStop(1, 'rgba(235,238,240,0)');
              c.save(); c.translate(x, y); c.scale(1, ry / rx); c.translate(-x, -y);
              c.fillStyle = gr; c.beginPath(); c.arc(x, y, rx, 0, Math.PI * 2); c.fill(); c.restore();
            };
            // hands pressed flat around the grille and the tray: four fingertips, a palm
            for (let i = 0; i < 7; i++) {
              const x = W / 2 + (r() - 0.5) * W * 0.5, y = H * 0.62 + (r() - 0.5) * H * 0.5;
              const a = (r() - 0.5) * 0.8;
              c.save(); c.translate(x, y); c.rotate(a);
              for (let f = 0; f < 4; f++) blot((f - 1.5) * 6.5, -Math.abs(f - 1.5) * 2.5 - 9, 2.8, 3.6, 0.2);
              blot(0, 5, 10, 7.5, 0.08);
              c.restore();
            }
            // and single prints anywhere a finger has pointed
            for (let i = 0; i < 22; i++) blot(r() * W, H * 0.3 + r() * H * 0.7, 2.4 + r() * 1.5, 3 + r() * 1.5, 0.1 + r() * 0.12);
          });
          const m = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.06, gh - 0.04), own(new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false })));
          m.position.set(0, gy + gh / 2, gz + 0.011);
          g.add(m);
        }
        return g;
      },

      // The receptionist: seated on a dais behind the counter so her bowed
      // head clears the ledge, at a desk, head down, face blurred to
      // unreadability (Doc 2). Low-poly, flat, static: no breathing, no
      // blink, the head never rises (C5). Her jaw is `receptionist_jaw`.
      receptionist(mats, o) {
        const g = new THREE.Group();
        const y0 = o.dais || 0;
        if (y0 > 0) { // the booth's raised floor: the building's (photoreal)
          const dais = box(mats, o.daisMat || 'marble', o.daisW || 4.4, y0, o.daisD || 0.9, 0, 0, o.daisZ || 0, { castShadow: false });
          applyWorldUV(dais.geometry, 2.5);
          g.add(dais);
        }
        const suit = o.suit || 'lp_red';
        // her chair
        g.add(box(mats, 'lp_dark', 0.05, 0.36, 0.05, 0, y0 + 0.04, -0.06));
        g.add(box(mats, 'lp_dark', 0.52, 0.04, 0.07, 0, y0, -0.06));
        g.add(box(mats, 'lp_dark', 0.07, 0.04, 0.52, 0, y0, -0.06));
        g.add(box(mats, 'lp_black', 0.46, 0.07, 0.44, 0, y0 + SEAT - 0.07, -0.05));
        g.add(box(mats, 'lp_black', 0.42, 0.46, 0.06, 0, y0 + SEAT + 0.06, -0.3));
        // the desk she bows over, and the form on it
        g.add(box(mats, 'lp_beige', 1.3, 0.035, 0.34, 0, y0 + 0.7, 0.36));
        for (const s of [-1, 1]) g.add(box(mats, 'lp_dark', 0.04, 0.7, 0.3, s * 0.6, y0, 0.36));
        g.add(box(mats, 'lp_paper', 0.21, 0.006, 0.28, 0.1, y0 + 0.735, 0.36, { castShadow: false }));
        // legs under the desk
        const ys = y0 + SEAT;
        for (const s of [-1, 1]) {
          g.add(box(mats, suit, 0.15, 0.13, 0.44, s * 0.1, ys - 0.02, 0.14));
          g.add(box(mats, 'lp_dark', 0.11, ys - y0 - 0.08, 0.11, s * 0.1, y0 + 0.06, 0.33));
          g.add(box(mats, 'lp_black', 0.11, 0.06, 0.2, s * 0.1, y0, 0.37));
        }
        // torso, leaning in; arms down to the desk, forearms and hands on it
        const torso = new THREE.Group();
        torso.position.set(0, ys, TORSO_Z);
        torso.rotation.x = LEAN;
        torso.add(box(mats, suit, 0.38, 0.5, 0.23, 0, 0, 0));
        torso.add(box(mats, suit, 0.48, 0.09, 0.25, 0, 0.48, 0));       // shoulders
        torso.add(box(mats, 'lp_skin', 0.09, 0.07, 0.09, 0, 0.56, 0.01)); // neck
        for (const s of [-1, 1]) torso.add(box(mats, suit, 0.1, 0.32, 0.11, s * 0.27, 0.22, 0.03));
        g.add(torso);
        for (const s of [-1, 1]) {
          g.add(box(mats, suit, 0.095, 0.085, 0.36, s * 0.22, y0 + 0.735, 0.22));
          g.add(box(mats, 'lp_skin', 0.085, 0.035, 0.1, s * 0.15, y0 + 0.737, 0.43));
        }
        // the head: bowed, hair up, the face a blur
        const head = headFrame(o);
        head.add(box(mats, 'lp_skin', 0.2, 0.235, 0.21, 0, 0, 0.01));
        head.add(box(mats, 'lp_dark', 0.22, 0.07, 0.225, 0, 0.2, 0.0));    // hair, top
        head.add(box(mats, 'lp_dark', 0.22, 0.2, 0.06, 0, 0.03, -0.085));  // hair, back
        head.add(box(mats, 'lp_dark', 0.11, 0.1, 0.09, 0, 0.17, -0.13));   // the bun
        const face = canvasTexture(64, 64, (c, W, H) => {
          c.fillStyle = '#c9a887'; c.fillRect(0, 0, W, H);
          c.filter = 'blur(3.5px)';
          c.fillStyle = 'rgba(70,46,36,0.75)';
          for (const x of [20, 44]) { c.beginPath(); c.ellipse(x, 27, 7, 3.2, 0, 0, Math.PI * 2); c.fill(); }
          c.fillStyle = 'rgba(120,80,60,0.45)'; c.beginPath(); c.ellipse(32, 37, 3, 7, 0, 0, Math.PI * 2); c.fill();
          c.fillStyle = 'rgba(110,58,52,0.7)'; c.beginPath(); c.ellipse(32, 47, 9, 2.6, 0, 0, Math.PI * 2); c.fill();
          c.filter = 'none';
          c.fillStyle = '#2b2b2b'; c.fillRect(0, 0, W, 5);
        });
        const fm = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.2), own(new THREE.MeshLambertMaterial({ map: face, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
        fm.position.set(0, 0.112, 0.1165);
        head.add(fm);
        g.add(head);
        return g;
      },

      // Her jaw, placed with the same spec as `receptionist`: hidden until
      // the call (scenes.json S2 shows it for the line). While shown it drops
      // in exactly four discrete steps and snaps shut, on a loop that does not
      // match the syllables (Doc 1 §5 S2, Doc 2 S2 KLING; C5). Nothing else moves.
      receptionist_jaw(mats, o) {
        const g = new THREE.Group();
        const head = headFrame(o);
        const mouth = box(mats, 'lp_black', 0.07, 1, 0.006, 0, 0, 0.12, { castShadow: false });
        const chin = box(mats, 'lp_skin', 0.12, 0.034, 0.016, 0, 0, 0.113, { castShadow: false });
        head.add(mouth, chin);
        g.add(head);
        const step = o.step || 0.014, fps = o.fps || 7;
        const pose = (k) => {
          const open = k * step;
          mouth.scale.y = Math.max(0.0005, open);
          mouth.position.y = MOUTH_Y - open / 2; // the slot hangs from the lip line
          chin.position.y = MOUTH_Y - open - 0.017;
        };
        pose(0);
        chin.onBeforeRender = () => pose(Math.floor(now() * fps) % 4);
        return g;
      },

      // A wall placard with the company's words on it (`text`, from
      // text/system.json -- C4: never "you"). Low-poly signage: a flat brass
      // plate, engraved, in a dark frame. Its back sits on the prop's origin.
      notice(mats, o) {
        const g = new THREE.Group();
        const w = o.w || 1.2, h = o.h || 0.22;
        g.add(box(mats, 'lp_dark', w + 0.05, h + 0.05, 0.016, 0, -(h + 0.05) / 2, 0.008));
        const px = 2048, py = Math.max(64, Math.round(px * h / w));
        const tex = canvasTexture(px, py, (c, W, H) => {
          c.fillStyle = o.plate || '#a8863c'; c.fillRect(0, 0, W, H);
          c.strokeStyle = 'rgba(40,30,12,0.55)'; c.lineWidth = Math.max(3, H * 0.03); c.strokeRect(H * 0.08, H * 0.08, W - H * 0.16, H - H * 0.16);
          let size = H * 0.5;
          c.font = `bold ${size}px "Arial Narrow", Arial, Helvetica, sans-serif`;
          const text = String(o.text || '').toUpperCase();
          const maxW = W * 0.9;
          const tw = c.measureText(text).width;
          if (tw > maxW) { size *= maxW / tw; c.font = `bold ${size}px "Arial Narrow", Arial, Helvetica, sans-serif`; }
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillStyle = 'rgba(255,240,200,0.35)'; c.fillText(text, W / 2 + 2, H / 2 + 3); // the engraving's lit lip
          c.fillStyle = o.ink || '#2a2214'; c.fillText(text, W / 2, H / 2 + 1);
        });
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(w, h), own(new THREE.MeshLambertMaterial({ map: tex })));
        plate.position.set(0, 0, 0.0175);
        plate.receiveShadow = true;
        g.add(plate);
        return g;
      },

      // The small ceiling speaker grille (Doc 2 S2): a round grille hanging
      // flush under the ceiling at the prop's origin. The Muzak is not from here
      // (S1: "a speaker you cannot locate"); the call is.
      speaker(mats) {
        const g = new THREE.Group();
        g.add(cylinder(mats, 'lp_grey', 0.15, 0.012, 0, -0.012, 0, 16));
        g.add(cylinder(mats, 'lp_dark', 0.12, 0.004, 0, -0.016, 0, 16));
        for (let i = -3; i <= 3; i++) g.add(box(mats, 'lp_grey', 0.22 - Math.abs(i) * 0.025, 0.004, 0.012, 0, -0.02, i * 0.03, { castShadow: false }));
        return g;
      },

      // The queue: a lane of brass stanchions and sagging maroon rope,
      // `w` wide and `len` long along z, open at both ends; the rope lines
      // collide (an invisible body under each) so the lane is entered from
      // its mouth. Standing at its head is STAY STANDING.
      queue(mats, o) {
        const g = new THREE.Group();
        const w = o.w || 1.4, len = o.len || 1.6, n = o.posts || 3;
        const zs = [];
        for (let i = 0; i < n; i++) zs.push(-len / 2 + 0.03 + i * ((len - 0.06) / (n - 1)));
        for (const s of [-1, 1]) {
          const x = s * w / 2;
          for (const z of zs) {
            g.add(cylinder(mats, 'lp_dark', 0.15, 0.03, x, 0, z, 10));
            g.add(cylinder(mats, 'lp_brass', 0.024, 0.9, x, 0.03, z, 6));
            g.add(cylinder(mats, 'lp_brass', 0.04, 0.05, x, 0.93, z, 8));
          }
          for (let i = 0; i < n - 1; i++) {
            const z0 = zs[i], z1 = zs[i + 1], zm = (z0 + z1) / 2, top = 0.93, sag = 0.09;
            for (const [a, b, ya, yb] of [[z0, zm, top, top - sag], [zm, z1, top - sag, top]]) {
              const l = Math.hypot(b - a, yb - ya);
              const rope = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, l), mats.get('lp_red'));
              rope.position.set(x, (ya + yb) / 2, (a + b) / 2);
              rope.rotation.x = Math.atan2(ya - yb, b - a);
              rope.castShadow = true;
              g.add(rope);
            }
          }
          g.add(unseen(box(mats, 'lp_dark', 0.08, 1.0, len + 0.04, x, 0, 0, { castShadow: false, collide: true })));
        }
        return g;
      },

      // The ticket dispenser on its post. `feed` (H): it never stops -- a
      // ribbon of slips hangs from the mouth and one drops every second or
      // so, flutters down and settles into the pile (Doc 2 S1_H KLING).
      ticketpost(mats, o) {
        const g = new THREE.Group();
        g.add(cylinder(mats, 'lp_dark', 0.17, 0.03, 0, 0, 0, 10));
        g.add(box(mats, 'lp_grey', 0.055, 1.02, 0.055, 0, 0.03, 0));
        g.add(box(mats, 'lp_red', 0.24, 0.3, 0.2, 0, 1.05, 0));
        g.add(box(mats, 'lp_red', 0.26, 0.03, 0.22, 0, 1.35, 0));
        g.add(box(mats, 'lp_dark', 0.15, 0.035, 0.025, 0, 1.2, 0.1));           // the mouth
        g.add(box(mats, 'lp_paper', 0.07, 0.004, 0.06, 0, 1.208, 0.125));       // the next slip, out
        const disc = cylinder(mats, 'lp_dark', 0.05, 0.01, 0, 0, 0, 12);        // the number window, dark
        disc.rotation.x = Math.PI / 2; disc.position.set(0, 1.3, 0.103);
        g.add(disc);
        g.add(unseen(box(mats, 'lp_dark', 0.28, 1.3, 0.28, 0, 0, 0, { castShadow: false, collide: true })));
        if (o.feed) {
          const mat = slipMaterial();
          // the ribbon: slips still joined, curling out and down
          const ribbon = [[0, 1.2, 0.13, 0.6], [0, 1.16, 0.17, 1.1], [0, 1.1, 0.19, 1.45]];
          for (const [x, y, z, a] of ribbon) {
            const m = new THREE.Mesh(slipGeo(), mat);
            m.scale.set(0.9, 1, 1.0);
            m.position.set(x, y, z);
            m.rotation.set(a, Math.PI / 2, 0);
            g.add(m);
          }
          const falling = [];
          for (let i = 0; i < 5; i++) {
            const m = new THREE.Mesh(slipGeo(), mat);
            m.castShadow = false;
            g.add(m);
            falling.push(m);
          }
          const P = 4.6, FALL = 0.85, LIE = 3.2;
          const hash = (n) => { const x = Math.sin(n * 91.345 + 7.13) * 43758.5453; return x - Math.floor(x); };
          const hostMesh = g.children[2];
          hostMesh.onBeforeRender = () => {
            const t = now();
            falling.forEach((m, i) => {
              const tt = t + i * (P / falling.length);
              const cyc = Math.floor(tt / P), c = tt - cyc * P;
              const hx = (hash(cyc * 5 + i) - 0.5) * 0.9, hz = 0.25 + hash(cyc * 7 + i + 3) * 0.7;
              if (c < FALL) {
                const u = c / FALL;
                m.visible = true;
                m.position.set(hx * u + Math.sin(u * 9 + i) * 0.04, 1.2 - 1.196 * u * u, 0.14 + (hz - 0.14) * u);
                m.rotation.set(Math.sin(u * 7 + i) * 0.9, u * 4 + i, Math.cos(u * 5 + i) * 0.6);
              } else if (c < FALL + LIE) {
                m.position.set(hx, 0.004, hz);
                m.rotation.set(0, i + cyc, 0);
              } else m.visible = false;
            });
          };
        }
        return g;
      },

      // The pile under the feeding dispenser (H): `n` printed slips heaped
      // within `r` of the prop's origin, plus single slips drifted out to
      // `drift` offsets. One instanced mesh (one draw call).
      slippile(mats, o) {
        const g = new THREE.Group();
        const n = o.n || 60, R = o.r || 0.8, drift = o.drift || [];
        const r = rng(o.seed || 99);
        const mesh = new THREE.InstancedMesh(slipGeo(), slipMaterial(), n + drift.length);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
        for (let i = 0; i < n; i++) {
          const rr = R * Math.sqrt(r()), a = r() * Math.PI * 2;
          const heap = Math.pow(1 - rr / R, 1.4);
          p.set(Math.cos(a) * rr, 0.003 + heap * 0.12 * (0.35 + 0.65 * r()) + i * 0.0002, 0.18 + Math.sin(a) * rr * 0.8);
          e.set((r() - 0.5) * heap * 0.9, r() * Math.PI * 2, (r() - 0.5) * heap * 0.9);
          mesh.setMatrixAt(i, m4.compose(p, q.setFromEuler(e), one));
        }
        drift.forEach(([x, z], k) => {
          p.set(x, 0.003 + k * 0.0003, z);
          e.set(0, r() * Math.PI * 2, 0);
          mesh.setMatrixAt(n + k, m4.compose(p, q.setFromEuler(e), one));
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.frustumCulled = false;
        mesh.receiveShadow = true;
        g.add(mesh);
        return g;
      },

      // The V&A monogram inlaid in the marble (Doc 1 §5 S1, Doc 2): an
      // interlocked V and A in flat brass inside a ring. On second look the V
      // is a serpent's open jaw (an eye at the hinge, fangs at the tips) and
      // the A a lion going into it, rear first (a mane at the apex). Held in
      // view for three seconds from close by, it resolves: the serpent's
      // body coils out round the ring, its scales and the lion's face come
      // up -- and it lets go two seconds after the gaze does.
      monogram(mats, o) {
        const g = new THREE.Group();
        const R = o.r || 1.5, s = R / 1.5;
        const brass = inlayMat(o.brass || '#9a7834', { emissive: new THREE.Color('#120d04') });
        const reveal = inlayMat('#c9a04a', { emissive: new THREE.Color('#2a1e08'), transparent: true, opacity: 0, depthWrite: false, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
        const revealDark = inlayMat('#231d12', { transparent: true, opacity: 0, depthWrite: false, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
        const bar = (mat, x0, z0, x1, z1, w) => g.add(floorBar(mat, x0 * s, z0 * s, x1 * s, z1 * s, w * s));
        const ringMesh = (mat, r0, r1) => {
          const m = new THREE.Mesh(new THREE.RingGeometry(r0 * s, r1 * s, 64, 1).rotateX(-Math.PI / 2), mat);
          m.position.y = 0.0045; m.receiveShadow = true; g.add(m); return m;
        };
        const ring = ringMesh(brass, 1.41, 1.5);
        ringMesh(brass, 1.32, 1.35);
        // V: the serpent's jaw, hinge toward the entrance (+z), opening on the core
        bar(brass, -0.76, -0.82, 0, 0.86, 0.13);
        bar(brass, 0.76, -0.82, 0, 0.86, 0.13);
        // A: apex to the core, legs into the jaw, the crossbar
        bar(brass, 0, -0.98, -0.6, 0.78, 0.11);
        bar(brass, 0, -0.98, 0.6, 0.78, 0.11);
        bar(brass, -0.31, 0.12, 0.31, 0.12, 0.1);
        // second look: fangs at the jaw's tips, an eye at its hinge, a mane at the apex
        bar(brass, -0.76, -0.82, -0.62, -0.74, 0.05);
        bar(brass, 0.76, -0.82, 0.62, -0.74, 0.05);
        bar(brass, -0.31, 0.6, -0.23, 0.6, 0.07);
        bar(brass, -0.1, -1.0, 0.1, -1.0, 0.2);
        for (let k = 0; k < 9; k++) {
          const a = Math.PI * (0.05 + 0.9 * k / 8);
          bar(brass, -Math.cos(a) * 0.14, -1.0 - Math.sin(a) * 0.14, -Math.cos(a) * 0.25, -1.0 - Math.sin(a) * 0.25, 0.03);
        }
        // the resolve: the serpent's body out of the hinge and round the ring,
        // scales on the jaw, the lion's face and a tail
        let px = 0, pz = 0.86;
        for (let k = 0; k <= 16; k++) {
          const a = Math.PI / 2 + (k / 16) * Math.PI * 1.55; // round the bottom, up the right, over the top
          const rr = 1.24 - k * 0.008;
          const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
          bar(reveal, px, pz, x, z, 0.11 - k * 0.0045);
          px = x; pz = z;
        }
        for (let k = 1; k <= 4; k++) for (const sgn of [-1, 1]) {
          const t = k / 5, x = sgn * 0.76 * (1 - t), z = -0.82 + 1.68 * t;
          bar(reveal, x - sgn * 0.07, z - 0.06, x + sgn * 0.02, z + 0.04, 0.03);
        }
        bar(reveal, 0.23, 0.6, 0.31, 0.6, 0.07);
        bar(revealDark, -0.065, -1.035, -0.025, -1.035, 0.035);
        bar(revealDark, 0.025, -1.035, 0.065, -1.035, 0.035);
        bar(revealDark, -0.03, -0.945, 0.03, -0.945, 0.03);
        bar(reveal, 0.6, 0.78, 0.9, 0.62, 0.035);
        bar(reveal, 0.9, 0.62, 0.98, 0.72, 0.035);
        // the gaze: held three seconds within ~7 m, it resolves; two seconds off, it lets go
        const st = { lookStart: 0, lastLook: -99, resolved: false, k: 0, last: 0 };
        const c = new THREE.Vector3(), f = new THREE.Vector3(), d = new THREE.Vector3();
        ring.onBeforeRender = (renderer, scene, cam) => {
          const t = now();
          const dt = st.last ? Math.min(0.5, t - st.last) : 0;
          st.last = t;
          g.getWorldPosition(c);
          d.subVectors(c, cam.position);
          const dist = d.length();
          cam.getWorldDirection(f);
          const looking = dist < (o.within || 7.5) && f.dot(d.normalize()) > Math.cos((o.cone || 13) * D2R);
          if (looking) { if (t - st.lastLook > 1.0) st.lookStart = t; st.lastLook = t; } // (a gap of a second breaks the gaze)
          if (looking && t - st.lookStart >= (o.gaze || 3)) st.resolved = true;
          if (t - st.lastLook > 2) st.resolved = false;
          st.k = Math.max(0, Math.min(1, st.k + (st.resolved ? 1 : -1) * dt / 1.5));
          reveal.opacity = st.k;
          revealDark.opacity = st.k;
        };
        return g;
      },

      // Dust in the ceiling light: the only thing that moves in the C room
      // (Doc 2 S1 KLING C, "a slow drift of dust in the ceiling light").
      // `n` motes in a `w` x `h` x `d` volume above the origin, drifting.
      dust(mats, o) {
        const g = new THREE.Group();
        const n = o.n || 90, w = o.w || 10, h = o.h || 2.4, d = o.d || 8, y0 = o.y || 1.4;
        const r = rng(o.seed || 5);
        const base = new Float32Array(n * 4);
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { base[i * 4] = (r() - 0.5) * w; base[i * 4 + 1] = y0 + r() * h; base[i * 4 + 2] = (r() - 0.5) * d; base[i * 4 + 3] = r() * 100; }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const pts = new THREE.Points(geo, own(new THREE.PointsMaterial({ color: o.color || '#e9eef4', size: o.size || 0.014, transparent: true, opacity: o.opacity || 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
        pts.frustumCulled = false;
        const place = (t) => {
          for (let i = 0; i < n; i++) {
            const ph = base[i * 4 + 3];
            pos[i * 3] = base[i * 4] + Math.sin(t * 0.07 + ph) * 0.35;
            pos[i * 3 + 1] = y0 + ((base[i * 4 + 1] - y0 - t * 0.012 + h * 10) % h);
            pos[i * 3 + 2] = base[i * 4 + 2] + Math.cos(t * 0.05 + ph * 1.3) * 0.35;
          }
          geo.attributes.position.needsUpdate = true;
        };
        place(0);
        pts.onBeforeRender = () => place(now());
        g.add(pts);
        return g;
      },

      // A lamp over a door: dark housing, a lens -- `lens: 'red'` (locked)
      // or `'green'` (the way on). Two are placed together and beats swap them.
      doorlamp(mats, o) {
        const g = new THREE.Group();
        g.add(box(mats, 'lp_dark', 0.16, 0.1, 0.06, 0, -0.05, 0.03));
        g.add(box(mats, o.lens === 'green' ? 'lp_sign' : 'lp_taillight', 0.11, 0.055, 0.014, 0, -0.0275, 0.066, { castShadow: false }));
        return g;
      },

      // The dark past a doorway (outside the shell): matte black, untouched
      // by fog or light, so glass in front of it reads as night with no
      // street and no sky (C3).
      backing(mats, o) {
        const g = new THREE.Group();
        const m = new THREE.Mesh(new THREE.BoxGeometry(o.w || 3, o.h || 3, 0.04), own(new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })));
        m.position.set(0, (o.h || 3) / 2, 0);
        g.add(m);
        return g;
      },

      // The marble's wet mirror finish (Doc 1: "deep and wet-looking"): an
      // additive film on the floor that shows what a polished floor would
      // reflect -- the ceiling's light fixtures, `lamps` [[x, z, w, d], ...]
      // at `ceiling` height, mirrored with the right parallax and stronger
      // toward grazing. With `coffers` (H) it reflects a coffered ceiling
      // that is not there (Doc 1 §5 S1 H) instead. `fog` [near, far] fades it.
      floorsheen(mats, o) {
        const g = new THREE.Group();
        const w = o.w || 10, d = o.d || 10;
        const lamps = (o.lamps || []).slice(0, 8);
        while (lamps.length < 8) lamps.push([0, 0, 0, 0]);
        const mat = own(new THREE.ShaderMaterial({
          uniforms: {
            uCam: { value: new THREE.Vector3() },
            uHalf: { value: new THREE.Vector2(w / 2, d / 2) },
            uCeil: { value: o.ceiling || 4.14 },
            uLamps: { value: lamps.map((l) => new THREE.Vector4(l[0], l[1], l[2] / 2, l[3] / 2)) },
            uCoffers: { value: o.coffers ? 1 : 0 },
            uCell: { value: o.cell || 1.75 },
            uColor: { value: new THREE.Color(o.color || (o.coffers ? '#fff2dc' : '#e6eef8')) },
            uGain: { value: o.gain || (o.coffers ? 0.55 : 0.8) },
            uFog: { value: new THREE.Vector2(...(o.fog || [10, 36])) }
          },
          vertexShader: `
            varying vec3 vLocal;
            void main() { vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: `
            uniform vec3 uCam; uniform vec2 uHalf; uniform float uCeil; uniform vec4 uLamps[8];
            uniform float uCoffers; uniform float uCell; uniform vec3 uColor; uniform float uGain; uniform vec2 uFog;
            varying vec3 vLocal;
            float boxGlow(vec2 q, vec4 l) {
              if (l.z <= 0.0) return 0.0;
              vec2 e = abs(q - l.xy) - l.zw;
              float out_ = length(max(e, 0.0));
              return smoothstep(0.12, 0.0, out_) + 0.25 * exp(-out_ * 3.0);
            }
            void main() {
              float h = max(uCam.y, 0.05);
              vec3 v = uCam - vLocal;
              float dist = length(v);
              // where the ray from the eye through this point meets the mirrored ceiling
              vec2 q = uCam.xz + (vLocal.xz - uCam.xz) * ((h + uCeil) / h);
              float inside = step(abs(q.x), uHalf.x) * step(abs(q.y), uHalf.y);
              float lum = 0.0;
              if (uCoffers > 0.5) {
                vec2 f = fract(q / uCell + 0.5) - 0.5;
                float m = max(abs(f.x), abs(f.y));
                lum = smoothstep(0.43, 0.38, m) * (0.35 + 0.65 * smoothstep(0.34, 0.05, m)) + 0.9 * exp(-dot(f, f) * 70.0);
              } else {
                for (int i = 0; i < 8; i++) lum += boxGlow(q, uLamps[i]);
              }
              float cosA = clamp(h / dist, 0.0, 1.0);
              float fres = 0.06 + 0.94 * pow(1.0 - cosA, 3.0);
              float fogK = 1.0 - smoothstep(uFog.x, uFog.y, dist);
              gl_FragColor = vec4(uColor * lum * fres * fogK * inside * uGain, 1.0);
            }`,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        }));
        if (o.tone) {
          // under it, a tone the marble is multiplied by: deeper, and cooler or warmer
          const tone = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), own(new THREE.MeshBasicMaterial({
            color: o.tone, blending: THREE.MultiplyBlending, premultipliedAlpha: true, transparent: true, depthWrite: false, fog: false,
            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
          })));
          tone.position.y = 0.0008;
          g.add(tone);
        }
        const film = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat);
        film.position.y = 0.001;
        film.renderOrder = 2;
        const inv = new THREE.Matrix4();
        film.onBeforeRender = (renderer, scene, cam) => {
          inv.copy(film.matrixWorld).invert();
          mat.uniforms.uCam.value.copy(cam.position).applyMatrix4(inv);
        };
        g.add(film);
        return g;
      }
    };
  })(),
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
