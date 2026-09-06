import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import HodAssignPage from '../hodAssign';

/**
 * Assigning heads of department.
 *
 * The rule this screen exists to hold is one head per department. The server
 * enforces it; what is pinned here is that the screen says so *before* the
 * refusal — an admin should not have to submit a form to find out the post is
 * filled — and that removing somebody reports honestly whether the account kept
 * the HOD role, which it does when the same person still heads elsewhere.
 */

const HEADS = [
  {
    _id: 'h1',
    dept: 'CSE',
    name: 'Dr A Sharma',
    email: 'a.sharma@nitj.ac.in',
    assignedAt: '2026-08-01T10:00:00.000Z',
  },
];

const jsonResponse = (body, ok = true) => ({ ok, json: async () => body });

const routeFetch = (overrides = {}) =>
  vi.fn(async (url, options) => {
    if (String(url).includes('/user/getuser/hods')) return jsonResponse({ heads: HEADS });
    if (String(url).includes('allsessanddept')) {
      return jsonResponse({ uniqueDept: ['CSE', 'ECE'] });
    }
    if (String(url).includes('assign-hod')) {
      return overrides.assign ? overrides.assign(options) : jsonResponse({ head: { dept: 'ECE' } });
    }
    if (String(url).includes('remove-hod')) {
      return overrides.remove ? overrides.remove(options) : jsonResponse({ roleRemoved: true });
    }
    return jsonResponse({});
  });

const renderPage = async () => {
  render(
    <ChakraProvider>
      <MemoryRouter>
        <HodAssignPage />
      </MemoryRouter>
    </ChakraProvider>,
  );
  return screen.findByText('a.sharma@nitj.ac.in');
};

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = routeFetch();
});

describe('HodAssignPage', () => {
  it('lists the departments that already have a head', async () => {
    await renderPage();

    const row = screen.getByText('a.sharma@nitj.ac.in').closest('tr');
    expect(within(row).getByText('CSE')).toBeInTheDocument();
    expect(within(row).getByText('Dr A Sharma')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 departments')).toBeInTheDocument();
  });

  it('says a department is taken before the form is submitted', async () => {
    await renderPage();

    await userEvent.selectOptions(screen.getByRole('combobox'), 'CSE');

    expect(
      await screen.findByText('This department already has a head. Remove them below first.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Assign/ })).toBeDisabled();
  });

  it('assigns an address to a free department', async () => {
    await renderPage();

    await userEvent.type(screen.getByPlaceholderText('faculty@nitj.ac.in'), 'b.kaur@nitj.ac.in');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'ECE');
    await userEvent.click(screen.getByRole('button', { name: /Assign/ }));

    await waitFor(() => {
      const call = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('assign-hod'));
      expect(JSON.parse(call[1].body)).toEqual({ email: 'b.kaur@nitj.ac.in', dept: 'ECE' });
    });
  });

  it('shows the server’s refusal rather than a generic failure', async () => {
    globalThis.fetch = routeFetch({
      assign: async () => jsonResponse(
        { error: 'CSE already has a Head of Department (old@nitj.ac.in).' },
        false,
      ),
    });
    await renderPage();

    await userEvent.type(screen.getByPlaceholderText('faculty@nitj.ac.in'), 'b.kaur@nitj.ac.in');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'ECE');
    await userEvent.click(screen.getByRole('button', { name: /Assign/ }));

    expect(
      await screen.findByText('CSE already has a Head of Department (old@nitj.ac.in).'),
    ).toBeInTheDocument();
  });

  it('says when the account keeps the HOD role because it heads somewhere else', async () => {
    globalThis.fetch = routeFetch({ remove: async () => jsonResponse({ roleRemoved: false }) });
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Remove the head of CSE' }));

    expect(
      await screen.findByText('The account keeps the HOD role — it still heads another department.'),
    ).toBeInTheDocument();
  });
});
