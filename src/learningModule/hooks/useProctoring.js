import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Client half of the quiz proctoring options.
 *
 * Everything here is a deterrent, not a guarantee — a determined student can
 * defeat any of it with devtools. What makes it useful is that every event is
 * **reported to the server and recorded on the attempt**, so the teacher sees
 * who left the window. The enforcement decision is the server's, not this
 * hook's: leaving the tab, the window or fullscreen submits the attempt on the
 * first offence, and the reply comes back `terminated`.
 *
 * @param {object} options
 * @param {object} options.settings   the quiz's proctoring settings
 * @param {boolean} options.active    only watch while a sitting is in progress
 * @param {string} [options.attemptId] keys the offline queue below; without it
 *        a report that cannot be sent is simply lost.
 * @param {(type: string, at: string, detail?: string) => Promise<object>} [options.onViolation]
 *        reports to the server; its response may ask us to stop (terminated).
 *        `at` is when the event actually happened, which is not when it is sent
 *        — see the queue below. Omitting the callback leaves the deterrents in
 *        place and reports nothing, which is what the pre-test brief wants: the
 *        same locked-down screen, with nothing yet to record it against.
 * @param {() => void} [options.onTerminated]
 * @param {() => Promise<object>} [options.onHeartbeat]
 *        called on a timer while the paper is open. Unlike the violation
 *        reports, this one matters by its *absence*: a client whose reporting
 *        has been blocked in devtools stops sending it, and the server records
 *        the silence. It also lets the server end a paper whose time ran out
 *        while the student sat looking at it.
 */
// Three of these may be missed before the server notes the silence, so a brief
// hiccup costs nothing while a blocked client is visible within a couple of
// minutes.
const HEARTBEAT_MS = 30 * 1000;

/**
 * Departures that could not be reported when they happened.
 *
 * The case this exists for: a student drops their connection, leaves fullscreen
 * "to check the wifi", and comes back. The exit fired locally, but the POST that
 * would have ended their attempt failed, and nothing ever retried it — so
 * pulling the network cable before switching windows was a free pass. Queued
 * here instead, and flushed the moment anything reaches the server again.
 *
 * sessionStorage so it survives a reload of the same tab, which is the cheap
 * version of the same trick. It does not survive clearing storage in devtools,
 * and it is not meant to: a client that has been tampered with is what the
 * server's heartbeat gap is for. This closes the accident-shaped hole, not the
 * determined one.
 */
const QUEUE_KEY = (attemptId) => `lmProctorQueue:${attemptId}`;
// Far more than a real sitting produces; a bound only so a pathological loop
// cannot fill storage.
const QUEUE_MAX = 50;

/**
 * The three events the server calls "leaving", in its own `countsAsLeaving`.
 *
 * Kept deliberately identical to the server's list. These are the events that end
 * an attempt, so they are exactly the ones the sitting must stop accepting work
 * for — a client that blocks on a different set than the server terminates on is
 * the inconsistency that caused this bug, whichever way round it disagrees.
 *
 * Module scope, so `report` closes over one array rather than a fresh one per
 * render.
 */
const LEAVING = ['fullscreen_exit', 'tab_switch', 'blur', 'key_press'];

/**
 * How long a window blur is given to prove itself before it ends a paper.
 *
 * `window.blur` is not the signal it looks like. It fires for a great many things
 * that are not a student leaving the test: pressing Alt or the Windows key, an
 * IME or keyboard-layout switch, a notification toast, an antivirus or updater
 * popup, one of the browser's own bubbles (autofill, translate, a permission
 * prompt), a device-connected dialog, a stray click landing on a second monitor.
 * Every one of those used to submit the paper on the spot, with no allowance and
 * no way back — which is what made the exits look random to the student.
 *
 * So a blur is now held for this long and only acted on if the window is *still*
 * unfocused when it elapses. Coming back cancels it. What survives the wait is a
 * student who has genuinely been somewhere else, and they are reported with the
 * timestamp of the blur itself rather than of the confirmation, so nothing is
 * bought by the delay: the server sees the moment they left.
 *
 * Two seconds is chosen against what it has to swallow, not against what it lets
 * through — the transient blurs above all resolve well inside it, and two seconds
 * of looking at another window is not enough to be worth the trip. The
 * unambiguous departures are unaffected: `visibilitychange` and `fullscreenchange`
 * still act immediately, because neither is ambiguous the way focus is.
 */
export const BLUR_GRACE_MS = 2000;

const readQueue = (key) => {
  if (!key) return [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (key, items) => {
  if (!key) return;
  try {
    if (items.length) sessionStorage.setItem(key, JSON.stringify(items.slice(-QUEUE_MAX)));
    else sessionStorage.removeItem(key);
  } catch {
    // A browser refusing storage costs us the queue, not the sitting.
  }
};

export default function useProctoring({
  settings = {},
  active,
  attemptId,
  onViolation,
  onTerminated,
  onHeartbeat,
}) {
  const [tabSwitches, setTabSwitches] = useState(0);
  const [warning, setWarning] = useState(null);
  const [remaining, setRemaining] = useState(null);
  // Seeded from the document rather than `false`: the quiz stage is already
  // fullscreen by the time a sitting mounts, and starting at false would flash
  // the "fullscreen required" gate for a frame before the watcher corrected it.
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  /**
   * The student has left the test screen, as observed *locally*.
   *
   * Separate from `terminatedRef`, which only becomes true once the server has
   * said so, and that distinction is the bug this exists for. Leaving ends the
   * attempt — the server does that on the first offence — but the client used to
   * wait for the reply before believing it. On a dropped connection the report is
   * queued instead, so nothing came back, and the paper stayed open with its
   * clock running until the next heartbeat flushed the queue up to thirty seconds
   * later. Pulling the network before pressing Esc bought that window.
   *
   * A departure needs no server round trip to be recognised: the browser already
   * told us. So it is latched here the moment it happens, the sitting stops
   * accepting work immediately, and the server's reply — whenever it arrives —
   * only confirms what the student has already been told.
   */
  const [departed, setDeparted] = useState(false);
  const terminatedRef = useRef(false);
  const flushingRef = useRef(false);
  // Mirrors `departed` for the watchers below, which read it from inside event
  // handlers and timers rather than from a render.
  const departedRef = useRef(false);
  // A blur waiting to be confirmed: when it fired, and the timer that will judge
  // it. See BLUR_GRACE_MS.
  const blurAtRef = useRef(null);
  const blurTimerRef = useRef(null);

  /**
   * The caller's callbacks, reachable without being dependencies.
   *
   * Every one of them arrives as a fresh arrow on each render of the sitting, and
   * the sitting re-renders once a second while the countdown ticks. Depending on
   * them directly means every effect below is torn down and rebuilt every second,
   * which breaks two things that matter:
   *
   *  - the blur confirmation, whose whole mechanism is a timer that has to
   *    outlive a render to be waited on. A cleanup a few hundred milliseconds in
   *    would cancel every pending departure, silently, and nothing would ever be
   *    reported at all.
   *  - the heartbeat, which restarted — and so beat again immediately — on every
   *    render, turning a 30-second ping into a per-second one.
   *
   * Same shape as `useQuizCountdown`'s `expire` ref, for the same reason: latest
   * callback, stable identity.
   */
  const handlers = useRef({ onViolation, onTerminated, onHeartbeat });
  handlers.current = { onViolation, onTerminated, onHeartbeat };

  const queueKey = attemptId ? QUEUE_KEY(attemptId) : null;

  /** What the server said about a report, whenever it was sent. */
  const applyResult = useCallback((result) => {
    if (result?.tabSwitches !== undefined) setTabSwitches(result.tabSwitches);
    if (result?.remaining !== undefined) setRemaining(result.remaining);
    if (result?.warning) setWarning(result.warning);
    if (result?.terminated) {
      terminatedRef.current = true;
      setWarning(result.message || 'Your test was submitted automatically.');
      handlers.current.onTerminated?.();
    }
  }, []);

  /**
   * Sends everything that was queued while the connection was down.
   *
   * In order, and stopping at the first failure, so a still-broken connection
   * leaves the queue intact rather than dropping the rest of it. A report that
   * lands here can still end the attempt — arriving late is not the same as
   * being forgiven, and the server judges it by the timestamp it carries.
   */
  const flush = useCallback(async () => {
    const { onViolation: send } = handlers.current;
    if (flushingRef.current || terminatedRef.current || !send || !queueKey) return;
    const pending = readQueue(queueKey);
    if (!pending.length) return;

    flushingRef.current = true;
    try {
      while (pending.length) {
        let result;
        try {
          // eslint-disable-next-line no-await-in-loop
          // Only where there is one: a violation with no detail sends two
          // arguments, as it always did, rather than an explicit `undefined`.
          result = pending[0].detail === undefined
            // eslint-disable-next-line no-await-in-loop
            ? await send(pending[0].type, pending[0].at)
            // eslint-disable-next-line no-await-in-loop
            : await send(pending[0].type, pending[0].at, pending[0].detail);
        } catch {
          break; // still unreachable — keep what is left for the next attempt
        }
        pending.shift();
        applyResult(result);
        if (terminatedRef.current) {
          // The paper is closed. Anything still queued would be a no-op against
          // a finished attempt, so it goes rather than outliving the sitting.
          pending.length = 0;
        }
      }
    } finally {
      writeQueue(queueKey, pending);
      flushingRef.current = false;
    }
  }, [applyResult, queueKey]);

  /**
   * @param {string} type
   * @param {string} [happenedAt] when the event actually occurred, for the paths
   *        that establish that earlier than the decision to report it — a blur
   *        is judged two seconds after it fired, and is reported with the time it
   *        fired. Defaults to now, which is right for everything immediate.
   * @param {string} [detail] a short note the server writes onto the violation —
   *        which key was pressed, for a paper under keyboard lockdown. Travels
   *        through the offline queue with the event, so a departure reported late
   *        still says what it was.
   */
  const report = useCallback(
    async (type, happenedAt, detail) => {
      // Latched before the request, not after it. The paper closes because the
      // browser saw the student leave, not because a POST came back.
      if (LEAVING.includes(type)) {
        setDeparted(true);
        departedRef.current = true;
      }
      const { onViolation: send } = handlers.current;
      if (terminatedRef.current || !send) return;
      // Stamped by the caller or here, never on arrival: the whole point of the
      // queue is that these two moments can be minutes apart.
      const at = happenedAt || new Date().toISOString();
      try {
        applyResult(detail === undefined ? await send(type, at) : await send(type, at, detail));
      } catch {
        // A failed report must not interrupt the test, but it must not vanish
        // either. The local counter still moves so the on-screen warning stays
        // honest, and the event waits for a connection.
        writeQueue(queueKey, [
          ...readQueue(queueKey),
          // Spread rather than always set, so a queued entry from before this
          // existed and one with no detail look the same on the way back out.
          { type, at, ...(detail === undefined ? {} : { detail }) },
        ]);
        setTabSwitches((count) => count + 1);
      }
    },
    [applyResult, queueKey],
  );

  /* ---- still-here ping ---- */
  useEffect(() => {
    if (!active || !handlers.current.onHeartbeat) return undefined;

    let cancelled = false;
    const beat = async () => {
      if (cancelled || terminatedRef.current) return;
      try {
        const result = await handlers.current.onHeartbeat();
        if (cancelled) return;
        // The server may have finalised the paper on its own clock — a tab left
        // open past the deadline finds out here rather than on the next click.
        if (result?.finished) {
          terminatedRef.current = true;
          if (result.expired) setWarning('Time is up — your test has been submitted.');
          handlers.current.onTerminated?.();
          return;
        }
      } catch {
        // Offline, or the request was blocked. Either way the server sees the
        // gap, and anything we could not report is already queued.
        return;
      }
      // A heartbeat got through, so the connection is back: this is the first
      // and most reliable moment to hand over what was missed. Also covers the
      // mount case, where the immediate beat below drains a queue left behind
      // by a reload.
      if (!cancelled) flush();
    };

    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    // Fires well before the next beat is due, which is what shortens the window
    // in which a student is back online and still sitting on an unreported exit.
    window.addEventListener('online', flush);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('online', flush);
    };
  }, [active, flush]);

  /* ---- leaving the window ----
     Watched on every paper, with nothing to switch it off: leaving the test is
     no longer counted against a budget, it ends the sitting, and the brief says
     so before the student starts.

     The two signals are not worth the same, and treating them alike is what made
     this fire on things that were not departures at all:

       visibilitychange → hidden   the page is not on screen. Unambiguous, acted
                                   on immediately.
       blur                        the window lost keyboard focus, which happens
                                   for a dozen reasons that leave the paper right
                                   where it was. Held for BLUR_GRACE_MS and only
                                   acted on if focus has not come back. */
  useEffect(() => {
    if (!active) return undefined;

    /* This effect must not be rebuilt while a blur is being deliberated on — its
       cleanup cancels the pending timer, so a teardown inside the grace window
       discards the departure entirely. That is what `report` being stable buys,
       and why the callbacks go through `handlers` rather than the dependency
       list; there is a test that re-renders mid-confirmation to hold it. */
    const cancelPending = () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
      blurAtRef.current = null;
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      // Whatever the blur timer was still deliberating about, this settles it:
      // the page is hidden. Reported as the departure it is, carrying the blur's
      // timestamp when there was one, because that is when the student left —
      // the two events are one departure and the earlier time is the true one.
      const at = blurAtRef.current || undefined;
      cancelPending();
      report('tab_switch', at);
    };

    const onBlur = () => {
      // Already gone, or already counting: neither needs a second timer.
      if (blurTimerRef.current || departedRef.current) return;
      blurAtRef.current = new Date().toISOString();
      blurTimerRef.current = setTimeout(() => {
        blurTimerRef.current = null;
        const at = blurAtRef.current;
        blurAtRef.current = null;
        // Something less ambiguous got there first — a fullscreen exit, most
        // likely, since a browser dropping fullscreen also drops focus. One
        // departure, already reported.
        if (departedRef.current) return;
        // Focus is back without a `focus` event having reached us — a bubble
        // that took and returned it, a key that opened and closed a menu. The
        // student never left. Where the browser cannot tell us, the two seconds
        // of silence stand on their own and the departure is reported: this
        // fails towards enforcing the rule, not towards excusing it.
        if (typeof document.hasFocus === 'function' && document.hasFocus()) return;
        report('blur', at);
      }, BLUR_GRACE_MS);
    };

    // The cancellation half of the confirmation. Alt-tabbing away and straight
    // back, a toast that steals focus and hands it over — both land here inside
    // the grace window, and the paper carries on untouched.
    const onFocus = () => cancelPending();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      cancelPending();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [active, report]);

  /* ---- the keyboard ----
     Blocked outright, and the first key ends the paper. See lmQuiz's
     `keyboardLockdown` for why a keypress is treated as leaving.

     Three things about how this is bound matter:

     `keydown` on `window` in the **capture** phase, so it runs before React's
     delegated handlers and before the event can reach an input. `preventDefault`
     there is what stops the character being inserted; without the capture phase
     a handler inside the page could see the key first and act on it.

     `keyup` and `keypress` are blocked too. `keydown` alone is enough to stop the
     input, but a page that swallows one of the three and not the others gives a
     student a way to tell which keys are watched.

     Not gated on `active`: the brief is sat on the same locked screen, and a
     student who discovers the keyboard is dead while reading the rules has
     learned it for free rather than at the cost of their paper. Only the *report*
     is gated, because the brief has no attempt to end — the same split the
     fullscreen watcher below uses. */
  useEffect(() => {
    if (!settings.keyboardLockdown) return undefined;

    const swallow = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const onKeyDown = (event) => {
      swallow(event);
      if (!active || departedRef.current) return;
      /* What was pressed, for the teacher reading the log afterwards. A bare
         modifier is the interesting case rather than a stray one: a global hotkey
         is consumed by the operating system before the page is handed it, so the
         modifier going down first is the only part of the combination that
         reaches us. Recorded as the key's name, never as typed text — a paper
         answered by clicking has no keystrokes worth transcribing, and logging
         them would be recording a student's keypresses for no purpose. */
      const held = [
        event.ctrlKey && 'Ctrl',
        event.altKey && 'Alt',
        event.metaKey && 'Meta',
        event.shiftKey && 'Shift',
      ].filter(Boolean);
      const named = event.key === 'Unidentified' ? event.code : event.key;
      const detail = held.length && !held.includes(named) ? `${held.join('+')}+${named}` : named;
      report('key_press', undefined, detail);
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', swallow, true);
    window.addEventListener('keypress', swallow, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', swallow, true);
      window.removeEventListener('keypress', swallow, true);
    };
  }, [active, settings.keyboardLockdown, report]);

  /* ---- copy / paste ---- */
  useEffect(() => {
    if (!active || !settings.disableCopyPaste) return undefined;

    const block = (event) => {
      event.preventDefault();
      report(event.type === 'copy' ? 'copy' : 'paste');
    };
    document.addEventListener('copy', block);
    document.addEventListener('paste', block);
    document.addEventListener('cut', block);
    return () => {
      document.removeEventListener('copy', block);
      document.removeEventListener('paste', block);
      document.removeEventListener('cut', block);
    };
  }, [active, settings.disableCopyPaste, report]);

  /* ---- right click ---- */
  useEffect(() => {
    if (!active || !settings.disableRightClick) return undefined;

    const block = (event) => {
      event.preventDefault();
      report('right_click');
    };
    document.addEventListener('contextmenu', block);
    return () => document.removeEventListener('contextmenu', block);
  }, [active, settings.disableRightClick, report]);

  /* ---- fullscreen ----
     Every paper is sat in fullscreen, so an exit is always reportable and always
     ends the sitting. The watching is not gated on `active` either: a state
     seeded at mount and then never updated reads "still fullscreen" for the rest
     of the sitting, which is exactly how a fullscreen gate comes to never fire.
     Only the report is gated, on `active` — the brief has no attempt to end. */
  useEffect(() => {
    const onChange = () => {
      const inFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(inFullscreen);
      if (!inFullscreen && active) report('fullscreen_exit');
    };
    document.addEventListener('fullscreenchange', onChange);
    setIsFullscreen(Boolean(document.fullscreenElement));
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [active, report]);

  // Entering and leaving fullscreen belongs to the quiz stage, not here: it
  // owns an element that outlives both quiz screens, so one fullscreen covers
  // the brief and the sitting. This hook only watches and reports.
  return {
    tabSwitches,
    warning,
    remaining,
    isFullscreen,
    /**
     * True once the student has left the test screen during this sitting.
     *
     * The sitting reads this to stop the clock and refuse further work, without
     * waiting for the server to confirm. It never goes back to false: re-entering
     * fullscreen does not reopen a paper that leaving has closed, which is the
     * whole point of the rule the brief promised.
     */
    departed,
    // Exposed so the sitting can drain the queue before it banks an answer or
    // submits: a queued departure has to be judged before the work it might
    // have bought, not after.
    flushViolations: flush,
    dismissWarning: () => setWarning(null),
  };
}

/** Same UA test the server uses, for the pre-test device check. */
export const isMobileDevice = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
