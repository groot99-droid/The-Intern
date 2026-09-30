// The 3D walk layer: the museum walkthrough's renderer/loop shape
// (_Museum/web/js/main.js) with the museum's realism pass swapped for this
// game's own look -- a third-resolution render target upscaled with
// nearest-neighbour sampling, no anti-aliasing, low-poly props that snap on
// a coarse vertex grid, and the building lit and shadowed like a building.
// One room at a time; the whole layer is torn down on leave.
//
// Lifecycle (driven by walk/launcher.js from router.js):
//   createWalk(container, { audio, sfx }) once,
//   enter(roomRecord) -> Promise that resolves when the player presses
//   LEAVE (or router.bail() aborts it). Walking is unscored: no friction,
//   no conformance, no flags. Ambience, drone and music carry on underneath
//   (C7 -- nothing here touches the AudioContext).

import * as THREE from '../../vendor/three/three.module.js';
import { createMaterialLibrary, setSnapResolution } from './materials.js';
import { buildRoom } from './room.js';
import { createControls, createTouchControls, EYE_HEIGHT } from './controls.js';

const RENDER_SCALE = 1 / 3;   // PS1 fill rate: render at a third of the viewport
const MAX_RENDER_WIDTH = 640;
const STRIDE_M = 0.72;        // one footstep cue per stride

export function createWalk(container, { audio = null, sfx = null } = {}) {
  let renderer = null;
  let scene = null;
  let camera = null;
  let mats = null;
  let controls = null;
  let touch = null;
  let room = null;
  let hud = null;
  let running = false;
  let resolveLeave = null;
  let rafId = 0;
  let strideAcc = 0;
  const clock = new THREE.Clock();

  function ensureRenderer() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 200);
    scene = new THREE.Scene();
    mats = createMaterialLibrary();
    controls = createControls(camera, renderer.domElement, () => ({ walls: room ? room.walls : [], floors: room ? room.floors : [] }));
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!renderer) return;
    const vw = container.clientWidth || window.innerWidth;
    const vh = container.clientHeight || window.innerHeight;
    const w = Math.min(MAX_RENDER_WIDTH, Math.max(160, Math.round(vw * RENDER_SCALE)));
    const h = Math.max(90, Math.round(w * (vh / vw)));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    setSnapResolution(w / 2);
  }

  function buildHud(rec) {
    hud = document.createElement('div');
    hud.className = 'walk-hud';
    const hint = document.createElement('div');
    hint.className = 'walk-hint';
    const isTouch = (navigator.maxTouchPoints || 0) > 0;
    hint.textContent = isTouch
      ? 'LEFT THUMB WALKS · RIGHT THUMB LOOKS'
      : 'W A S D WALKS · CLICK THE ROOM TO LOOK · ESC RELEASES THE MOUSE';
    const leave = document.createElement('button');
    leave.type = 'button';
    leave.className = 'walk-leave';
    leave.textContent = 'LEAVE THE ROOM';
    leave.addEventListener('click', () => leaveRoom());
    hud.append(hint, leave);
    container.appendChild(hud);
    const title = document.createElement('div');
    title.className = 'walk-title';
    title.textContent = rec.name || '';
    container.appendChild(title);
    hud._title = title;
  }

  function frame() {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    const delta = Math.min(clock.getDelta(), 0.1);
    controls.update(delta);
    // Footsteps: sfx.js's synthesized cue, tinted per room surface.
    strideAcc += controls.movedThisFrame();
    if (strideAcc >= STRIDE_M) {
      strideAcc -= STRIDE_M;
      if (sfx) sfx.play('footstep', room && room.footstep ? room.footstep : {});
    }
    renderer.render(scene, camera);
  }

  function teardownRoom() {
    if (!room) return;
    scene.remove(room.group);
    room.dispose();
    room = null;
    scene.fog = null;
  }

  function leaveRoom() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    controls.release();
    if (touch) { touch.dispose(); touch = null; }
    if (hud) { hud._title.remove(); hud.remove(); hud = null; }
    teardownRoom();
    container.hidden = true;
    const r = resolveLeave;
    resolveLeave = null;
    if (r) r();
  }

  return {
    enter(rec) {
      if (running) return Promise.resolve();
      ensureRenderer();
      room = buildRoom(mats, rec);
      scene.add(room.group);
      scene.background = new THREE.Color(room.background);
      if (room.fog) scene.fog = new THREE.Fog(new THREE.Color(room.fog.color), room.fog.near, room.fog.far);
      controls.teleport(room.spawn.x, room.spawn.z, room.spawn.yaw);
      camera.position.y = EYE_HEIGHT;
      container.hidden = false;
      resize();
      buildHud(rec);
      touch = createTouchControls({ domElement: renderer.domElement, overlay: container, controls });
      strideAcc = 0;
      running = true;
      clock.getDelta();
      frame();
      if (audio) audio.resumeIfSuspended();
      return new Promise((resolve) => { resolveLeave = resolve; });
    },
    abort() { leaveRoom(); },
    isActive: () => running,
    // Test hooks
    _debug() { return { running, room: room ? { walls: room.walls.length, floors: room.floors.length, spawn: room.spawn } : null, camera: camera ? camera.position.toArray() : null }; }
  };
}
