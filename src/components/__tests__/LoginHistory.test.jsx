import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import LoginHistoryModal, { LastLogin, openLoginHistory, deviceLabel } from '../LoginHistory';

/**
 * The account's own sign-ins: one line in the account menu (the sign-in
 * before this one) and the full list in a dialog any menu can open.
 */

vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));

const LOGINS = [
  { id: 'c', at: '2026-09-24T08:00:00Z', device: 'laptop', os: 'Windows', browser: 'Edge', ip: '203.0.113.7' },
  {
    id: 'b',
    at: '2026-09-20T05:30:00Z',
    device: 'phone',
    os: 'Android',
    osVersion: '14.0.0',
    model: 'Samsung SM-S911B',
    browser: 'Chrome',
    ip: '198.51.100.2',
    deviceId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    newDevice: true,
  },
  { id: 'a', at: '2026-09-01T10:00:00Z', device: 'computer', os: 'Linux', browser: 'Firefox', ip: '' },
];

const serve = (logins = LOGINS) => {
  const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ logins }) }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const wrap = (ui) =>
  render(
    <ChakraProvider>
      <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
    </ChakraProvider>,
  );

beforeEach(() => vi.restoreAllMocks());

describe('LastLogin', () => {
  it('shows the sign-in before this one', async () => {
    serve();
    wrap(<LastLogin />);
    expect(await screen.findByText(/Last login: .*Samsung SM-S911B/)).toBeInTheDocument();
  });

  it('says so when there is no earlier one', async () => {
    serve(LOGINS.slice(0, 1));
    wrap(<LastLogin />);
    expect(await screen.findByText('Last login: none before this one')).toBeInTheDocument();
  });
});

describe('LoginHistoryModal', () => {
  it('fetches nothing until opened, then lists every sign-in with device and address', async () => {
    const fetchMock = serve();
    wrap(<LoginHistoryModal />);
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => openLoginHistory());

    expect(await screen.findByText('Login history')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('203.0.113.7')).toBeInTheDocument());
    expect(screen.getByText('198.51.100.2')).toBeInTheDocument();
    expect(screen.getByText('Laptop · Edge on Windows')).toBeInTheDocument();
    expect(screen.getByText('Laptop or desktop · Firefox on Linux')).toBeInTheDocument();
    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://api.test/user/getuser/login-history?limit=50');
  });
});

describe('deviceLabel', () => {
  it('names the kind even without browser details', () => {
    expect(deviceLabel({ device: 'tablet' })).toBe('Tablet');
    expect(deviceLabel({})).toBe('Unknown device');
  });
});

describe('LoginHistoryModal — model and device ID', () => {
  it('shows the model, the short device ID, and marks new and current devices', async () => {
    window.localStorage.setItem('xceed.deviceId', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    serve();
    wrap(<LoginHistoryModal />);

    act(() => openLoginHistory());

    expect(await screen.findByText('Samsung SM-S911B · Chrome on Android 14')).toBeInTheDocument();
    expect(screen.getByText('aaaaaaaa')).toBeInTheDocument();
    expect(screen.getByText('New device')).toBeInTheDocument();
    expect(screen.getByText('This device')).toBeInTheDocument();
    window.localStorage.clear();
  });
});
