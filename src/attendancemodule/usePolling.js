import { useEffect, useRef } from 'react';

/**
 * setInterval for things that talk to the server, with the two guards a bare
 * setInterval does not have.
 *
 * Every polling page in this module was written as
 *
 *     useEffect(() => {
 *       load();
 *       const id = setInterval(load, MS);
 *       return () => clearInterval(id);
 *     }, [load]);
 *
 * which has two problems that only show up in the aggregate.
 *
 * It never stops. A dashboard left open in a background tab — which is what
 * happens to a dashboard — keeps polling for as long as the browser is running.
 * Across the module that was a request every 2s (server metrics), 4s
 * (recordings), 5s (ML health), 8s, 15s and 30s, per open tab, forever, for a
 * page nobody is looking at. Pausing on `document.hidden` costs nothing and
 * gives all of it back; the poll fires immediately on return so the first thing
 * a returning user sees is fresh rather than however stale the tab went.
 *
 * And it can stack. setInterval does not care whether the previous callback has
 * finished, so any poll slower than its own interval overlaps itself — the 2s
 * metrics poll against a server slow enough to be worth watching is exactly the
 * case where piling on more requests is worst. The in-flight guard skips a tick
 * instead of queueing it.
 *
 * Both are opt-out, because a few callers genuinely want neither: see the
 * options below.
 *
 * @param {() => (void | Promise<void>)} callback  Polled function. If it
 *   returns a promise, the next tick waits for it to settle.
 * @param {number|null} intervalMs  Delay between ticks. null/0 disables.
 * @param {object}  [options]
 * @param {boolean} [options.enabled=true]  False stops polling entirely (and
 *   skips the leading call) — for an explicit pause toggle, or a view that
 *   cannot change, such as a ledger for a date in the past.
 * @param {boolean} [options.immediate=true]  Call once on mount, before the
 *   first interval elapses.
 * @param {boolean} [options.pauseWhenHidden=true]  Pause while the tab is in
 *   the background. Set false only for a poll whose whole purpose survives the
 *   tab being hidden.
 * @param {boolean} [options.skipWhenInFlight=true]  Skip a tick while the
 *   previous call is still running.
 */
export default function usePolling(callback, intervalMs, options = {}) {
  const {
    enabled = true,
    immediate = true,
    pauseWhenHidden = true,
    skipWhenInFlight = true,
  } = options;

  // The callback is usually an inline arrow or a useCallback that changes
  // identity as state moves. Holding it in a ref means a new identity does not
  // tear down and restart the timer — which, with `immediate`, would otherwise
  // fire an extra request on every render that touched a dependency.
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled || !intervalMs || intervalMs <= 0) return undefined;

    let cancelled = false;
    let timer = null;

    const run = () => {
      if (cancelled) return;
      if (skipWhenInFlight && inFlight.current) return;

      let result;
      try {
        result = savedCallback.current();
      } catch (_) {
        // A throwing callback must not kill the timer — the next tick may well
        // succeed, and a poll that silently stops after one bad response is
        // worse than the bad response.
        return;
      }

      if (result && typeof result.then === 'function') {
        inFlight.current = true;
        result
          .catch(() => {})
          .finally(() => { inFlight.current = false; });
      }
    };

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(run, intervalMs);
    };

    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const hidden = () =>
      pauseWhenHidden
      && typeof document !== 'undefined'
      && document.visibilityState === 'hidden';

    const onVisibilityChange = () => {
      if (hidden()) {
        stop();
      } else {
        // Fire straight away rather than waiting out a full interval: the
        // data on screen is as stale as the tab was in the background.
        run();
        start();
      }
    };

    if (immediate && !hidden()) run();
    if (!hidden()) start();

    if (pauseWhenHidden && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      cancelled = true;
      stop();
      if (pauseWhenHidden && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [enabled, intervalMs, immediate, pauseWhenHidden, skipWhenInFlight]);
}
