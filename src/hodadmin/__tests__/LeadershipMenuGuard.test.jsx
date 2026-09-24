import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import HodLayout from '../HodLayout';
import { menuForPath } from '../../attendancemodule/menuCatalogue';

/**
 * A screen an administrator has switched off is refused, not merely unlinked.
 *
 * The toggles on the Academic Administration page used to decide which links
 * the sidebar drew and nothing else: an old bookmark, a link somebody was sent
 * or a typed path all reached the screen anyway, and it rendered as though it
 * had been enabled. The server refuses its data now — see requireLeadershipMenu
 * — so without this the reader gets a page of failed fetches, which reads as a
 * broken screen rather than a closed one.
 */

const MENUS = { attendanceReports: true, erpUpload: false };

const jsonResponse = (body, ok = true) => ({ ok, json: async () => body });

const renderAt = (pathname) =>
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path="/ileed-hod" element={<HodLayout />}>
          <Route path="reports" element={<div>the report screen</div>} />
          <Route path="erp-upload" element={<div>the erp upload screen</div>} />
          <Route path="notifications" element={<div>my email preferences</div>} />
          <Route path="dashboard" element={<div>the dashboard</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = vi.fn(async (url) => {
    if (String(url).includes('hod-menus')) return jsonResponse({ hodMenus: MENUS });
    return jsonResponse({ department: 'CSE', batchDepartment: 'CSE', departments: ['CSE'] });
  });
});

describe('a screen whose menu is switched off', () => {
  it('is refused, and says which menu', async () => {
    renderAt('/ileed-hod/erp-upload');

    expect(await screen.findByText(/ERP Upload is not switched on/i)).toBeInTheDocument();
    expect(screen.queryByText('the erp upload screen')).toBeNull();
  });

  /* The same toggle switched on must still open it — a guard that refuses
     everything would pass the test above. */
  it('renders normally once the menu is on', async () => {
    renderAt('/ileed-hod/reports');

    expect(await screen.findByText('the report screen')).toBeInTheDocument();
    expect(screen.queryByText(/not switched on/i)).toBeNull();
  });

  /* The head's own mailbox has no menuKey: it is not a view of the
     department's data an admin decides they may see, it is their own
     settings, and gating it would let an admin take away somebody's ability
     to unsubscribe themselves. */
  it('never withholds the head their own email preferences', async () => {
    renderAt('/ileed-hod/notifications');

    expect(await screen.findByText('my email preferences')).toBeInTheDocument();
  });

  /* Where the role card lands. A card that opens a refusal is worse than one
     menu an admin has not got round to enabling. */
  it('never withholds the dashboard', async () => {
    renderAt('/ileed-hod/dashboard');

    expect(await screen.findByText('the dashboard')).toBeInTheDocument();
  });

  /* Nothing may be refused on the strength of an answer that has not arrived:
     the toggles are fetched, and until they are here every screen renders. */
  it('does not refuse while the toggles are still loading', async () => {
    let release;
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes('hod-menus')) {
        await new Promise((resolve) => { release = resolve; });
        return jsonResponse({ hodMenus: MENUS });
      }
      return jsonResponse({ department: 'CSE' });
    });

    renderAt('/ileed-hod/erp-upload');

    expect(screen.queryByText(/not switched on/i)).toBeNull();
    release();
    await waitFor(() => expect(screen.getByText(/ERP Upload is not switched on/i)).toBeInTheDocument());
  });
});

describe('menuForPath', () => {
  it('matches a screen, and its detail pages with it', () => {
    expect(menuForPath('/ileed-hod', '/ileed-hod/erp-overrides').id).toBe('erpOverrides');
    // The drill-down is governed by the toggle of the listing it came from,
    // rather than falling through as an unknown path and rendering anyway.
    expect(menuForPath('/ileed-hod', '/ileed-hod/erp-overrides/abc123').id).toBe('erpOverrides');
  });

  it('is null for a path no menu owns', () => {
    expect(menuForPath('/ileed-hod', '/ileed-hod/notifications')).toBeNull();
    expect(menuForPath('/ileed-hod', '/ileed-hod/nothing-here')).toBeNull();
  });

  /* `reports` is a prefix of nothing, but `erp-overrides` is a prefix of its
     own detail page — a substring match rather than a segment match would let
     a future `/reports-archive` be governed by `reports`. */
  it('does not match a path that merely starts with a menu\'s name', () => {
    expect(menuForPath('/ileed-hod', '/ileed-hod/reports-archive')).toBeNull();
  });
});
