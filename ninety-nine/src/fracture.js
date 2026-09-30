// Doc 4 §5.2: three layers driven by fracture() (Doc 1 §2.3), all capped so
// the effect reads as smooth wrongness, never a glitch (Doc 1 C1, Doc 2 §4).
//
// The anomaly sprite is "a single paper slip reading 99, lying at the same
// screen coordinate in both renders" (Doc 4 §5.2 / Doc 1 §9.2). No
// standalone image asset for it was generated (it's not in MANIFEST.csv) --
// but it doesn't need to be: Doc 1 §6.1 already lists "99" as engine-
// rendered text ("Slip: 99"), same as every other in-world string. Because
// it's a fixed CSS-positioned overlay rather than something composited into
// the video, "same coordinate in both renders" is automatically true.

const TEXTURE_BLEED_CAP = 0.22; // Doc 4 §5.2: "Cap texture bleed at 0.22. Above that it reads as a glitch effect."
const CHROMA_DRIFT_MAX_DEG = 4;
const ANOMALY_VISIBLE_THRESHOLD = 0.05;
const ANOMALY_POSITION = { x: '8%', y: '85%' }; // fixed across all scenes/branches by construction

export function createFractureOverlay(sceneContainer) {
  const bleed = document.createElement('div');
  bleed.className = 'fracture-bleed';
  const anomaly = document.createElement('div');
  anomaly.className = 'fracture-anomaly';
  anomaly.textContent = '99';
  anomaly.style.left = ANOMALY_POSITION.x;
  anomaly.style.top = ANOMALY_POSITION.y;
  sceneContainer.append(bleed, anomaly);

  return {
    // fractureValue: 0..1 (Doc 1 §2.3). oppositeImgIn: the OTHER render's
    // IMG_IN filename for this scene (null for S0, which has no C/H split).
    apply(fractureValue, oppositeImgIn) {
      const f = Math.min(1, Math.max(0, fractureValue));

      if (oppositeImgIn) {
        bleed.style.backgroundImage = `url("./assets/img/${oppositeImgIn}")`;
        bleed.style.opacity = String(f * TEXTURE_BLEED_CAP);
      } else {
        bleed.style.opacity = '0';
      }

      sceneContainer.style.setProperty('--chroma-drift', `${f * CHROMA_DRIFT_MAX_DEG}deg`);

      anomaly.style.opacity = f > ANOMALY_VISIBLE_THRESHOLD ? String(Math.min(1, f)) : '0';
    },
    destroy() {
      bleed.remove();
      anomaly.remove();
    }
  };
}
