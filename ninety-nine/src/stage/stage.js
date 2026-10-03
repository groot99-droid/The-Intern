// The stage: the renderer, the composite pass and the frame loop that draw
// the continuous building (src/world/world.js) through the candidate's
// eyes (src/world/player.js). The game is played on foot, in first person,
// from the apartment to the ending card, with no cuts; the camera is taken
// away from the player only for CARRIED moments -- sitting down at the
// computer, the freight cab's descent, the fall into the pool, an ending's
// pull-back -- which are camera moves (carry() between two world poses, or
// playShot() of a named shot from data/rooms.json, authored in the room's
// own frame and carried into the world by the room's matrix).
//
// Public surface (src/director.js; test/rooms.html for previews):
//   world, player, camera            the building, the body, the eye
//   preview(key)                     a lone room at the origin (rooms.html)
//   playShot(inst|key, shot, opts)   a camera move from rooms.json; resolves at its end
//   holdPose(inst|key, pose)         park the camera on a named pose
//   carry(pose, opts)                ease the camera from wherever it is to a world pose
//   walk(key)                        walk a lone room (rooms.html), resolves never
//   screenRect(inst, prop)           where a prop's screen is in the viewport (the CRT form)
//   project(point)                   a world point in viewport fractions (threshold labels)
//   onFrame(fn)                      per-frame hook (the director's zone checks)
//   fadeTo / blackout                the composite's fade (the ending card)
//
// Look: an MSAA float target at ~70% of the viewport, ACES, vignette,
// grain, dither. Exposure, grain, vignette, fog and background follow the
// world's atmosphere, which blends between rooms across a connector.

import * as THREE from '../../vendor/three/three.module.js';
import { createMaterialLibrary, setSnapResolution } from '../walk/materials.js';
import { createLibrary } from './library.js';
import { createWorld, resolveRecord } from '../world/world.js';
import { createPlayer, WALK_FOV } from '../world/player.js';

const RENDER_SCALE = 0.7;
const MAX_RENDER_WIDTH = 1600;
const MIN_RENDER_WIDTH = 480;
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

export const EASE = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inout: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
};

export function createStage(container, { rooms = null, audio = null, sfx = null, library = null, overlay = null, onBump = null } = {}) {
  let destroyed = false;
  let rafId = 0;
  let elapsed = 0;
  const clock = new THREE.Clock();
  const lib = library || createLibrary();

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.className = 'stage-canvas';
  container.prepend(renderer.domElement); // under the fracture overlay
  const camera = new THREE.PerspectiveCamera(WALK_FOV, 16 / 9, 0.05, 320);
  const scene = new THREE.Scene();
  scene.add(camera); // so props parented to the camera (a held package) render
  scene.background = new THREE.Color('#000000');
  scene.fog = new THREE.Fog(0x000000, 400, 1200); // never null: the fog define stays constant
  const mats = createMaterialLibrary({ anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
  const samples = renderer.capabilities.isWebGL2 ? 4 : 0;
  const target = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples, depthBuffer: true, stencilBuffer: false });
  target.texture.minFilter = THREE.LinearFilter;
  target.texture.magFilter = THREE.LinearFilter;
  const postMat = new THREE.ShaderMaterial({
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
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const world = createWorld({ scene, mats, library: lib, rooms });
  const player = createPlayer({ camera, domElement: renderer.domElement, overlay: overlay || container, world, sfx, onBump });
  player.disable();

  let shot = null;          // the running camera move
  let fade = 1;             // 0 black .. 1 clear (post uniform)
  let fadeTarget = 1;
  let fadeSpeed = 0;        // per second
  let playerActive = false;
  const frameHooks = new Set();

  function resize() {
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
  window.addEventListener('resize', resize);
  resize();

  // ---- instances -----------------------------------------------------------

  function instOf(ref) {
    if (!ref) return world.current();
    if (typeof ref === 'object') return ref;
    return world.instances().find((i) => i.key === ref || i.base === world.baseOf(ref)) || null;
  }

  // A lone room at the origin (rooms.html, tests): the world is cleared.
  async function preview(key) {
    await world.prebuild(key);
    world.clear();
    const inst = world.spawn(key);
    world.setCurrent(inst);
    return inst;
  }

  // ---- camera moves -----------------------------------------------------------

  function namedPose(inst, p) {
    if (typeof p === 'string') {
      const named = inst.rec.shots && inst.rec.shots[p];
      if (!named || !named.pos) throw new Error(`stage: ${inst.key} has no pose "${p}"`);
      return world.poseToWorld(inst, named);
    }
    return p.space === 'world' ? p : world.poseToWorld(inst, p);
  }

  function applyPose(pose) {
    camera.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    camera.lookAt(pose.look[0], pose.look[1], pose.look[2]);
    const fov = pose.fov || camera.fov;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  const _fwd = new THREE.Vector3();
  function currentPose(lookDist = 3) {
    camera.getWorldDirection(_fwd);
    return {
      pos: camera.position.toArray(),
      look: [camera.position.x + _fwd.x * lookDist, camera.position.y + _fwd.y * lookDist, camera.position.z + _fwd.z * lookDist],
      fov: camera.fov,
      space: 'world'
    };
  }

  function setFade(value, seconds) {
    fadeTarget = value;
    fadeSpeed = seconds > 0 ? Math.abs(value - fade) / seconds : Infinity;
    if (seconds <= 0) fade = value;
  }

  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  function stepShot(dt) {
    if (!shot) return;
    shot.t += dt / shot.seconds;
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
      const s = shot.sway;
      tmpPos.y += Math.sin(elapsed * 0.9) * s;
      tmpPos.x += Math.sin(elapsed * 0.53 + 1.0) * s * 0.6;
      tmpLook.x += Math.sin(elapsed * 0.37) * s * 2.5;
      tmpLook.y += Math.cos(elapsed * 0.61) * s * 1.5;
    }
    if (shot.shake) {
      const k = shot.shake * (1 - u * 0.3);
      tmpPos.x += (Math.sin(elapsed * 37) + Math.sin(elapsed * 23)) * 0.5 * k;
      tmpPos.y += Math.sin(elapsed * 41) * k;
    }
    camera.position.copy(tmpPos);
    camera.lookAt(tmpLook);
    const fa = a.fov || camera.fov, fb = b.fov || fa;
    const fov = fa + (fb - fa) * e;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

    const tSec = Math.min(shot.seconds, shot.t * shot.seconds);
    if (shot.fadeIn) fade = Math.min(1, tSec / shot.fadeIn);
    if (shot.fadeOut) fade = Math.min(fade, Math.max(0, (shot.seconds - tSec) / shot.fadeOut));

    if (!shot.pingpong && shot.t >= 1 && !shot.done) {
      shot.done = true;
      const r = shot.resolve;
      shot.resolve = null;
      if (!shot.hold) shot = null;
      if (r) r();
    }
  }

  function startMove(from, to, def) {
    if (shot && shot.resolve) { const r = shot.resolve; shot.resolve = null; r(); } // supersede: the old move releases its waiter
    fadeTarget = 1; fadeSpeed = 0;
    if (def.fadeIn) fade = 0;
    return new Promise((resolve) => {
      shot = {
        from, to,
        seconds: Math.max(0.05, def.seconds || 4),
        ease: def.ease || 'inout',
        pingpong: !!def.pingpong,
        sway: def.sway || 0,
        shake: def.shake || 0,
        fadeIn: def.fadeIn || 0,
        fadeOut: def.fadeOut || 0,
        hold: def.hold !== false,
        t: 0,
        done: false,
        resolve
      };
      stepShot(0);
      if (shot && shot.pingpong) { const r = shot.resolve; shot.resolve = null; r(); }
    });
  }

  // A named shot of a room instance, in that room's frame.
  async function playShot(ref, name, { onStart = null } = {}) {
    if (destroyed) return;
    let inst = instOf(ref);
    if (!inst && typeof ref === 'string') inst = await preview(ref);
    if (!inst) throw new Error(`stage: no instance for ${ref}`);
    const def = inst.rec.shots && inst.rec.shots[name];
    if (!def) throw new Error(`stage: ${inst.key} has no shot "${name}"`);
    if (def.pos) {
      shot = null;
      applyPose(namedPose(inst, def));
      if (onStart) onStart();
      return;
    }
    const p = startMove(namedPose(inst, def.from), namedPose(inst, def.to), def);
    if (onStart) onStart();
    return p;
  }

  async function holdPose(ref, pose) {
    if (destroyed) return;
    let inst = instOf(ref);
    if (!inst && typeof ref === 'string') inst = await preview(ref);
    if (shot && shot.resolve) { const r = shot.resolve; shot.resolve = null; r(); }
    shot = null;
    fade = 1; fadeTarget = 1; fadeSpeed = 0;
    applyPose(namedPose(inst, pose));
  }

  // Ease the camera from where it is to `pose` ({pos, look, fov}, world
  // space unless `inst` is given, then in that room's frame).
  function carry(pose, { inst = null, seconds = 1.6, ease = 'inout', shake = 0, hold = true } = {}) {
    const to = inst ? world.poseToWorld(inst, pose) : pose;
    return startMove(currentPose(), to, { seconds, ease, shake, hold });
  }

  function releaseShot() { if (shot) { const r = shot.resolve; shot.resolve = null; shot = null; if (r) r(); } }

  // ---- per frame -----------------------------------------------------------

  function frame() {
    if (destroyed) return;
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    elapsed += dt;
    if (fadeSpeed > 0 && fade !== fadeTarget) {
      fade = fade < fadeTarget ? Math.min(fadeTarget, fade + fadeSpeed * dt) : Math.max(fadeTarget, fade - fadeSpeed * dt);
    }
    if (shot) stepShot(dt);
    else if (playerActive) player.update(dt);
    mats.update(dt);
    const pos = camera.position.toArray();
    const env = world.update(dt, elapsed, pos);
    scene.background.set(env.background);
    if (env.fog) { scene.fog.color.set(env.fog.color); scene.fog.near = env.fog.near; scene.fog.far = env.fog.far; } else { scene.fog.near = 400; scene.fog.far = 1200; }
    postMat.uniforms.uExposure.value = env.exposure;
    postMat.uniforms.uGrain.value = env.grain;
    postMat.uniforms.uVignette.value = env.vignette;
    for (const fn of frameHooks) fn(dt, elapsed);
    if (!world.instances().length) return;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    postMat.uniforms.uTime.value = elapsed;
    postMat.uniforms.uFade.value = fade;
    renderer.render(postScene, postCamera);
  }
  clock.getDelta();
  frame();

  // ---- screen space ---------------------------------------------------------------

  const corner = new THREE.Vector3();
  function screenRect(ref, propName = 'terminal') {
    const inst = instOf(ref);
    if (!inst) return null;
    const term = inst.room.named.get(propName);
    if (!term) return null;
    let screenMesh = null;
    term.traverse((o) => { if (!screenMesh && o.isMesh && o.userData.screen) screenMesh = o; });
    if (!screenMesh) return null;
    screenMesh.updateWorldMatrix(true, false);
    const bb = new THREE.Box3().setFromObject(screenMesh);
    let minX = 1, minY = 1, maxX = -1, maxY = -1;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).project(camera);
      minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
    }
    const x = (minX + 1) / 2, y = (1 - maxY) / 2;
    return { x, y, w: (maxX - minX) / 2, h: (maxY - minY) / 2 };
  }

  const _proj = new THREE.Vector3();
  function project(point) {
    _proj.set(point[0], point[1], point[2]);
    const camSpace = _proj.clone().applyMatrix4(camera.matrixWorldInverse);
    _proj.project(camera);
    return { x: (_proj.x + 1) / 2, y: (1 - _proj.y) / 2, behind: camSpace.z > 0 };
  }

  // ---- preview walk (rooms.html) ----------------------------------------------------

  async function walk(key) {
    const inst = await preview(key);
    const s = inst.room.spawn;
    shot = null;
    fade = 1; fadeTarget = 1; fadeSpeed = 0;
    camera.fov = WALK_FOV; camera.updateProjectionMatrix();
    player.teleport(s.x, inst.rec.floorY || 0, s.z, s.yaw);
    player.enable();
    playerActive = true;
    if (audio) audio.resumeIfSuspended();
    return inst;
  }

  return {
    ready: lib.ready,
    library: lib,
    world,
    player,
    camera,
    renderer,
    scene,
    mats,
    preview,
    prefetch(key) { if (rooms && rooms.rooms[key]) return world.prebuild(key).catch((e) => console.warn('stage: prefetch failed', key, e)); return Promise.resolve(); },
    playShot,
    holdPose,
    carry,
    releaseShot,
    walk,
    setPlayerActive(v) { playerActive = !!v; },
    isPlayerActive: () => playerActive,
    screenRect,
    project,
    onFrame(fn) { frameHooks.add(fn); return () => frameHooks.delete(fn); },
    currentKey() { const c = world.current(); return c ? c.key : null; },
    baseKey(key) { const rec = rooms && resolveRecord(rooms, key); return rec ? rec.base : key; },
    record(key) { return rooms ? resolveRecord(rooms, key) : null; },
    fadeTo(value, seconds) { setFade(value, seconds); return new Promise((r) => setTimeout(r, seconds * 1000)); },
    async blackout(seconds = 1.2) {
      playerActive = false;
      player.disable({ releasePointer: true });
      await this.fadeTo(0, seconds);
      releaseShot();
    },
    elapsed: () => elapsed,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      releaseShot();
      player.dispose();
      world.clear();
      window.removeEventListener('resize', resize);
      renderer.dispose();
      renderer.domElement.remove();
    },
    // Test hooks
    _debug() { return { current: world.currentKey ? world.currentKey() : (world.current() ? world.current().key : null), shot: shot ? { t: shot.t, pingpong: shot.pingpong } : null, fade, playerActive, camera: camera.position.toArray(), fov: camera.fov, world: world._debug(), target: [target.width, target.height] }; }
  };
}
