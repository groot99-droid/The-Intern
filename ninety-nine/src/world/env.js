// A room's atmosphere (room.js `env`, carried into world space by
// world.js) and the blend between two of them. Pure: test-friendly.
//
// Inside a room the stage uses that room's env. Inside a connector it
// blends the room behind into the room ahead by how far along the
// connector the player is, so night turns to dawn on the stairs and the
// lobby's light comes up as the street's goes down -- without a fade.

import * as THREE from '../../vendor/three/three.module.js';

const _a = new THREE.Color();
const _b = new THREE.Color();

function mixColor(ca, cb, t) {
  _a.set(ca || '#000000');
  _b.set(cb || '#000000');
  return '#' + _a.lerp(_b, t).getHexString();
}
const mix = (a, b, t) => a + (b - a) * t;

export const BLACK_ENV = {
  ambient: { color: '#000000', intensity: 0 },
  hemisphere: null,
  sun: null,
  sunDir: [0, -1, 0],
  fog: { color: '#000000', near: 1, far: 40 },
  background: '#000000',
  exposure: 1,
  grain: 0.03,
  vignette: 0.55,
  shadowExtent: 12
};

function fogOf(env) {
  return env.fog || { color: env.background || '#000000', near: 400, far: 1200 };
}

// t = 0 -> a, t = 1 -> b. Missing pieces blend from/to nothing.
export function blendEnv(a, b, t) {
  if (!a) return b;
  if (!b || t <= 0) return a;
  if (t >= 1) return b;
  const fa = fogOf(a), fb = fogOf(b);
  const ha = a.hemisphere || { sky: '#000000', ground: '#000000', intensity: 0 };
  const hb = b.hemisphere || { sky: '#000000', ground: '#000000', intensity: 0 };
  const sa = a.sun || { color: '#000000', intensity: 0 };
  const sb = b.sun || { color: '#000000', intensity: 0 };
  const da = a.sunDir || [0, -1, 0], db = b.sunDir || [0, -1, 0];
  const d = [mix(da[0], db[0], t), mix(da[1], db[1], t), mix(da[2], db[2], t)];
  const dl = Math.hypot(d[0], d[1], d[2]) || 1;
  return {
    ambient: { color: mixColor(a.ambient.color, b.ambient.color, t), intensity: mix(a.ambient.intensity, b.ambient.intensity, t) },
    hemisphere: { sky: mixColor(ha.sky, hb.sky, t), ground: mixColor(ha.ground, hb.ground, t), intensity: mix(ha.intensity, hb.intensity, t) },
    sun: { color: mixColor(sa.color, sb.color, t), intensity: mix(sa.intensity, sb.intensity, t) },
    sunDir: [d[0] / dl, d[1] / dl, d[2] / dl],
    fog: { color: mixColor(fa.color, fb.color, t), near: mix(fa.near, fb.near, t), far: mix(fa.far, fb.far, t) },
    background: mixColor(a.background, b.background, t),
    exposure: mix(a.exposure, b.exposure, t),
    grain: mix(a.grain, b.grain, t),
    vignette: mix(a.vignette, b.vignette, t),
    shadowExtent: mix(a.shadowExtent || 12, b.shadowExtent || 12, t)
  };
}
