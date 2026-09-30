// Doc 4 §5.3 / Doc 2 §5 (S2): 4-frame NPC jaw fallback, used only if Kling
// cannot hold the hard jaw snap. Built per Doc 4's explicit Phase 3
// instruction ("build this module regardless") but DORMANT by default --
// the delivered S2_C_VID.mp4 / S2_H_VID.mp4 already contain the single
// discrete jaw snap and were accepted on review (README). Toggle via
// scenes.json's `flipbookFallback.active` flag if that ever changes.
//
// Only two endpoint stills (imgIn/imgOut) were generated for S2, not four
// intermediate frames -- Doc 3's "generate 4 stills and flipbook them"
// fallback was never triggered. This module accepts an arbitrary frame
// list so it's ready if that's needed later, and is usable today as a
// discrete closed/open jaw toggle between the two delivered stills.

export function createFlipbook(container, frames, { base = './assets/img/', stepMs = 90 } = {}) {
  const img = document.createElement('img');
  img.className = 'flipbook-frame';
  img.style.imageRendering = 'pixelated';
  container.appendChild(img);

  let timer = null;
  let frameIndex = 0;

  function showFrame(i) {
    img.src = `${base}${frames[i]}`;
  }

  return {
    play() {
      frameIndex = 0;
      showFrame(0);
      timer = setInterval(() => {
        frameIndex = (frameIndex + 1) % frames.length;
        showFrame(frameIndex);
      }, stepMs);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    destroy() {
      this.stop();
      if (img.parentNode) img.parentNode.removeChild(img);
    }
  };
}
