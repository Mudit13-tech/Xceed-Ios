/**
 * Where a 401 is allowed to send the user.
 *
 * The platform navbar asks /user/getuser on every route, so an anonymous
 * visitor draws a 401 on any page they open. Acting on it as "your session
 * ended" is only right where being signed in was the premise — on the pages
 * built for people who cannot sign in, it throws away the page they came for.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../session', () => ({ clearNativeSession: vi.fn(() => Promise.resolve()) }));

const { clearNativeSession } = await import('../session');
const { handleUnauthorized } = await import('../httpSession');

/** jsdom's window.location is read-only; swap in a plain object we can watch. */
const atPath = (pathname) => {
  const location = { pathname, href: pathname };
  delete window.location;
  window.location = location;
  return location;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleUnauthorized', () => {
  it('sends a signed-in user back to the login screen', async () => {
    const location = atPath('/learning');

    await handleUnauthorized();

    expect(location.href).toBe('/login');
  });

  // The reported bug: the form opened and was replaced by the login screen a
  // moment later, so nobody could read the address field long enough to use it.
  it.each(['/login', '/forgot-password', '/register', '/help'])(
    'leaves a visitor on %s where they are',
    async (pathname) => {
      const location = atPath(pathname);

      await handleUnauthorized();

      expect(location.href).toBe(pathname);
    },
  );

  it('still drops the stored credentials wherever it fires', async () => {
    atPath('/forgot-password');

    await handleUnauthorized();

    expect(clearNativeSession).toHaveBeenCalledTimes(1);
  });
});
