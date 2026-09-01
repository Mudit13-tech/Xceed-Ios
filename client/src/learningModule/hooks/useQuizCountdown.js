import { useEffect, useRef, useState } from 'react';
import { now as serverNow } from '../serverClock';

/**
 * The quiz countdown.
 *
 * Its own hook for one reason: what matters about it is **which changes stop the
 * interval**, and that is a property of the effect's dependency list rather than
 * of anything you can see in a rendered paper. Left inline in `QuizAttempt`, the
 * only way to test it was to copy the effect into the test file — which tests the
 * copy, and would go on passing after the real one regressed. Now both import
 * this.
 *
 * ## What stops it
 *
 *  - **`departed`** — the student left fullscreen, the tab or the window. That
 *    ends the paper, so there is nothing left to count. This was the reported bug:
 *    the clock ran on behind the "fullscreen required" screen, which even said so,
 *    and a student who came back had quietly lost the time.
 *  - **`finished`** — the attempt is over. This has to be *state*, not a ref: the
 *    original guard read a `useRef`, which does not re-run an effect, so the
 *    interval outlived the attempt. It kept ticking behind the result screen and,
 *    on reaching zero, auto-submitted a paper that was already submitted.
 *  - no deadline at all — an untimed paper.
 *
 * ## What it deliberately is not
 *
 * Not a pause. `deadline` is an absolute timestamp the server derives from
 * `startedAt + timeLimitMinutes`, so stopping this display does not stop the
 * clock: the server would still expire the student at the original wall-clock
 * moment. That is precisely why leaving has to *end* an attempt rather than
 * suspend it — a frozen clock over a deadline that kept moving would show time
 * remaining on a paper the server had already closed, which is the cruellest
 * possible version of this bug. A real pause would need the server to extend the
 * deadline by the time spent away.
 *
 * @param {object} options
 * @param {string|Date|null} options.deadline  absolute, from the server — and
 *        counted down against the *server's* clock, not the browser's; see
 *        serverClock.js for why that distinction decides whether a student gets
 *        their full time
 * @param {boolean} options.departed  the student has left the test screen
 * @param {boolean} options.finished  the attempt is no longer in progress
 * @param {() => void} options.onExpire  called once the deadline passes
 * @returns {number|null} seconds left, or null when nothing is being counted
 */
export default function useQuizCountdown({ deadline, departed, finished, onExpire }) {
  const [remaining, setRemaining] = useState(null);

  /**
   * The expiry callback, reachable without being a dependency.
   *
   * It cannot go in the dependency list: it closes over the student's answers, so
   * a new one arrives on every keystroke and the countdown would restart each
   * time — handing anyone who keeps typing an unlimited question.
   *
   * But it cannot be captured once either, which is what the previous version did
   * on the reasoning that "which copy runs does not matter at zero". That was
   * wrong, and expensively so in one-at-a-time delivery: the callback advances the
   * question *and posts the answer with it*, so the copy taken when the question
   * loaded submitted the answer state from that moment — nothing — and the answer
   * the student actually gave was discarded. In that mode the answer is only sent
   * on advance, so it was not saved anywhere else either.
   *
   * A ref refreshed on every render is both: latest callback, stable identity.
   */
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    if (!deadline || departed || finished) {
      setRemaining(null);
      return undefined;
    }

    let timer = null;
    /**
     * Expiry happens once per deadline.
     *
     * Without this the interval ran on past zero and fired again every second
     * while the advance request was in flight — and each firing advanced the
     * cursor, so a student on a slow connection was carried past questions they
     * never saw. The deadline does not change until the *next* question arrives,
     * so the interval cannot be relied on to stop itself.
     */
    let fired = false;

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const tick = () => {
      /* Both sides of this subtraction have to come from the same clock. The
         deadline is the server's; `serverNow` is the server's too, corrected for
         this browser's drift. Using `Date.now()` here — as this did — put the
         difference between the two clocks straight onto the number the student
         reads, which on a laptop that had been asleep was minutes. */
      const left = Math.round((new Date(deadline) - serverNow()) / 1000);
      setRemaining(left);
      if (left > 0 || fired) return;
      fired = true;
      stop();
      expire.current?.();
    };

    tick();
    // Only if the first look did not already expire it — a question served to a
    // sleeping tab, or a reload after the clock ran out.
    if (!fired) timer = setInterval(tick, 1000);
    return stop;
  }, [deadline, departed, finished]);

  return remaining;
}
