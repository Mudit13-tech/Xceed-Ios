/**
 * Web storage that cannot take the application down with it.
 *
 * `localStorage` is not always there, and the way it is missing is the problem:
 * a browser told not to keep site data throws a `SecurityError` from
 * `getItem` — and, in Chromium, from the `window.localStorage` *property access*
 * itself — rather than returning null. So every bare `localStorage.getItem(...)`
 * is a throw site, and the two that matter most sit inside the global `fetch`
 * wrapper and the axios interceptor in main.jsx, which every request in the
 * application passes through. One `SecurityError` there is not a degraded
 * feature; it is every call in the app throwing before it reaches the network.
 *
 * Where this actually bites is Safe Exam Browser. A `.seb` profile carries
 * `removeLocalStorage`, and the settings file this platform generates
 * deliberately sets it false (see server sebTemplate.js) precisely so the token
 * survives — but an institution may sit its exams on a file built elsewhere, or
 * an older one, and SEB's own default has not always been the kind one. The
 * result is an error the moment the paper loads, for the students in the exam
 * browser and for nobody else, on a machine nobody can open devtools on.
 *
 * Losing storage is survivable and always was: the session token is issued as an
 * httpOnly cookie as well as in the response body (see server readAuthToken), so
 * an account that cannot keep a copy in localStorage is still signed in by the
 * cookie the browser sends on its own. What was not survivable was the throw.
 *
 * The same reasoning the learning module already applies to every sessionStorage
 * touch it makes — see `quizSession` and the proctoring queue in lmApi.js —
 * applied to the one read that predates it and covers everything else.
 */

/**
 * The store, or null when this browser will not give us one.
 *
 * The probe matters: some browsers hand back a `localStorage` object and only
 * throw when it is used, so having the object is not proof it works. Not cached,
 * because permission can change under a running page (a student granting site
 * data mid-sitting) and this is a property read on a path that is already doing
 * a network call.
 */
function store(kind) {
  try {
    const storage = kind === 'session' ? window.sessionStorage : window.localStorage;
    if (!storage) return null;
    // Touching it is the only reliable test.
    storage.getItem('__probe__');
    return storage;
  } catch {
    return null;
  }
}

/** @returns {string|null} the stored value, or null for missing *or* unavailable. */
export function readLocal(key) {
  try {
    return store('local')?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** @returns {boolean} whether the value was actually kept. */
export function writeLocal(key, value) {
  try {
    const storage = store('local');
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    // Also the quota case, which is a different fault with the same remedy:
    // carry on without a stored copy.
    return false;
  }
}

export function removeLocal(key) {
  try {
    store('local')?.removeItem(key);
  } catch {
    /* nothing to remove */
  }
}

/** Whether this browser is keeping anything for us at all. */
export const localStorageAvailable = () => store('local') !== null;

/**
 * A Storage-shaped object that is safe to hand to a library.
 *
 * Anything that takes `window.localStorage` as a constructor argument — the
 * react-query persister does — captures it at import time, which is exactly when
 * the property access can throw and take the whole bundle's evaluation with it.
 * This is the same three methods with the failure already handled.
 */
export const safeLocalStorage = {
  getItem: (key) => readLocal(key),
  setItem: (key, value) => {
    writeLocal(key, value);
  },
  removeItem: (key) => removeLocal(key),
};
