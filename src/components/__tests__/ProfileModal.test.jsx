import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import ProfileModal, { openProfile } from '../ProfileModal';

/**
 * "Edit profile": name, roll number, email and date of birth — the only place
 * the date of birth is shown — each with its one-time edit.
 */

vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));

const serve = (user) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ user }) })),
  );

const open = async (user) => {
  serve(user);
  render(
    <ChakraProvider>
      <QueryClientProvider client={new QueryClient()}>
        <ProfileModal />
      </QueryClientProvider>
    </ChakraProvider>,
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  act(() => openProfile());
  await screen.findByText('Edit profile');
};

beforeEach(() => vi.restoreAllMocks());

describe('ProfileModal', () => {
  it('shows name, roll number, email and date of birth, with the edits still available', async () => {
    await open({
      name: 'Asha Kumari',
      rollNumber: '21103045',
      email: ['21103045@nitj.ac.in'],
      role: ['STUDENT'],
      dob: '2004-05-06',
      dobCorrectedAt: null,
      lmIdentityCorrectedAt: null,
    });

    expect(screen.getByText('Asha Kumari')).toBeInTheDocument();
    expect(screen.getByText('21103045')).toBeInTheDocument();
    expect(screen.getByText('21103045@nitj.ac.in')).toBeInTheDocument();
    expect(screen.getByText('6 May 2004')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(3);
  });

  it('offers no edit once it is spent, and none on the name for a non-learning account', async () => {
    await open({
      name: 'Coordinator',
      email: ['tt@nitj.ac.in'],
      role: ['DTTI'],
      dob: '1980-01-02',
      dobCorrectedAt: '2026-01-01T00:00:00Z',
      lmIdentityCorrectedAt: null,
    });

    expect(screen.queryByText('Roll number')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByText('Edit used')).toBeInTheDocument();
  });
});
