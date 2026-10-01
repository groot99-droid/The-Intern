// The open-source prop library: assets/glb/library.glb, one file holding
// every catalog model the rooms place (tools/build_rooms.py's CATALOG),
// exported from the Higgsfield 3D scene builder's "Prop Library" project.
// Each model is a named node; props.js's `glb` builder asks for a clone by
// that name and falls back to its box builder when the file is missing or
// still loading, so a room never waits on the download to exist.
//
// Canon C1: company property is low-poly. Whatever shading the catalog
// shipped, the clone gets the same treatment as every other prop: flat
// shading, PS1 vertex snapping, the model's own flat colours and nothing
// else (a palette texture is kept, since it reads as flat colour; a
// photo texture is not).

import * as THREE from '../../vendor/three/three.module.js';
import { withVertexSnap } from '../walk/materials.js';

const LIBRARY_URL = './assets/glb/library.glb';
const LOAD_TIMEOUT_MS = 12000;

export function createLibrary({ url = LIBRARY_URL } = {}) {
  let scene = null;
  let failed = false;
  const converted = new Map(); // source material uuid -> low-poly material

  const ready = (async () => {
    try {
      const head = await fetch(url, { method: 'HEAD' });
      if (!head.ok) { failed = true; return false; }
      const { GLTFLoader } = await import('../../vendor/three/GLTFLoader.js');
      const loader = new GLTFLoader();
      const gltf = await Promise.race([
        loader.loadAsync(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('library.glb: load timed out')), LOAD_TIMEOUT_MS))
      ]);
      scene = gltf.scene;
      return true;
    } catch (e) {
      console.warn('library.js: no prop library, box fallbacks only', e && e.message);
      failed = true;
      return false;
    }
  })();

  function lowPoly(src) {
    if (converted.has(src.uuid)) return converted.get(src.uuid);
    const map = src.map && src.map.image && src.map.image.width <= 256 ? src.map : null; // palette textures only
    const mat = new THREE.MeshLambertMaterial({
      color: src.color ? src.color.clone() : new THREE.Color('#8a8a86'),
      map,
      flatShading: true,
      emissive: src.emissive ? src.emissive.clone() : new THREE.Color(0),
      emissiveIntensity: src.emissiveIntensity !== undefined ? Math.min(1, src.emissiveIntensity) : 1,
      transparent: !!src.transparent && src.opacity < 1,
      opacity: src.opacity !== undefined ? src.opacity : 1,
      side: THREE.FrontSide
    });
    if (map) { map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestFilter; }
    withVertexSnap(mat);
    converted.set(src.uuid, mat);
    return mat;
  }

  return {
    ready,
    loaded: () => !!scene,
    failed: () => failed,
    has(node) { return !!(scene && scene.getObjectByName(node)); },
    // A fresh clone of a named model, origin-centred on the floor, sharing
    // geometry with every other clone. null when unavailable.
    instance(node) {
      if (!scene) return null;
      const src = scene.getObjectByName(node);
      if (!src) return null;
      const clone = src.clone(true);
      clone.position.set(0, 0, 0);
      clone.rotation.set(0, 0, 0);
      clone.scale.set(1, 1, 1);
      clone.traverse((o) => {
        if (!o.isMesh) return;
        o.material = Array.isArray(o.material) ? o.material.map(lowPoly) : lowPoly(o.material);
        o.castShadow = true;
        o.receiveShadow = true;
      });
      // Sit on the floor whatever the source's pivot was.
      const bb = new THREE.Box3().setFromObject(clone);
      if (Number.isFinite(bb.min.y)) clone.position.y = -bb.min.y;
      const wrap = new THREE.Group();
      wrap.add(clone);
      wrap.name = node;
      return wrap;
    }
  };
}
