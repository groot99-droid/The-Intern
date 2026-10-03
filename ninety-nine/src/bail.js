// Doc 4 §9: the global accessibility exit, present in every scene and every
// mini-game. "Quitting is an ending, not an exit" -- the player who leaves
// is filed as PENDING REVIEW, which is exactly what that ending means. This
// is the ONE persistent non-diegetic UI element in the entire game (Doc 4
// §14), deliberately styled as a fire exit sign rather than a generic
// button.
//
// Doc 4 §13: touch long-press requires 1200ms AND 3+ fingers specifically
// so it never collides with walking (one thumb) and looking (the other).
//
// Escape no longer bails: the candidate is always walking, and Escape is
// the browser's own "release the mouse" key under pointer lock. Once the
// pointer is released, EXIT is a click away.

const LONG_PRESS_MS = 1200;
const LONG_PRESS_MIN_TOUCHES = 3;

export function initBail(director) {
  const affordance = document.createElement('button');
  affordance.id = 'bail-affordance';
  affordance.type = 'button';
  affordance.setAttribute('aria-label', 'Exit');
  affordance.textContent = 'EXIT';
  document.body.appendChild(affordance);

  affordance.addEventListener('click', () => director.bail());

  let touchTimer = null;
  const clearTouchTimer = () => {
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
  };

  document.addEventListener('touchstart', (e) => {
    clearTouchTimer();
    if (e.touches.length >= LONG_PRESS_MIN_TOUCHES) {
      touchTimer = setTimeout(() => director.bail(), LONG_PRESS_MS);
    }
  }, { passive: true });
  document.addEventListener('touchend', clearTouchTimer, { passive: true });
  document.addEventListener('touchcancel', clearTouchTimer, { passive: true });
  document.addEventListener('touchmove', clearTouchTimer, { passive: true });

  return {
    destroy() {
      affordance.remove();
    }
  };
}
