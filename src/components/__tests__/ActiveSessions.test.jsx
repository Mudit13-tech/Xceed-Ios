import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import ActiveSessions, { openActiveSessions } from '../ActiveSessions';

/**
 * "Active devices": each place the account is signed in, with a separate Log
 * out for every device but this one, and "Log out all other devices".
 */

vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));

const SESSIONS = [
  { id: 'mine', current: true, device: 'laptop', os: 'Windows', browser: 'Edge', createdAt: '2026-09-24T08:00:00Z', lastSeenAt: '2026-09-24T09:00:00Z', ip: '203.0.113.7', app: 'web' },
  { id: 'phone', current: false, device: 'phone', model: 'Samsung SM-S911B', os: 'Android', osVersion: '14.0.0', browser: 'Chrome', createdAt: '2026-09-20T05:30:00Z', lastSeenAt: '2026-09-23T10:00:00Z', ip: '198.51.100.2', app: 'web' },
  { id: 'tablet', current: false, device: 'tablet', os: 'Android', browser: '', createdAt: '2026-09-10T05:30:00Z', lastSeenAt: '2026-09-11T10:00:00Z', ip: '', app: 'app' },
];

const serve = () => {
  let sessions = [...SESSIONS];
  const fetchMock = vi.fn(async (url, options = {}) => {
    const target = String(url);
    if (options.method === 'POST' && target.endsWith('/sessions/logout-others')) {
      const count = sessions.filter((row) => !row.current).length;
      sessions = sessions.filter((row) => row.current);
      return { ok: true, json: async () => ({ ok: true, count }) };
    }
    const one = target.match(/\/sessions\/([^/]+)\/logout$/);
    if (options.method === 'POST' && one) {
      sessions = sessions.filter((row) => row.id !== decodeURIComponent(one[1]));
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: true, json: async () => ({ sessions, currentKnown: true }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const open = async () => {
  render(
    <ChakraProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ActiveSessions />
      </QueryClientProvider>
    </ChakraProvider>,
  );
  act(() => openActiveSessions());
  await screen.findByText('Active devices');
};

beforeEach(() => vi.restoreAllMocks());

describe('ActiveSessions', () => {
  it('lists every signed-in device, marking this one and offering Log out for the others', async () => {
    serve();
    await open();

    expect(await screen.findByText(/Samsung SM-S911B · Chrome on Android 14/)).toBeInTheDocument();
    expect(screen.getByText('This device')).toBeInTheDocument();
    expect(screen.getByText('XCEED app')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Log out' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Log out all other devices' })).toBeInTheDocument();
  });

  it('logs out one device on its own', async () => {
    const fetchMock = serve();
    const user = userEvent.setup();
    await open();
    await screen.findByText(/Samsung SM-S911B/);

    await user.click(screen.getAllByRole('button', { name: 'Log out' })[0]);

    await waitFor(() => expect(screen.queryByText(/Samsung SM-S911B/)).not.toBeInTheDocument());
    const post = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(String(post[0])).toBe('http://api.test/user/getuser/sessions/phone/logout');
    expect(screen.getAllByRole('button', { name: 'Log out' })).toHaveLength(1);
  });

  it('logs out all the others at once', async () => {
    serve();
    const user = userEvent.setup();
    await open();
    await screen.findByText(/Samsung SM-S911B/);

    await user.click(screen.getByRole('button', { name: 'Log out all other devices' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument());
    expect(screen.getByText('This device')).toBeInTheDocument();
  });
});
