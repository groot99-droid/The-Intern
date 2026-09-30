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
//
// Token contract (the bug this closes): every crossfade takes a fresh
// `loopToken`; a crossfade that finds the token moved on at ANY of its await
// points -- load, play(), or the 400ms settle -- returns null and touches
// nothing, because the newer crossfade now owns both elements. The soft-loop
// handler is armed with the token of the crossfade that produced its element,
// never with whatever `loopToken` happens to be at arm time. Before this, a
// choice clicked inside a re-arm's 400ms settle made the re-arm hand its
// (already superseded) "active" element -- by then the TRANSITION clip -- to
// armSoftLoop, which read the transition's own token and so passed the
// guard: 0.9s before the transition ended, the old room loop was loaded over
// it, `ended` never fired, and the router sat out its fallback timer while
// the previous room played again. Reproducible in ~400ms/loop-length of
// clicks (≈7% on a 6s room, ≈19% on the 3s S4_C plate).
//
// playTransition(file, { startAt, stopAt }) plays a sub-range of a clip:
// router.js composes a render-flip transition out of the departure half of
// the current room's black-join clip and the arrival half of the other
// branch's (see router.js planTransition).

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
  let playbackRate = 1; // mini-games may slow/speed the room (MG-05 H's run); carried across soft-loop re-arms
  let held = false; // pause() was called and resume() hasn't: a soft-loop re-arm landing in between must not restart motion

  function hideStill() {
    stillImg.classList.remove('visible');
    stillImg.hidden = true;
  }

  // Resolves { el, token } once `file` is the visible layer, or null if a
  // newer crossfade (or destroy()) superseded this one at any await.
  // A load failure worth reacting to: aborted, network, decode. Not
  // MEDIA_ERR_SRC_NOT_SUPPORTED (4) -- a browser that cannot play the codec
  // will not be helped by a reload, and the pre-existing behaviour (play()
  // rejects, the hard fallback deadline releases the wait) stays for it.
  const isRetryableError = (el) => !!(el.error && el.error.code !== 4);

  // Wait for `el` to be playable, or to fail. Resolves 'ready' | 'error'
  // | 'timeout' -- the timeout keeps a slow-but-fine load from blocking the
  // whole game (canplaythrough is not prompt everywhere).
  function waitPlayable(el, ms) {
    return new Promise((resolve) => {
      let settled = false;
      let timer = null;
      const done = (how) => {
        if (settled) return;
        settled = true;
        el.removeEventListener('canplaythrough', onReady);
        el.removeEventListener('error', onError);
        if (timer !== null) clearTimeout(timer);
        resolve(how);
      };
      const onReady = () => done('ready');
      const onError = () => { if (isRetryableError(el)) done('error'); };
      if (el.readyState >= 4) { done('ready'); return; }
      el.addEventListener('canplaythrough', onReady, { once: true });
      el.addEventListener('error', onError, { once: true });
      timer = setTimeout(() => done('timeout'), ms);
    });
  }

  async function crossfadeToVideo(file, { onStart, startAt = 0, rearm = false, fallbackStill = null } = {}) {
    // Doc 4 §8.2 cold start: if a still (e.g. S0's IMG_IN) is already up as
    // a stopgap, keep it visible through the load wait below and only swap
    // to video once it's actually ready to play -- not before.
    const myToken = ++loopToken;
    if (!rearm) held = false; // a new clip (entry or transition) always moves; only a soft-loop re-arm inherits a hold
    hidden.loop = false; // never native-loop (see header)
    hidden.muted = true; // defensive; Doc 4 §8.3 strips audio from every source file anyway
    hidden.src = `./assets/vid/${file}`;
    hidden.load();

    let how = await waitPlayable(hidden, 2500);
    if (myToken !== loopToken || destroyed) return null; // superseded while loading
    if (how === 'error') {
      // A network/decode failure on the clip (the "failed connection" a
      // dropped range request or a stalled host produces). One reload,
      // then give up on the clip rather than sit black for 11 s: the room's
      // own still stands in and the router carries on.
      console.warn(`renderer.js: ${file} failed to load (${hidden.error && hidden.error.code}), retrying once`);
      hidden.load();
      how = await waitPlayable(hidden, 4000);
      if (myToken !== loopToken || destroyed) return null;
      if (how === 'error') {
        console.warn(`renderer.js: ${file} failed twice; standing in with ${fallbackStill || 'nothing'}`);
        if (fallbackStill) showStill(fallbackStill);
        return null;
      }
    }

    if (startAt > 0) {
      try { hidden.currentTime = startAt; } catch (e) { /* metadata not ready: play from 0 */ }
    }
    hidden.playbackRate = playbackRate;
    try {
      await hidden.play();
    } catch (e) {
      console.warn(`renderer.js: play() blocked for ${file}`, e);
    }
    // play() can sit pending on a slow load; a newer crossfade may have
    // re-pointed this same idle element at its own file in the meantime.
    if (myToken !== loopToken || destroyed) return null;
    // A hold (MG-05 H releasing inside a re-arm's 400ms) freezes the
    // incoming frame too, otherwise the room keeps moving after the hand
    // comes off.
    if (held) hidden.pause();

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
    // Superseded during the settle: the newer crossfade has already swapped
    // active/hidden, so `active` is ITS clip, not ours -- hand nothing back.
    if (myToken !== loopToken || destroyed) return null;
    hidden.pause();
    return { el: active, token: myToken };
  }

  function armSoftLoop(el, file, token) {
    let rearmed = false;
    const onTime = () => {
      if (token !== loopToken || rearmed || destroyed) { el.removeEventListener('timeupdate', onTime); return; }
      if (!Number.isFinite(el.duration)) return;
      if (el.duration - el.currentTime <= SOFT_LOOP_LEAD_S) {
        rearmed = true;
        el.removeEventListener('timeupdate', onTime);
        crossfadeToVideo(file, { rearm: true }).then((res) => {
          if (res) armSoftLoop(res.el, file, res.token);
        });
      }
    };
    el.addEventListener('timeupdate', onTime);
  }

  function showStill(file) {
    loopToken++; // cancels any soft loop in flight
    held = false;
    videoA.pause(); // a flip's still-cut must not leave the old room looping (hidden) underneath
    videoB.pause();
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
  //
  // opts.stopAt: treat the clip as ended once playback reaches this time (a
  // black-join's midpoint -- router.js's flip transitions) and freeze there.
  function waitForEnded(videoEl, { stopAt = null } = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        videoEl.removeEventListener('ended', onEnded);
        videoEl.removeEventListener('emptied', onEmptied);
        videoEl.removeEventListener('error', onError);
        videoEl.removeEventListener('timeupdate', onTime);
        clearTimeout(retryTimer);
        clearTimeout(fallbackTimer);
        pendingWaits.delete(finish);
        resolve();
      };
      const onEnded = () => finish();
      // The source was replaced underneath us (only a newer crossfade or
      // destroy() can do that): `ended` will never come, so release now
      // instead of sitting out the fallback deadline below. Same for a
      // mid-clip network/decode error.
      const onEmptied = () => finish();
      const onError = () => { if (isRetryableError(videoEl)) finish(); };
      const onTime = () => {
        if (stopAt !== null && videoEl.currentTime >= stopAt) {
          videoEl.pause();
          finish();
        }
      };
      videoEl.addEventListener('ended', onEnded, { once: true });
      videoEl.addEventListener('emptied', onEmptied, { once: true });
      videoEl.addEventListener('error', onError, { once: true });
      if (stopAt !== null) videoEl.addEventListener('timeupdate', onTime);

      const retryTimer = setTimeout(() => {
        if (!settled && videoEl.paused && !videoEl.ended) {
          videoEl.play().catch(() => {});
        }
      }, 500);

      const endS = stopAt !== null ? stopAt : videoEl.duration;
      const remainingMs = Number.isFinite(endS) && endS > 0 ? Math.max(0, endS - videoEl.currentTime) * 1000 : 8000;
      const fallbackTimer = setTimeout(finish, remainingMs + 3000);
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
    // opts.fallbackStill: shown instead if the clip cannot load (twice).
    async playEntry(entry, _branchLetter, { onStart, fallbackStill = null } = {}) {
      if (entry.type === 'still') {
        showStill(entry.file);
        if (onStart) onStart();
        return; // stills have no "ended" -- caller (router) controls advancement
      }
      const res = await crossfadeToVideo(entry.file, { onStart, fallbackStill });
      if (!res) { if (onStart && stillImg.src && !stillImg.hidden) onStart(); return; }
      if (entry.loop) {
        armSoftLoop(res.el, entry.file, res.token);
        return; // looping video "never ends" -- router controls advancement
      }
      await waitForEnded(res.el);
    },

    // startAt/stopAt (seconds) play a sub-range: router.js's flip
    // transitions use the departure half [0, split] of one black-join clip
    // and the arrival half [split, end] of another.
    async playTransition(file, { onStart, startAt = 0, stopAt = null, fallbackStill = null } = {}) {
      const res = await crossfadeToVideo(file, { onStart, startAt, fallbackStill });
      if (!res) return;
      await waitForEnded(res.el, { stopAt });
    },

    // Freeze whatever is playing on its current frame (used while the 3D
    // walk layer is up, so the video isn't burning decode time underneath;
    // and by MG-05 H, where the garage only moves while the player runs).
    pause() { held = true; active.pause(); hidden.pause(); },
    resume() { held = false; if (active.src && active.currentTime < active.duration) active.play().catch(() => {}); },
    isPaused() { return active.paused; },

    // Playback speed of the visible clip (and of every clip that follows
    // until reset): MG-05 H's run slows as stamina drains. Clamped so the
    // soft-loop's 0.9s media lead always stays longer than the 400ms
    // wall-clock crossfade (at 0.5x the lead is 1.8s; at 2x it is 0.45s).
    setPlaybackRate(rate) {
      playbackRate = Math.min(2, Math.max(0.5, Number.isFinite(rate) ? rate : 1));
      videoA.playbackRate = playbackRate;
      videoB.playbackRate = playbackRate;
    },

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
