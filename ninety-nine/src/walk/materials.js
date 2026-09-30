// Two-tier material library for the walkable rooms, mirroring the Blender
// pipeline's PhotorealArch_* / LowPolyProp_* split (blender/material_
// factories.py) and canon C1: the BUILDING (floors, walls, glass, water,
// fog, light) reads as real -- tiled, noisy, lit, shadowed; everything the
// COMPANY owns (chairs, desks, cars, signs, paper, people) is flat-shaded
// low-poly with PS1 vertex snapping.
//
// No image files: every "photoreal" surface is a procedurally drawn canvas
// texture (value noise + a per-slot pattern pass), tiled in world units by
// applyWorldUV() below (ported from the Earth_Worldbuild museum's
// matlib.js) so a 30 m garage floor and a 3 m elevator floor share one
// grain. Nothing to download, nothing to license.

import * as THREE from '../../vendor/three/three.module.js';

const TEX_SIZE = 256;

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
  // bilinearly interpolated, wrapping at the edges.
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

function fbm(size, seed, octaves = 4, base = 4) {
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

// Slot recipes: base/alt colours, noise contrast, a pattern pass, roughness.
const RECIPES = {
  marble:        { a: '#2a2825', b: '#57534b', seed: 11, contrast: 1.0, pattern: 'veins', rough: 0.25, metal: 0.05 },
  marble_light:  { a: '#9a958a', b: '#d9d4c8', seed: 12, contrast: 0.9, pattern: 'veins', rough: 0.3 },
  plaster:       { a: '#8d8a80', b: '#a8a498', seed: 21, contrast: 0.5, pattern: 'none', rough: 0.9 },
  plaster_blown: { a: '#d8d5cc', b: '#f2f0ea', seed: 22, contrast: 0.3, pattern: 'none', rough: 0.95 },
  plaster_dark:  { a: '#4a4742', b: '#5e5a53', seed: 23, contrast: 0.5, pattern: 'none', rough: 0.9 },
  concrete:      { a: '#5d5b57', b: '#7a7772', seed: 31, contrast: 0.8, pattern: 'speckle', rough: 0.85 },
  concrete_wet:  { a: '#3b3a38', b: '#5a5855', seed: 32, contrast: 0.9, pattern: 'stains', rough: 0.35, metal: 0.05 },
  garage_floor:  { a: '#4a4845', b: '#63605c', seed: 33, contrast: 0.8, pattern: 'parking', rough: 0.5 },
  carpet:        { a: '#3e3f46', b: '#4d4e56', seed: 41, contrast: 0.6, pattern: 'weave', rough: 1.0 },
  carpet_red:    { a: '#4a1f1f', b: '#5e2a2a', seed: 42, contrast: 0.6, pattern: 'weave', rough: 1.0 },
  cinderblock:   { a: '#6e6c68', b: '#85827c', seed: 51, contrast: 0.6, pattern: 'blocks', rough: 0.9 },
  linoleum:      { a: '#b8b3a3', b: '#d2cdbf', seed: 61, contrast: 0.5, pattern: 'tiles', rough: 0.35 },
  ceiling_tile:  { a: '#c9c6bd', b: '#dedbd3', seed: 71, contrast: 0.4, pattern: 'tiles', rough: 0.95 },
  pool_tile:     { a: '#6f8f93', b: '#9fbcbf', seed: 81, contrast: 0.7, pattern: 'tiles_small', rough: 0.2 },
  water:         { a: '#0d3a45', b: '#1a6a78', seed: 91, contrast: 0.9, pattern: 'caustic', rough: 0.05, metal: 0.1, opacity: 0.85 },
  cardboard:     { a: '#8a6a44', b: '#a68355', seed: 101, contrast: 0.5, pattern: 'none', rough: 0.95 },
  rust:          { a: '#4d2e1c', b: '#7a4a2a', seed: 111, contrast: 1.0, pattern: 'stains', rough: 0.8, metal: 0.3 },
  grate:         { a: '#2b2a28', b: '#55524d', seed: 121, contrast: 0.9, pattern: 'grate', rough: 0.6, metal: 0.6 },
  void:          { a: '#050505', b: '#0a0a0a', seed: 131, contrast: 0.2, pattern: 'none', rough: 1.0 },
  asphalt:       { a: '#2c2b2a', b: '#403f3d', seed: 141, contrast: 0.8, pattern: 'speckle', rough: 0.9 },
  glass:         { a: '#9fb2b8', b: '#c8d6da', seed: 151, contrast: 0.1, pattern: 'none', rough: 0.05, metal: 0.2, opacity: 0.22 },
  glass_dark:    { a: '#1a2224', b: '#25302f', seed: 152, contrast: 0.1, pattern: 'none', rough: 0.05, metal: 0.4, opacity: 0.55 }
};

function drawPattern(ctx, size, pattern, rnd) {
  ctx.save();
  switch (pattern) {
    case 'veins': {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        let x = rnd() * size, y = rnd() * size;
        ctx.moveTo(x, y);
        for (let k = 0; k < 8; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      break;
    }
    case 'speckle': {
      for (let i = 0; i < 1400; i++) {
        ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
        ctx.fillRect(rnd() * size, rnd() * size, 1, 1);
      }
      break;
    }
    case 'stains': {
      for (let i = 0; i < 9; i++) {
        const r = 10 + rnd() * 40;
        const g = ctx.createRadialGradient(rnd() * size, rnd() * size, 0, 0, 0, 0);
        ctx.fillStyle = `rgba(0,0,0,${0.15 + rnd() * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(rnd() * size, rnd() * size, r, r * (0.4 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
        void g;
      }
      break;
    }
    case 'parking': {
      // one bay per tile: a white line down the left edge, an oil stain
      ctx.fillStyle = 'rgba(230,230,220,0.75)';
      ctx.fillRect(0, 0, 4, size);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(size * 0.55, size * 0.5, 34, 22, 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'weave': {
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (let y = 0; y < size; y += 3) ctx.fillRect(0, y, size, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let x = 0; x < size; x += 3) ctx.fillRect(x, 0, 1, size);
      break;
    }
    case 'blocks': {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      const bh = size / 4, bw = size / 2;
      for (let r = 0; r < 4; r++) {
        ctx.fillRect(0, r * bh, size, 2);
        const off = r % 2 ? bw / 2 : 0;
        for (let c = -1; c < 3; c++) ctx.fillRect(c * bw + off, r * bh, 2, bh);
      }
      break;
    }
    case 'tiles': {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      const n = 2;
      for (let i = 0; i <= n; i++) { ctx.fillRect(0, (i * size) / n - 1, size, 2); ctx.fillRect((i * size) / n - 1, 0, 2, size); }
      break;
    }
    case 'tiles_small': {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      const n = 8;
      for (let i = 0; i <= n; i++) { ctx.fillRect(0, (i * size) / n, size, 1); ctx.fillRect((i * size) / n, 0, 1, size); }
      break;
    }
    case 'grate': {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      const n = 12;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if ((x + y) % 2 === 0) ctx.fillRect((x * size) / n + 2, (y * size) / n + 2, size / n - 4, size / n - 4);
      }
      break;
    }
    case 'caustic': {
      ctx.strokeStyle = 'rgba(200,240,255,0.18)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 24; i++) {
        ctx.beginPath();
        const cx = rnd() * size, cy = rnd() * size, r = 10 + rnd() * 30;
        ctx.arc(cx, cy, r, rnd() * 6, rnd() * 6);
        ctx.stroke();
      }
      break;
    }
    default: break;
  }
  ctx.restore();
}

export function makeCanvasTexture(slot) {
  const recipe = RECIPES[slot] || RECIPES.plaster;
  const size = TEX_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const noise = fbm(size, recipe.seed);
  const A = hexToRgb(recipe.a), B = hexToRgb(recipe.b);
  for (let i = 0; i < size * size; i++) {
    const t = Math.min(1, Math.max(0, 0.5 + (noise[i] - 0.5) * recipe.contrast * 2));
    img.data[i * 4] = mix(A[0], B[0], t);
    img.data[i * 4 + 1] = mix(A[1], B[1], t);
    img.data[i * 4 + 2] = mix(A[2], B[2], t);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  drawPattern(ctx, size, recipe.pattern, mulberry32(recipe.seed * 7 + 3));
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter; // PS1: no texture filtering
  tex.minFilter = THREE.LinearMipmapNearestFilter;
  tex.anisotropy = 1;
  return tex;
}

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
export function setSnapResolution(px) { SNAP.value = px; }
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
  lp_car:    { color: '#5a4a3a' },
  lp_car2:   { color: '#4a5a6a' },
  lp_car3:   { color: '#6a5a2a' },
  lp_car4:   { color: '#3a3a3a' },
  lp_blue:   { color: '#2e4a6b' },
  lp_curtain:{ color: '#6a1420' },
  lp_brass:  { color: '#a8863c' },
  lp_glass:  { color: '#8fb0b8', opacity: 0.35 },
  lp_sign:   { color: '#1e7a3a', emissive: '#22ff66', emissiveIntensity: 1.2 },
  lp_screen: { color: '#0a0a0a', emissive: '#7ad9a0', emissiveIntensity: 0.9 },
  lp_screen_off: { color: '#0a0a0a', emissive: '#111111', emissiveIntensity: 0.2 },
  lp_fluoro: { color: '#e8e8e0', emissive: '#f4f2e8', emissiveIntensity: 1.6 },
  lp_sodium: { color: '#e0a040', emissive: '#ffb04a', emissiveIntensity: 1.4 },
  lp_white:  { color: '#e6e6e0' }
};

export function createMaterialLibrary() {
  const cache = new Map();
  const textures = new Map();

  function texture(slot) {
    if (!textures.has(slot)) textures.set(slot, makeCanvasTexture(slot));
    return textures.get(slot);
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
    } else {
      const r = RECIPES[slot] || RECIPES.plaster;
      mat = new THREE.MeshStandardMaterial({
        map: texture(slot),
        roughness: r.rough,
        metalness: r.metal || 0,
        transparent: r.opacity !== undefined,
        opacity: r.opacity !== undefined ? r.opacity : 1,
        side: slot === 'water' ? THREE.DoubleSide : THREE.FrontSide
      });
    }
    cache.set(slot, mat);
    return mat;
  }

  return {
    get,
    isLowPoly: (slot) => !!LOWPOLY[slot],
    slots: () => Object.keys(RECIPES).concat(Object.keys(LOWPOLY)),
    dispose() {
      for (const m of cache.values()) m.dispose();
      for (const t of textures.values()) t.dispose();
      cache.clear();
      textures.clear();
    }
  };
}
