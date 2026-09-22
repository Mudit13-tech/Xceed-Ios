/**
 * Signing out of the attendance shell.
 *
 * The platform navbar is hidden on mobile here, so this header carries the
 * action itself — as a 32px square button sitting immediately beside the one
 * that goes to the XCEED home page. It used to sign the user out on a single
 * press, which makes a mis-tap on a phone cost a login. It now asks first, with
 * the same dialog the rest of the platform uses.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));
/* The shell opens a stream for the health banner; it is not what this is about. */
vi.mock('../HealthContext', () => ({
  HealthProvider: ({ children }) => <>{children}</>,
  useHealth: () => ({ status: 'ok' }),
}));

import AMSLayout from '../AMSLayout';

const renderShell = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChakraProvider>
        <MemoryRouter initialEntries={['/attendance/dashboard']}>
          <AMSLayout />
        </MemoryRouter>
      </ChakraProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.restoreAllMocks();
  // The mobile header is the one that carries these buttons.
  window.innerWidth = 480;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ fullAccess: true }) })),
  );
});

describe('attendance shell logout', () => {
  it('asks before signing out', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(await screen.findByRole('button', { name: 'Logout' }));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    // The access check is the only call so far — nothing has been signed out.
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/logout'))).toBe(false);
  });

  it('signs out once confirmed', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(await screen.findByRole('button', { name: 'Logout' }));
    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    await waitFor(() =>
      expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/user/getuser/logout'))).toBe(true),
    );
  });

  it('stays put when the question is declined', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(await screen.findByRole('button', { name: 'Logout' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/logout'))).toBe(false);
  });

  // The way back to the platform, beside it — pinned because the two buttons
  // are a pair and a change to one is usually a change to both.
  it('keeps the XCEED home button next to it', async () => {
    renderShell();

    const home = await screen.findByRole('link', { name: 'Xceed home' });
    expect(home).toHaveAttribute('href', '/');
  });
});
