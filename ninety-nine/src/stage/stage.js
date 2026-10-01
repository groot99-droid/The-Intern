// The stage: every scene of the game is a live three.js set with a scripted
// camera. This replaces the video pool (two <video> elements crossfading
// Kling clips) and the stills that stood in while they loaded: nothing
// here is a file but the open-source prop library (library.js); the
// building is drawn by materials.js, the company's things by props.js,
// and what used to be a clip is a SHOT -- a camera move between two poses
// defined in data/rooms.json (tools/build_rooms.py's shots_for()).
//
// Public surface (router.js is the only caller besides test/rooms.html):
//   prefetch(key)                 build a room ahead of time (and warm the library)
//   show(key)                     make a room the visible set (no camera move)
//   holdPose(key, pose)           park the camera on a named pose ('in' / 'out')
//   playShot(key, shot, opts)     run a camera move; resolves when it ends
//                                 (immediately for a pingpong loop)
//   pause() / resume() / setRate  freeze, release, scale the shot clock
//   screenRect()                  where the current room's `terminal` screen is on
//                                 screen, as viewport fractions (MG-05 C's sheet)
//   actor(name, t)                drive a room actor along its path (MG-03 C)
//   walk(key)                     free first-person walk (WALK THE ROOM), resolves on LEAVE
//   blackout()                    fade to black and stop (the ending card)
//
// Look: the same composite pass the walk mode had -- an MSAA float target
// at ~70% of the viewport, ACES, vignette, grain, dither -- plus a fade
// uniform the leave/arrive shots use for their black-joins, so a
// transition is exactly what the old clips were: the room being left,
// black, the room being entered. Canon C2 (shadows toward the core) is
// room.js's job; C3 (no sky after the lobby doors) is build_rooms.py's.

import * as THREE from '../../vendor/three/three.module.js';
import { createMaterialLibrary, setSnapResolution } from '../walk/materials.js';
import { buildRoom } from '../walk/room.js';
import { createControls, createTouchControls, EYE_HEIGHT } from '../walk/controls.js';
import { createLibrary } from './library.js';

const RENDER_SCALE = 0.7;
const MAX_RENDER_WIDTH = 1600;
const MIN_RENDER_WIDTH = 480;
const STRIDE_M = 0.72;
const BOB_AMPLITUDE = 0.035;
const BOB_RATE = 2 * Math.PI / STRIDE_M;
const ROOM_CACHE_MAX = 4;
const LIBRARY_WAIT_MS = 6000; // a room builds with box fallbacks if the library is slower than this
export const DEFAULT_FOV = 62;

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
  uniform float uFade;
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
    col += g * smoothstep(0.0, 0.12, l) * (1.0 - 0.7 * l);
    col += (hash(vUv * uResolution + 7.0) - 0.5) / 255.0;
    col *= uFade;
    gl_FragColor = vec4(toSRGB(clamp(col, 0.0, 1.0)), 1.0);
  }
`;

const EASE = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inout: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
};

function resolveRecord(rooms, key) {
  const rec = rooms.rooms[key];
  if (!rec) return null;
  if (rec.alias) return { ...rooms.rooms[rec.alias], ...rec, id: key, base: rec.alias };
  return { ...rec, id: key, base: key };
}

export function createStage(container, { rooms = null, audio = null, sfx = null, library = null } = {}) {
  let renderer = null;
  let scene = null;
  let camera = null;
  let mats = null;
  let target = null;
  let postScene = null;
  let postCamera = null;
  let postMat = null;
  let rafId = 0;
  let elapsed = 0;
  let destroyed = false;
  const clock = new THREE.Clock();
  const lib = library || createLibrary();

  const cache = new Map(); // key -> { rec, room, promise }
  let current = null;      // { key, rec, room }
  let shot = null;         // the running camera move
  let held = false;
  let rate = 1;
  let fade = 1;            // 0 black .. 1 clear (post uniform)
  let fadeTarget = 1;
  let fadeSpeed = 0;       // per second
  let poseFov = DEFAULT_FOV;

  // Free-walk mode (WALK THE ROOM)
  let walkState = null;    // { controls, touch, hud, title, resolve, strideAcc, bobPhase, savedShot }

  function ensureRenderer() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.domElement.className = 'stage-canvas';
    container.prepend(renderer.domElement); // under the fracture overlay
    camera = new THREE.PerspectiveCamera(DEFAULT_FOV, 16 / 9, 0.05, 260);
    scene = new THREE.Scene();
    mats = createMaterialLibrary({ anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
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
        uFade: { value: 1.0 },
        uResolution: { value: new THREE.Vector2(16, 16) }
      },
      depthTest: false, depthWrite: false, toneMapped: false
    });
    postScene = new THREE.Scene();
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
    postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    window.addEventListener('resize', resize);
    resize();
    clock.getDelta();
    frame();
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
    setSnapResolution(w / 2.5);
  }

  // ---- rooms -------------------------------------------------------------

  async function getRoom(key) {
    if (!rooms) throw new Error('stage: no rooms.json');
    if (cache.has(key)) return cache.get(key).promise;
    const rec = resolveRecord(rooms, key);
    if (!rec) throw new Error(`stage: no room ${key}`);
    const entry = { rec, room: null, promise: null, used: performance.now() };
    entry.promise = (async () => {
      ensureRenderer();
      // Give the prop library a bounded head start so catalog models land in
      // the first build; past that the box fallbacks stand in.
      const needsLib = (rec.props || []).some((p) => p.type === 'glb');
      if (needsLib && !lib.loaded() && !lib.failed()) {
        await Promise.race([lib.ready, new Promise((r) => setTimeout(r, LIBRARY_WAIT_MS))]);
      }
      entry.room = buildRoom(mats, rec, { library: lib });
      return entry;
    })();
    cache.set(key, entry);
    trimCache();
    return entry.promise;
  }

  function trimCache() {
    if (cache.size <= ROOM_CACHE_MAX) return;
    const victims = [...cache.entries()]
      .filter(([k]) => !current || k !== current.key)
      .sort((a, b) => a[1].used - b[1].used);
    while (cache.size > ROOM_CACHE_MAX && victims.length) {
      const [k, e] = victims.shift();
      cache.delete(k);
      if (e.room) e.room.dispose();
    }
  }

  async function show(key) {
    const entry = await getRoom(key);
    entry.used = performance.now();
    if (destroyed) return entry;
    if (current && current.key === key) return entry;
    if (current) scene.remove(current.room.group);
    const { rec, room } = entry;
    scene.add(room.group);
    scene.background = new THREE.Color(room.background);
    scene.fog = room.fog ? new THREE.Fog(new THREE.Color(room.fog.color), room.fog.near, room.fog.far) : null;
    postMat.uniforms.uExposure.value = rec.exposure || 1.0;
    postMat.uniforms.uGrain.value = rec.grain === undefined ? 0.03 : rec.grain;
    postMat.uniforms.uVignette.value = rec.vignette === undefined ? 0.55 : rec.vignette;
    current = { key, rec, room };
    return entry;
  }

  // ---- shots -------------------------------------------------------------

  function poseOf(rec, p) {
    if (typeof p === 'string') {
      const named = rec.shots && rec.shots[p];
      if (!named || !named.pos) throw new Error(`stage: ${rec.id} has no pose "${p}"`);
      return named;
    }
    return p;
  }

  function applyPose(pose) {
    camera.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    camera.lookAt(pose.look[0], pose.look[1], pose.look[2]);
    poseFov = pose.fov || DEFAULT_FOV;
    if (camera.fov !== poseFov) { camera.fov = poseFov; camera.updateProjectionMatrix(); }
  }

  function setFade(value, seconds) {
    fadeTarget = value;
    fadeSpeed = seconds > 0 ? Math.abs(value - fade) / seconds : Infinity;
  }

  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  function stepShot(dt) {
    if (!shot) return;
    if (!held && !walkState) shot.t += (dt * rate) / shot.seconds;
    let u;
    if (shot.pingpong) {
      const c = shot.t % 2;
      u = c <= 1 ? c : 2 - c;
    } else {
      u = Math.min(1, shot.t);
    }
    const e = (EASE[shot.ease] || EASE.inout)(u);
    const a = shot.from, b = shot.to;
    tmpPos.set(a.pos[0] + (b.pos[0] - a.pos[0]) * e, a.pos[1] + (b.pos[1] - a.pos[1]) * e, a.pos[2] + (b.pos[2] - a.pos[2]) * e);
    tmpLook.set(a.look[0] + (b.look[0] - a.look[0]) * e, a.look[1] + (b.look[1] - a.look[1]) * e, a.look[2] + (b.look[2] - a.look[2]) * e);
    if (shot.sway) {
      const s = shot.sway * (held ? 0.3 : 1);
      tmpPos.y += Math.sin(elapsed * 0.9) * s;
      tmpPos.x += Math.sin(elapsed * 0.53 + 1.0) * s * 0.6;
      tmpLook.x += Math.sin(elapsed * 0.37) * s * 2.5;
      tmpLook.y += Math.cos(elapsed * 0.61) * s * 1.5;
    }
    camera.position.copy(tmpPos);
    camera.lookAt(tmpLook);
    const fa = a.fov || DEFAULT_FOV, fb = b.fov || DEFAULT_FOV;
    const fov = fa + (fb - fa) * e;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

    // Black-joins: fade out over the move's last `fadeOut` seconds, fade in
    // over its first `fadeIn`.
    const tSec = Math.min(shot.seconds, shot.t * shot.seconds);
    if (shot.fadeIn) fade = Math.min(1, tSec / shot.fadeIn);
    if (shot.fadeOut) fade = Math.min(fade, Math.max(0, (shot.seconds - tSec) / shot.fadeOut));

    if (!shot.pingpong && shot.t >= 1 && !shot.done) {
      shot.done = true;
      const r = shot.resolve;
      shot.resolve = null;
      if (r) r();
    }
  }

  async function playShot(key, name, { onStart = null } = {}) {
    if (destroyed) return;
    const entry = await show(key);
    if (destroyed) return;
    const { rec } = entry;
    const def = rec.shots && rec.shots[name];
    if (!def) throw new Error(`stage: ${rec.id} has no shot "${name}"`);
    if (shot && shot.resolve) { const r = shot.resolve; shot.resolve = null; r(); } // supersede: the old move releases its waiter
    held = false;
    if (def.pos) {
      // a bare pose: park on it
      shot = null;
      applyPose(def);
      if (onStart) onStart();
      return;
    }
    const from = poseOf(rec, def.from), to = poseOf(rec, def.to);
    fadeTarget = 1; fadeSpeed = 0;
    if (def.fadeIn) fade = 0;
    if (!def.fadeIn && !def.fadeOut) fade = 1;
    const promise = new Promise((resolve) => {
      shot = {
        key, name, from, to,
        seconds: Math.max(0.05, def.seconds || 4),
        ease: def.ease || 'inout',
        pingpong: !!def.pingpong,
        sway: def.sway || 0,
        fadeIn: def.fadeIn || 0,
        fadeOut: def.fadeOut || 0,
        holdEnd: !!def.holdEnd,
        t: 0,
        done: false,
        resolve
      };
      stepShot(0);
    });
    if (onStart) onStart();
    if (shot.pingpong) { const r = shot.resolve; shot.resolve = null; r(); }
    return promise;
  }

  async function holdPose(key, pose) {
    if (destroyed) return;
    const entry = await show(key || (current && current.key));
    if (destroyed) return;
    if (shot && shot.resolve) { const r = shot.resolve; shot.resolve = null; r(); }
    shot = null;
    fade = 1; fadeTarget = 1; fadeSpeed = 0;
    applyPose(poseOf(entry.rec, pose));
  }

  // ---- per frame -----------------------------------------------------------

  function frame() {
    if (destroyed) return;
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    elapsed += dt;
    if (fadeSpeed > 0 && fade !== fadeTarget) {
      fade = fade < fadeTarget ? Math.min(fadeTarget, fade + fadeSpeed * dt) : Math.max(fadeTarget, fade - fadeSpeed * dt);
    }
    if (walkState) stepWalk(dt); else stepShot(dt);
    mats.update(dt);
    if (current && current.room.update) current.room.update(dt, elapsed);
    if (!current) return;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    postMat.uniforms.uTime.value = elapsed;
    postMat.uniforms.uFade.value = fade;
    renderer.render(postScene, postCamera);
  }

  // ---- services for mini-games ---------------------------------------------

  const corner = new THREE.Vector3();
  function screenRect() {
    if (!current) return null;
    const term = current.room.named.get('terminal');
    if (!term) return null;
    let screen = null;
    term.traverse((o) => { if (!screen && o.isMesh && o.userData.screen) screen = o; });
    if (!screen) return null;
    screen.updateWorldMatrix(true, false);
    const bb = new THREE.Box3().setFromObject(screen);
    let minX = 1, minY = 1, maxX = -1, maxY = -1;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).project(camera);
      minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
    }
    const x = (minX + 1) / 2, y = (1 - maxY) / 2;
    return { x, y, w: (maxX - minX) / 2, h: (maxY - minY) / 2 };
  }

  function actor(name, t) {
    if (!current) return;
    const a = current.room.actors[name];
    if (a) a.set(t);
  }

  // ---- free walk -------------------------------------------------------------

  function stepWalk(dt) {
    const w = walkState;
    w.controls.update(dt);
    const moved = w.controls.movedThisFrame();
    w.strideAcc += moved;
    w.bobPhase += moved * BOB_RATE;
    if (w.strideAcc >= STRIDE_M) {
      w.strideAcc -= STRIDE_M;
      if (sfx) sfx.play('footstep', current && current.room.footstep ? current.room.footstep : {});
    }
    w.controls.setEyeOffset(moved > 0 ? Math.sin(w.bobPhase) * BOB_AMPLITUDE : 0, dt);
  }

  function buildHud(rec, overlay) {
    const hud = document.createElement('div');
    hud.className = 'walk-hud';
    const hint = document.createElement('div');
    hint.className = 'walk-hint';
    const isTouch = (navigator.maxTouchPoints || 0) > 0;
    hint.textContent = isTouch ? 'LEFT THUMB WALKS · RIGHT THUMB LOOKS' : 'W A S D WALKS · CLICK THE ROOM TO LOOK · ESC RELEASES THE MOUSE';
    const leave = document.createElement('button');
    leave.type = 'button';
    leave.className = 'walk-leave';
    leave.textContent = 'LEAVE THE ROOM';
    leave.addEventListener('click', () => leaveWalk());
    hud.append(hint, leave);
    const title = document.createElement('div');
    title.className = 'walk-title';
    title.textContent = rec.name || '';
    overlay.append(hud, title);
    return { hud, title };
  }

  function leaveWalk() {
    const w = walkState;
    if (!w) return;
    walkState = null;
    w.controls.release();
    w.controls.dispose();
    if (w.touch) w.touch.dispose();
    w.hud.remove();
    w.title.remove();
    w.overlay.hidden = true;
    // back to the scripted camera exactly where it was
    camera.fov = poseFov; camera.updateProjectionMatrix();
    if (w.savedShot) { shot = w.savedShot; stepShot(0); } else if (w.savedPose) { camera.position.copy(w.savedPose.pos); camera.quaternion.copy(w.savedPose.quat); }
    const r = w.resolve;
    if (r) r();
  }

  async function walk(key, { overlay = null } = {}) {
    if (walkState || destroyed) return;
    const entry = await show(key);
    if (destroyed) return;
    const { rec, room } = entry;
    const ov = overlay || container;
    ov.hidden = false;
    const controls = createControls(camera, renderer.domElement, () => ({ walls: room.walls, floors: room.floors }));
    const saved = { savedShot: shot, savedPose: { pos: camera.position.clone(), quat: camera.quaternion.clone() } };
    shot = null;
    fade = 1; fadeTarget = 1; fadeSpeed = 0;
    camera.fov = 68; camera.updateProjectionMatrix();
    controls.setEyeOffset(0, 1);
    controls.teleport(room.spawn.x, room.spawn.z, room.spawn.yaw);
    camera.position.y = EYE_HEIGHT;
    const { hud, title } = buildHud(rec, ov);
    const touch = createTouchControls({ domElement: renderer.domElement, overlay: ov, controls });
    if (audio) audio.resumeIfSuspended();
    return new Promise((resolve) => {
      walkState = { controls, touch, hud, title, overlay: ov, resolve, strideAcc: 0, bobPhase: 0, ...saved };
    });
  }

  return {
    ready: lib.ready,
    library: lib,
    prefetch(key) { if (rooms && rooms.rooms[key]) getRoom(key).catch(() => {}); },
    show,
    holdPose,
    playShot,
    pause() { held = true; },
    resume() { held = false; },
    isPaused() { return held; },
    setRate(r) { rate = Math.min(2, Math.max(0.25, Number.isFinite(r) ? r : 1)); },
    screenRect,
    actor,
    walk,
    abortWalk() { leaveWalk(); },
    isWalking() { return !!walkState; },
    currentKey() { return current ? current.key : null; },
    baseKey(key) { const rec = rooms && resolveRecord(rooms, key); return rec ? rec.base : key; },
    record(key) { return rooms ? resolveRecord(rooms, key) : null; },
    fadeTo(value, seconds) { setFade(value, seconds); return new Promise((r) => setTimeout(r, seconds * 1000)); },
    async blackout(seconds = 1.2) {
      leaveWalk();
      await this.fadeTo(0, seconds);
      if (shot && shot.resolve) { const r = shot.resolve; shot.resolve = null; r(); }
      shot = null;
    },
    destroy() {
      destroyed = true;
      leaveWalk();
      cancelAnimationFrame(rafId);
      if (shot && shot.resolve) { const r = shot.resolve; shot.resolve = null; r(); }
      shot = null;
      for (const e of cache.values()) if (e.room) e.room.dispose();
      cache.clear();
      current = null;
      if (renderer) { window.removeEventListener('resize', resize); renderer.dispose(); renderer.domElement.remove(); renderer = null; }
    },
    // Test hooks
    _debug() { return { current: current ? current.key : null, shot: shot ? { name: shot.name, t: shot.t, pingpong: shot.pingpong } : null, fade, held, rate, camera: camera ? camera.position.toArray() : null, cached: [...cache.keys()], target: target ? [target.width, target.height] : null }; }
  };
}
