import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The bug report: clicking "Dashboard" in the navbar (a plain <a
 * href="/userroles">) landed on a completely blank page for a single-role
 * user.
 *
 * Root cause: this page's own single-role auto-redirect effect calls
 * singleRoleTarget(role, user) exactly like LoginForm.jsx does, but with no
 * try/catch around it — and there is no error boundary anywhere in this app
 * (confirmed: no ErrorBoundary component exists in client/src). An exception
 * thrown from inside a useEffect unmounts the whole tree in React, so the
 * same "name is unset, email arrives as an array or a plain string" shape
 * that made LoginForm show a swallowed "An error occurred" message instead
 * blanked this page entirely, with nothing in the UI or history to recover
 * from.
 *
 * singleRoleTarget itself was already fixed (see authRedirect.js and
 * authRedirect.test.js) to normalize email before calling toLowerCase, which
 * already prevents this specific crash. This test guards the page itself:
 * even if some future user shape trips up single-role resolution again, the
 * effect here must not let that take the whole page down with it.
 */

const originalFetch = global.fetch;

const jsonResponse = (data, ok = true) => ({
  ok,
  json: async () => data,
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.resetModules();
});

const mockFetchFor = (user) => {
  global.fetch = vi.fn((url) => {
    if (String(url).includes('/user/getuser')) {
      return Promise.resolve(jsonResponse({ user }));
    }
    if (String(url).includes('/learningmodule/overview')) {
      return Promise.resolve(jsonResponse({ teachingCount: 0, enrolledCount: 0 }));
    }
    return Promise.resolve(jsonResponse({}, false));
  });
};

it('does not blank the page for a single-role user whose singleRoleTarget resolution throws', async () => {
  // Forces the crash this page must survive, independent of whatever
  // authRedirect.js currently does — simulates a future regression there.
  vi.doMock('../../authRedirect', async () => {
    const actual = await vi.importActual('../../authRedirect');
    return {
      ...actual,
      singleRoleTarget: () => {
        throw new TypeError('user.email.toLowerCase is not a function');
      },
    };
  });

  mockFetchFor({ _id: 'u1', name: undefined, email: ['ittc.cse@nitj.ac.in'], role: ['ITTC'] });

  const { default: AllocatedRolesPage } = await import('../allotedroles');
  renderWithProviders(<AllocatedRolesPage />);

  // The page must still show *something* — its own role card, at minimum —
  // rather than an empty document. A blank page has no role/heading text at
  // all; this is the actual regression signal.
  await waitFor(() => {
    expect(document.body.textContent.trim().length).toBeGreaterThan(0);
  });
  expect(await screen.findByText(/institute time table coordinator/i)).toBeInTheDocument();
});

it('auto-redirects a genuinely single-role user without crashing (real singleRoleTarget, array email, no name)', async () => {
  mockFetchFor({ _id: 'u2', name: undefined, email: ['dtti.cse@nitj.ac.in'], role: ['DTTI'] });

  const { default: AllocatedRolesPage } = await import('../allotedroles');
  renderWithProviders(<AllocatedRolesPage />);

  await waitFor(() => {
    expect(document.body.textContent.trim().length).toBeGreaterThan(0);
  });
});
