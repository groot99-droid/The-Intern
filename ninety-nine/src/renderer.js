// Doc 4 §5.1: two pooled <video> elements + crossfade, never created at
// runtime (Mobile Safari restriction) -- they live in index.html and are
// looked up here. Same public interface as the Phase 1 placeholder this
// file replaces, so router.js did not need to change:
//   createRenderer(container) -> { playEntry(entry, branchLetter), playTransition(file), destroy() }

const CROSSFADE_MS = 400;

export function createRenderer(container) {
  const videoA = container.querySelector('#video-a');
  const videoB = container.querySelector('#video-b');
  const stillImg = container.querySelector('#still-img');

  let active = videoA;
  let hidden = videoB;

  function hideStill() {
    stillImg.classList.remove('visible');
    stillImg.hidden = true;
  }

  async function crossfadeToVideo(file, { loop }) {
    // Doc 4 §8.2 cold start: if a still (e.g. S0's IMG_IN) is already up as
    // a stopgap, keep it visible through the load wait below and only swap
    // to video once it's actually ready to play -- not before.
    hidden.loop = !!loop;
    hidden.muted = true; // defensive; Doc 4 §8.3 strips audio from every source file anyway
    hidden.src = `./assets/vid/${file}`;
    hidden.load();

    await new Promise((resolve) => {
      let settled = false;
      const onReady = () => {
        if (settled) return;
        settled = true;
        hidden.removeEventListener('canplaythrough', onReady);
        resolve();
      };
      hidden.addEventListener('canplaythrough', onReady, { once: true });
      // Some browsers/containers don't fire canplaythrough promptly; don't
      // block the whole game on it.
      setTimeout(onReady, 2500);
    });

    try {
      await hidden.play();
    } catch (e) {
      console.warn(`renderer.js: play() blocked for ${file}`, e);
    }

    hideStill();
    hidden.classList.add('visible');
    active.classList.remove('visible');

    const prevActive = active;
    active = hidden;
    hidden = prevActive;

    // Let the CSS opacity transition run its course before anything reads
    // "active" as fully settled (mirrors Doc 4 §5.1's 400ms crossfade).
    await new Promise((resolve) => setTimeout(resolve, CROSSFADE_MS));
    hidden.pause();
  }

  function showStill(file) {
    videoA.classList.remove('visible');
    videoB.classList.remove('visible');
    stillImg.src = `./assets/img/${file}`;
    stillImg.hidden = false;
    // Force layout before adding the class so the opacity transition runs.
    void stillImg.offsetWidth;
    stillImg.classList.add('visible');
  }

  // Guaranteed exit even if 'ended' never fires -- e.g. play() was silently
  // rejected (autoplay policy) and left the element paused at currentTime 0.
  // Retries play() once mid-wait, and always resolves by a hard fallback
  // deadline so the router can never hang forever on a stuck video.
  function waitForEnded(videoEl) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        videoEl.removeEventListener('ended', onEnded);
        clearTimeout(retryTimer);
        clearTimeout(fallbackTimer);
        resolve();
      };
      const onEnded = () => finish();
      videoEl.addEventListener('ended', onEnded, { once: true });

      const retryTimer = setTimeout(() => {
        if (!settled && videoEl.paused && !videoEl.ended) {
          videoEl.play().catch(() => {});
        }
      }, 500);

      const durationMs = Number.isFinite(videoEl.duration) && videoEl.duration > 0 ? videoEl.duration * 1000 : 8000;
      const fallbackTimer = setTimeout(finish, durationMs + 3000);
    });
  }

  return {
    // Doc 4 §8.2 cold start: show a still immediately (no loader/spinner)
    // while the first real video streams in behind it. Only meaningful
    // before the very first crossfadeToVideo() of a session.
    primeStill(file) {
      showStill(file);
    },

    async playEntry(entry, _branchLetter) {
      if (entry.type === 'still') {
        showStill(entry.file);
        return; // stills have no "ended" -- caller (router) controls advancement
      }
      await crossfadeToVideo(entry.file, { loop: entry.loop });
      if (entry.loop) return; // looping video "never ends" -- router controls advancement
      await waitForEnded(active);
    },

    async playTransition(file) {
      await crossfadeToVideo(file, { loop: false });
      await waitForEnded(active);
    },

    destroy() {
      videoA.pause();
      videoB.pause();
      videoA.removeAttribute('src');
      videoB.removeAttribute('src');
      videoA.classList.remove('visible');
      videoB.classList.remove('visible');
      hideStill();
    }
  };
}
