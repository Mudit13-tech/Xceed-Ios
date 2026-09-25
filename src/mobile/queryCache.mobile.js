/**
 * Lifetimes for the react-query cache and its persisted copy — the app's values.
 * The web's are react-query's defaults; see queryCache.js and README.md.
 *
 * Kept indefinitely (gcTime and maxAge both Infinity). The default maxAge is 24
 * hours and all-or-nothing: one timestamp covers the whole cache, so a cache
 * last written 25 hours ago is thrown away entirely. On a phone that is exactly
 * backwards, because the days between opening the app are when there is no
 * network to fall back on. Unbounded is safe because staleTime is 0: nothing
 * restored is ever treated as fresh, it is shown while the refetch runs.
 *
 * Busted per release instead, so an OTA update starts from an empty cache rather
 * than rehydrating one written by the previous bundle into components that may
 * no longer read that shape. The version is read from a <meta> tag that
 * vite.app.config.js injects, not inlined as a `define`: see the note there on
 * why a define made every release re-download 9.79 MB. The fallback covers the
 * dev server and jsdom, neither of which persists a cache worth busting.
 */
export const CACHE_GC_TIME = Infinity;
export const PERSIST_MAX_AGE = Infinity;
export const PERSIST_BUSTER =
  (typeof document !== 'undefined' &&
    document.querySelector('meta[name="app-version"]')?.content) ||
  'dev';

// Everything else the web seam exports, unchanged. AMS may add exports to a
// seam (src/mobile/README.md allows it), and without this the app build fails
// on the first one it has not heard of. Exports declared in this file win.
export * from './queryCache';
