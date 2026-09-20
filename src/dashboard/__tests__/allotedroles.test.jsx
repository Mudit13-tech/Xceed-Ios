import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

// The page navigates by calling useNavigate()'s result, so the auto-redirect is
// only observable through a spy — rendering the component directly leaves it
// mounted and still drawing cards even after it has navigated away, which is
// how a redirect that hid every card went unnoticed here.
const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateSpy };
});

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

const originalFetch = globalThis.fetch;

const jsonResponse = (data, ok = true) => ({
  ok,
  json: async () => data,
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.resetModules();
  navigateSpy.mockClear();
  // The crash test below registers a `vi.doMock` for authRedirect, and a
  // doMock outlives the test that made it — `resetModules` clears the module
  // registry but not the mock registration. Left in place it makes
  // singleRoleTarget throw for every later test in this file, where the page's
  // own try/catch swallows it and the redirect silently never happens: a test
  // asserting a redirect then passes or fails for a reason that has nothing to
  // do with the code under test.
  vi.doUnmock('../../authRedirect');
});

/** Lets the mount's effects, and the redirect one behind them, actually run. */
const settle = () => new Promise((resolve) => { setTimeout(resolve, 50); });

const mockFetchFor = (user) => {
  globalThis.fetch = vi.fn((url) => {
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

/**
 * The two dashboard roles a head of department holds.
 *
 * `HOD` used to be one role standing for two screens, so the page inferred the
 * second one and invented an unstored "ileed-hod" key to hang a card on.
 * `hod-learning` and `hod-ileed` are those screens, named — which means the
 * page's job here is no longer to infer anything, but to make sure a head is
 * offered each dashboard exactly once and is not offered one that has been
 * taken away from them.
 */
describe('a head of department is offered one card per dashboard', () => {
  const hodUser = (role) => ({
    _id: 'u3',
    name: 'Head-CSE',
    email: ['head.cse@nitj.ac.in'],
    role,
    roleTargets: {
      HOD: '/learning/hod-dashboard',
      'hod-learning': '/learning/hod-dashboard',
      'hod-ileed': '/ileed-hod/dashboard',
      'ileed-hod': '/ileed-hod/dashboard',
    },
  });

  const cardHeadings = () =>
    screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent);

  it('shows both, and not a third for the bare appointment', async () => {
    mockFetchFor(hodUser(['HOD', 'hod-learning', 'hod-ileed']));

    const { default: AllocatedRolesPage } = await import('../allotedroles');
    renderWithProviders(<AllocatedRolesPage />);

    await waitFor(() => expect(cardHeadings().length).toBeGreaterThan(0));
    // Exactly two: one per dashboard. Three would mean the appointment is
    // being drawn as a card of its own and opening one of them twice.
    expect(cardHeadings()).toEqual(['Xceed Learning — HOD', 'iLEED — HOD']);
  });

  /* Splitting the role in two is only worth anything if either half can be
     withdrawn. A head left holding the Learning dashboard must not be handed
     the attendance one back by the legacy card the page appends. */
  it('does not hand back a dashboard an administrator has withdrawn', async () => {
    mockFetchFor(hodUser(['HOD', 'hod-learning']));

    const { default: AllocatedRolesPage } = await import('../allotedroles');
    renderWithProviders(<AllocatedRolesPage />);

    await waitFor(() => expect(cardHeadings().length).toBeGreaterThan(0));
    expect(cardHeadings()).toEqual(['Xceed Learning — HOD']);
  });

  /* Every head appointed before the two roles existed holds only `HOD` until
     the boot migration reaches them, and must keep both screens meanwhile. */
  it('still offers both to a head who holds only the appointment', async () => {
    mockFetchFor(hodUser(['HOD']));

    const { default: AllocatedRolesPage } = await import('../allotedroles');
    renderWithProviders(<AllocatedRolesPage />);

    await waitFor(() => expect(cardHeadings().length).toBeGreaterThan(0));
    expect(cardHeadings()).toEqual(['Xceed Learning — HOD', 'iLEED — HOD']);
  });

  /* The bug a head actually reported: no cards at all.
     `HOD` is one role, so the "only one role — skip the picker" shortcut fired
     and dropped them on the Learning dashboard. The second card was built and
     never seen. One role, but two destinations, so the shortcut does not
     apply. */
  it('does not skip the picker for a head whose one role opens two dashboards', async () => {
    mockFetchFor(hodUser(['HOD']));

    const { default: AllocatedRolesPage } = await import('../allotedroles');
    renderWithProviders(<AllocatedRolesPage />);

    await waitFor(() => expect(cardHeadings().length).toBeGreaterThan(0));
    await settle();
    expect(navigateSpy).not.toHaveBeenCalledWith('/learning/hod-dashboard');
    expect(navigateSpy).not.toHaveBeenCalledWith('/ileed-hod/dashboard');
  });

  /* Roles are typed by hand, so the same head is stored `HOD`, `hod` or `Hod`.
     Matched on the key: the unknown-role fallback prints the raw string, so a
     head stored as `hod` got a card titled "hod" instead of a dashboard name. */
  it('names the cards however the role was typed', async () => {
    mockFetchFor(hodUser(['hod']));

    const { default: AllocatedRolesPage } = await import('../allotedroles');
    renderWithProviders(<AllocatedRolesPage />);

    await waitFor(() => expect(cardHeadings().length).toBeGreaterThan(0));
    expect(cardHeadings()).toEqual(['Xceed Learning — HOD', 'iLEED — HOD']);
    await settle();
    expect(navigateSpy).not.toHaveBeenCalledWith('/learning/hod-dashboard');
  });

  it('names the named roles however they were typed', async () => {
    mockFetchFor(hodUser(['Hod', 'HOD-LEARNING', 'Hod-Ileed']));

    const { default: AllocatedRolesPage } = await import('../allotedroles');
    renderWithProviders(<AllocatedRolesPage />);

    await waitFor(() => expect(cardHeadings().length).toBeGreaterThan(0));
    expect(cardHeadings()).toEqual(['Xceed Learning — HOD', 'iLEED — HOD']);
  });

  /* The shortcut is not disabled for heads in general — only while the one
     role really does stand for two screens. An administrator who withdrew the
     iLEED dashboard left exactly one destination, so going straight there is
     right. */
  it('still skips the picker once a head has only one dashboard left', async () => {
    mockFetchFor(hodUser(['HOD', 'hod-learning']));

    const { default: AllocatedRolesPage } = await import('../allotedroles');
    renderWithProviders(<AllocatedRolesPage />);

    await waitFor(() => expect(cardHeadings().length).toBeGreaterThan(0));
    await settle();
    expect(navigateSpy).toHaveBeenCalledWith('/learning/hod-dashboard');
  });
});

/**
 * The two dashboards a Dean (Academic) holds, through one role.
 *
 * The head-of-department story one scope up, and it arrives with the same two
 * failure modes already seen above: a second dashboard that is never offered,
 * and a single-role account dropped straight onto the first of them. `DEAN` is
 * one stored role — there is no `dean-learning`/`dean-ileed` split — so the
 * iLEED card is appended, exactly as the bare head's is.
 */
describe('a Dean (Academic) is offered one card per dashboard', () => {
  const deanUser = (role = ['DEAN']) => ({
    _id: 'u4',
    name: 'Dean-Academic',
    email: ['dean@nitj.ac.in'],
    role,
    roleTargets: {
      DEAN: '/learning/dean-dashboard',
      'ileed-dean': '/ileed-dean/dashboard',
    },
  });

  const cardHeadings = () =>
    screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent);

  it('offers the learning dashboard and the iLEED one', async () => {
    mockFetchFor(deanUser());

    const { default: AllocatedRolesPage } = await import('../allotedroles');
    renderWithProviders(<AllocatedRolesPage />);

    await waitFor(() => expect(cardHeadings().length).toBeGreaterThan(0));
    expect(cardHeadings()).toEqual(['Dean (Academic)', 'iLEED — Dean (Academic)']);
  });

  /* The bug the head reported, in the shape it would take for a dean: one
     role, so the "skip the picker" shortcut fires and the second card is built
     and never seen. */
  it('does not skip the picker for a dean, whose one role opens two dashboards', async () => {
    mockFetchFor(deanUser());

    const { default: AllocatedRolesPage } = await import('../allotedroles');
    renderWithProviders(<AllocatedRolesPage />);

    await waitFor(() => expect(cardHeadings().length).toBeGreaterThan(0));
    await settle();
    expect(navigateSpy).not.toHaveBeenCalledWith('/learning/dean-dashboard');
    expect(navigateSpy).not.toHaveBeenCalledWith('/ileed-dean/dashboard');
  });

  /* Roles are typed by hand here too. */
  it('names the cards however the role was typed', async () => {
    mockFetchFor(deanUser(['dean']));

    const { default: AllocatedRolesPage } = await import('../allotedroles');
    renderWithProviders(<AllocatedRolesPage />);

    await waitFor(() => expect(cardHeadings().length).toBeGreaterThan(0));
    expect(cardHeadings()).toEqual(['Dean (Academic)', 'iLEED — Dean (Academic)']);
  });

  /* The iLEED card is the dean's, not everybody's. */
  it('does not offer it to somebody who is not a dean', async () => {
    mockFetchFor({
      _id: 'u5',
      name: 'Someone',
      email: ['someone@nitj.ac.in'],
      role: ['FACULTY', 'ITTC'],
      roleTargets: { FACULTY: '/learning', ITTC: '/tt/admin' },
    });

    const { default: AllocatedRolesPage } = await import('../allotedroles');
    renderWithProviders(<AllocatedRolesPage />);

    await waitFor(() => expect(cardHeadings().length).toBeGreaterThan(0));
    expect(cardHeadings()).not.toContain('iLEED — Dean (Academic)');
  });
});
