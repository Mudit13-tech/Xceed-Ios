/**
 * The learning-module API, with the shell's own reads answered from memory.
 *
 * The problem this solves
 * -----------------------
 * LearningLayout keeps the three things the whole module's chrome is built
 * from -- `me`, `overview` and the class list -- in plain `useState(null)`
 * (LearningLayout.jsx:458-466). Not react-query: so none of it is deduplicated,
 * none of it is cached, none of it is shared, and every fetch of it starts from
 * null. Its loader then runs four requests, with a *write* awaited in front of
 * the three reads:
 *
 *     await lmApi.claimInvites()                       // POST, serial
 *     await Promise.all([me(), overview(), listClasses()])
 *
 * That would be fine once per visit to the module. It is not once. Dashboard
 * re-runs the whole thing every time it mounts:
 *
 *     useEffect(() => { reloadOverview?.() }, [reloadOverview])   // Dashboard.jsx:728
 *
 * So leaving the class list for the calendar and coming back pays for all four
 * again, and because the values are gated on their own absence -- `overview ?`
 * for the stat tiles, `if (!classes)` for the class switcher in the rail -- the
 * skeletons come back with them every single time. On a phone that is a couple
 * of seconds of placeholder blocks on a screen the user was looking at ten
 * seconds ago.
 *
 * None of that is reachable from here without forking the two largest files in
 * the module, both of which AMS edits constantly. But all four requests go
 * through this object, and this object is one file with 96 importers -- so the
 * repetition can be answered where it is cheapest to answer, underneath all of
 * them.
 *
 * What this does
 * ---------------
 * Keeps the last answer to each of those reads, and returns it immediately on
 * the next ask while checking for a new one behind it. The screen paints from
 * what it showed last time instead of from nothing, so there are no grey boxes
 * to sit through, and the refresh that runs behind that paint is what the
 * following visit reads.
 *
 * The last values are also written to the device, so the first load after
 * launching the app paints from what was on screen last time rather than from
 * nothing. See the persistence section further down for what is stored and what
 * refuses to be.
 *
 * Staleness is bounded by writes rather than by a clock. A timer would have to
 * choose between refetching often enough to be safe and rarely enough to be
 * useful, and it does not need to choose: the events that make this data wrong
 * are creating, joining, archiving and leaving classes, and all of them come
 * through this same object, where they clear the cache outright.
 *
 * See build/mobileOverrides.js. `npm run drift` reports what AMS has changed in
 * lmApi.js since; this file wraps whatever that file exports rather than
 * restating any of it, so most such changes need nothing done here.
 */
import { Preferences } from '@capacitor/preferences';

import base from './lmApi';

// Everything AMS exports by name — shortGuest, formGuest, quizSession, and
// whatever it adds later — reaches its importers untouched. Only the default
// export is wrapped.
export * from './lmApi';

/**
 * How long a value is treated as fresh enough not to re-ask.
 *
 * This is not how long a value is *used* -- a value is used for as long as it
 * is the newest one there is. It is only how quickly moving between screens
 * stops starting another request. Below it, a second visit costs nothing at
 * all; above it, the visit still paints instantly from what is already here and
 * a refresh runs behind it.
 */
const FRESH_MS = 30_000;

/**
 * The reads the module's chrome is built from. Every one of these is fetched
 * again on each visit to the dashboard, and every one is gated on its own
 * absence somewhere in the UI.
 *
 * `me` is in this list, and has to be. The loader awaits all three together, so
 * the screen cannot paint until the slowest returns -- leaving `me` to the
 * network would mean the other two were answered instantly and nothing appeared
 * any sooner. It is held in memory only and never written to disk, and the
 * session check below drops it the moment the token changes.
 */
const CACHED = new Set(['me', 'overview', 'listClasses', 'getMyDashboardSections']);

/**
 * A POST, cached far longer than the reads, because of where it sits: the
 * loader awaits it *before* the other three, so its round trip is added to the
 * top of every load. An invite is claimed by having an account with a matching
 * address, which does not become true again while the app is open.
 */
const CLAIM_MS = 5 * 60_000;

/**
 * Must never clear the cache, whatever the rule below decides about it.
 *
 * This is load-bearing rather than tidy: claimInvites is a POST, so it would
 * otherwise invalidate everything -- and since the loader calls it first, every
 * load would clear the cache it is about to read from, leaving this file doing
 * nothing while appearing to work.
 */
const NEVER_INVALIDATES = new Set(['claimInvites']);

/**
 * Which methods change something on the server, asked of the method itself.
 *
 * Every call in lmApi.js passes its verb to the shared `request` helper, so the
 * verb is in the function's own source and `toString()` can be asked for it.
 * That survives the production build -- the minifier keeps `method:` as a
 * property name and the verb as a literal:
 *
 *     claimInvites:()=>K(`/claim-invites`,{method:`POST`,body:{}})
 *
 * Read at runtime rather than kept as a list of the 184 mutation names, because
 * a list would be right today and quietly wrong the first time AMS adds one --
 * and wrong in that direction means showing a class list that no longer exists.
 *
 * The failure modes are not symmetric and this errs the safe way: a read that
 * merely mentions one of these words clears a cache it needn't have, costing
 * one refetch.
 */
const WRITES = /\b(POST|PUT|PATCH|DELETE)\b/;

/** key -> { value, hasValue, at, inflight } */
const entries = new Map();

let sessionToken;

const STORE_KEY = 'lmShellCache';

/**
 * How old a stored value may be and still be shown on launch.
 *
 * Within a session the age of a value does not matter -- the alternative to an
 * old number is a grey box, and a refresh is always running behind it. Across
 * launches that argument gets weaker the longer the gap, because of the one
 * thing this cannot do: it cannot push the refreshed value into a screen that
 * is already drawn (see staleWhileRevalidate). So a value restored on launch is
 * what the user looks at until they navigate away and back.
 *
 * A day is the line. Someone who used the app yesterday evening opens it to
 * their real classes instantly; someone coming back after the holidays waits
 * once for a load that is genuinely correct, rather than reading a class list
 * from a semester that has ended.
 */
const MAX_RESTORED_AGE_MS = 24 * 60 * 60_000;

/** Skip a write rather than push something large through the Capacitor bridge. */
const MAX_STORED_CHARS = 512 * 1024;

/**
 * What may be written to the device.
 *
 * `me` is on this list, and it is the one decision here worth arguing, because
 * utils/queryPersister.js decides the opposite: it keeps the signed-in identity
 * out of persisted storage on purpose, and the reasoning there is right. Two
 * things make this different rather than a contradiction of it.
 *
 * The threat that note describes is a shared machine -- one student's browser
 * restoring the previous student's identity and attendance record. This is
 * Capacitor Preferences on a personal phone: private to the app, unreadable by
 * other apps, and gone when the app is uninstalled. The auth token already
 * lives on that same device; anyone who can read this can read the token and
 * simply ask the server for `/me` themselves, so storing it beside the token
 * adds no reach that the token did not already give.
 *
 * The other half of that note -- a signed-out app still showing the last
 * person's email -- is the real risk, and is what the fingerprint below exists
 * for: nothing is restored unless the token it was stored under is the token in
 * hand. Sign out, expire, or sign in as someone else, and the stored values are
 * not read.
 *
 * It is also not optional. The loader awaits all three reads together, so the
 * screen cannot paint until the slowest returns. Leaving `me` to the network
 * would mean the other two were restored instantly and the launch was no faster
 * at all, which is the whole point of this section.
 */
const PERSISTED = new Set(['me', 'overview', 'listClasses', 'getMyDashboardSections']);

function currentToken() {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

/**
 * A short, non-reversible tag for the session a stored blob belongs to.
 *
 * A comparison is all that is needed, so the token itself is not written to
 * disk a second time -- FNV-1a over it is enough to tell "same session" from
 * "anyone else", and leaves nothing in the file worth stealing.
 */
function fingerprint(token) {
  if (!token) return 'anon';
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  // Coalesced: a single load settles four entries, and that is one write.
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void persist();
  }, 1_500);
}

async function persist() {
  try {
    const token = currentToken();
    if (!token) {
      await Preferences.remove({ key: STORE_KEY });
      return;
    }
    const stored = {};
    for (const [key, entry] of entries) {
      if (entry.hasValue && PERSISTED.has(key.split(':')[0])) {
        stored[key] = { value: entry.value, at: entry.at };
      }
    }
    const payload = JSON.stringify({ t: fingerprint(token), v: stored });
    if (payload.length > MAX_STORED_CHARS) return;
    await Preferences.set({ key: STORE_KEY, value: payload });
  } catch {
    // Storage being unavailable costs the next launch its head start and
    // nothing else.
  }
}

/**
 * Reads the stored values back, once, before the first call is answered.
 *
 * Restored entries keep the timestamp they were stored with rather than being
 * treated as new, so the first read of each one paints instantly and still
 * starts a refresh behind it.
 */
const hydrated = (async () => {
  try {
    const token = currentToken();
    // Claimed here so the session check below does not mistake the first call
    // for a change of account and throw all of this away.
    sessionToken = token;
    if (!token) return;

    const { value } = await Preferences.get({ key: STORE_KEY });
    if (!value) return;

    const parsed = JSON.parse(value);
    if (!parsed || parsed.t !== fingerprint(token)) return;

    const cutoff = Date.now() - MAX_RESTORED_AGE_MS;
    for (const [key, entry] of Object.entries(parsed.v || {})) {
      if (entry && typeof entry.at === 'number' && entry.at > cutoff) {
        entries.set(key, { hasValue: true, value: entry.value, at: entry.at, inflight: null });
      }
    }
  } catch {
    // A cache that cannot be read is simply not used.
  }
})();

const keyFor = (name, args) => (args.length ? `${name}:${JSON.stringify(args)}` : name);

/**
 * Drop everything if the signed-in account has changed.
 *
 * Checked on every call rather than wired into the sign-out path, because there
 * is more than one way out -- the logout button, an expired token turning into
 * a 401, a different account signing in on a shared phone -- and a rule that
 * has to be remembered at each of them is one that will be missed at one of
 * them. The token is the thing that actually identifies the session, so
 * watching it covers all three at once.
 */
function sameSession() {
  let token = null;
  try {
    token = localStorage.getItem('token');
  } catch {
    // A WebView refusing storage is not a reason to fail the call.
  }
  if (token !== sessionToken) {
    sessionToken = token;
    entries.clear();
    scheduleSave();
  }
}

/**
 * Show what we already have, and find out what changed at the same time.
 *
 * The rule is: if there is a previous answer, it is returned now -- always, no
 * matter how old. The alternative to a slightly old number is not a fresher
 * number, it is a grey box where the number should be, and then a wait. A value
 * from the last visit is a better answer than no value.
 *
 * A refresh is started behind that, unless one is already running or the value
 * was fetched within FRESH_MS. Its result replaces what is stored, so the next
 * read of this screen gets it.
 *
 * The one thing this cannot do is push the new value into a screen that is
 * already on display: LearningLayout holds these in `useState` and only writes
 * them when its loader resolves, and nothing here can reach that. So the
 * dashboard shows the previous visit's numbers and picks up the refreshed ones
 * on the next visit -- which, because a visit is what starts the refresh, means
 * they are typically seconds old rather than a session old. Anything the user
 * actually changes does not go through this path at all: a write clears the
 * cache outright, so the reload after creating or joining a class is a real one.
 */
function staleWhileRevalidate(name, freshMs, call) {
  return async (...args) => {
    // Resolved after the first call; a microtask on every one after that.
    await hydrated;
    sameSession();
    const key = keyFor(name, args);
    const entry = entries.get(key) || { hasValue: false, value: undefined, at: 0, inflight: null };

    const fresh = entry.hasValue && Date.now() - entry.at < freshMs;
    if (!fresh && !entry.inflight) {
      entry.inflight = Promise.resolve(call(...args)).then(
        (value) => {
          const current = entries.get(key);
          if (current) {
            current.value = value;
            current.hasValue = true;
            current.at = Date.now();
            current.inflight = null;
            if (PERSISTED.has(name)) scheduleSave();
          }
          return value;
        },
        (error) => {
          const current = entries.get(key);
          // A failure must never overwrite a good value -- the point of keeping
          // it is to have something to show when the network does not answer.
          if (current) current.inflight = null;
          throw error;
        },
      );
      entries.set(key, entry);
      // Only the caller that is actually waiting on this request should see it
      // fail; when it is running behind a value that was returned already,
      // there is nobody to report to and an unhandled rejection would be noise.
      if (entry.hasValue) entry.inflight.catch(() => {});
    }

    entries.set(key, entry);
    if (entry.hasValue) return Promise.resolve(entry.value);
    return entry.inflight;
  };
}

function invalidating(call) {
  return (...args) => {
    // Cleared going in as well as coming out: a read issued while the write is
    // still in flight must not be answered from something written before it.
    entries.clear();
    scheduleSave();
    const promise = Promise.resolve(call(...args));
    promise.then(() => { entries.clear(); scheduleSave(); }, () => {});
    return promise;
  };
}

const lmApi = {};
for (const [name, value] of Object.entries(base)) {
  if (typeof value !== 'function') {
    lmApi[name] = value;
    continue;
  }

  // Bound to the original object so a method reaching for a sibling through
  // `this` still finds it. Classification reads the *unbound* function: a bound
  // one stringifies to "[native code]" and would match nothing.
  const call = value.bind(base);

  if (CACHED.has(name)) lmApi[name] = staleWhileRevalidate(name, FRESH_MS, call);
  else if (name === 'claimInvites') lmApi[name] = staleWhileRevalidate(name, CLAIM_MS, call);
  else if (!NEVER_INVALIDATES.has(name) && WRITES.test(Function.prototype.toString.call(value))) {
    lmApi[name] = invalidating(call);
  } else lmApi[name] = call;
}

export default lmApi;
