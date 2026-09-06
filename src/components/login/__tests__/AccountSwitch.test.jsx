/**
 * Switching between saved accounts.
 *
 * The bug these cover: choosing another account updated the screen and nothing
 * else. Two separate causes, either of which alone left the user in the account
 * they had just switched away from.
 *
 *   1. The switcher never used the saved token. It set the account and dropped
 *      the user on the password form, so the only way to "switch" was to log in
 *      again from scratch — and a saved session was worth nothing.
 *
 *   2. Nothing tore down the previous account's data. The client keeps queries
 *      forever and mirrors the cache into Capacitor Preferences, so the hard
 *      navigation that ends a switch rehydrated the old account's name, roles
 *      and module data on the other side of it.
 *
 * The third cause lived in the request layer — the server prefers the httpOnly
 * `jwt` cookie over the Authorization header, and script cannot change that
 * cookie — and is fixed in main.jsx, which mounts the app on import and so is
 * not reachable from here.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../getenvironment', () => ({ default: () => 'http://api.test' }));

const SAVED = {
  saved_accounts: JSON.stringify([
    { email: 'asha@nitj.ac.in', name: 'Asha', token: 'token-asha', pin: null },
    { email: 'ravi@nitj.ac.in', name: 'Ravi', token: 'token-ravi', pin: null },
  ]),
  last_active_email: 'asha@nitj.ac.in',
};

const secureStore = { ...SAVED };

vi.mock('capacitor-secure-storage-plugin', () => ({
  SecureStoragePlugin: {
    get: vi.fn(({ key }) =>
      key in secureStore
        ? Promise.resolve({ value: secureStore[key] })
        : Promise.reject(new Error('not found')),
    ),
    set: vi.fn(({ key, value }) => {
      secureStore[key] = value;
      return Promise.resolve();
    }),
    remove: vi.fn(({ key }) => {
      delete secureStore[key];
      return Promise.resolve();
    }),
  },
}));

const preferences = {};
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(({ key }) => Promise.resolve({ value: preferences[key] ?? null })),
    set: vi.fn(({ key, value }) => {
      preferences[key] = value;
      return Promise.resolve();
    }),
    remove: vi.fn(({ key }) => {
      delete preferences[key];
      return Promise.resolve();
    }),
  },
}));

const removeClient = vi.fn(() => Promise.resolve());
vi.mock('../../../utils/queryPersister', () => ({
  queryPersister: {
    persistClient: vi.fn(() => Promise.resolve()),
    restoreClient: vi.fn(() => Promise.resolve()),
    removeClient: () => removeClient(),
  },
}));

import LoginForm from '../LoginForm';

let queryClient;

const renderForm = () => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ChakraProvider>
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      </ChakraProvider>
    </QueryClientProvider>,
  );
};

/** jsdom refuses a real navigation, so the switch's last step is recorded. */
const captureNavigation = () => {
  const seen = { href: null };
  delete window.location;
  window.location = {
    href: '',
    search: '',
    pathname: '/login',
    assign: vi.fn(),
  };
  Object.defineProperty(window.location, 'href', {
    get: () => seen.href ?? '',
    set: (value) => {
      seen.href = value;
    },
    configurable: true,
  });
  return seen;
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(secureStore, SAVED);
  Object.keys(preferences).forEach((key) => delete preferences[key]);
  localStorage.clear();
  localStorage.setItem('token', 'token-asha');
});

describe('switching to another saved account', () => {
  it('signs into the chosen account with its saved token', async () => {
    const navigation = captureNavigation();
    const user = userEvent.setup();
    renderForm();

    // Neither account has a PIN, and jsdom is not a native platform, so the
    // switcher is what a returning user lands on.
    await user.click(await screen.findByText('Ravi'));

    await waitFor(() => expect(navigation.href).toBeTruthy());

    // The whole point: the active token is Ravi's, without a password.
    expect(localStorage.getItem('token')).toBe('token-ravi');
    expect(secureStore.last_active_email).toBe('ravi@nitj.ac.in');
    expect(navigation.href).toBe('/userroles');
  });

  it('drops the previous account\'s cached data, in memory and on disk', async () => {
    const navigation = captureNavigation();
    const user = userEvent.setup();
    renderForm();

    // Something the previous account had loaded. Invalidating this would leave
    // the value in place; a switch has to remove it.
    queryClient.setQueryData(['user', 'details'], { name: 'Asha' });

    await user.click(await screen.findByText('Ravi'));
    await waitFor(() => expect(navigation.href).toBeTruthy());

    expect(queryClient.getQueryData(['user', 'details'])).toBeUndefined();
    // And the persisted copy, which the reload would otherwise restore.
    expect(removeClient).toHaveBeenCalled();
  });

  it('keeps the account it switched away from', async () => {
    const navigation = captureNavigation();
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByText('Ravi'));
    await waitFor(() => expect(navigation.href).toBeTruthy());

    // Switching is not signing out: Asha's token is untouched in secure
    // storage, so switching back needs no password.
    const saved = JSON.parse(secureStore.saved_accounts);
    expect(saved.map((a) => a.email)).toEqual(['asha@nitj.ac.in', 'ravi@nitj.ac.in']);
    expect(saved.find((a) => a.email === 'asha@nitj.ac.in').token).toBe('token-asha');
  });

  it('resumes a route saved before the session lapsed', async () => {
    preferences.pendingRoute = '/learning/classes/42';
    const navigation = captureNavigation();
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByText('Ravi'));
    await waitFor(() => expect(navigation.href).toBeTruthy());

    expect(navigation.href).toBe('/learning/classes/42');
    expect(preferences.pendingRoute).toBeUndefined();
  });
});

/**
 * Unlocking back into the session you are already in.
 *
 * This is not a switch, but it arrives through the same function, and on a
 * device it is by far the more common of the two: the app cold-starts at `/`,
 * which redirects to /login, so every launch unlocks the last-used account and
 * calls activateAccount. Tearing the cache down there ran the switch's teardown
 * on every restart — the persisted cache was written correctly, restored
 * correctly, and then deleted by the unlock a moment before the first screen
 * asked for it. It looked exactly like persistence not working at all.
 */
describe('resuming the account already signed in', () => {
  it('keeps its cached data, in memory and on disk', async () => {
    const navigation = captureNavigation();
    const user = userEvent.setup();
    renderForm();

    // Restored from the persisted cache on this launch, before the unlock.
    queryClient.setQueryData(['user', 'details'], { name: 'Asha' });

    // Asha is who `token` in localStorage already names — the same account,
    // not another one.
    await user.click(await screen.findByText('Asha'));
    await waitFor(() => expect(navigation.href).toBeTruthy());

    expect(localStorage.getItem('token')).toBe('token-asha');
    expect(queryClient.getQueryData(['user', 'details'])).toEqual({ name: 'Asha' });
    expect(removeClient).not.toHaveBeenCalled();
  });

  it('still tears the cache down when there is no active token to match', async () => {
    // A launch that lost localStorage — the WebView clears it under storage
    // pressure, which is the whole reason the cache itself lives in Preferences.
    // Whose cache the snapshot belongs to is then unknowable, so it goes.
    localStorage.removeItem('token');
    const navigation = captureNavigation();
    const user = userEvent.setup();
    renderForm();

    queryClient.setQueryData(['user', 'details'], { name: 'Asha' });

    await user.click(await screen.findByText('Asha'));
    await waitFor(() => expect(navigation.href).toBeTruthy());

    expect(queryClient.getQueryData(['user', 'details'])).toBeUndefined();
    expect(removeClient).toHaveBeenCalled();
  });
});
