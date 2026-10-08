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
  // S4 THE FLOOR. The surfaces the material library has no slot for -- the
  // manager's blurred face, the evidence (the one photoreal paper in the
  // game, Doc 1 S4), a caged bulb, a wet film on the concrete, the
  // janitor's yellow -- are made here once per library (a WeakMap keyed by
  // `mats`) and shared by every prop that uses them, never made per prop.
  // Company things keep the PS1 look (C1: flat-shaded, vertex-snapped like
  // the lp_* slots); the building's things (the paper, the bulb, water,
  // dust, steam) are lit and real.
  ...(() => {
    const own = new WeakMap();
    const cached = (mats, key, make) => {
      let m = own.get(mats);
      if (!m) { m = new Map(); own.set(mats, m); }
      if (!m.has(key)) m.set(key, make());
      return m.get(key);
    };
    // the lp_* vertex snap, borrowed from a library slot (materials.js withVertexSnap)
    const snapped = (mats, m) => {
      const b = mats.get('lp_grey');
      m.onBeforeCompile = b.onBeforeCompile;
      m.customProgramCacheKey = b.customProgramCacheKey;
      return m;
    };
    const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
    const texture = (c, { srgb = true, repeat = false } = {}) => {
      const t = new THREE.CanvasTexture(c);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    };
    const rng = (seed) => {
      let a = seed >>> 0;
      return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    const blob = (g, x, y, rx, ry, color) => {
      const r = Math.max(rx, ry);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, color);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.save();
      g.translate(x, y);
      g.scale(rx / r, ry / r);
      g.fillStyle = gr;
      g.fillRect(-r, -r, 2 * r, 2 * r);
      g.restore();
    };
    const _q = new THREE.Quaternion();
    const mesh = (geo, m, { cast = true, receive = true } = {}) => { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = receive; return o; };

    // A face blurred beyond reading at every distance (Doc 1 S4): soft
    // features only, then blurred again, on the head's front.
    const faceMat = (mats) => cached(mats, 'face', () => {
      const raw = canvas(64, 64, (g, w, h) => {
        g.fillStyle = '#c4a383';
        g.fillRect(0, 0, w, h);
        blob(g, 32, 2, 40, 12, 'rgba(38,30,26,0.95)');
        blob(g, 20, 28, 11, 6, 'rgba(70,46,36,0.7)');
        blob(g, 44, 28, 11, 6, 'rgba(70,46,36,0.7)');
        blob(g, 32, 39, 5, 10, 'rgba(105,72,54,0.4)');
        blob(g, 32, 51, 13, 4, 'rgba(92,52,46,0.6)');
        blob(g, 32, 66, 34, 9, 'rgba(110,80,62,0.45)');
      });
      const soft = canvas(64, 64, (g) => { g.filter = 'blur(3px)'; g.drawImage(raw, 0, 0); g.filter = 'none'; });
      return snapped(mats, new THREE.MeshLambertMaterial({ map: texture(soft), flatShading: true }));
    });

    // The evidence: crisp, typed, signed, clipped. Illegible (no words in
    // the world), but the sharpest thing in any frame it is in.
    const paperMats = (mats) => cached(mats, 'paper', () => {
      const r = rng(4099);
      const page = canvas(512, 724, (g, w, h) => {
        g.fillStyle = '#f3f1eb';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 4200; i++) {
          const v = r() < 0.5 ? 150 : 255;
          g.fillStyle = `rgba(${v},${v},${v - 6},${0.04 + r() * 0.06})`;
          g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1);
        }
        const ink = 'rgba(28,28,32,0.9)';
        g.fillStyle = ink;
        g.fillRect(44, 46, 150, 11);
        g.fillRect(44, 64, 96, 5);
        g.fillRect(352, 46, 116, 6);
        g.fillRect(392, 58, 76, 5);
        g.fillStyle = 'rgba(40,40,44,0.7)';
        g.fillRect(44, 88, w - 88, 1.5);
        let y = 116;
        for (let line = 0; y < 600; line++) {
          if (line % 7 === 6) { y += 10; continue; }
          let x = 44 + (line % 7 === 0 ? 22 : 0);
          const end = w - 44 - (line % 7 === 5 ? 120 + r() * 160 : r() * 18);
          g.fillStyle = ink;
          while (x < end) {
            const ww = Math.min(end - x, 10 + r() * 46);
            g.fillRect(x, y, ww, 3.2);
            x += ww + 6;
          }
          y += 11.5;
        }
        // a form box, a signature, a stamp
        g.strokeStyle = 'rgba(30,30,34,0.85)';
        g.lineWidth = 1.2;
        g.strokeRect(44, 616, 210, 58);
        g.strokeRect(274, 616, 194, 58);
        for (let k = 0; k < 3; k++) { g.fillStyle = ink; g.fillRect(52, 628 + k * 15, 60 + r() * 100, 3); }
        g.strokeStyle = 'rgba(22,30,70,0.85)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(292, 660);
        g.bezierCurveTo(310, 620, 330, 676, 350, 640);
        g.bezierCurveTo(366, 612, 380, 668, 410, 646);
        g.bezierCurveTo(424, 636, 440, 650, 452, 642);
        g.stroke();
        g.strokeStyle = 'rgba(140,38,34,0.45)';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(410, 560, 38, 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 2;
        g.beginPath();
        g.arc(410, 560, 28, 0, Math.PI * 2);
        g.stroke();
      });
      return {
        top: new THREE.MeshStandardMaterial({ map: texture(page), roughness: 0.78, metalness: 0 }),
        edge: new THREE.MeshStandardMaterial({ color: '#ebe8df', roughness: 0.86, metalness: 0 }),
        clip: new THREE.MeshStandardMaterial({ color: '#b9bdc1', roughness: 0.22, metalness: 0.9 })
      };
    });

    const yellowMat = (mats) => cached(mats, 'yellow', () => snapped(mats, new THREE.MeshLambertMaterial({ color: '#b8952c', flatShading: true })));
    const coldLensMat = (mats) => cached(mats, 'coldLens', () => snapped(mats, new THREE.MeshLambertMaterial({ color: '#d8e6f0', emissive: '#cfe2f2', emissiveIntensity: 1.5, flatShading: true })));
    const bulbMats = (mats) => cached(mats, 'bulb', () => ({
      metal: new THREE.MeshStandardMaterial({ color: '#2c2b28', roughness: 0.5, metalness: 0.75 }),
      lit: new THREE.MeshStandardMaterial({ color: '#fff3d8', emissive: '#ffd79a', emissiveIntensity: 2.4, roughness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: '#77736a', roughness: 0.18, metalness: 0.05 })
    }));
    // a soft round glow (additive), so a lamp's halo is a falloff, not a square
    const haloMat = (mats, color, opacity) => cached(mats, `halo:${color}:${opacity}`, () => {
      const c = canvas(64, 64, (g) => blob(g, 32, 32, 31, 31, 'rgba(255,255,255,1)'));
      return new THREE.MeshBasicMaterial({ map: texture(c), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    });
    const spillMat = (mats) => cached(mats, 'spill', () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    const puddleMat = (mats) => cached(mats, 'puddle', () => new THREE.MeshStandardMaterial({ color: '#141513', roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.58, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const dustMat = (mats) => cached(mats, 'dust', () => {
      const dot = canvas(32, 32, (g) => blob(g, 16, 16, 15, 15, 'rgba(255,255,255,1)'));
      return new THREE.PointsMaterial({ color: '#fbf5e2', size: 0.018, sizeAttenuation: true, map: texture(dot), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
    });
    const steamMat = (mats) => cached(mats, 'steam', () => {
      const r = rng(77);
      const wisps = canvas(64, 128, (g, w, h) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) {
          const x = r() * w, y = r() * h, rx = 4 + r() * 10, ry = 12 + r() * 26, a = 0.12 + r() * 0.2;
          for (const dy of [-h, 0, h]) blob(g, x, y + dy, rx, ry, `rgba(255,255,255,${a})`);
        }
      });
      const fade = canvas(64, 64, (g, w, h) => {
        const hz = g.createLinearGradient(0, 0, w, 0);
        hz.addColorStop(0, '#000'); hz.addColorStop(0.5, '#fff'); hz.addColorStop(1, '#000');
        g.fillStyle = hz;
        g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'multiply';
        const vt = g.createLinearGradient(0, 0, 0, h);
        vt.addColorStop(0, '#000'); vt.addColorStop(0.55, '#bbb'); vt.addColorStop(0.92, '#fff'); vt.addColorStop(1, '#333');
        g.fillStyle = vt;
        g.fillRect(0, 0, w, h);
      });
      const map = texture(wisps, { repeat: true });
      return new THREE.MeshBasicMaterial({ map, alphaMap: texture(fade, { srgb: false }), color: '#dfe5df', transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    });

    return {
      // THE MANAGER (Doc 1 S4, Doc 2 S4_C): the same blocky suit as
      // `figure`, a face blurred beyond reading on the front of the head
      // (`face: 'blur'`), a tie that is four flat polygons (`tie`), and with
      // `offer` his right forearm held out, palm up, for the evidence to lie
      // on. No walk cycle: he only ever translates (room.js actors). `collide`
      // gives him a body the candidate cannot walk through.
      manager(mats, o) {
        const g = new THREE.Group();
        const suit = o.suit || 'lp_suit';
        const skin = mats.get('lp_skin'), hair = mats.get('lp_dark');
        g.add(box(mats, suit, 0.44, 0.6, 0.24, 0, 0.9, 0));
        g.add(box(mats, suit, 0.56, 0.1, 0.26, 0, 1.44, 0));
        g.add(box(mats, 'lp_white', 0.13, 0.1, 0.01, 0, 1.36, 0.122)); // the shirt at the collar
        g.add(box(mats, 'lp_skin', 0.1, 0.06, 0.1, 0, 1.5, 0));
        const head = mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), [skin, skin, hair, skin, o.face === 'blur' ? faceMat(mats) : skin, hair]);
        head.position.set(0, 1.68, 0);
        g.add(head);
        g.add(box(mats, 'lp_dark', 0.24, 0.07, 0.24, 0, 1.79, -0.005));
        for (const s of [-1, 1]) {
          g.add(box(mats, 'lp_dark', 0.16, 0.9, 0.16, s * 0.12, 0, 0));
          g.add(box(mats, 'lp_black', 0.15, 0.06, 0.26, s * 0.12, 0, 0.04));
        }
        // his left arm hangs
        g.add(box(mats, suit, 0.12, 0.58, 0.12, 0.3, 0.92, 0));
        g.add(box(mats, 'lp_skin', 0.1, 0.12, 0.1, 0.3, 0.8, 0));
        if (o.offer) {
          // his right: upper arm a little forward, forearm out level, palm up
          const shoulder = new THREE.Group();
          shoulder.position.set(-0.3, 1.46, 0);
          shoulder.rotation.x = -0.45;
          shoulder.add(box(mats, suit, 0.12, 0.34, 0.12, 0, -0.34, 0));
          const elbow = new THREE.Group();
          elbow.position.set(0, -0.32, 0);
          elbow.rotation.x = -1.05;
          elbow.add(box(mats, suit, 0.11, 0.3, 0.11, 0, -0.3, 0));
          elbow.add(box(mats, 'lp_skin', 0.1, 0.11, 0.1, 0, -0.41, 0));
          shoulder.add(elbow);
          g.add(shoulder);
        } else {
          g.add(box(mats, suit, 0.12, 0.58, 0.12, -0.3, 0.92, 0));
          g.add(box(mats, 'lp_skin', 0.1, 0.12, 0.1, -0.3, 0.8, 0));
        }
        if (o.tie) {
          // four flat polygons: the knot, the blade, its widening, the point
          const quads = [
            [[-0.036, 1.44], [0.036, 1.44], [0.022, 1.37], [-0.022, 1.37]],
            [[-0.022, 1.37], [0.022, 1.37], [0.04, 1.12], [-0.04, 1.12]],
            [[-0.04, 1.12], [0.04, 1.12], [0.05, 1.0], [-0.05, 1.0]]
          ];
          const v = [];
          for (const [a, b, c, d] of quads) v.push(...a, 0, ...d, 0, ...c, 0, ...a, 0, ...c, 0, ...b, 0);
          v.push(-0.05, 1.0, 0, 0, 0.93, 0, 0.05, 1.0, 0);
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
          geo.computeVertexNormals();
          const tie = mesh(geo, mats.get('lp_red'), { cast: false });
          tie.position.z = 0.129;
          g.add(tie);
        }
        if (o.collide) {
          const body = box(mats, 'lp_dark', 0.56, 1.8, 0.32, 0, 0, 0, { castShadow: false, collide: true });
          body.visible = false;
          g.add(body);
        }
        return g;
      },
      // The evidence (Doc 1 S4): a stack of photoreal paper, the top sheet
      // typed and signed, a clip at the corner. `tilt` (degrees) lifts its
      // far edge toward whoever it is held out to. The top of the page is
      // toward local -z.
      evidence(mats, o) {
        const g = new THREE.Group();
        const pm = paperMats(mats);
        const inner = new THREE.Group();
        inner.rotation.x = THREE.MathUtils.degToRad(o.tilt || 0);
        g.add(inner);
        const W = 0.21, D = 0.297, T = 0.0011 * (o.sheets || 10);
        const stack = mesh(new THREE.BoxGeometry(W, T, D), pm.edge);
        stack.position.y = T / 2;
        inner.add(stack);
        const loose = mesh(new THREE.BoxGeometry(W, 0.0008, D), pm.edge, { cast: false });
        loose.position.set(0.006, T + 0.0004, 0.004);
        loose.rotation.y = -0.045;
        inner.add(loose);
        const top = mesh(new THREE.PlaneGeometry(W, D), pm.top, { cast: false });
        top.rotation.set(-Math.PI / 2, 0, 0.018);
        top.position.y = T + 0.0013;
        inner.add(top);
        for (const [x, w, d] of [[-0.075, 0.006, 0.05], [-0.06, 0.006, 0.04], [-0.0675, 0.021, 0.006]]) {
          const c = mesh(new THREE.BoxGeometry(w, 0.0025, d), pm.clip, { cast: false });
          c.position.set(x, T + 0.0022, -D / 2 + (d > 0.01 ? d / 2 - 0.006 : 0.03));
          inner.add(c);
        }
        return g;
      },
      // Real dust in the air (Doc 1 S4, Doc 2 KLING C "dust drifts"): a
      // few hundred motes in a w x h x d volume above the prop's position,
      // drifting slowly, lit by nothing but adding to the light they are in.
      dust(mats, o) {
        const g = new THREE.Group();
        const n = o.n || 220, w = o.w || 3, h = o.h || 2.4, d = o.d || 3;
        const r = rng(o.seed || 11);
        const base = new Float32Array(n * 3), ph = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          base[i * 3] = (r() - 0.5) * w; base[i * 3 + 1] = 0.3 + r() * (h - 0.3); base[i * 3 + 2] = (r() - 0.5) * d;
          ph[i * 3] = r() * 6.28; ph[i * 3 + 1] = 0.006 + r() * 0.02; ph[i * 3 + 2] = r() * 6.28;
        }
        const geo = new THREE.BufferGeometry();
        const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
        geo.setAttribute('position', pos);
        const pts = new THREE.Points(geo, dustMat(mats));
        pts.frustumCulled = false;
        const span = h - 0.3;
        const step = () => {
          const t = performance.now() * 0.001;
          const a = pos.array;
          for (let i = 0; i < n; i++) {
            const k = i * 3;
            a[k] = base[k] + Math.sin(t * 0.17 + ph[k]) * 0.14;
            a[k + 1] = 0.3 + ((base[k + 1] - 0.3 + t * ph[k + 1]) % span);
            a[k + 2] = base[k + 2] + Math.cos(t * 0.13 + ph[k + 2]) * 0.14;
          }
          pos.needsUpdate = true;
        };
        step();
        pts.onBeforeRender = step;
        g.add(pts);
        return g;
      },
      // Light lying on the floor where it comes through a door (the side
      // door's cold strip, the ajar door's gap): a fan from `w` wide at the
      // door to `w2` wide `len` into the room (local +z), fading to nothing.
      lightspill(mats, o) {
        const g = new THREE.Group();
        const w0 = o.w || 1.0, w1 = o.w2 || 1.6, len = o.len || 1.2;
        const c = new THREE.Color(o.color || '#cfdcea').multiplyScalar(o.strength === undefined ? 0.35 : o.strength);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute([-w0 / 2, 0, 0, w0 / 2, 0, 0, w1 / 2, 0, len, -w1 / 2, 0, len], 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute([c.r, c.g, c.b, c.r, c.g, c.b, 0, 0, 0, 0, 0, 0], 3));
        geo.setIndex([0, 2, 1, 0, 3, 2]);
        const m = new THREE.Mesh(geo, spillMat(mats));
        m.position.y = 0.006;
        m.renderOrder = 1;
        g.add(m);
        return g;
      },
      // A wall bulkhead lamp with a cold lens, mounted on a wall (local -z
      // is the wall): the light over the side door.
      bulkhead(mats) {
        const g = new THREE.Group();
        g.add(box(mats, 'lp_dark', 0.36, 0.18, 0.09, 0, -0.09, 0.045, { castShadow: false }));
        g.add(box(mats, 'lp_dark', 0.04, 0.04, 0.05, 0, -0.02, 0.1, { castShadow: false }));
        const lens = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.02), coldLensMat(mats));
        lens.position.set(0, -0.09, 0.095);
        g.add(lens);
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), haloMat(mats, '#cfe0f0', 0.5));
        glow.position.set(0, -0.09, 0.11);
        g.add(glow);
        return g;
      },
      // A caged bulb under the ceiling (Doc 2 S4_H: "a single caged
      // bulb"): the building's light, so photoreal -- a steel cage, a warm
      // bulb, a glow. `lit: false` leaves the glass dark.
      cagebulb(mats, o) {
        const g = new THREE.Group();
        const bm = bulbMats(mats);
        const drop = o.drop || 0.14, lit = o.lit !== false;
        const plate = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 10), bm.metal, { cast: false });
        plate.position.y = -0.0125;
        g.add(plate);
        const stem = mesh(new THREE.CylinderGeometry(0.016, 0.016, drop, 6), bm.metal, { cast: false });
        stem.position.y = -drop / 2;
        g.add(stem);
        const socket = mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.05, 8), bm.metal, { cast: false });
        socket.position.y = -drop - 0.025;
        g.add(socket);
        const bulb = mesh(new THREE.SphereGeometry(0.05, 10, 8), lit ? bm.lit : bm.dark, { cast: false });
        bulb.position.y = -drop - 0.1;
        g.add(bulb);
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + Math.PI / 4;
          const bar = mesh(new THREE.BoxGeometry(0.007, 0.17, 0.007), bm.metal, { cast: false });
          bar.position.set(Math.cos(a) * 0.075, -drop - 0.115, Math.sin(a) * 0.075);
          g.add(bar);
        }
        for (const y of [-drop - 0.04, -drop - 0.2]) {
          const ring = mesh(new THREE.TorusGeometry(0.075, 0.004, 4, 12), bm.metal, { cast: false });
          ring.rotation.x = Math.PI / 2;
          ring.position.y = y;
          g.add(ring);
        }
        if (lit) {
          // a halo round the bulb that always faces the eye
          const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), haloMat(mats, '#ffd296', 0.55));
          glow.position.y = -drop - 0.1;
          glow.onBeforeRender = (r, sc, cam) => {
            cam.getWorldQuaternion(glow.quaternion);
            if (glow.parent) glow.quaternion.premultiply(glow.parent.getWorldQuaternion(_q).invert());
            glow.updateMatrixWorld();
          };
          g.add(glow);
        }
        return g;
      },
      // The janitor's mop bucket on casters, its wringer, the mop leaning
      // out of it (Doc 2 S4_H). Company property: low-poly, PS1 yellow.
      mopbucket(mats) {
        const g = new THREE.Group();
        const yel = yellowMat(mats);
        g.add(box(mats, 'lp_black', 0.05, 0.06, 0.05, -0.17, 0, -0.17));
        g.add(box(mats, 'lp_black', 0.05, 0.06, 0.05, 0.17, 0, -0.17));
        g.add(box(mats, 'lp_black', 0.05, 0.06, 0.05, -0.17, 0, 0.17));
        g.add(box(mats, 'lp_black', 0.05, 0.06, 0.05, 0.17, 0, 0.17));
        const deck = mesh(new THREE.BoxGeometry(0.44, 0.05, 0.44), yel);
        deck.position.y = 0.085;
        g.add(deck);
        const tub = mesh(new THREE.CylinderGeometry(0.21, 0.17, 0.32, 8), yel);
        tub.position.y = 0.27;
        g.add(tub);
        const rim = mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.03, 8), yel);
        rim.position.y = 0.44;
        g.add(rim);
        const water = mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.01, 8), mats.get('lp_dark'), { cast: false });
        water.position.y = 0.4;
        g.add(water);
        g.add(box(mats, 'lp_grey', 0.32, 0.12, 0.15, 0, 0.42, -0.12));
        const lever = box(mats, 'lp_grey', 0.03, 0.5, 0.03, 0.12, 0.45, -0.17);
        lever.rotation.x = 0.25;
        g.add(lever);
        const mop = new THREE.Group();
        mop.position.set(-0.04, 0.3, 0.05);
        mop.rotation.set(0.22, 0, -0.2);
        mop.add(box(mats, 'lp_wood', 0.03, 1.25, 0.03, 0, 0, 0));
        mop.add(box(mats, 'lp_grey', 0.16, 0.14, 0.12, 0, -0.06, 0));
        g.add(mop);
        const body = box(mats, 'lp_dark', 0.5, 0.95, 0.5, 0, 0, 0, { castShadow: false, collide: true });
        body.visible = false;
        g.add(body);
        return g;
      },
      // A hand truck stood on its nose plate with two cartons on it (Doc 2
      // S4_H). Low-poly; the frame leans back a little onto its wheels.
      handtruck(mats) {
        const g = new THREE.Group();
        const frame = new THREE.Group();
        frame.rotation.x = -0.1;
        for (const s of [-1, 1]) frame.add(box(mats, 'lp_red', 0.035, 1.22, 0.035, s * 0.18, 0.02, 0));
        for (const y of [0.35, 0.75, 1.15]) frame.add(box(mats, 'lp_red', 0.36, 0.025, 0.025, 0, y, 0));
        frame.add(box(mats, 'lp_dark', 0.3, 0.04, 0.04, 0, 1.22, -0.03));
        frame.add(box(mats, 'lp_grey', 0.4, 0.015, 0.24, 0, 0.01, 0.12));
        const c1 = box(mats, 'cardboard', 0.36, 0.3, 0.3, 0, 0.03, 0.17);
        const c2 = box(mats, 'cardboard', 0.32, 0.26, 0.28, 0.01, 0.33, 0.16);
        c2.rotation.y = 0.06;
        frame.add(c1, c2);
        g.add(frame);
        for (const s of [-1, 1]) {
          const wheel = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 8), mats.get('lp_black'));
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(s * 0.24, 0.11, -0.07);
          g.add(wheel);
        }
        const body = box(mats, 'lp_dark', 0.56, 1.2, 0.5, 0, 0, 0.06, { castShadow: false, collide: true });
        body.visible = false;
        g.add(body);
        return g;
      },
      // Standing water on the concrete (C1: the building's, photoreal): an
      // irregular dark glossy film, `w` x `d` metres, that catches the bulbs.
      puddle(mats, o) {
        const g = new THREE.Group();
        const r = rng(o.seed || 5);
        const shape = new THREE.Shape();
        const n = 16;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const rad = 0.5 * (0.72 + r() * 0.36);
          const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
          if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        }
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape, 2);
        geo.rotateX(-Math.PI / 2);
        geo.scale(o.w || 1.0, 1, o.d || 0.7);
        const m = mesh(geo, puddleMat(mats), { cast: false });
        m.position.y = 0.003;
        g.add(m);
        return g;
      },
      // Faint steam off a floor drain (Doc 2 KLING H): three crossed
      // additive sheets of slow-rising wisps.
      steam(mats, o) {
        const g = new THREE.Group();
        const m = steamMat(mats);
        const h = o.h || 1.5, w = o.w || 0.7;
        const tick = () => {
          const t = performance.now() * 0.001;
          m.map.offset.y = -((t * 0.07) % 1);
          g.rotation.y = Math.sin(t * 0.21) * 0.35;
        };
        for (let k = 0; k < 3; k++) {
          const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
          p.position.y = h / 2;
          p.rotation.y = (k * Math.PI) / 3;
          p.renderOrder = 2;
          if (k === 0) p.onBeforeRender = tick;
          g.add(p);
        }
        return g;
      }
    };
  })(),
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
