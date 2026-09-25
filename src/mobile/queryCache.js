/**
 * Lifetimes for the react-query cache and its persisted copy — web values,
 * which are react-query's own defaults. See ./README.md.
 *
 * (The app keeps both indefinitely, because the days between opening it are
 * exactly when there is no network to fall back on, and busts the copy on each
 * release instead.)
 */
const DAY = 24 * 60 * 60 * 1000;

export const CACHE_GC_TIME = DAY;
export const PERSIST_MAX_AGE = DAY;
export const PERSIST_BUSTER = '';

/**
 * How long a fetched answer is trusted before react-query goes and asks again.
 *
 * This was zero — "every answer is out of date the moment it arrives". Paired
 * with REFETCH_ON_WINDOW_FOCUS below, that turned every return to the tab into
 * a refetch of every query on the page, so a student alt-tabbing between XCEED
 * and their notes re-ran the whole screen's worth of requests on each switch
 * and spent the first moment back loading data they already had. Across a
 * campus that leaves tabs open all day it is a lot of traffic that changes
 * nothing on screen.
 *
 * Thirty seconds is only the floor under the queries that never made a choice.
 * The ones that need to be fresher, or can afford to be staler, say so where
 * they are declared: two minutes for a class list, five for the signed-in
 * account, zero for the list of active sessions.
 */
export const DEFAULT_STALE_TIME = 30 * 1000;

/**
 * Whether coming back to the tab re-asks for anything gone stale.
 *
 * Deliberately on. Returning after a lecture *should* show current coursework —
 * the fault was never that it refetched, it was that with a zero staleTime it
 * refetched everything, every time, however briefly you had been away. Bounded
 * by DEFAULT_STALE_TIME it fires when an answer is actually old.
 */
export const REFETCH_ON_WINDOW_FOCUS = true;

/**
 * How many times a failed request is tried again before the screen says so.
 *
 * react-query's default is three, which is three attempts too many in the one
 * case that matters: when the server is struggling, every client on campus
 * independently triples the load on it, and the retries arrive at the moment
 * it can least take them. A campus-sized client is a thundering herd, and the
 * default is tuned for one user on a flaky phone.
 *
 * One retry keeps what the default is actually for — the single dropped
 * request on a lift ride or a wifi handover — and drops the rest. Anything
 * still failing on the second attempt is not a blip, and the sooner a student
 * is told that, the sooner they stop waiting at a spinner.
 */
export const QUERY_RETRY = 1;
