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
    // `headDown` (degrees): the head bowed forward from the neck -- she
    // speaks without raising it (C5)
    const head = new THREE.Group();
    head.position.y = 1.5;
    head.add(box(mats, o.face === 'blur' ? 'lp_grey' : 'lp_skin', 0.22, 0.24, 0.22, 0, 0.06, 0));
    head.add(box(mats, 'lp_dark', 0.24, 0.08, 0.24, 0, 0.28, 0)); // hair
    if (o.headDown) head.rotation.x = (o.headDown === true ? 30 : o.headDown) * Math.PI / 180;
    g.add(head);
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
  // His desk (S0): the building's -- photoreal wood (Doc 1 §5 S0, "the desk
  // ... photoreal"), world-tiled so the grain does not stretch per face.
  homedesk(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 1.5, d = o.d || 0.7, m = o.mat || 'wood', tile = o.tile || 0.9;
    const top = box(mats, m, w, 0.04, d, 0, 0.71, 0, { collide: true });
    applyWorldUV(top.geometry, tile);
    g.add(top);
    for (const [x, z] of [[-w / 2 + 0.04, -d / 2 + 0.04], [w / 2 - 0.04, -d / 2 + 0.04], [-w / 2 + 0.04, d / 2 - 0.04], [w / 2 - 0.04, d / 2 - 0.04]]) {
      const leg = box(mats, m, 0.05, 0.71, 0.05, x, 0, z);
      applyWorldUV(leg.geometry, tile);
      g.add(leg);
    }
    const apron = box(mats, m, w - 0.1, 0.1, 0.02, 0, 0.61, -d / 2 + 0.03, { castShadow: false });
    applyWorldUV(apron.geometry, tile);
    g.add(apron);
    const drawer = box(mats, m, 0.44, 0.13, 0.02, w / 2 - 0.3, 0.57, d / 2 - 0.01);
    applyWorldUV(drawer.geometry, tile);
    g.add(drawer);
    g.add(box(mats, 'lp_dark', 0.09, 0.015, 0.012, w / 2 - 0.3, 0.63, d / 2 + 0.005, { castShadow: false }));
    const body = box(mats, 'lp_dark', w, 0.72, d, 0, 0, 0, { castShadow: false });
    body.visible = false; body.userData.collide = true; g.add(body);
    return g;
  },
  // His bed (S0): low-poly like everything he owns. Head toward -z.
  bed(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 0.9, L = o.len || 2.0;
    g.add(box(mats, 'lp_wood', w, 0.26, L, 0, 0.04, 0));                       // frame
    for (const [x, z] of [[-w / 2 + 0.04, -L / 2 + 0.04], [w / 2 - 0.04, -L / 2 + 0.04], [-w / 2 + 0.04, L / 2 - 0.04], [w / 2 - 0.04, L / 2 - 0.04]]) g.add(box(mats, 'lp_dark', 0.06, 0.04, 0.06, x, 0, z));
    g.add(box(mats, 'lp_wood', w, 0.62, 0.05, 0, 0.04, -L / 2 + 0.025));       // headboard
    g.add(box(mats, 'lp_paper', w - 0.04, 0.18, L - 0.08, 0, 0.3, 0.02));      // mattress
    g.add(box(mats, o.blanket || 'lp_blue', w + 0.02, 0.06, L * 0.62, 0, 0.45, L * 0.17)); // blanket, turned back
    g.add(box(mats, o.blanket || 'lp_blue', w + 0.02, 0.2, 0.04, -0.0, 0.29, L / 2 - 0.02)); // its fall at the foot
    g.add(box(mats, 'lp_white', w * 0.62, 0.1, 0.34, 0, 0.48, -L / 2 + 0.26)); // pillow
    const body = box(mats, 'lp_dark', w, 0.55, L, 0, 0, 0, { castShadow: false });
    body.visible = false; body.userData.collide = true; g.add(body);
    return g;
  },
  // Light from the stairwell under a shut door: a warm line on the floor
  // just inside it (S0: the way out, before it opens). `w` the door width.
  doorglow(mats, o) {
    // one additive quad, bright at the door and fading to nothing across
    // the floor (vertex colours: black adds nothing), a little wider as it goes
    const w = o.w || 1.1, reach = o.reach || 0.5;
    const c = new THREE.Color(o.color || '#ffb060').multiplyScalar(o.strength || 0.55);
    const pos = new Float32Array([-w * 0.46, 0, 0, w * 0.46, 0, 0, w * 0.62, 0, reach, -w * 0.62, 0, reach]);
    const col = new Float32Array([c.r, c.g, c.b, c.r, c.g, c.b, 0, 0, 0, 0, 0, 0]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex([0, 2, 1, 0, 3, 2]);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    mat.userData.owned = true;
    const quad = new THREE.Mesh(geo, mat);
    quad.position.y = 0.006;
    const g = new THREE.Group();
    g.add(quad);
    return g;
  },
  // Dust in the CRT's light (Doc 2 S0_X: "dust in the air"): a few dozen
  // still motes, one draw call. Box w x h x d around the prop's origin.
  dust(mats, o) {
    const n = o.n || 40, w = o.w || 0.5, h = o.h || 0.5, d = o.d || 0.7;
    const pos = new Float32Array(n * 3);
    const home = new Float32Array(n * 3);
    let s = o.seed || 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) { pos[3 * i] = (rnd() - 0.5) * w; pos[3 * i + 1] = rnd() * h; pos[3 * i + 2] = (rnd() - 0.5) * d; }
    home.set(pos);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    // soft round motes, not square points: a small radial falloff as the map
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const cx = cv.getContext('2d');
    const grad = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.PointsMaterial({ color: new THREE.Color(o.color || '#cfe2ea'), map: tex, size: o.size || 0.006, sizeAttenuation: true, transparent: true, opacity: o.opacity || 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    mat.userData.owned = true;
    const pts = new THREE.Points(geo, mat);
    // they hang in the CRT's light and drift, a few millimetres, very slowly
    const drift = o.drift === undefined ? 0.012 : o.drift;
    if (drift > 0) {
      const attr = geo.getAttribute('position');
      pts.onBeforeRender = () => {
        const t = performance.now() / 1000;
        for (let i = 0; i < n; i++) {
          attr.array[3 * i] = home[3 * i] + Math.sin(t * 0.13 + i * 1.7) * drift;
          attr.array[3 * i + 1] = home[3 * i + 1] + Math.sin(t * 0.09 + i * 2.3) * drift;
          attr.array[3 * i + 2] = home[3 * i + 2] + Math.cos(t * 0.11 + i * 0.9) * drift;
        }
        attr.needsUpdate = true;
      };
    }
    const g = new THREE.Group();
    g.add(pts);
    return g;
  },
  // His desk lamp (S0): low-poly like everything he owns -- a weighted base,
  // a stem, an open cone shade. The light is the building's (C1): the
  // inside of the shade and the bulb glow, a soft halo, and the room's own
  // point light (placed by the room inside the shade, about y 0.27 here),
  // which pools on the desk and climbs the wall without blowing the shade
  // out. Shade centre at y 0.3.
  desklamp(mats, o) {
    const g = new THREE.Group();
    const shadeSlot = o.shade || 'lp_beige';
    g.add(cylinder(mats, 'lp_dark', 0.075, 0.025, 0, 0, 0, 10));
    g.add(box(mats, 'lp_dark', 0.016, 0.24, 0.016, 0, 0.025, 0));
    g.add(box(mats, 'lp_dark', 0.05, 0.016, 0.016, 0, 0.255, 0, { castShadow: false })); // the yoke
    const coneGeo = new THREE.CylinderGeometry(0.065, 0.12, 0.15, 12, 1, true);
    const outer = new THREE.Mesh(coneGeo, mats.get(shadeSlot));
    outer.position.y = 0.3;
    outer.castShadow = true;
    outer.receiveShadow = true;
    g.add(outer);
    // inside of the shade: lit by the bulb, so it glows, warmer at the mouth
    const inGeo = new THREE.CylinderGeometry(0.063, 0.118, 0.148, 12, 1, true);
    const ip = inGeo.getAttribute('position');
    const col = new Float32Array(ip.count * 3);
    const hot = new THREE.Color(o.glow || '#ffd9a0'), dim = hot.clone().multiplyScalar(0.45);
    for (let i = 0; i < ip.count; i++) { const c = ip.getY(i) < 0 ? hot : dim; col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b; }
    inGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const inMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
    inMat.userData.owned = true;
    const inner = new THREE.Mesh(inGeo, inMat);
    inner.position.y = 0.3;
    g.add(inner);
    const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4e0') });
    bulbMat.userData.owned = true;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), bulbMat);
    bulb.position.y = 0.27;
    g.add(bulb);
    // the halo around the mouth of the shade: always faces the eye
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const cx = cv.getContext('2d');
    const grad = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const haloMat = new THREE.SpriteMaterial({ map: tex, color: hot, transparent: true, opacity: o.halo === undefined ? 0.5 : o.halo, blending: THREE.AdditiveBlending, depthWrite: false });
    haloMat.userData.owned = true;
    const halo = new THREE.Sprite(haloMat);
    halo.position.y = 0.24;
    halo.scale.setScalar(o.haloSize || 0.42);
    g.add(halo);
    return g;
  },
  // A street facade (SET_STREET): the building's, so photoreal (C1: brick,
  // stone, glass). Front faces +z (turn it with `rot`). w along the front,
  // d deep, h tall. Upper floors get a grid of dark windows with stone sills
  // and lintels (instanced: four draw calls for the lot); the ground floor
  // a shopfront or a door up two steps; a cornice caps it. Wordless.
  facade(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 9, h = o.h || 16, d = o.d || 9, m = o.mat || 'brick';
    const trim = o.trim || 'concrete';
    if (o.body !== false) { // body: false dresses a wall that is already there (the street's end slab)
      const body = box(mats, m, w, h, d, 0, 0, -d / 2, { collide: true });
      applyWorldUV(body.geometry, o.tile || 0.5);
      g.add(body);
    }
    // details cast no shadow: the sun runs down the street, along the
    // fronts, so they would only cost shadow-pass draws
    const add = (slot, bw, bh, bd, x, y, z, opts = {}) => {
      const b = box(mats, slot, bw, bh, bd, x, y, z, { castShadow: false, ...opts });
      if (!mats.isLowPoly(slot) && !mats.isGlow(slot)) applyWorldUV(b.geometry, opts.tile || 1.2);
      g.add(b);
      return b;
    };
    // pilasters at both ends and a plinth: the party walls read between blocks
    for (const s of [-1, 1]) add(trim, 0.42, h, 0.12, s * (w / 2 - 0.21), 0, 0.06);
    if (o.plinth !== false) add(trim, w, 0.5, 0.1, 0, 0, 0.05, { castShadow: false });
    // cornice
    add(trim, w + 0.2, 0.22, 0.55, 0, h - 0.62, 0.22);
    add(trim, w + 0.1, 0.4, 0.3, 0, h - 0.4, 0.1);
    // ground floor
    const gf = o.ground || 'shop';
    const gh = o.groundH || 3.6;
    if (gf === 'shop') {
      const sw = Math.min(w - 1.4, o.shopW || w * 0.72);
      add('void', sw, 2.5, 0.06, 0, 0.5, 0.02, { castShadow: false });
      add('glass_dark', sw - 0.1, 2.4, 0.03, 0, 0.55, 0.07, { castShadow: false });
      add(trim, sw + 0.3, 0.12, 0.16, 0, 0.42, 0.06);             // stall riser cap
      add('lp_dark', sw + 0.2, 0.08, 0.1, 0, 3.0, 0.07);          // the shop's frame head (its fittings: company)
      for (const x of [-sw / 2, 0, sw / 2]) add('lp_dark', 0.07, 2.5, 0.1, x, 0.5, 0.07, { castShadow: false });
      add(o.fascia || 'lp_dark', sw + 0.4, 0.55, 0.08, 0, 3.08, 0.08); // blank fascia: no name
      // a shut roller shutter on half of them (dawn: nothing open)
      if (o.shutter) {
        add('lp_grey', sw - 0.1, 2.3, 0.04, 0, 0.7, 0.11, { castShadow: false });
        for (let y = 0.9; y < 2.95; y += 0.4) add('lp_dark', sw - 0.1, 0.02, 0.05, 0, y, 0.12, { castShadow: false });
      }
    } else if (gf === 'door') {
      // a residential door up two steps, off-centre
      const dx = o.doorX === undefined ? -w * 0.22 : o.doorX;
      add(trim, 1.8, 0.16, 0.7, dx, 0, 0.35);
      add(trim, 1.6, 0.16, 0.4, dx, 0.16, 0.2);
      add('void', 1.2, 2.4, 0.06, dx, 0.32, 0.02, { castShadow: false });
      add('lp_dark', 1.0, 2.2, 0.06, dx, 0.32, 0.06);           // the door leaf
      add('glass_dark', 0.7, 0.35, 0.02, dx, 2.3, 0.1, { castShadow: false }); // fanlight
      add(trim, 1.6, 0.2, 0.18, dx, 2.75, 0.09);                 // door head
      // two ground-floor windows beside it
      for (const x of [dx + 1.9, dx + 3.5].filter((x) => x < w / 2 - 0.9)) {
        add('void', 1.0, 1.6, 0.06, x, 1.0, 0.02, { castShadow: false });
        add('glass_dark', 0.92, 1.52, 0.03, x, 1.04, 0.06, { castShadow: false });
        add(trim, 1.2, 0.08, 0.16, x, 0.94, 0.08);
      }
    }
    // upper floors: instanced windows
    const fh = o.floorH || 3.1;
    const cols = Math.max(1, Math.floor((w - 1.2) / (o.bay || 2.1)));
    const bay = (w - 1.2) / cols;
    const spots = [];
    for (let y = gh + 0.75; y + 1.7 < h - 0.9; y += fh) for (let c = 0; c < cols; c++) spots.push([-w / 2 + 0.6 + bay * (c + 0.5), y]);
    if (spots.length) {
      const ww = o.winW || Math.min(1.15, bay * 0.55), wh = o.winH || 1.7;
      const parts = [
        { slot: 'void', g: new THREE.BoxGeometry(ww, wh, 0.06), dy: wh / 2, z: 0.0 },
        { slot: 'glass_dark', g: new THREE.BoxGeometry(ww - 0.08, wh - 0.08, 0.02), dy: wh / 2, z: 0.035 },
        { slot: trim, g: new THREE.BoxGeometry(ww + 0.22, 0.08, 0.16), dy: -0.04, z: 0.06 },
        { slot: trim, g: new THREE.BoxGeometry(ww + 0.18, 0.2, 0.07), dy: wh + 0.1, z: 0.03 },
        { slot: 'lp_dark', g: new THREE.BoxGeometry(0.04, wh - 0.1, 0.03), dy: wh / 2, z: 0.05 } // the sash bar
      ];
      const mtx = new THREE.Matrix4();
      for (const p of parts) {
        if (!mats.isLowPoly(p.slot)) applyWorldUV(p.g, 1.2);
        const im = new THREE.InstancedMesh(p.g, mats.get(p.slot), spots.length);
        spots.forEach(([x, y], i) => { mtx.makeTranslation(x, y + p.dy, p.z); im.setMatrixAt(i, mtx); });
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = false;
        im.receiveShadow = true;
        im.computeBoundingSphere();
        g.add(im);
      }
    }
    return g;
  },
  // A street sign on a pole, wordless (canon: no legible text in the world).
  // kind 'ahead' (default): a blue disc facing +z with a white arrow
  // pointing up -- straight on, at the tower. kind 'noparking': a red-ringed
  // disc facing +z. kind 'oneway': a plate along the kerb, its arrow along
  // local -z. Low-poly: the company's street furniture.
  streetsign(mats, o) {
    const g = new THREE.Group();
    const h = o.h || 2.6;
    const kind = o.kind || 'ahead';
    g.add(cylinder(mats, 'lp_grey', 0.035, h, 0, 0, 0, 6, { collide: true })); // he walks round it, not through it
    if (kind === 'ahead' || kind === 'noparking') {
      const disc = (slot, r, z) => {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 14), mats.get(slot));
        c.rotation.x = Math.PI / 2; c.position.set(0, h - 0.3, z);
        c.castShadow = true;
        g.add(c);
      };
      if (kind === 'ahead') {
        disc('lp_blue', 0.3, 0.05);
        for (const s of [-1, 1]) {
          const z = 0.05 + s * 0.016;
          g.add(box(mats, 'lp_white', 0.07, 0.26, 0.006, 0, h - 0.47, z, { castShadow: false }));
          const head = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.006, 3), mats.get('lp_white'));
          head.rotation.set(Math.PI / 2, Math.PI, 0); // a triangle in the face, tip up
          head.position.set(0, h - 0.17, z);
          g.add(head);
        }
      } else {
        disc('lp_red', 0.3, 0.05);
        disc('lp_blue', 0.24, 0.05 + 0.004 * 1);
        for (const s of [-1, 1]) {
          const bar = box(mats, 'lp_red', 0.42, 0.06, 0.03, 0, h - 0.33, 0.05, { castShadow: false });
          bar.rotation.z = s * Math.PI / 4;
          bar.position.y = h - 0.3;
          g.add(bar);
        }
      }
    } else {
      // a long plate along the pavement, the arrow on both faces
      g.add(box(mats, o.plate || 'lp_blue', 0.04, 0.34, 0.95, 0, h - 0.42, 0));
      for (const s of [-1, 1]) {
        g.add(box(mats, 'lp_white', 0.012, 0.07, 0.48, s * 0.024, h - 0.285, 0.11, { castShadow: false })); // shaft
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.012, 3), mats.get('lp_white'));
        head.rotation.set(Math.PI, 0, Math.PI / 2); // a triangle, tip toward -z
        head.position.set(s * 0.024, h - 0.25, -0.2);
        g.add(head);
      }
    }
    return g;
  },
  // A newspaper box on the kerb (Doc 2 S0_X: "a newspaper box"): low-poly,
  // a window onto a stack of blank paper, a coin slot. Front faces +z.
  newsbox(mats, o) {
    const g = new THREE.Group();
    const m = o.mat || 'lp_blue';
    g.add(box(mats, 'lp_dark', 0.42, 0.28, 0.36, 0, 0, 0));                 // pedestal
    g.add(box(mats, m, 0.5, 0.72, 0.44, 0, 0.28, 0));                       // body
    g.add(box(mats, m, 0.54, 0.06, 0.48, 0, 1.0, 0));                       // lid
    g.add(box(mats, 'lp_paper', 0.36, 0.2, 0.02, 0, 0.62, 0.215, { castShadow: false })); // the paper, blank
    g.add(box(mats, 'lp_glass', 0.4, 0.3, 0.02, 0, 0.58, 0.225, { castShadow: false }));
    g.add(box(mats, 'lp_chrome', 0.1, 0.12, 0.04, 0.16, 0.86, 0.23, { castShadow: false }));  // coin box
    g.add(box(mats, 'lp_dark', 0.04, 0.008, 0.02, 0.16, 0.95, 0.25, { castShadow: false }));  // slot
    g.add(box(mats, 'lp_chrome', 0.2, 0.03, 0.04, 0, 0.5, 0.24, { castShadow: false }));      // handle
    const body = box(mats, 'lp_dark', 0.54, 1.06, 0.48, 0, 0, 0, { castShadow: false });
    body.visible = false; body.userData.collide = true; g.add(body);
    return g;
  },
  // The street clock's post: a pole with a collar and a cradle; the clock
  // prop itself (C8: the same handless clock) sits on it at h + 0.26.
  clockpost(mats, o) {
    const g = new THREE.Group();
    const h = o.h || 2.8;
    g.add(cylinder(mats, 'lp_dark', 0.055, h, 0, 0, 0, 8, { collide: true }));
    g.add(cylinder(mats, 'lp_dark', 0.11, 0.35, 0, 0, 0, 8));
    g.add(cylinder(mats, 'lp_dark', 0.08, 0.06, 0, h - 0.1, 0, 8));
    g.add(box(mats, 'lp_dark', 0.06, 0.2, 0.06, 0, h - 0.06, 0)); // the cradle the clock sits in
    return g;
  },
  // A street lamp still burning at dawn: the lens under a catalog lamp's
  // head and the glow it throws (the light itself is the room's).
  lampglow(mats, o) {
    const g = new THREE.Group();
    g.add(box(mats, 'lp_sodium', o.w || 0.34, 0.03, o.d || 0.2, 0, 0, 0, { castShadow: false }));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(o.glow || 1.1, (o.glow || 1.1) * 0.7), mats.get('glow_sodium'));
    glow.rotation.x = Math.PI / 2; glow.position.y = -0.04;
    g.add(glow);
    return g;
  },
  // The company's address plate beside the tower doors (SET_STREET): a
  // brass plate on a dark backing, four standoff bolts and three engraved
  // bars where the letters would be -- wordless (the zone label carries
  // "666 HALLAM ROW."). Low-poly: company signage. Front faces +z; y is
  // the plate's centre.
  addressplate(mats, o) {
    const g = new THREE.Group();
    const w = o.w || 0.5, h = o.h || 0.32;
    g.add(box(mats, 'lp_dark', w + 0.06, h + 0.06, 0.02, 0, -(h + 0.06) / 2, 0.01, { castShadow: false }));
    g.add(box(mats, o.mat || 'lp_brass', w, h, 0.012, 0, -h / 2, 0.026, { castShadow: false }));
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(mats, 'lp_chrome', 0.022, 0.022, 0.01, x * (w / 2 - 0.035), y * (h / 2 - 0.035) - 0.011, 0.036, { castShadow: false }));
    const bars = [[0.62, 0.075], [0.8, 0.0], [0.5, -0.07]];
    for (const [f, y] of bars) g.add(box(mats, 'lp_dark', w * f, 0.026, 0.004, 0, y * (h / 0.32) - 0.013, 0.033, { castShadow: false }));
    return g;
  },
  // The street's paint, gutters and covers (SET_STREET): the building's, so
  // the slot's photoreal texture -- but flat quads with no sides, and a
  // bump-less copy of the slot. (As thin boxes, their 5 mm sides were seen
  // edge-on down the street, where the derivative bump map's normal
  // degenerates: every kerb and lane line sparkled with white dots in play.)
  // o.rects: [[x0, z0, x1, z1], ...] in the prop's frame, at height o.y; one
  // mesh, one draw call. Pulled toward the eye so it never fights the road.
  roadmarks(mats, o) {
    const y = o.y === undefined ? 0.004 : o.y;
    const rects = o.rects || [];
    const pos = new Float32Array(rects.length * 12);
    const nrm = new Float32Array(rects.length * 12);
    const idx = [];
    rects.forEach(([x0, z0, x1, z1], i) => {
      pos.set([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1], i * 12);
      for (let k = 0; k < 4; k++) nrm.set([0, 1, 0], i * 12 + k * 3);
      const b = i * 4;
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2); // +y faces
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setIndex(idx);
    applyWorldUV(geo, o.tile || 1.0);
    // one bump-less copy per slot, kept with the library (it shares the
    // slot's textures, so it is never the room's to dispose)
    const cache = mats._s0Flat || (mats._s0Flat = new Map());
    const key = `${o.mat || 'plaster_blown'}:road`;
    if (!cache.has(key)) {
      const c = mats.get(o.mat || 'plaster_blown').clone();
      c.bumpMap = null;
      c.bumpScale = 0;
      c.polygonOffset = true;
      c.polygonOffsetFactor = -1;
      c.polygonOffsetUnits = -2;
      cache.set(key, c);
    }
    const mesh = new THREE.Mesh(geo, cache.get(key));
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    const g = new THREE.Group();
    g.add(mesh);
    return g;
  },
  // Kerb stones (SET_STREET): the building's stone, a bump-less copy of the
  // slot for the same reason as roadmarks (their road faces run edge-on to
  // the eye down the street). o.boxes: [[x0, y0, z0, x1, y1, z1], ...] in the
  // prop's frame. No collider: the pavement slabs under them are the floor.
  kerbs(mats, o) {
    const cache = mats._s0Flat || (mats._s0Flat = new Map());
    const key = `${o.mat || 'plaster_blown'}:kerb`;
    if (!cache.has(key)) {
      const c = mats.get(o.mat || 'plaster_blown').clone();
      c.bumpMap = null;
      c.bumpScale = 0;
      cache.set(key, c);
    }
    const mat = cache.get(key);
    const g = new THREE.Group();
    for (const [x0, y0, z0, x1, y1, z1] of o.boxes || []) {
      const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
      geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      applyWorldUV(geo, o.tile || 1.0);
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = false;
      m.receiveShadow = true;
      g.add(m);
    }
    return g;
  },
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
    // brass let into the marble (the building's, photoreal): metal that
    // catches the ceiling lights, not flat yellow paint
    const brassMat = (color, extra = {}) => own(new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.32, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, ...extra }));
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
      // `paint: '#rrggbb'` paints in that colour instead of the slot's own
      // (the same flat, vertex-snapped low-poly material, one per colour):
      // the slot's maroon reads as fire-engine red under the lobby's light.
      palette(mats) {
        const g = new THREE.Group();
        const tinted = new Map();
        const paintOf = (spec) => {
          const base = mats.get(spec.mat);
          if (typeof spec.paint !== 'string') return base;
          if (!tinted.has(spec.paint)) {
            const m = own(base.clone());
            m.color.set(spec.paint);
            m.onBeforeCompile = base.onBeforeCompile;           // keep the PS1 vertex snap
            m.customProgramCacheKey = base.customProgramCacheKey;
            tinted.set(spec.paint, m);
          }
          return tinted.get(spec.paint);
        };
        g.addEventListener('added', () => {
          for (const c of (g.parent ? g.parent.children : [])) {
            const spec = c.userData && c.userData.spec;
            if (!spec || !spec.paint || !spec.mat || !mats.isLowPoly(spec.mat)) continue;
            const m = paintOf(spec);
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
      // The frame is a rim round the plate, not a board behind it: the lp_
      // vertex snap moves a board's corners on screen but not in depth, and
      // from the seats it won the depth test over the plate and blacked the
      // words out.
      notice(mats, o) {
        const g = new THREE.Group();
        const w = o.w || 1.2, h = o.h || 0.22, rim = 0.025, rd = 0.024;
        for (const s of [-1, 1]) {
          g.add(box(mats, 'lp_dark', w + 2 * rim, rim, rd, 0, s * (h + rim) / 2 - rim / 2, rd / 2));
          g.add(box(mats, 'lp_dark', rim, h, rd, s * (w + rim) / 2, -h / 2, rd / 2));
        }
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
        plate.position.set(0, 0, 0.012); // inside the rim, off the wall
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
        const brass = brassMat(o.brass || '#b48f45', { emissive: new THREE.Color('#0e0a04') });
        const reveal = brassMat('#d2aa55', { emissive: new THREE.Color('#241a08'), transparent: true, opacity: 0, depthWrite: false, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
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
          } else ctx.fillStyle = '#3a5747'; // dead: the letters still faintly there
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
      // The black behind the parted curtain (Doc 2 S3_C_IMG_OUT: "Behind it,
      // pure black, no detail resolvable"): a matte black plane standing in
      // the curtain doorway's depth, inside the wall, wider and taller than
      // the opening (the wall hides the rest). One-sided and untouched by
      // light and fog, it is seen only from the room: through the parted
      // curtain there is nothing (not the passage joined behind, its lamps,
      // or the sign's green spilling into it) until he has walked through
      // it, and from the passage it is not there. Origin: the plane's foot,
      // centred; it faces +z (the room).
      curtainvoid(mats, o) {
        const g = new THREE.Group();
        const w = o.w || 3.0, h = o.h || 3.2;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), owned(new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })));
        m.position.set(0, h / 2, 0);
        m.castShadow = false;
        m.receiveShadow = false;
        g.add(m);
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
              // a faint tint lit by the lobby, with no highlights: the
              // lobby's ceiling lamps made bright points (or, rougher, soft
              // blobs) on the pane that read as lamps lit in the dead street
              const clear = owned(new THREE.MeshLambertMaterial({
                color: new THREE.Color('#c9d6da'),
                transparent: true, opacity: o.glassOpacity || 0.08, depthWrite: false
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
