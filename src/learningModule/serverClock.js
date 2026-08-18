/**
 * The server's clock, as best this browser can tell.
 *
 * ## The bug this fixes
 *
 * A quiz deadline is an absolute timestamp the *server* computes from
 * `startedAt + timeLimitMinutes`. The sitting then counted down to it with
 * `new Date(deadline) - Date.now()` — a server timestamp minus a *browser*
 * timestamp. The difference between the two clocks lands directly on the number
 * a student is watching, so a laptop whose clock is seven minutes fast showed
 * seven minutes less time than the student actually had, and one running slow
 * showed time remaining on a paper the server had already closed.
 *
 * Nothing about this is specific to any platform — it is wherever a clock has
 * drifted. It shows up most on laptops, which sleep, wake in another timezone,
 * and sit on networks that block the time-sync port.
 *
 * The invigilator's results page already corrected for this (see `skewRef` in
 * QuizResults) with a comment describing exactly this failure. It was never
 * applied to the side of the screen where it decides whether a student gets
 * their full time.
 *
 * ## How the offset is learned
 *
 * Every quiz response that carries a deadline now carries `serverTime` beside
 * it. `sync` records the difference; `now()` applies it. The heartbeat sends one
 * every thirty seconds for the whole sitting, so a clock that drifts — or is
 * changed — during a paper is corrected within one beat rather than at the next
 * page load.
 *
 * ## What it does not attempt
 *
 * The offset includes the time the response spent in flight, so it is out by
 * roughly half the round trip. On a countdown displayed to the nearest second
 * that is not worth correcting: the error is tens of milliseconds on a network
 * where the alternative — a skewed clock — is minutes.
 *
 * It is also not an integrity measure. A student who sets their clock back gains
 * a display that lies to them for up to thirty seconds and nothing more: expiry
 * is decided by the server against its own clock, which is the whole reason the
 * deadline is computed there.
 */

/** Milliseconds to add to `Date.now()` to get the server's clock. */
let offset = 0;
let synced = false;

/**
 * Learn the offset from a response that carried the server's time.
 *
 * Ignores anything unparseable rather than poisoning the offset with `NaN` —
 * which would make every countdown in the sitting read `00:00` and expire on
 * arrival, a far worse failure than the drift it is here to fix.
 *
 * @param {string|Date|undefined|null} serverTime
 * @returns {boolean} whether the offset was updated
 */
export function sync(serverTime) {
  if (!serverTime) return false;
  const at = new Date(serverTime).getTime();
  if (!Number.isFinite(at)) return false;
  offset = at - Date.now();
  synced = true;
  return true;
}

/** The server's current time, in milliseconds. Falls back to this browser's. */
export function now() {
  return Date.now() + offset;
}

/** For diagnostics and tests. */
export function state() {
  return { offset, synced };
}

/** Test-only: forget what was learned. */
export function reset() {
  offset = 0;
  synced = false;
}

export default { sync, now, state, reset };
