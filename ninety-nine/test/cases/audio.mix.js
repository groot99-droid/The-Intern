// Mix pass: every bed and one-shot is trimmed toward a common level, the
// bus gains are sane, and the music engine knows every mood scenes.json
// asks for. Pure-function checks -- no AudioContext is created here (that
// needs a gesture; audio.drone.js covers the context path).

import { runCase, assert, assertEqual } from '../harness.js';
import { ambienceTrimFor, sfxTrimFor, DRONE_GAIN } from '../../src/audio.js';

export async function run() {
  await runCase('Mix: ambience trims pull the 17 dB bed spread into a 6 dB window (capped boost)', async () => {
    const res = await fetch('../assets/aud/_MANIFEST.csv');
    const rows = (await res.text()).trim().split('\n').slice(1).map((l) => l.split(','));
    const beds = rows.filter((r) => r[0].includes('_AMB'));
    assert(beds.length >= 18, `expected the 18 beds in _MANIFEST.csv, got ${beds.length}`);
    const outLevels = beds.map((r) => parseFloat(r[5]) + 20 * Math.log10(ambienceTrimFor(`${r[0]}.wav`)));
    const spread = Math.max(...outLevels) - Math.min(...outLevels);
    assert(spread <= 7.5, `post-trim loudness spread ${spread.toFixed(1)} dB (raw was ~17.3)`);
    for (const r of beds) assert(ambienceTrimFor(`${r[0]}.wav`) <= 2.0, `${r[0]} boost exceeds +6 dB`);
  });

  await runCase('Mix: one-shot trims bring the stapler down and the keyboard/footsteps up', () => {
    assert(sfxTrimFor('S5_C_SFX_STAPLER.wav') < 0.6, 'stapler (-1.8 dBFS) should be attenuated');
    assert(sfxTrimFor('S6_C_SFX_KEYBOARD.wav') > 4, 'keyboard (-22.4 dBFS) should be boosted');
    assert(sfxTrimFor('S4_H_SFX_FOOTSTEPS.wav') > 4, 'footsteps (-21.4 dBFS) should be boosted');
    assertEqual(sfxTrimFor('nonexistent.wav'), 1, 'unknown file = unity');
  });

  await runCase('Mix: drone gain unchanged from Doc 4 §7.1 (0.06)', () => {
    assertEqual(DRONE_GAIN, 0.06);
  });

  await runCase('Music: every mood referenced by scenes.json is a known preset or null', async () => {
    const [{ createMusic }, scenes] = await Promise.all([import('../../src/music.js'), fetch('../data/scenes.json').then((r) => r.json())]);
    // A stub context is enough to read presets; nothing is scheduled until start()+setMood().
    const stub = { sampleRate: 48000, currentTime: 0, createGain() { return { gain: { value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() { return this; }, disconnect() {} }; } };
    const music = createMusic(stub, stub.createGain());
    const known = new Set(music.presets);
    for (const [id, scene] of Object.entries(scenes.scenes)) {
      const moods = [scene.music, ...Object.values(scene.branches).map((b) => b.music)].filter((m) => m !== undefined && m !== null);
      for (const m of moods) {
        const name = typeof m === 'string' ? m : m.mood;
        if (name) assert(known.has(name), `${id}: unknown music mood "${name}"`);
      }
    }
    assert(music.currentKey() === null, 'no mood before start()');
    music.setMood('pad', 'C');
    assert(music.currentKey() === null, 'setMood is a no-op before start() (Doc 4 §7.4: nothing before the gesture)');
  });
}
