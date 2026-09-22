import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import AttendanceMenusPanel from '../attendanceMenus';
import { ALL_MENUS, leadershipMenuKeysFor } from '../../attendancemodule/menuCatalogue';

/**
 * Choosing which iLEED screens the two leadership views carry.
 *
 * The sibling of dashboardSections.test.jsx, and it guards the rules that are
 * NOT the same as that panel's — which is exactly why they are easy to get
 * wrong when the two sit on one page:
 *
 *  - **Absent means OFF here.** The learning module's panel shows everything
 *    until somebody hides it; this module's leadership toggles all default to
 *    false, because a view opens from a role card the moment an appointment is
 *    made. Reading these the other way round would hand every head of
 *    department every screen the first time an admin opened this form.
 *  - **Two audiences, two documents.** The HOD column writes `hodMenus` and the
 *    dean's writes `deanMenus`, at two different endpoints. Saving one must not
 *    post the other, or adjusting the dean's view rewrites every head's.
 *  - **One column failing is not both failing.** The two are read separately,
 *    so a dead endpoint must cost its own column and leave the other editable —
 *    and must not let a save write "everything off" over what is stored.
 */

const jsonResponse = (body, ok = true) => ({ ok, json: async () => body });

const routeFetch = (overrides = {}) =>
  vi.fn(async (url, options) => {
    const isDean = String(url).includes('dean-menus');
    if (options?.method === 'PUT') {
      const body = JSON.parse(options.body);
      return jsonResponse(body);
    }
    if (isDean) {
      return overrides.loadDean
        ? overrides.loadDean()
        : jsonResponse({ deanMenus: { attendanceReports: true } });
    }
    return overrides.loadHod
      ? overrides.loadHod()
      : jsonResponse({ hodMenus: { attendanceReports: true, livePreview: true } });
  });

const renderPanel = () =>
  render(
    <ChakraProvider>
      <AttendanceMenusPanel />
    </ChakraProvider>,
  );

const HOD = 'HOD — iLEED menus';
const DEAN = 'Dean (Academic) — iLEED menus';

/** One audience's column, found by its heading. */
const column = (title) =>
  screen.getByRole('heading', { name: title }).closest('div').parentElement.parentElement;

const switchFor = (title, label) =>
  within(column(title)).getByRole('checkbox', { name: new RegExp(`^${label} on`) });

const writes = () =>
  globalThis.fetch.mock.calls.filter(([, options]) => options?.method === 'PUT');

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = routeFetch();
});

describe('the two columns', () => {
  it('reads each audience from its own endpoint', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: HOD });

    const urls = globalThis.fetch.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.endsWith('/hod-menus'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/dean-menus'))).toBe(true);
    expect(screen.getByRole('heading', { name: DEAN })).toBeInTheDocument();
  });

  /* The catalogue is shared with the attendance module's own Dept Menu Config
     screen, so a menu added there appears here without this file being
     touched — and the two screens cannot come to disagree about what a menu
     is. */
  it('builds its rows from the shared catalogue, not a list of its own', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: HOD });

    for (const menu of ALL_MENUS) {
      // Once per column.
      expect(screen.getAllByText(menu.label)).toHaveLength(2);
    }
  });

  it('shows a menu nobody has turned on as off — the opposite of the learning panel', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: HOD });

    // Stored true for the head, and for the dean.
    expect(switchFor(HOD, 'Attendance Reports')).toBeChecked();
    expect(switchFor(DEAN, 'Attendance Reports')).toBeChecked();
    // Stored true for the head only.
    expect(switchFor(HOD, 'Live Preview')).toBeChecked();
    expect(switchFor(DEAN, 'Live Preview')).not.toBeChecked();
    // Absent everywhere, and therefore off rather than on.
    expect(switchFor(HOD, 'Camera Registry')).not.toBeChecked();
    expect(switchFor(DEAN, 'Camera Registry')).not.toBeChecked();
  });

  it('turns a defaulted-off menu on with the first click', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: HOD });

    await userEvent.click(switchFor(DEAN, 'Camera Registry'));
    expect(switchFor(DEAN, 'Camera Registry')).toBeChecked();
  });

  it('offers Save only once something has changed, and only on that column', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: HOD });

    const hodSave = within(column(HOD)).getByRole('button', { name: /^Save/ });
    expect(hodSave).toBeDisabled();

    await userEvent.click(switchFor(HOD, 'Camera Registry'));
    expect(hodSave).toBeEnabled();
    expect(within(column(DEAN)).getByRole('button', { name: /^Save/ })).toBeDisabled();
  });

  it('saves one audience to its own field without posting the other', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: HOD });

    await userEvent.click(switchFor(DEAN, 'Camera Registry'));
    await userEvent.click(within(column(DEAN)).getByRole('button', { name: /^Save/ }));

    await waitFor(() => expect(writes()).toHaveLength(1));

    const [url, options] = writes()[0];
    expect(String(url)).toContain('dean-menus');
    const body = JSON.parse(options.body);
    expect(body.deanMenus.cameraRegistry).toBe(true);
    // The head's field is not in the body at all: an administrator adjusting
    // the dean's view has said nothing about every head's.
    expect(body.hodMenus).toBeUndefined();
  });

  it('enables every menu in the catalogue, not only the ones already stored', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: HOD });

    await userEvent.click(within(column(DEAN)).getByRole('button', { name: 'Enable all' }));
    await userEvent.click(within(column(DEAN)).getByRole('button', { name: /^Save/ }));

    await waitFor(() => expect(writes()).toHaveLength(1));

    const body = JSON.parse(writes()[0][1].body);
    for (const menu of ALL_MENUS) {
      expect(body.deanMenus[menu.key]).toBe(true);
    }
  });
});

describe('when one column cannot be loaded', () => {
  beforeEach(() => {
    globalThis.fetch = routeFetch({
      loadDean: () => jsonResponse({ error: 'Internal server error' }, false),
    });
  });

  it('leaves the other column editable', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: HOD });

    expect(switchFor(HOD, 'Attendance Reports')).toBeChecked();
    await userEvent.click(switchFor(HOD, 'Camera Registry'));
    expect(within(column(HOD)).getByRole('button', { name: /^Save/ })).toBeEnabled();
  });

  /* The dangerous case. With nothing read, every switch would draw "off" — so
     a save would write "everything off" over whatever is actually stored. The
     column says so and refuses to be edited instead. */
  it('refuses to let the failed column be saved over', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: DEAN });

    expect(within(column(DEAN)).getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(within(column(DEAN)).getByRole('button', { name: /^Save/ })).toBeDisabled();
    expect(within(column(DEAN)).queryByRole('checkbox')).toBeNull();
  });
});

describe('which menus the views actually draw', () => {
  const labelled = (key) => ALL_MENUS.find((menu) => menu.key === key).label;

  /* Eighteen switches of which five do anything is a trap, so the ones with a
     screen behind them are marked — and marked from the layouts' own list, so
     a screen added to them is marked without this panel being edited. */
  it('marks exactly the menus that column\'s layout renders', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: HOD });

    // Counted inside each column: the footer note below them uses the same
    // words to explain what the badge means, and a bare screen-wide count
    // would be asserting that sentence as well.
    for (const [title, audience] of [[HOD, 'hod'], [DEAN, 'dean']]) {
      const keys = leadershipMenuKeysFor(audience);
      expect(within(column(title)).getAllByText('has a screen')).toHaveLength(keys.length);

      for (const key of keys) {
        const row = within(column(title)).getAllByText(labelled(key))[0].closest('div');
        expect(within(row).getByText('has a screen')).toBeInTheDocument();
      }
    }
  });

  /* The bug this replaced: the badge was drawn from one shared list, so the
     HOD column promised a screen for Confidence Monitor and Class
     Verification. Neither has a route under /ileed-hod at all — an
     administrator switched them on and waited for links that could never
     appear. The Dean's column still marks them, because the Dean's view
     really does draw them. */
  it('does not promise the head of department a screen the dean alone has', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: HOD });

    for (const key of ['confidenceMonitor', 'classVerification']) {
      const hodRow = within(column(HOD)).getAllByText(labelled(key))[0].closest('div');
      expect(within(hodRow).queryByText('has a screen')).toBeNull();

      const deanRow = within(column(DEAN)).getAllByText(labelled(key))[0].closest('div');
      expect(within(deanRow).getByText('has a screen')).toBeInTheDocument();
    }
  });

  /* An administrator configuring which panels a view carries had no way to go
     and look at the result. These go to the real screens rather than an
     admin-only twin, which works because checkRole lets `admin` past every
     gate and resolveAttendanceAccess has an explicit admin branch that grants
     institute scope with no department — so a platform admin is not refused
     for heading no department. */
  it('offers a View link into each iLEED view', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: HOD });

    const hodView = within(column(HOD)).getByRole('link', { name: /view/i });
    expect(hodView).toHaveAttribute('href', '/ileed-hod/dashboard');

    const deanView = within(column(DEAN)).getByRole('link', { name: /view/i });
    expect(deanView).toHaveAttribute('href', '/ileed-dean/dashboard');
  });

  /* A navigation would discard unsaved toggles, and comparing the switches
     against the screen they produce is the entire reason to click it. */
  it('opens each view in a new tab', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: HOD });

    for (const title of [HOD, DEAN]) {
      const link = within(column(title)).getByRole('link', { name: /view/i });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
    }
  });
});
