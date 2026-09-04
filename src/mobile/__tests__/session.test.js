import { beforeEach, describe, expect, it, vi } from 'vitest';

let store = {};

vi.mock('capacitor-secure-storage-plugin', () => ({
  SecureStoragePlugin: {
    get: vi.fn(({ key }) =>
      key in store ? Promise.resolve({ value: store[key] }) : Promise.reject(new Error('not found')),
    ),
    set: vi.fn(({ key, value }) => {
      store[key] = value;
      return Promise.resolve();
    }),
    remove: vi.fn(({ key }) => {
      if (!(key in store)) return Promise.reject(new Error('not found'));
      delete store[key];
      return Promise.resolve();
    }),
  },
}));

const { clearNativeSession } = await import('../session');

const ASHA = { email: 'asha@nitj.ac.in', name: 'Asha', token: 'token-asha', pin: '1234' };
const RAVI = { email: 'ravi@nitj.ac.in', name: 'Ravi', token: 'token-ravi', pin: '5678' };

const savedAccounts = () => JSON.parse(store.saved_accounts);

beforeEach(() => {
  store = {
    saved_accounts: JSON.stringify([ASHA, RAVI]),
    last_active_email: ASHA.email,
  };
  localStorage.setItem('token', ASHA.token);
});

describe('clearNativeSession', () => {
  /**
   * The bug this exists for. Signing out cleared `user_pin` and `auth_token` —
   * the keys the app used before the account switcher — while the credential
   * anyone actually had sat in `saved_accounts`. The account came back on the
   * login screen with a live token and its PIN, and four digits undid the
   * sign-out.
   */
  it('removes the signed-out account, so its token cannot unlock the session again', async () => {
    await clearNativeSession();

    expect(savedAccounts().map((a) => a.email)).toEqual([RAVI.email]);
    expect(JSON.stringify(savedAccounts())).not.toContain(ASHA.token);
    expect(JSON.stringify(savedAccounts())).not.toContain(ASHA.pin);
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('leaves the other saved accounts alone — signing out of one is how you reach another', async () => {
    await clearNativeSession();

    expect(savedAccounts()).toEqual([RAVI]);
    expect(store.last_active_email).toBe(RAVI.email);
  });

  it('forgets the last active account when it was the only one', async () => {
    store.saved_accounts = JSON.stringify([ASHA]);
    await clearNativeSession();

    expect(savedAccounts()).toEqual([]);
    expect(store.last_active_email).toBeUndefined();
  });

  it('identifies the account by its token, not by whichever was chosen last', async () => {
    // A switch that did not finish can leave last_active_email pointing at an
    // account other than the one whose token is live. The live one signs out.
    store.last_active_email = RAVI.email;
    localStorage.setItem('token', ASHA.token);

    await clearNativeSession();

    expect(savedAccounts().map((a) => a.email)).toEqual([RAVI.email]);
    expect(store.last_active_email).toBe(RAVI.email);
  });

  it('still clears the legacy keys, for a device that has not signed in since the switcher', async () => {
    store.user_pin = '1234';
    store.auth_token = 'legacy-token';

    await clearNativeSession();

    expect(store.user_pin).toBeUndefined();
    expect(store.auth_token).toBeUndefined();
  });

  it('does not throw when there is no secure storage at all (the web build)', async () => {
    store = {};
    localStorage.setItem('token', 'whatever');

    await expect(clearNativeSession()).resolves.toBeUndefined();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
