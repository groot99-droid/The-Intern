// First-person controls for the walkable rooms, ported from the
// Earth_Worldbuild museum walkthrough (_Museum/web/js/controls.js +
// touch.js) and trimmed to what a single closed room needs: WASD / arrows
// to walk, pointer-lock or click-drag to look, two axis-separated raycasts
// against the wall list so the player slides along walls, a downward ray
// for the floor. Touch: left half joystick, right half drag-to-look.

import * as THREE from '../../vendor/three/three.module.js';

export const EYE_HEIGHT = 1.6;
const MOVE_SPEED = 2.6; // m/s -- slower than the museum's 4.2: this is an intern, not a tourist
const COLLIDE_RADIUS = 0.35;
const STEP_UP = 0.4;
const STEP_DOWN = 1.0;
const LOOK_SENS = 0.0022;
const DOWN = new THREE.Vector3(0, -1, 0);

function isEditable(t) {
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export function createControls(camera, domElement, getCollidables) {
  const keys = { forward: false, back: false, left: false, right: false };
  const axis = { x: 0, y: 0 };
  let yaw = 0;
  let pitch = 0;
  let pointerLocked = false;
  let dragLooking = false;
  let lastPointerType = 'mouse';
  let moved = 0; // metres walked this frame (footstep cadence)
  let eyeOffset = 0; // head-bob (walk.js), added on top of EYE_HEIGHT wherever the floor sets y

  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const raycaster = new THREE.Raycaster();
  const forwardVec = new THREE.Vector3();
  const rightVec = new THREE.Vector3();
  const moveVec = new THREE.Vector3();
  const rayOrigin = new THREE.Vector3();
  const axisDir = new THREE.Vector3();

  function onKeyDown(e) {
    if (isEditable(e.target)) return;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': keys.forward = true; break;
      case 'KeyS': case 'ArrowDown': keys.back = true; break;
      case 'KeyA': case 'ArrowLeft': keys.left = true; break;
      case 'KeyD': case 'ArrowRight': keys.right = true; break;
      default: return;
    }
    e.preventDefault();
  }
  function onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': keys.forward = false; break;
      case 'KeyS': case 'ArrowDown': keys.back = false; break;
      case 'KeyA': case 'ArrowLeft': keys.left = false; break;
      case 'KeyD': case 'ArrowRight': keys.right = false; break;
      default: break;
    }
  }
  function rotateRadians(dYaw, dPitch) {
    yaw -= dYaw;
    pitch -= dPitch;
    pitch = Math.max(-Math.PI / 2 + 0.08, Math.min(Math.PI / 2 - 0.08, pitch));
    euler.set(pitch, yaw, 0);
    camera.quaternion.setFromEuler(euler);
  }
  function onMouseMove(e) {
    if (pointerLocked || dragLooking) rotateRadians((e.movementX || 0) * LOOK_SENS, (e.movementY || 0) * LOOK_SENS);
  }
  function onLockChange() { pointerLocked = document.pointerLockElement === domElement; }
  function onPointerDown(e) {
    lastPointerType = e.pointerType || 'mouse';
    if (e.button !== 0 || lastPointerType === 'touch') return;
    if (!pointerLocked) dragLooking = true;
  }
  function onPointerUp() { dragLooking = false; }
  function requestLock() {
    if (lastPointerType === 'touch') return;
    const p = domElement.requestPointerLock && domElement.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }
  function onClick() { requestLock(); }

  domElement.addEventListener('click', onClick);
  domElement.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);

  function blocked(origin, dir, dist, walls) {
    if (dist <= 0 || !walls.length) return false;
    raycaster.set(origin, dir);
    raycaster.far = dist;
    const hits = raycaster.intersectObjects(walls, false);
    return hits.length > 0 && hits[0].distance < dist;
  }

  function tryMove(delta) {
    const len = moveVec.length();
    if (len === 0) return;
    if (len > 1) moveVec.divideScalar(len);
    moveVec.multiplyScalar(MOVE_SPEED * delta);
    const { walls } = getCollidables();
    const rayY = camera.position.y - EYE_HEIGHT - eyeOffset + 1.0;
    let dx = 0, dz = 0;
    if (Math.abs(moveVec.x) > 0) {
      rayOrigin.set(camera.position.x, rayY, camera.position.z);
      axisDir.set(Math.sign(moveVec.x), 0, 0);
      if (!blocked(rayOrigin, axisDir, Math.abs(moveVec.x) + COLLIDE_RADIUS, walls)) dx = moveVec.x;
    }
    if (Math.abs(moveVec.z) > 0) {
      rayOrigin.set(camera.position.x + dx, rayY, camera.position.z);
      axisDir.set(0, 0, Math.sign(moveVec.z));
      if (!blocked(rayOrigin, axisDir, Math.abs(moveVec.z) + COLLIDE_RADIUS, walls)) dz = moveVec.z;
    }
    camera.position.x += dx;
    camera.position.z += dz;
    moved = Math.hypot(dx, dz);
  }

  function followFloor() {
    const { floors } = getCollidables();
    if (!floors || floors.length === 0) return;
    const feetY = camera.position.y - EYE_HEIGHT - eyeOffset;
    rayOrigin.set(camera.position.x, feetY + STEP_UP, camera.position.z);
    raycaster.set(rayOrigin, DOWN);
    raycaster.far = STEP_UP + STEP_DOWN;
    const hits = raycaster.intersectObjects(floors, false);
    if (hits.length > 0) camera.position.y = hits[0].point.y + EYE_HEIGHT + eyeOffset;
  }
  // Smoothed toward `target` so the bob eases in and out with the stride
  // instead of snapping when a key is released.
  function setEyeOffset(target, delta) {
    const k = Math.min(1, (delta || 0.016) * 10);
    eyeOffset += (target - eyeOffset) * k;
  }

  function update(delta) {
    moved = 0;
    camera.getWorldDirection(forwardVec);
    forwardVec.y = 0;
    forwardVec.normalize();
    rightVec.crossVectors(forwardVec, camera.up).normalize();
    moveVec.set(0, 0, 0);
    if (keys.forward) moveVec.add(forwardVec);
    if (keys.back) moveVec.sub(forwardVec);
    if (keys.right) moveVec.add(rightVec);
    if (keys.left) moveVec.sub(rightVec);
    if (axis.x || axis.y) {
      moveVec.addScaledVector(forwardVec, axis.y);
      moveVec.addScaledVector(rightVec, axis.x);
    }
    tryMove(delta);
    followFloor();
  }

  function setLook(y, p = 0) {
    yaw = y;
    pitch = p;
    euler.set(pitch, yaw, 0);
    camera.quaternion.setFromEuler(euler);
  }
  function setMoveAxis(x, y) {
    const len = Math.hypot(x, y);
    const s = len > 1 ? 1 / len : 1;
    axis.x = x * s;
    axis.y = y * s;
  }
  function teleport(x, z, yawDeg) {
    camera.position.set(x, EYE_HEIGHT, z);
    setLook(THREE.MathUtils.degToRad(yawDeg || 0), 0);
    followFloor();
  }
  function release() {
    if (pointerLocked && document.exitPointerLock) document.exitPointerLock();
  }
  function dispose() {
    release();
    domElement.removeEventListener('click', onClick);
    domElement.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointerlockchange', onLockChange);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousemove', onMouseMove);
  }

  return {
    update, setLook, setMoveAxis, teleport, release, dispose, rotateRadians, setEyeOffset,
    movedThisFrame: () => moved,
    isPointerLocked: () => pointerLocked,
    state: () => ({ position: camera.position.toArray(), yaw, pitch })
  };
}

// Touch: left half of the layer is a virtual joystick, right half drags to look.
export function createTouchControls({ domElement, overlay, controls }) {
  const enabled = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
  if (!enabled) return { enabled: false, dispose() {} };

  const joy = document.createElement('div');
  joy.className = 'walk-joystick';
  joy.innerHTML = '<div class="knob"></div>';
  overlay.appendChild(joy);
  const knob = joy.querySelector('.knob');

  const RADIUS = 50;
  const LOOK_GAIN = 0.0045;
  let movePointer = null, lookPointer = null;
  let moveStart = null, lookLast = null;

  function setKnob(dx, dy) { knob.style.transform = `translate(${dx}px, ${dy}px)`; }

  function onDown(e) {
    if (e.pointerType !== 'touch') return;
    if (e.clientX < window.innerWidth / 2 && movePointer === null) {
      movePointer = e.pointerId;
      moveStart = { x: e.clientX, y: e.clientY };
    } else if (lookPointer === null) {
      lookPointer = e.pointerId;
      lookLast = { x: e.clientX, y: e.clientY };
    } else return;
    try { domElement.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  }
  function onMove(e) {
    if (e.pointerId === movePointer) {
      let dx = (e.clientX - moveStart.x) / RADIUS;
      let dy = -(e.clientY - moveStart.y) / RADIUS;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      controls.setMoveAxis(dx, dy);
      setKnob(dx * RADIUS * 0.8, -dy * RADIUS * 0.8);
    } else if (e.pointerId === lookPointer) {
      controls.rotateRadians((e.clientX - lookLast.x) * LOOK_GAIN, (e.clientY - lookLast.y) * LOOK_GAIN);
      lookLast = { x: e.clientX, y: e.clientY };
    }
  }
  function onUp(e) {
    if (e.pointerId === movePointer) {
      movePointer = null;
      controls.setMoveAxis(0, 0);
      setKnob(0, 0);
    } else if (e.pointerId === lookPointer) {
      lookPointer = null;
    }
  }
  domElement.addEventListener('pointerdown', onDown);
  domElement.addEventListener('pointermove', onMove);
  domElement.addEventListener('pointerup', onUp);
  domElement.addEventListener('pointercancel', onUp);

  return {
    enabled: true,
    dispose() {
      domElement.removeEventListener('pointerdown', onDown);
      domElement.removeEventListener('pointermove', onMove);
      domElement.removeEventListener('pointerup', onUp);
      domElement.removeEventListener('pointercancel', onUp);
      joy.remove();
    }
  };
}
