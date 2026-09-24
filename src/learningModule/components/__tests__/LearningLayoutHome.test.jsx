/**
 * The way out of the learning module.
 *
 * Students get no platform navbar above this header (`studentOnly` hides it),
 * and neither does a teacher on a phone, so for most of the people inside the
 * module the only exit used to be the browser's back button — which, after a
 * few screens of classes, is a long way from the front page. The X in the
 * header is that exit, and the drawer repeats it where navigation actually
 * happens on a phone.
 *
 * Pinned here because both are one attribute away from being useless: a router
 * link instead of an anchor cannot be opened in a second tab, and a missing
 * label makes a logo-only button unreachable by anything but a mouse.
 */

import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

const ME = {
  name: 'Asha',
  email: 'asha@nitj.ac.in',
  roles: ['STUDENT'],
  isAdmin: false,
};

vi.mock('../../api/lmApi', () => ({
  default: {
    claimInvites: vi.fn(async () => ({ claimed: 0 })),
    me: vi.fn(async () => ME),
    overview: vi.fn(async () => ({ awaitingReview: 0 })),
    listClasses: vi.fn(async () => []),
  },
}));

/* Both pull their own data on mount and neither is what this file is about. */
vi.mock('../NotificationBell', () => ({ default: () => null }));
vi.mock('../../hooks/useTimetableChanges', () => ({ default: () => ({ changes: [], dismiss: vi.fn() }) }));

const renderLayout = async () => {
  const { default: LearningLayout } = await import('../LearningLayout');
  return renderWithProviders(<LearningLayout />, { route: '/learning' });
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
  Element.prototype.scrollIntoView = vi.fn();
});

describe('learning module logout', () => {
  it('asks before signing out, and signs out once confirmed', async () => {
    const user = userEvent.setup();
    await renderLayout();

    await user.click(await screen.findByRole('button', { name: 'Logout' }));

    const dialog = await screen.findByRole('alertdialog');
    // Named *in the dialog*, because on a shared lab machine "log out" is
    // ambiguous in the one way that matters. Scoped, since the account menu
    // carries the same address elsewhere on the page.
    expect(within(dialog).getByText('asha@nitj.ac.in')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() =>
      expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/user/getuser/logout'))).toBe(true),
    );
  });

  it('stays signed in when the question is declined', async () => {
    const user = userEvent.setup();
    await renderLayout();

    await user.click(await screen.findByRole('button', { name: 'Logout' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('XCEED home from the learning module', () => {
  it('puts an X in the header that leaves for the platform', async () => {
    await renderLayout();

    const home = await screen.findByRole('link', { name: 'XCEED home' });
    // A real anchor at the site root, so it can be opened in a second tab while
    // a class stays open in this one.
    expect(home).toHaveAttribute('href', '/');
    expect(home.tagName).toBe('A');
  });

  it('sits with the theme and sign-out buttons as one square set', async () => {
    await renderLayout();

    const home = await screen.findByRole('link', { name: 'XCEED home' });
    // The shared 32px treatment: a home button that is a different size from
    // the pair beside it reads as something else entirely.
    expect(home).toHaveStyle({ width: '32px', height: '32px' });
  });

  it('carries the brand mark rather than a bare glyph', async () => {
    await renderLayout();
    const home = await screen.findByRole('link', { name: 'XCEED home' });

    const logo = home.querySelector('img');
    expect(logo).not.toBeNull();
    expect(logo.getAttribute('src')).toBe('/clublogo.png');
    // Decorative: the button is already labelled, and a second name read out
    // beside it is noise.
    expect(logo.getAttribute('alt')).toBe('');
  });

  /**
   * clublogo.png is a near-white wordmark on transparency — its opaque pixels
   * average rgb(242,242,242). It was drawn for the platform's dark hero, and
   * this header is white in light mode, so the button was a white X on white:
   * in daylight there was nothing there to press.
   *
   * Asserted as "not transparent" rather than against one exact colour: the
   * point is that the mark never borrows the header's background, whatever
   * shade of dark is chosen for it later.
   */
  it('does not leave the white wordmark on a white header', async () => {
    await renderLayout();
    const home = await screen.findByRole('link', { name: 'XCEED home' });

    const { backgroundColor } = window.getComputedStyle(home);
    expect(backgroundColor).not.toBe('transparent');
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('gives the mark a dark ground in the drawer too, where a phone sees it', async () => {
    const user = userEvent.setup();
    await renderLayout();

    await user.click(await screen.findByRole('button', { name: 'Open menu' }));
    const drawer = await screen.findByRole('dialog');
    const logo = within(drawer).getByRole('link', { name: /XCEED home/i }).querySelector('img');

    const { backgroundColor } = window.getComputedStyle(logo.parentElement);
    expect(backgroundColor).not.toBe('transparent');
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('repeats the exit in the mobile drawer', async () => {
    const user = userEvent.setup();
    await renderLayout();

    await user.click(await screen.findByRole('button', { name: 'Open menu' }));

    const drawer = await screen.findByRole('dialog');
    const home = within(drawer).getByRole('link', { name: /XCEED home/i });
    expect(home).toHaveAttribute('href', '/');
  });
});
