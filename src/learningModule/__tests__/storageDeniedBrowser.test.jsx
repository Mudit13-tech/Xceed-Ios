/**
 * A browser that keeps no site data, which is the one every exam is sat in.
 *
 * `localStorage` is not simply absent when a browser is told to keep nothing:
 * `getItem` throws a `SecurityError`, and in Chromium so does the
 * `window.localStorage` property access itself. So a bare read is a throw site,
 * and the platform put two of them on the path of *every* request it makes —
 * inside the global `fetch` wrapper and the axios interceptor in main.jsx. One
 * `SecurityError` there is not a lost preference; it is every call in the
 * application dying before it reaches the network, which is what a student
 * reports as the app erroring the moment the paper opens.
 *
 * Safe Exam Browser is where this actually happens. A `.seb` profile carries
 * `removeLocalStorage`; the settings file this platform generates sets it false
 * on purpose (server sebTemplate.js), but an institution may sit its exams on a
 * file built elsewhere — and then it is the students in the exam browser, and
 * nobody else, on machines with no devtools to open.
 *
 * Nothing is actually lost by storage going away: the session token is issued as
 * an httpOnly cookie as well as in the body (server readAuthToken), so the
 * account stays signed in on the cookie the browser sends by itself. Only the
 * throw was fatal.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../getenvironment', () => ({ default: () => 'https://exams.example.edu' }));
vi.mock('../serverClock', () => ({ sync: () => {} }));

import lmApi from '../api/lmApi';
import { readLocal, writeLocal, localStorageAvailable, safeLocalStorage } from '../../utils/safeStorage';

const denied = () => {
  throw new DOMException('The operation is insecure.', 'SecurityError');
};

/** A browser that answers every storage question with a SecurityError. */
const denyStorage = () => {
  const throwing = {
    getItem: denied,
    setItem: denied,
    removeItem: denied,
    clear: denied,
    key: denied,
    length: 0,
  };
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(throwing);
};

const okResponse = () => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  text: async () => JSON.stringify({ ok: true }),
});

describe('safeStorage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads and writes normally when the browser allows it', () => {
    expect(writeLocal('probe-key', 'kept')).toBe(true);
    expect(readLocal('probe-key')).toBe('kept');
    expect(localStorageAvailable()).toBe(true);
  });

  it('answers null rather than throwing when the browser refuses', () => {
    denyStorage();

    expect(() => readLocal('token')).not.toThrow();
    expect(readLocal('token')).toBeNull();
    expect(localStorageAvailable()).toBe(false);
  });

  it('reports a write that could not be kept, rather than throwing', () => {
    denyStorage();

    expect(() => writeLocal('token', 'abc')).not.toThrow();
    expect(writeLocal('token', 'abc')).toBe(false);
  });

  it('offers a Storage-shaped object safe to hand to a library', () => {
    /* The react-query persister takes the store as a constructor argument and
       captures it at import time — which is exactly when the property access can
       throw, taking the whole bundle's evaluation with it rather than merely
       losing the cache. */
    denyStorage();

    expect(() => safeLocalStorage.setItem('k', 'v')).not.toThrow();
    expect(safeLocalStorage.getItem('k')).toBeNull();
    expect(() => safeLocalStorage.removeItem('k')).not.toThrow();
  });

  it('survives a browser that hands back a store and only throws when it is used', () => {
    // Having the object is not proof it works, which is why the helper probes it.
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({ getItem: denied, setItem: denied });
    expect(readLocal('token')).toBeNull();
  });
});

describe('the learning module in a browser that keeps no site data', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => okResponse());
  });
  afterEach(() => vi.restoreAllMocks());

  it('still makes its requests, unauthenticated by header', async () => {
    /* The payoff. Without a stored token there is no Authorization header, and
       the request is signed by the httpOnly cookie instead — `credentials:
       include` is on every call. What must not happen is the call never being
       made at all. */
    denyStorage();

    await expect(lmApi.heartbeat('c1', 'a1')).resolves.toBeTruthy();

    const [, options] = global.fetch.mock.calls.at(-1);
    expect(options.credentials).toBe('include');
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('sends the token as usual when the browser does keep it', async () => {
    window.localStorage.setItem('token', 'a-real-session');

    await lmApi.heartbeat('c1', 'a1');

    const [, options] = global.fetch.mock.calls.at(-1);
    expect(options.headers.Authorization).toBe('Bearer a-real-session');
    window.localStorage.removeItem('token');
  });
});
