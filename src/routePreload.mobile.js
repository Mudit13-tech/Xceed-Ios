/**
 * Route preloading, on a touch screen.
 *
 * Only the listener changes. `lazyWithPreload`, `registerRouteTree` and
 * `preloadPath` are AMS's and are re-exported untouched below -- the registry,
 * the matching and the memoised import are all theirs, and all correct here.
 * What does not survive the move to a phone is the event the whole thing hangs
 * off.
 *
 * Why `pointerover` had to go
 * ---------------------------
 * Upstream listens for `pointerover`, and on a desktop that is exactly right: a
 * mouse arriving over a link precedes the click by a few hundred milliseconds
 * and means nothing else. On iOS there is no hover. The same event fires when a
 * finger lands, and again for whatever passes under the finger while a list is
 * being dragged -- so a scroll through a dashboard is a stream of pointerover
 * events naming links the user is moving *away* from. Each one cost:
 *
 *  - a walk of the whole route registry (some 270 entries, each compiling a
 *    path pattern into a RegExp) on the main thread, inside the frame the
 *    browser was trying to scroll; and
 *
 *  - an actual chunk download for a page nobody opened. That is the expensive
 *    half. These chunks are not uniform -- the certificate renderer alone is
 *    5.1 MB -- so brushing past one link during a scroll could commit the phone
 *    to megabytes of speculative transfer, over the same connection the screen
 *    the user is *looking at* needs for its own API calls. The preloader was
 *    making the current page slower in order to speed up a page nobody asked
 *    for.
 *
 * What replaces it
 * ----------------
 * `touchstart`, qualified by what the touch turns out to be. A finger going
 * down on a link is a good prediction; a finger going down and then travelling
 * is a scroll and predicts nothing. So the match is deferred a beat, and
 * dropped if the touch moved in the meantime. A tap still gets its head start
 * -- touchstart leads the click by roughly a tenth of a second, which is most
 * of a chunk fetch on wifi -- and a scroll now costs nothing at all.
 *
 * `focusin` is kept exactly as upstream has it: an external keyboard and
 * VoiceOver both drive focus, and neither fires during a scroll.
 *
 * See build/mobileOverrides.js. `npm run drift` reports what AMS has changed in
 * src/routePreload.js since.
 */
import { useEffect } from 'react';

import { preloadPath } from './routePreload';

export {
  lazyWithPreload,
  registerRouteTree,
  preloadPath,
  __resetPreloadRegistry,
} from './routePreload';

// Pathnames already handled, so a list scrolled past twice does not re-match
// the registry. Upstream keeps the same set for the same reason.
const seen = new Set();

// How far a finger may travel and still be a tap. Below the platform's own
// scroll threshold, so anything this rejects the browser was going to treat as
// a drag anyway.
const TAP_SLOP_PX = 10;

// A link worth predicting: one this router will handle, opened in this tab.
// Kept in step with the upstream version deliberately -- it is the same
// question, and the answer does not depend on the input device.
function targetPath(link) {
  if (!link || link.target === '_blank' || link.hasAttribute('download')) return null;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null;
  }
  let url;
  try {
    url = new URL(link.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname) return null;
  return url.pathname;
}

/**
 * Metered or 2G connections are the ones splitting was for. Guessing wrong
 * there costs the user data they did not ask to spend.
 *
 * navigator.connection does not exist in WKWebView at all, so on iOS this is
 * always the permissive branch -- which is the honest answer, not a bug: the
 * app has no way to ask, and refusing to preload on every iPhone because one
 * API is missing would be the worse guess.
 */
function connectionAllowsPreload() {
  const connection = navigator.connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return !/(^|-)2g$/.test(connection.effectiveType || '');
}

/** Runs `task` off the current frame, but soon -- a tap is only ~100ms away. */
function soon(task) {
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(task, { timeout: 60 });
  }
  return window.setTimeout(task, 0);
}

export function useLinkPreloading() {
  useEffect(() => {
    if (!connectionAllowsPreload()) return undefined;

    // The touch currently in progress, if it still looks like a tap.
    let pending = null;

    const start = (pathname) => {
      if (!pathname || seen.has(pathname)) return;
      seen.add(pathname);
      preloadPath(pathname);
    };

    const onTouchStart = (event) => {
      const touch = event.touches && event.touches[0];
      const link = event.target?.closest?.('a[href]');
      if (!touch || !link) return;

      const pathname = targetPath(link);
      if (!pathname || seen.has(pathname)) return;

      const candidate = { pathname, x: touch.clientX, y: touch.clientY, moved: false };
      pending = candidate;

      // Deferred rather than done here: the registry walk is the work this
      // override exists to keep out of the scroll frame, and waiting also
      // leaves onTouchMove a window in which to call this off.
      soon(() => {
        if (pending !== candidate || candidate.moved) return;
        pending = null;
        start(pathname);
      });
    };

    const onTouchMove = (event) => {
      if (!pending) return;
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      const travelled =
        Math.abs(touch.clientX - pending.x) + Math.abs(touch.clientY - pending.y);
      // A scroll. Whatever was under the finger when it landed is not where it
      // is going.
      if (travelled > TAP_SLOP_PX) {
        pending.moved = true;
        pending = null;
      }
    };

    const onTouchEnd = () => { pending = null; };

    const onFocus = (event) => {
      const link = event.target?.closest?.('a[href]');
      if (link) start(targetPath(link));
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('focusin', onFocus);
    };
  }, []);
}
