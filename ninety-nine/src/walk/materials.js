// Two-tier material library for the walkable rooms, mirroring the Blender
// pipeline's PhotorealArch_* / LowPolyProp_* split (blender/material_
// factories.py) and canon C1: the BUILDING (floors, walls, glass, water,
// fog, light) reads as real -- tiled, noisy, lit, shadowed, with a bump
// and roughness map under every surface; everything the COMPANY owns
// (chairs, desks, cars, signs, paper, people) is flat-shaded low-poly with
// PS1 vertex snapping and no texture at all.
//
// No image files: every "photoreal" surface is a procedurally drawn canvas
// (value-noise fBm + a per-slot pattern pass that also writes a height map
// and a roughness map), tiled in world units by applyWorldUV() below
// (ported from the Earth_Worldbuild museum's matlib.js) so a 30 m garage
// floor and a 3 m elevator floor share one grain. Nothing to download,
// nothing to license.
//
// Quality pass (post-launch): 256 px flat colour maps sampled with
// NearestFilter were the main reason the rooms read as "low quality" -- a
// smeared, filterless blur on every wall. The building now gets 512 px
// colour + bump + roughness at trilinear/anisotropic filtering; the PS1
// treatment is reserved for the company's props (C1), which is where the
// design puts it.

import * as THREE from '../../vendor/three/three.module.js';

const TEX_SIZE = 512;

// ---- tiny deterministic noise ------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(size, cells, rnd) {
  // Tileable value noise: a cells x cells lattice of random values,
  // bilinearly interpolated with a smoothstep, wrapping at the edges.
  const lat = new Float32Array(cells * cells);
  for (let i = 0; i < lat.length; i++) lat[i] = rnd();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells;
    const y0 = Math.floor(fy), y1 = (y0 + 1) % cells, ty = fy - y0;
    const sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const x0 = Math.floor(fx), x1 = (x0 + 1) % cells, tx = fx - x0;
      const sx = tx * tx * (3 - 2 * tx);
      const a = lat[y0 * cells + x0], b = lat[y0 * cells + x1];
      const c = lat[y1 * cells + x0], d = lat[y1 * cells + x1];
      out[y * size + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
  }
  return out;
}

function fbm(size, seed, octaves = 5, base = 4) {
  const rnd = mulberry32(seed);
  const out = new Float32Array(size * size);
  let amp = 0.5, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(size, base * Math.pow(2, o), rnd);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return Math.min(1, Math.max(0, v)); }

// Slot recipes: base/alt colours, noise contrast, a pattern pass,
// roughness, bump strength (metres-ish, tiny), roughness variation.
const RECIPES = {
  marble:        { a: '#26241f', b: '#5a564c', seed: 11, contrast: 0.9, pattern: 'veins', rough: 0.22, metal: 0.05, bump: 0.004, roughVar: 0.5 },
  marble_light:  { a: '#9a958a', b: '#dcd7cb', seed: 12, contrast: 0.8, pattern: 'veins', rough: 0.28, bump: 0.004, roughVar: 0.4 },
  plaster:       { a: '#87847a', b: '#a9a599', seed: 21, contrast: 0.45, pattern: 'plaster', rough: 0.92, bump: 0.01, roughVar: 0.3 },
  plaster_blown: { a: '#d6d3ca', b: '#f1efe9', seed: 22, contrast: 0.3, pattern: 'plaster', rough: 0.95, bump: 0.006, roughVar: 0.2 },
  plaster_dark:  { a: '#46433e', b: '#5e5a53', seed: 23, contrast: 0.5, pattern: 'plaster', rough: 0.92, bump: 0.01, roughVar: 0.3 },
  concrete:      { a: '#5a5852', b: '#7b7872', seed: 31, contrast: 0.55, pattern: 'concrete', rough: 0.86, bump: 0.02, roughVar: 0.5, base: 8 },
  concrete_wet:  { a: '#36352f', b: '#585651', seed: 32, contrast: 0.9, pattern: 'stains', rough: 0.3, metal: 0.05, bump: 0.012, roughVar: 1.2 },
  garage_floor:  { a: '#413f3a', b: '#615e58', seed: 33, contrast: 0.85, pattern: 'parking', rough: 0.45, bump: 0.012, roughVar: 1.0 },
  paint_green:   { a: '#2f4a3c', b: '#3f5e4d', seed: 34, contrast: 0.5, pattern: 'concrete', rough: 0.6, bump: 0.012, roughVar: 0.5 },
  carpet:        { a: '#3a3b42', b: '#4e4f58', seed: 41, contrast: 0.6, pattern: 'weave', rough: 1.0, bump: 0.006, roughVar: 0.1 },
  carpet_red:    { a: '#471d1d', b: '#622c2c', seed: 42, contrast: 0.6, pattern: 'weave', rough: 1.0, bump: 0.006, roughVar: 0.1 },
  cinderblock:   { a: '#6a6864', b: '#8a877f', seed: 51, contrast: 0.6, pattern: 'blocks', rough: 0.9, bump: 0.03, roughVar: 0.3 },
  linoleum:      { a: '#b3ae9e', b: '#d4cfc1', seed: 61, contrast: 0.5, pattern: 'tiles', rough: 0.32, bump: 0.006, roughVar: 0.7 },
  ceiling_tile:  { a: '#c4c1b8', b: '#e0ddd5', seed: 71, contrast: 0.35, pattern: 'ceiling', rough: 0.95, bump: 0.015, roughVar: 0.2 },
  pool_tile:     { a: '#7d8f8e', b: '#b5c3c0', seed: 81, contrast: 0.6, pattern: 'tiles_small', rough: 0.18, bump: 0.02, roughVar: 0.4 },
  water:         { a: '#06232b', b: '#0e4a56', seed: 91, contrast: 0.9, pattern: 'caustic', rough: 0.04, metal: 0.15, opacity: 0.9, bump: 0.02, roughVar: 0.2, animate: true },
  cardboard:     { a: '#8a6a44', b: '#a68355', seed: 101, contrast: 0.5, pattern: 'cardboard', rough: 0.95, bump: 0.006, roughVar: 0.2 },
  rust:          { a: '#46291a', b: '#7c4c2b', seed: 111, contrast: 1.0, pattern: 'stains', rough: 0.8, metal: 0.3, bump: 0.02, roughVar: 0.8 },
  grate:         { a: '#2a2927', b: '#57544f', seed: 121, contrast: 0.9, pattern: 'grate', rough: 0.6, metal: 0.6, bump: 0.04, roughVar: 0.3 },
  void:          { a: '#050505', b: '#0a0a0a', seed: 131, contrast: 0.2, pattern: 'none', rough: 1.0, bump: 0 },
  asphalt:       { a: '#2a2928', b: '#3f3e3c', seed: 141, contrast: 0.8, pattern: 'concrete', rough: 0.9, bump: 0.015, roughVar: 0.4 },
  glass:         { a: '#9fb2b8', b: '#c8d6da', seed: 151, contrast: 0.1, pattern: 'none', rough: 0.05, metal: 0.2, opacity: 0.22, bump: 0 },
  glass_dark:    { a: '#1a2224', b: '#25302f', seed: 152, contrast: 0.1, pattern: 'none', rough: 0.05, metal: 0.4, opacity: 0.55, bump: 0 }
};

// Pattern pass. `c` draws colour, `h` draws height (white = raised,
// black = recessed; grout, seams, cracks go dark), `r` draws roughness
// (white = rough, black = glossy; wet and worn spots go dark).
function drawPattern(c, h, r, size, pattern, rnd) {
  // per-tile / per-block value variation: grey only, never a hue shift
  const greyTint = (alpha) => () => { const v = rnd() > 0.5 ? 255 : 0; return `rgba(${v},${v},${v},${alpha})`; };
  const polyline = (ctx, n, step) => {
    let x = rnd() * size, y = rnd() * size;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < n; k++) { x += (rnd() - 0.5) * step; y += (rnd() - 0.5) * step; ctx.lineTo(x, y); }
    ctx.stroke();
  };
  const blob = (ctx, x, y, rx, ry, rot, color) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(rx, ry);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const grid = (n, grout, groutColor, heightColor, tileTint) => {
    const cell = size / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (tileTint) { c.fillStyle = tileTint(); c.fillRect(i * cell, j * cell, cell, cell); }
    }
    c.fillStyle = groutColor; h.fillStyle = heightColor;
    for (let i = 0; i <= n; i++) {
      c.fillRect(0, i * cell - grout / 2, size, grout); c.fillRect(i * cell - grout / 2, 0, grout, size);
      h.fillRect(0, i * cell - grout / 2, size, grout); h.fillRect(i * cell - grout / 2, 0, grout, size);
    }
  };
  switch (pattern) {
    case 'veins': {
      for (let i = 0; i < 18; i++) {
        const light = rnd() > 0.4;
        c.strokeStyle = light ? `rgba(255,255,255,${0.05 + rnd() * 0.12})` : `rgba(0,0,0,${0.1 + rnd() * 0.2})`;
        c.lineWidth = 0.6 + rnd() * 2.2;
        h.strokeStyle = 'rgba(0,0,0,0.12)'; h.lineWidth = c.lineWidth;
        let x = rnd() * size, y = rnd() * size;
        c.beginPath(); c.moveTo(x, y); h.beginPath(); h.moveTo(x, y);
        for (let k = 0; k < 10; k++) {
          const cx = x + (rnd() - 0.5) * 90, cy = y + (rnd() - 0.5) * 90;
          x += (rnd() - 0.5) * 120; y += (rnd() - 0.5) * 120;
          c.quadraticCurveTo(cx, cy, x, y); h.quadraticCurveTo(cx, cy, x, y);
        }
        c.stroke(); h.stroke();
      }
      for (let i = 0; i < 6; i++) blob(r, rnd() * size, rnd() * size, 30 + rnd() * 80, 30 + rnd() * 80, rnd() * 3, 'rgba(0,0,0,0.25)');
      break;
    }
    case 'concrete': {
      // formwork seams (one per tile, top edge), aggregate speckle, a
      // couple of hairline cracks, soft water stains
      for (let i = 0; i < 2600; i++) {
        c.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.12)';
        const s = rnd() > 0.85 ? 2 : 1;
        c.fillRect(rnd() * size, rnd() * size, s, s);
      }
      for (let i = 0; i < 40; i++) { const x = rnd() * size, y = rnd() * size; blob(c, x, y, 3 + rnd() * 5, 3 + rnd() * 5, 0, 'rgba(0,0,0,0.35)'); blob(h, x, y, 3 + rnd() * 5, 3 + rnd() * 5, 0, 'rgba(0,0,0,0.5)'); }
      c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(0, 0, size, 3); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, 3, size, 2);
      h.fillStyle = 'rgba(0,0,0,0.6)'; h.fillRect(0, 0, size, 4);
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; h.strokeStyle = 'rgba(0,0,0,0.5)'; h.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const n = 8 + Math.floor(rnd() * 6); const x0 = rnd() * size, y0 = rnd() * size; let x = x0, y = y0; c.beginPath(); h.beginPath(); c.moveTo(x, y); h.moveTo(x, y); for (let k = 0; k < n; k++) { x += (rnd() - 0.5) * 40; y += rnd() * 30; c.lineTo(x, y); h.lineTo(x, y); } c.stroke(); h.stroke(); }
      for (let i = 0; i < 5; i++) blob(c, rnd() * size, rnd() * size, 40 + rnd() * 90, 20 + rnd() * 60, rnd() * 3, 'rgba(20,15,10,0.18)');
      for (let i = 0; i < 5; i++) blob(r, rnd() * size, rnd() * size, 40 + rnd() * 90, 30 + rnd() * 60, rnd() * 3, 'rgba(0,0,0,0.3)');
      break;
    }
    case 'plaster': {
      // a wall: faint roller streaks, a few scuffs low on the tile, one seam
      for (let i = 0; i < 24; i++) {
        c.strokeStyle = `rgba(0,0,0,${0.02 + rnd() * 0.05})`; c.lineWidth = 6 + rnd() * 20;
        const x = rnd() * size; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (rnd() - 0.5) * 20, size); c.stroke();
      }
      for (let i = 0; i < 6; i++) blob(c, rnd() * size, size * (0.6 + rnd() * 0.4), 20 + rnd() * 60, 8 + rnd() * 20, rnd() * 0.6 - 0.3, 'rgba(30,25,20,0.16)');
      for (let i = 0; i < 4; i++) blob(r, rnd() * size, rnd() * size, 60 + rnd() * 100, 60 + rnd() * 100, 0, 'rgba(0,0,0,0.12)');
      break;
    }
    case 'stains': {
      for (let i = 0; i < 12; i++) {
        const x = rnd() * size, y = rnd() * size, rx = 15 + rnd() * 70, ry = rx * (0.4 + rnd() * 0.8), rot = rnd() * Math.PI;
        blob(c, x, y, rx, ry, rot, `rgba(0,0,0,${0.25 + rnd() * 0.35})`);
        blob(r, x, y, rx * 1.1, ry * 1.1, rot, 'rgba(0,0,0,0.7)'); // wet = glossy
      }
      for (let i = 0; i < 8; i++) { // drips
        c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1 + rnd() * 2;
        const x = rnd() * size, y = rnd() * size; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 6, y + 30 + rnd() * 120); c.stroke();
      }
      for (let i = 0; i < 1200; i++) { c.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'; c.fillRect(rnd() * size, rnd() * size, 1, 1); }
      break;
    }
    case 'parking': {
      // one bay per tile: a worn white line down the left edge, an oil
      // stain, tyre scuffs, expansion joint across the top
      for (let i = 0; i < 2000; i++) { c.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.14)'; c.fillRect(rnd() * size, rnd() * size, 1, 1); }
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 0, size, 3); h.fillStyle = 'rgba(0,0,0,0.8)'; h.fillRect(0, 0, size, 4);
      for (let y = 0; y < size; y += 6) { c.fillStyle = `rgba(232,228,214,${0.45 + rnd() * 0.35})`; c.fillRect(0, y, 9 + rnd() * 2, 6); }
      r.fillStyle = 'rgba(0,0,0,0.3)'; r.fillRect(0, 0, 11, size);
      const ox = size * (0.45 + rnd() * 0.2), oy = size * (0.4 + rnd() * 0.2);
      blob(c, ox, oy, 40 + rnd() * 30, 26 + rnd() * 20, 0.4, 'rgba(10,8,5,0.6)');
      blob(r, ox, oy, 50 + rnd() * 30, 34 + rnd() * 20, 0.4, 'rgba(0,0,0,0.85)');
      for (let i = 0; i < 4; i++) { c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 6 + rnd() * 6; c.beginPath(); c.arc(rnd() * size, rnd() * size, 120 + rnd() * 200, rnd() * 6, rnd() * 6); c.stroke(); }
      for (let i = 0; i < 6; i++) blob(c, rnd() * size, rnd() * size, 30 + rnd() * 60, 20 + rnd() * 40, rnd() * 3, 'rgba(0,0,0,0.2)');
      break;
    }
    case 'weave': {
      for (let y = 0; y < size; y += 3) { c.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.06})`; c.fillRect(0, y, size, 1); }
      for (let x = 0; x < size; x += 3) { c.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.04})`; c.fillRect(x, 0, 1, size); }
      for (let i = 0; i < 6; i++) blob(c, rnd() * size, rnd() * size, 40 + rnd() * 90, 40 + rnd() * 90, 0, 'rgba(0,0,0,0.12)');
      for (let i = 0; i < 3; i++) blob(c, rnd() * size, rnd() * size, 30 + rnd() * 40, 10 + rnd() * 20, rnd() * 3, 'rgba(0,0,0,0.18)'); // worn track
      break;
    }
    case 'blocks': {
      const bh = size / 4, bw = size / 2, mortar = 4;
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? bw / 2 : 0;
        for (let col = -1; col < 3; col++) {
          c.fillStyle = greyTint(0.05)();
          c.fillRect(col * bw + off, row * bh, bw, bh);
          for (let k = 0; k < 60; k++) { c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(col * bw + off + rnd() * bw, row * bh + rnd() * bh, 1, 1); }
        }
        c.fillStyle = 'rgba(30,28,25,0.55)'; h.fillStyle = 'rgba(0,0,0,0.85)';
        c.fillRect(0, row * bh - mortar / 2, size, mortar); h.fillRect(0, row * bh - mortar / 2, size, mortar);
        for (let col = -1; col < 3; col++) { c.fillRect(col * bw + off - mortar / 2, row * bh, mortar, bh); h.fillRect(col * bw + off - mortar / 2, row * bh, mortar, bh); }
      }
      break;
    }
    case 'tiles': {
      grid(2, 3, 'rgba(20,18,15,0.55)', 'rgba(0,0,0,0.8)', greyTint(0.04));
      for (let i = 0; i < 10; i++) { c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1 + rnd() * 2; c.beginPath(); c.arc(rnd() * size, rnd() * size, 20 + rnd() * 60, rnd() * 6, rnd() * 6); c.stroke(); } // scuffs
      for (let i = 0; i < 4; i++) blob(r, rnd() * size, rnd() * size, 40 + rnd() * 60, 40 + rnd() * 60, 0, 'rgba(0,0,0,0.35)');
      break;
    }
    case 'ceiling': {
      grid(2, 5, 'rgba(70,68,62,0.7)', 'rgba(0,0,0,0.9)', greyTint(0.03));
      for (let i = 0; i < 1800; i++) { c.fillStyle = 'rgba(0,0,0,0.18)'; const x = rnd() * size, y = rnd() * size; c.fillRect(x, y, 2, 2); h.fillStyle = 'rgba(0,0,0,0.3)'; h.fillRect(x, y, 2, 2); } // pinholes
      blob(c, rnd() * size, rnd() * size, 60 + rnd() * 60, 50 + rnd() * 50, 0, 'rgba(120,90,40,0.2)'); // one water stain
      break;
    }
    case 'tiles_small': {
      grid(8, 2, 'rgba(25,30,32,0.6)', 'rgba(0,0,0,0.85)', greyTint(0.06));
      for (let i = 0; i < 5; i++) blob(c, rnd() * size, rnd() * size, 30 + rnd() * 60, 30 + rnd() * 60, 0, 'rgba(60,90,80,0.2)'); // algae
      break;
    }
    case 'grate': {
      c.fillStyle = 'rgba(0,0,0,0.75)'; h.fillStyle = 'rgba(0,0,0,0.95)';
      const n = 12;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if ((x + y) % 2 === 0) { c.fillRect((x * size) / n + 3, (y * size) / n + 3, size / n - 6, size / n - 6); h.fillRect((x * size) / n + 3, (y * size) / n + 3, size / n - 6, size / n - 6); }
      }
      for (let i = 0; i < 6; i++) blob(c, rnd() * size, rnd() * size, 20 + rnd() * 40, 20 + rnd() * 40, 0, 'rgba(120,60,20,0.35)'); // rust bloom
      break;
    }
    case 'caustic': {
      for (let i = 0; i < 40; i++) {
        c.strokeStyle = `rgba(160,220,235,${0.08 + rnd() * 0.14})`; c.lineWidth = 1.5 + rnd() * 2.5;
        h.strokeStyle = 'rgba(255,255,255,0.35)'; h.lineWidth = c.lineWidth;
        const cx = rnd() * size, cy = rnd() * size, rr = 12 + rnd() * 40, a0 = rnd() * 6, a1 = a0 + 1 + rnd() * 3;
        c.beginPath(); c.arc(cx, cy, rr, a0, a1); c.stroke(); h.beginPath(); h.arc(cx, cy, rr, a0, a1); h.stroke();
      }
      for (let i = 0; i < 8; i++) blob(c, rnd() * size, rnd() * size, 40 + rnd() * 80, 20 + rnd() * 40, rnd() * 3, 'rgba(0,0,0,0.25)');
      break;
    }
    case 'cardboard': {
      for (let y = 0; y < size; y += 4) { c.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`; c.fillRect(0, y, size, 1); }
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, size / 2 - 2, size, 4); h.fillStyle = 'rgba(0,0,0,0.6)'; h.fillRect(0, size / 2 - 2, size, 4);
      break;
    }
    default: break;
  }
}

// Colour + height + roughness canvases for a slot.
export function makeCanvasTextures(slot) {
  const recipe = RECIPES[slot] || RECIPES.plaster;
  const size = TEX_SIZE;
  const mk = () => { const cv = document.createElement('canvas'); cv.width = cv.height = size; return cv; };
  const colorCv = mk(), heightCv = mk(), roughCv = mk();
  const c = colorCv.getContext('2d'), h = heightCv.getContext('2d'), r = roughCv.getContext('2d');
  const img = c.createImageData(size, size), himg = h.createImageData(size, size), rimg = r.createImageData(size, size);
  const noise = fbm(size, recipe.seed, 5, recipe.base || 4);
  const fine = fbm(size, recipe.seed + 101, 3, 32);
  const A = hexToRgb(recipe.a), B = hexToRgb(recipe.b);
  const roughVar = recipe.roughVar || 0;
  for (let i = 0; i < size * size; i++) {
    const t = clamp01(0.5 + (noise[i] - 0.5) * recipe.contrast * 2);
    img.data[i * 4] = mix(A[0], B[0], t);
    img.data[i * 4 + 1] = mix(A[1], B[1], t);
    img.data[i * 4 + 2] = mix(A[2], B[2], t);
    img.data[i * 4 + 3] = 255;
    const hv = Math.round(255 * clamp01(0.5 + (noise[i] - 0.5) * 0.9 + (fine[i] - 0.5) * 0.5));
    himg.data[i * 4] = himg.data[i * 4 + 1] = himg.data[i * 4 + 2] = hv; himg.data[i * 4 + 3] = 255;
    const rv = Math.round(255 * clamp01(1 - (noise[i] - 0.5) * roughVar - (fine[i] - 0.5) * roughVar * 0.4));
    rimg.data[i * 4] = rimg.data[i * 4 + 1] = rimg.data[i * 4 + 2] = rv; rimg.data[i * 4 + 3] = 255;
  }
  c.putImageData(img, 0, 0); h.putImageData(himg, 0, 0); r.putImageData(rimg, 0, 0);
  drawPattern(c, h, r, size, recipe.pattern, mulberry32(recipe.seed * 7 + 3));
  const tex = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = ANISO.value;
    return t;
  };
  return { map: tex(colorCv, true), bumpMap: tex(heightCv, false), roughnessMap: tex(roughCv, false) };
}

// Back-compat single-texture entry point (tests, blender mirrors).
export function makeCanvasTexture(slot) { return makeCanvasTextures(slot).map; }

// World-space planar UVs so tiling is continuous across every box in a
// room (ported from the museum's matlib.applyWorldUV). tile = metres per
// texture repeat.
export function applyWorldUV(geometry, tile = 1, offset = [0, 0, 0]) {
  const pos = geometry.attributes.position;
  let nor = geometry.attributes.normal;
  if (!nor) { geometry.computeVertexNormals(); nor = geometry.attributes.normal; }
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i) + offset[0], y = pos.getY(i) + offset[1], z = pos.getZ(i) + offset[2];
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; }
    else if (nx >= nz) { u = z; v = y; }
    else { u = x; v = y; }
    uv[2 * i] = u / tile;
    uv[2 * i + 1] = v / tile;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

// PS1 vertex snapping: quantise clip-space positions to a coarse grid so
// low-poly props wobble as the camera moves (blender/material_factories.py's
// apply_vertex_snap, in shader form). Applied only to company-owned
// materials; the building never wobbles (C1).
const SNAP = { value: 160.0 };
const ANISO = { value: 1 };
export function setSnapResolution(px) { SNAP.value = px; }
export function setAnisotropy(n) { ANISO.value = Math.max(1, n | 0); }
function withVertexSnap(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = SNAP;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSnap;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        {
          vec4 p = gl_Position;
          vec2 grid = vec2(uSnap, uSnap * 0.5625);
          p.xy = floor(p.xy / p.w * grid) / grid * p.w;
          gl_Position = p;
        }`);
  };
  material.customProgramCacheKey = () => 'snap';
  return material;
}

// Low-poly prop palette (LowPolyProp_*): flat, un-textured, band-lit.
const LOWPOLY = {
  lp_red:    { color: '#7a2634' },
  lp_wood:   { color: '#8c6a3f' },
  lp_grey:   { color: '#8a8a86' },
  lp_dark:   { color: '#2b2b2b' },
  lp_black:  { color: '#101010' },
  lp_beige:  { color: '#b9ad93' },
  lp_paper:  { color: '#e8e2d0' },
  lp_skin:   { color: '#c9a887' },
  lp_suit:   { color: '#3a3a44' },
  lp_rust:   { color: '#6b3f26' },
  lp_car:    { color: '#5a3f2e' },
  lp_car2:   { color: '#3f4a52' },
  lp_car3:   { color: '#6a5a2a' },
  lp_car4:   { color: '#2e2e30' },
  lp_car5:   { color: '#5a2a26' },
  lp_car6:   { color: '#7a7566' },
  lp_blue:   { color: '#2e4a6b' },
  lp_curtain:{ color: '#6a1420' },
  lp_brass:  { color: '#a8863c' },
  lp_chrome: { color: '#9a9a96' },
  lp_glass:  { color: '#8fb0b8', opacity: 0.35 },
  lp_sign:   { color: '#1e7a3a', emissive: '#22ff66', emissiveIntensity: 1.2 },
  lp_screen: { color: '#0a0a0a', emissive: '#7ad9a0', emissiveIntensity: 0.9 },
  lp_screen_off: { color: '#0a0a0a', emissive: '#111111', emissiveIntensity: 0.2 },
  lp_fluoro: { color: '#e8e8e0', emissive: '#f4f2e8', emissiveIntensity: 1.6 },
  lp_sodium: { color: '#e0a040', emissive: '#ffb04a', emissiveIntensity: 1.8 },
  lp_taillight: { color: '#6a1a10', emissive: '#ff5a2a', emissiveIntensity: 0.6 },
  lp_headlight: { color: '#d8d0b0', emissive: '#fff4d0', emissiveIntensity: 0.3 },
  lp_white:  { color: '#e6e6e0' }
};

// Additive, depth-less glow sprites for light fixtures (the building's
// light, C1 -- so these are not vertex-snapped).
const GLOWS = {
  glow_sodium: { color: '#ff9a3a', opacity: 0.35 },
  glow_fluoro: { color: '#e8f0ff', opacity: 0.22 },
  glow_water:  { color: '#3ab8d0', opacity: 0.35 },
  glow_green:  { color: '#33ff77', opacity: 0.3 }
};

export function createMaterialLibrary({ anisotropy = 1 } = {}) {
  const cache = new Map();
  const textureSets = new Map();
  const animated = []; // { set, recipe }
  setAnisotropy(anisotropy);

  function textures(slot) {
    if (!textureSets.has(slot)) {
      const set = makeCanvasTextures(slot);
      textureSets.set(slot, set);
      const recipe = RECIPES[slot];
      if (recipe && recipe.animate) animated.push({ set, recipe });
    }
    return textureSets.get(slot);
  }

  function get(slot) {
    if (cache.has(slot)) return cache.get(slot);
    let mat;
    if (LOWPOLY[slot]) {
      const lp = LOWPOLY[slot];
      mat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(lp.color),
        flatShading: true,
        emissive: lp.emissive ? new THREE.Color(lp.emissive) : new THREE.Color(0x000000),
        emissiveIntensity: lp.emissiveIntensity || 1,
        transparent: lp.opacity !== undefined,
        opacity: lp.opacity !== undefined ? lp.opacity : 1
      });
      withVertexSnap(mat);
    } else if (GLOWS[slot]) {
      const g = GLOWS[slot];
      mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(g.color),
        transparent: true,
        opacity: g.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
      });
    } else {
      const r = RECIPES[slot] || RECIPES.plaster;
      const set = textures(slot);
      mat = new THREE.MeshStandardMaterial({
        map: set.map,
        bumpMap: r.bump ? set.bumpMap : null,
        bumpScale: r.bump || 0,
        roughnessMap: r.roughVar ? set.roughnessMap : null,
        roughness: r.rough,
        metalness: r.metal || 0,
        transparent: r.opacity !== undefined,
        opacity: r.opacity !== undefined ? r.opacity : 1,
        side: slot === 'water' ? THREE.DoubleSide : THREE.FrontSide
      });
      if (r.opacity !== undefined) mat.depthWrite = slot === 'water';
    }
    cache.set(slot, mat);
    return mat;
  }

  let t = 0;
  return {
    get,
    isLowPoly: (slot) => !!LOWPOLY[slot],
    isGlow: (slot) => !!GLOWS[slot],
    slots: () => Object.keys(RECIPES).concat(Object.keys(LOWPOLY), Object.keys(GLOWS)),
    // Per-frame: the water drifts (colour one way, caustics the other).
    update(dt) {
      t += dt;
      for (const { set } of animated) {
        set.map.offset.set(t * 0.012, t * 0.007);
        set.bumpMap.offset.set(-t * 0.02, t * 0.011);
      }
    },
    dispose() {
      for (const m of cache.values()) m.dispose();
      for (const set of textureSets.values()) { set.map.dispose(); set.bumpMap.dispose(); set.roughnessMap.dispose(); }
      cache.clear();
      textureSets.clear();
      animated.length = 0;
    }
  };
}
