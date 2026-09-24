import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The account's own details on the student and faculty dashboard: name, roll
 * number for a student, and the date of birth, with "Edit profile" beside them.
 */

let outletContext;
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn(), useOutletContext: () => outletContext };
});

vi.mock('../api/lmApi', () => ({
  default: {
    listClasses: vi.fn(async () => []),
    ttRoomLocations: vi.fn(async () => ({})),
    createClass: vi.fn(),
    previewCode: vi.fn(),
    joinByCode: vi.fn(),
    ttBranches: vi.fn(async () => []),
    ttSemesters: vi.fn(async () => []),
    ttSubjects: vi.fn(async () => []),
  },
}));
vi.mock('../../getenvironment', () => ({ default: () => 'http://api.test' }));

const serveUser = (user) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ user }) })),
  );

const renderDashboard = async (me) => {
  outletContext = { me, overview: {}, reloadOverview: vi.fn() };
  const { default: Dashboard } = await import('../pages/Dashboard');
  render(
    <ChakraProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    </ChakraProvider>,
  );
};

beforeEach(() => vi.restoreAllMocks());

describe('Dashboard — your details', () => {
  it('shows a student their name, roll number and date of birth', async () => {
    serveUser({ name: 'Asha Kumari', rollNumber: '21103045', dob: '2004-05-06' });
    await renderDashboard({ name: 'Asha Kumari', roles: ['student'] });

    expect(await screen.findByText('6 May 2004')).toBeInTheDocument();
    expect(screen.getByText('21103045')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
  });

  it('shows faculty their date of birth without a roll number', async () => {
    serveUser({ name: 'Dr Sharma', rollNumber: '', dob: '1980-01-02' });
    await renderDashboard({ name: 'Dr Sharma', roles: ['faculty'] });

    expect(await screen.findByText('2 January 1980')).toBeInTheDocument();
    expect(screen.queryByText('Roll number')).not.toBeInTheDocument();
  });

  it('says when it has not been added', async () => {
    serveUser({ name: 'Asha', dob: '' });
    await renderDashboard({ name: 'Asha', roles: ['student'] });
    expect(await screen.findByText('Not added yet')).toBeInTheDocument();
  });
});
