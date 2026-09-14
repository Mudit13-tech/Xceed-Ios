/**
 * The query cache, on a device.
 *
 * A full replacement rather than a wrapper: the AMS original is a *sync*
 * persister over window.localStorage, and neither half survives the move. The
 * WebView's localStorage is cleared by the system under storage pressure — the
 * cache it is meant to protect is exactly what goes first — and Capacitor
 * Preferences is async, so the persister type itself has to change. There is no
 * seam between the two versions to share.
 *
 * Because this replaces the file outright it inherits nothing from AMS - with
 * the one exception re-exported at the bottom. Run npm run drift to see what
 * upstream has changed here. See build/mobileOverrides.js.
 */
import { Preferences } from '@capacitor/preferences';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const capacitorStorage = {
  getItem: async (key) => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key, value) => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key) => {
    await Preferences.remove({ key });
  },
};

/**
 * How large the persisted cache is allowed to get, in characters of JSON.
 *
 * There has to be a number here, and the reason is the bridge rather than the
 * disk. Preferences is UserDefaults on iOS and SharedPreferences on Android,
 * and neither is reached directly: the string is marshalled across the
 * Capacitor bridge, which means it is JSON-encoded *again* (every quote in it
 * escaped) on the WebView side and parsed back on the native side, both on the
 * main thread. That cost is linear in the size of the cache and it is paid on a
 * timer for as long as the app is open.
 *
 * Nothing bounded it before. main.jsx sets gcTime to Infinity and maxAge to
 * Infinity — deliberately, so a phone that has been offline for a week still
 * opens to something — and the two together describe a cache that only ever
 * grows. A student six months into a semester has every quiz, every attendance
 * page and every notification list they have ever loaded in there, and the app
 * was re-encoding all of it, end to end, every second that anything changed.
 * That is the periodic quarter-second of unresponsiveness while scrolling, and
 * on Android a multi-megabyte SharedPreferences write is a well-known way to
 * take the main thread down with it.
 *
 * 2 MB is chosen to be large enough that the screens a user actually revisits
 * all fit, and small enough that one write is not perceptible. Measured in
 * characters rather than bytes on purpose: this JSON is overwhelmingly ASCII,
 * so the two are within a few percent of each other, and `String.length` is
 * free where counting UTF-8 bytes would mean allocating the string again.
 */
const MAX_CACHE_CHARS = 2 * 1024 * 1024;

/**
 * Drops queries until the cache fits, newest kept first.
 *
 * Recency is the right axis because it is the one that predicts the next
 * launch: the screens someone opened today are the screens they will open
 * tomorrow, and a page last seen in August has no claim on the budget. Sizing
 * each query once and keeping greedily also means one large stale response
 * cannot evict a dozen small useful ones.
 *
 * A query that does not fit is skipped rather than ending the loop, so a single
 * oversized entry — a report with a few thousand rows — costs only itself
 * instead of everything that sorts after it.
 *
 * Mutations are never pruned. They are paused writes waiting for the network,
 * they are tiny, and dropping one loses work the user believes they have done.
 */
function withinBudget(client) {
  const state = client.clientState ?? {};
  const queries = state.queries ?? [];

  const budget = Math.floor(MAX_CACHE_CHARS * 0.9);
  const ranked = queries
    .map((query) => ({
      query,
      size: JSON.stringify(query).length,
      updatedAt: query.state?.dataUpdatedAt ?? 0,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const kept = [];
  let used = 0;
  for (const entry of ranked) {
    if (used + entry.size > budget) continue;
    used += entry.size;
    kept.push(entry.query);
  }

  if (kept.length === queries.length) return client;
  return { ...client, clientState: { ...state, queries: kept } };
}

/**
 * Serialize, but refusing to hand the bridge something enormous.
 *
 * The common path is one `JSON.stringify` and a length check, which is what it
 * was doing anyway. Pruning only runs on the launches where the cache has
 * actually outgrown the budget, and then costs a second pass.
 */
function serialize(client) {
  const json = JSON.stringify(client);
  if (json.length <= MAX_CACHE_CHARS) return json;
  return JSON.stringify(withinBudget(client));
}

export const queryPersister = createAsyncStoragePersister({
  storage: capacitorStorage,
  serialize,

  /**
   * Four seconds rather than the default one.
   *
   * The default is tuned for localStorage, where a write is a synchronous poke
   * at an in-process map. Here it is a bridge crossing and a plist or XML
   * rewrite, so the right interval is the one that is still frequent enough to
   * survive a kill and rare enough to disappear between frames. Nothing is lost
   * by waiting: the throttle keeps the *latest* state and writes that, so a
   * longer interval coalesces a burst of settling queries into one write
   * instead of dropping any of them.
   *
   * The exposure is the last four seconds of cache updates if the OS kills the
   * app outright — which costs a refetch of screens that were about to be
   * refetched anyway, because staleTime is 0.
   */
  throttleTime: 4000,

  /**
   * The last resort, for when the platform refuses the write anyway — a device
   * genuinely out of space, or an OS-side limit the budget above did not
   * anticipate. Returning a smaller client asks the persister to try again with
   * it; returning undefined gives up and leaves the app running with an
   * in-memory cache, which is a worse launch tomorrow and nothing worse today.
   */
  retry: ({ persistedClient, errorCount }) => {
    if (errorCount > 3) return undefined;
    const queries = persistedClient.clientState?.queries ?? [];
    if (queries.length === 0) return undefined;
    // Halve it. Guessing at which half by recency, as above.
    const byRecency = [...queries].sort(
      (a, b) => (b.state?.dataUpdatedAt ?? 0) - (a.state?.dataUpdatedAt ?? 0),
    );
    return {
      ...persistedClient,
      clientState: {
        ...persistedClient.clientState,
        queries: byRecency.slice(0, Math.floor(byRecency.length / 2)),
      },
    };
  },
});

/**
 * Which queries may be written to storage, taken straight from AMS rather than
 * copied down here.
 *
 * The predicate names the query keys that describe who is signed in; nothing
 * about it is storage-specific, so the reason this file exists at all does not
 * apply to it. Copying it would mean a privacy allowlist that stops growing
 * when AMS adds a key to it - the one kind of drift worth paying to avoid.
 *
 * `./queryPersister` from inside the override reaches the real AMS module (see
 * build/mobileOverrides.js), which does construct its localStorage persister on
 * the way past. That object is never used here, and the WebView has a
 * localStorage for it to be built over.
 */
export { shouldPersistQuery } from './queryPersister';
