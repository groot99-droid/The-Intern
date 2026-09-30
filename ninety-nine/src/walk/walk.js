// The 3D walk layer: the museum walkthrough's renderer/loop shape
// (_Museum/web/js/main.js) with the museum's realism pass swapped for this
// game's own look. One room at a time; the whole layer is torn down on
// leave.
//
// Look (post-launch quality pass): the scene renders into an MSAA float
// target at ~70% of the viewport and is composited to the canvas by a
// small full-screen pass that does the tone mapping (ACES), a vignette,
// film grain and a dither -- the same finish the photoreal video plates
// have, so a room reads as the building the clips were shot in rather
// than a blocky box. The PS1 treatment lives where canon C1 puts it: on
// the company's props (flat shading, vertex snapping, no textures), not
// smeared over the whole frame as a third-resolution nearest-neighbour
// upscale, which is what made the rooms read as "low quality".
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

const RENDER_SCALE = 0.7;     // internal target vs. viewport
const MAX_RENDER_WIDTH = 1600;
const MIN_RENDER_WIDTH = 480;
const STRIDE_M = 0.72;        // one footstep cue per stride
const BOB_AMPLITUDE = 0.035;  // metres of head-bob at full stride
const BOB_RATE = 2 * Math.PI / STRIDE_M; // one bob per stride

// Composite pass: linear HDR target -> ACES -> vignette -> grain -> sRGB.
const POST_VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const POST_FRAG = `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform float uExposure;
  uniform float uGrain;
  uniform float uVignette;
  uniform vec2 uResolution;
  varying vec2 vUv;
  vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
  vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main() {
    vec3 col = texture2D(tDiffuse, vUv).rgb * uExposure;
    col = aces(col);
    vec2 d = vUv - 0.5;
    float vig = 1.0 - uVignette * smoothstep(0.25, 0.9, dot(d, d) * 2.2);
    col *= vig;
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    float g = (hash(vUv * uResolution) - 0.5) * uGrain;
    col += g * smoothstep(0.0, 0.12, l) * (1.0 - 0.7 * l); // grain in the mid-tones, not the blacks
    col += (hash(vUv * uResolution + 7.0) - 0.5) / 255.0; // dither
    gl_FragColor = vec4(toSRGB(clamp(col, 0.0, 1.0)), 1.0);
  }
`;

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
  let bobPhase = 0;
  let target = null;
  let postScene = null;
  let postCamera = null;
  let postMat = null;
  let elapsed = 0;
  const clock = new THREE.Clock();

  function ensureRenderer() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping; // done in the post pass (a render target skips it anyway)
    container.appendChild(renderer.domElement);
    camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.05, 200);
    scene = new THREE.Scene();
    mats = createMaterialLibrary({ anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
    controls = createControls(camera, renderer.domElement, () => ({ walls: room ? room.walls : [], floors: room ? room.floors : [] }));

    const samples = renderer.capabilities.isWebGL2 ? 4 : 0;
    target = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples, depthBuffer: true, stencilBuffer: false });
    target.texture.minFilter = THREE.LinearFilter;
    target.texture.magFilter = THREE.LinearFilter;
    postMat = new THREE.ShaderMaterial({
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      uniforms: {
        tDiffuse: { value: target.texture },
        uTime: { value: 0 },
        uExposure: { value: 1.0 },
        uGrain: { value: 0.03 },
        uVignette: { value: 0.55 },
        uResolution: { value: new THREE.Vector2(16, 16) }
      },
      depthTest: false, depthWrite: false, toneMapped: false
    });
    postScene = new THREE.Scene();
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
    postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!renderer) return;
    const vw = container.clientWidth || window.innerWidth;
    const vh = container.clientHeight || window.innerHeight;
    renderer.setSize(vw, vh, false);
    const w = Math.min(MAX_RENDER_WIDTH, Math.max(MIN_RENDER_WIDTH, Math.round(vw * RENDER_SCALE)));
    const h = Math.max(120, Math.round(w * (vh / vw)));
    target.setSize(w, h);
    postMat.uniforms.uResolution.value.set(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    setSnapResolution(w / 2.5); // the props' snap grid, in half-pixels of the target
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
    elapsed += delta;
    controls.update(delta);
    // Footsteps: sfx.js's synthesized cue, tinted per room surface. Head
    // bob rides the same stride so the two agree.
    const moved = controls.movedThisFrame();
    strideAcc += moved;
    bobPhase += moved * BOB_RATE;
    if (strideAcc >= STRIDE_M) {
      strideAcc -= STRIDE_M;
      if (sfx) sfx.play('footstep', room && room.footstep ? room.footstep : {});
    }
    const bobTarget = moved > 0 ? Math.sin(bobPhase) * BOB_AMPLITUDE : 0;
    controls.setEyeOffset(bobTarget, delta);

    mats.update(delta);
    if (room && room.update) room.update(delta, elapsed);

    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    postMat.uniforms.uTime.value = elapsed;
    renderer.render(postScene, postCamera);
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
      postMat.uniforms.uExposure.value = rec.exposure || 1.0;
      postMat.uniforms.uGrain.value = rec.grain === undefined ? 0.03 : rec.grain;
      postMat.uniforms.uVignette.value = rec.vignette === undefined ? 0.55 : rec.vignette;
      controls.setEyeOffset(0, 1);
      controls.teleport(room.spawn.x, room.spawn.z, room.spawn.yaw);
      camera.position.y = EYE_HEIGHT;
      container.hidden = false;
      resize();
      buildHud(rec);
      touch = createTouchControls({ domElement: renderer.domElement, overlay: container, controls });
      strideAcc = 0;
      bobPhase = 0;
      running = true;
      clock.getDelta();
      frame();
      if (audio) audio.resumeIfSuspended();
      return new Promise((resolve) => { resolveLeave = resolve; });
    },
    abort() { leaveRoom(); },
    isActive: () => running,
    // Test hooks
    _debug() { return { running, room: room ? { walls: room.walls.length, floors: room.floors.length, spawn: room.spawn } : null, camera: camera ? camera.position.toArray() : null, target: target ? [target.width, target.height] : null }; }
  };
}
