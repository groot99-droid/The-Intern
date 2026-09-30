// Doc 4 §5.1: two pooled <video> elements + crossfade, never created at
// runtime (Mobile Safari restriction) -- they live in index.html and are
// looked up here. Same public interface as the Phase 1 placeholder this
// file replaces, so router.js did not need to change:
//   createRenderer(container) -> { playEntry(entry, branchLetter, opts), playTransition(file), destroy() }
//
// Looping scene clips are IMG_IN->IMG_OUT interpolations, so a native
// `loop` snapped from the end frame straight back to the start frame every
// few seconds -- which read as the clip jumping backwards. Loops are now
// "soft": the same file is re-armed in the idle element as the active one
// nears its end and the two are crossfaded over the usual 400ms, so a
// looping room only ever moves forward and the seam is a dissolve.

const CROSSFADE_MS = 400;
const SOFT_LOOP_LEAD_S = 0.9; // start re-arming this far before the end

export function createRenderer(container) {
  const videoA = container.querySelector('#video-a');
  const videoB = container.querySelector('#video-b');
  const stillImg = container.querySelector('#still-img');

  let active = videoA;
  let hidden = videoB;
  let loopToken = 0; // bumps whenever a new clip starts; stale soft-loop handlers check it
  let destroyed = false;

  function hideStill() {
    stillImg.classList.remove('visible');
    stillImg.hidden = true;
  }

  async function crossfadeToVideo(file, { onStart } = {}) {
    // Doc 4 §8.2 cold start: if a still (e.g. S0's IMG_IN) is already up as
    // a stopgap, keep it visible through the load wait below and only swap
    // to video once it's actually ready to play -- not before.
    const myToken = ++loopToken;
    hidden.loop = false; // never native-loop (see header)
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
    if (myToken !== loopToken || destroyed) return null; // superseded while loading

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
    if (onStart) onStart();

    // Let the CSS opacity transition run its course before anything reads
    // "active" as fully settled (mirrors Doc 4 §5.1's 400ms crossfade).
    await new Promise((resolve) => setTimeout(resolve, CROSSFADE_MS));
    if (myToken === loopToken) hidden.pause();
    return active;
  }

  function armSoftLoop(el, file) {
    const token = loopToken;
    let rearmed = false;
    const onTime = () => {
      if (token !== loopToken || rearmed || destroyed) { el.removeEventListener('timeupdate', onTime); return; }
      if (!Number.isFinite(el.duration)) return;
      if (el.duration - el.currentTime <= SOFT_LOOP_LEAD_S) {
        rearmed = true;
        el.removeEventListener('timeupdate', onTime);
        crossfadeToVideo(file).then((nowActive) => {
          if (nowActive) armSoftLoop(nowActive, file);
        });
      }
    };
    el.addEventListener('timeupdate', onTime);
  }

  function showStill(file) {
    loopToken++; // cancels any soft loop in flight
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
      // destroy() must release anyone waiting here immediately -- the bail
      // path used to sit out the whole fallback deadline first.
      pendingWaits.add(finish);
    });
  }
  const pendingWaits = new Set();

  return {
    // Doc 4 §8.2 cold start: show a still immediately (no loader/spinner)
    // while the first real video streams in behind it. Only meaningful
    // before the very first crossfadeToVideo() of a session.
    primeStill(file) {
      showStill(file);
    },

    // opts.onStart fires the moment the clip becomes the visible layer
    // (router.js uses it to land a bed change on the cut, not after it).
    async playEntry(entry, _branchLetter, { onStart } = {}) {
      if (entry.type === 'still') {
        showStill(entry.file);
        if (onStart) onStart();
        return; // stills have no "ended" -- caller (router) controls advancement
      }
      const el = await crossfadeToVideo(entry.file, { onStart });
      if (!el) return;
      if (entry.loop) {
        armSoftLoop(el, entry.file);
        return; // looping video "never ends" -- router controls advancement
      }
      await waitForEnded(el);
    },

    async playTransition(file, { onStart } = {}) {
      const el = await crossfadeToVideo(file, { onStart });
      if (!el) return;
      await waitForEnded(el);
    },

    // Freeze whatever is playing on its current frame (used while the 3D
    // walk layer is up, so the video isn't burning decode time underneath).
    pause() { active.pause(); },
    resume() { if (active.src && active.currentTime < active.duration) active.play().catch(() => {}); },

    destroy() {
      destroyed = true;
      loopToken++;
      for (const finish of pendingWaits) finish();
      pendingWaits.clear();
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
