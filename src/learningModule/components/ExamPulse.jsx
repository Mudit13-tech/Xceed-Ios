import React, { useEffect, useRef, useState } from 'react';
import serverClock from '../serverClock';

/**
 * A faint ring that blooms out from the centre of a live exam screen every
 * thirty seconds and fades.
 *
 * The point is not the student — it is the invigilator at the back of the hall.
 * The pulse is deliberately weak up close: a thin line at low opacity, over the
 * paper but never near the text long enough to read against. From a distance
 * what registers is the *motion* — a ring sweeping outward — and, crucially,
 * that every screen does it at the same instant. It is anchored to the server's
 * clock, not each browser's, so a room full of papers breathes together, and a
 * screen that is not pulsing in time — a second window, a screenshot held up, a
 * paper that was quietly closed — is the one thing that stands out from the back.
 *
 * There are two ways it fires, and they are independent on purpose. `auto` runs
 * the automatic 30s ring — the teacher's per-quiz toggle. `manualPulseAt` is a
 * "pulse now" pressed in live control and delivered on the heartbeat; it blooms
 * immediately whether or not `auto` is on, because an invigilator wants to be
 * able to sweep the hall on a quiz where the standing pulse was never turned on.
 * When both are live, a manual pulse also skips the next automatic ring so
 * nobody is pulsed twice in quick succession.
 *
 * The teacher also picks the ring's `color`, painted inline so a hall settles on
 * a shade its invigilators can read at range.
 *
 * `pointer-events: none` throughout: it paints over the sitting and touches
 * nothing. It never intercepts a click, never blocks a question.
 */

const PULSE_INTERVAL_MS = 30_000;
const DEFAULT_COLOR = '#3884ff';

// A manual pulse is only honoured while it is genuinely fresh. The stamp lives
// on the quiz and rides the heartbeat, so on a first load or a reconnect a
// sitting can be handed a `manualPulseAt` from an earlier press — replaying that
// would bloom a screen for a pulse the invigilator called minutes ago. One
// heartbeat plus margin: anything older is treated as already spent.
const MANUAL_MAX_AGE_MS = 45_000;

/* A thin line that grows from a point to past the edges and fades — width and
   height are animated rather than a transform:scale, so the 2px border stays a
   constant line instead of thickening as it grows. It stays a thin line so it
   never obscures the paper, but the line itself is drawn boldly and held near
   full strength across most of the sweep: a hairline at low opacity reads as
   nothing from across a hall, and the point of this is to be seen from the back.
   The colour is set inline per-quiz. Under reduced-motion the ring does not
   travel: it becomes a fixed circle that only breathes in opacity, which keeps
   the synchronised cue an invigilator relies on without the sweep. */
const css = `
.lm-exam-pulse-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 2147483000;
}
.lm-exam-pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  border: 4px solid ${DEFAULT_COLOR};
  transform: translate(-50%, -50%);
  opacity: 0;
  will-change: width, height, opacity;
  animation: lm-exam-pulse-ring 2800ms ease-out forwards;
}
@keyframes lm-exam-pulse-ring {
  0%   { width: 0; height: 0; opacity: 0; }
  6%   { opacity: 0.85; }
  70%  { opacity: 0.7; }
  100% { width: 170vmax; height: 170vmax; opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .lm-exam-pulse-ring {
    width: 46vmin;
    height: 46vmin;
    animation: lm-exam-pulse-fade 2800ms ease-in-out forwards;
  }
  @keyframes lm-exam-pulse-fade {
    0%, 100% { opacity: 0; }
    50%      { opacity: 0.7; }
  }
}
`;

export default function ExamPulse({
  auto = true,
  intervalMs = PULSE_INTERVAL_MS,
  color = DEFAULT_COLOR,
  manualPulseAt = null,
}) {
  // Bumped each cycle; used as the ring's key so React remounts it and the CSS
  // animation restarts from the top. Starts at 0 so nothing shows until the
  // first server-aligned boundary — a screen joins the room's rhythm on the
  // next tick rather than firing a lone pulse the moment it loads.
  const [tick, setTick] = useState(0);
  // The last manual stamp acted on, and whether the next automatic bloom should
  // be swallowed. Refs, not state: they steer the timer without themselves
  // re-running the effect that owns it.
  const lastManualRef = useRef(null);
  const skipNextAutoRef = useRef(false);

  useEffect(() => {
    if (!auto) return undefined;
    let cancelled = false;
    let intervalId;
    const fire = () => {
      if (cancelled) return;
      // A manual "pulse now" just bloomed the screen; let this scheduled ring
      // pass so the student is not pulsed twice within a breath of it.
      if (skipNextAutoRef.current) {
        skipNextAutoRef.current = false;
        return;
      }
      setTick((n) => n + 1);
    };
    // One ring shortly after the pulse goes live, so an invigilator (and the
    // teacher who just turned it on) can see it is working instead of waiting up
    // to a full interval for the next server boundary. A short settle first, so
    // it lands after the paper has painted rather than competing with mount.
    const kickoffId = setTimeout(fire, 1200);
    // Milliseconds until the next interval boundary of the *server's* clock, so
    // this screen lands on the same instant as every other one in the hall. From
    // here on every screen is aligned — which is what makes an out-of-rhythm one
    // stand out — regardless of the unsynced kick-off above.
    const msToNext = intervalMs - (((serverClock.now() % intervalMs) + intervalMs) % intervalMs);
    const timeoutId = setTimeout(() => {
      fire();
      intervalId = setInterval(fire, intervalMs);
    }, msToNext || intervalMs);
    return () => {
      cancelled = true;
      clearTimeout(kickoffId);
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [auto, intervalMs]);

  useEffect(() => {
    // Honoured whether or not `auto` is on — a manual pulse is the whole point
    // on a quiz that never turned the standing pulse on.
    if (!manualPulseAt) return;
    // The stamp is unchanged from the one we last saw — nothing to do. This also
    // covers every heartbeat that carries the same value between presses.
    if (lastManualRef.current === manualPulseAt) return;
    lastManualRef.current = manualPulseAt;
    // Both sides are server time (serverClock corrects this browser's), so the
    // age is real. A stale or future stamp is ignored — see MANUAL_MAX_AGE_MS.
    const age = serverClock.now() - new Date(manualPulseAt).getTime();
    if (age < 0 || age > MANUAL_MAX_AGE_MS) return;
    setTick((n) => n + 1);
    // Only bites when the automatic ring is running; harmless otherwise.
    skipNextAutoRef.current = true;
  }, [manualPulseAt]);

  if (tick === 0) return null;

  return (
    <>
      <style>{css}</style>
      <div className="lm-exam-pulse-overlay" aria-hidden="true">
        <div key={tick} className="lm-exam-pulse-ring" style={{ borderColor: color }} />
      </div>
    </>
  );
}
