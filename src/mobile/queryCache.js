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
