import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import DobGate, { openDobEditor } from '../DobGate';

/**
 * The date-of-birth dialog: required (and not dismissible) for a signed-in
 * account without one, and the one-time edit when opened from a menu.
 */

vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));

const signedIn = (user, putReply = { ok: true, body: { dob: '2004-05-06', canEditDob: true } }) => {
  const fetchMock = vi.fn((url, options = {}) => {
    if (String(url).endsWith('/user/getuser/dob')) {
      // Stateful like the server: the refetch after a save sees the new date.
      if (putReply.ok && user) user.dob = putReply.body.dob;
      return Promise.resolve({ ok: putReply.ok, json: () => Promise.resolve(putReply.body) });
    }
    if (!user) return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ user }) });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const renderGate = () =>
  render(
    <ChakraProvider>
      <QueryClientProvider client={new QueryClient()}>
        <DobGate />
      </QueryClientProvider>
    </ChakraProvider>,
  );

const setDate = (value) => fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value } });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('DobGate', () => {
  it('asks a signed-in account without a date of birth, with no way to dismiss it', async () => {
    signedIn({ email: ['a@nitj.ac.in'], dob: '' });
    renderGate();

    expect(await screen.findByText('Add your date of birth')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('saves it and closes', async () => {
    const fetchMock = signedIn({ email: ['a@nitj.ac.in'], dob: '' });
    const user = userEvent.setup();
    renderGate();

    await screen.findByText('Add your date of birth');
    setDate('2004-05-06');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByText('Add your date of birth')).not.toBeInTheDocument());
    const [, options] = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/user/getuser/dob'));
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ dob: '2004-05-06' });
  });

  it('shows nothing to an account that already has one, or to nobody signed in', async () => {
    signedIn({ email: ['a@nitj.ac.in'], dob: '2004-05-06' });
    const { unmount } = renderGate();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();

    signedIn(null);
    renderGate();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers the one-time edit from a menu, and confirms before spending it', async () => {
    const fetchMock = signedIn(
      { email: ['a@nitj.ac.in'], dob: '2004-05-06', dobCorrectedAt: null },
      { ok: true, body: { dob: '2004-06-05', canEditDob: false } },
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderGate();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    act(() => openDobEditor());
    expect(await screen.findByText('Edit your date of birth')).toBeInTheDocument();
    expect(screen.getByText(/only once/)).toBeInTheDocument();

    setDate('2004-06-05');
    await user.click(screen.getByRole('button', { name: 'Use my one edit' }));

    expect(confirm).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Edit your date of birth')).not.toBeInTheDocument());
  });

  it('says so when the edit is already spent', async () => {
    signedIn({ email: ['a@nitj.ac.in'], dob: '2004-05-06', dobCorrectedAt: '2026-01-01T00:00:00Z' });
    renderGate();
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    act(() => openDobEditor());
    expect(await screen.findByText(/already used your one-time edit/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Date of birth/)).not.toBeInTheDocument();
  });
});
