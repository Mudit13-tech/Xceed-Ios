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
    if (String(url).includes('rename-hod')) {
      return overrides.rename ? overrides.rename(options) : jsonResponse({ head: HEADS[0] });
    }
    if (String(url).includes('remove-hod')) {
      return overrides.remove ? overrides.remove(options) : jsonResponse({ roleRemoved: true });
    }
    /* The other two panels on this screen — the dean appointment and the
       dashboard settings — fetch on mount too. They own their own tests; what
       matters here is that they are answered rather than left to error, so a
       failure in this file is about heads of department and not about a toast
       raised by a neighbour. */
    if (String(url).includes('/user/getuser/deans')) return jsonResponse({ deans: [] });
    if (String(url).includes('dashboard-sections')) {
      return jsonResponse({ catalogue: [], values: { hod: {}, dean: {} } });
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
    expect(screen.getByRole('button', { name: /Assign head/ })).toBeDisabled();
  });

  it('assigns an address to a free department', async () => {
    await renderPage();

    await userEvent.type(screen.getByPlaceholderText('faculty@nitj.ac.in'), 'b.kaur@nitj.ac.in');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'ECE');
    await userEvent.click(screen.getByRole('button', { name: /Assign head/ }));

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
    await userEvent.click(screen.getByRole('button', { name: /Assign head/ }));

    expect(
      await screen.findByText('CSE already has a Head of Department (old@nitj.ac.in).'),
    ).toBeInTheDocument();
  });

  /* The appointment is an address and a department. No name is asked for —
     whoever fills this in is not the person being appointed — and a created
     account is named for the post instead, which the helper text says out loud
     so nobody goes looking for a field that was left out by mistake. */
  it('asks for an address and a department and nothing else', async () => {
    await renderPage();

    expect(screen.getByPlaceholderText('faculty@nitj.ac.in')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Name$/i)).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox'), 'ECE');
    expect(await screen.findByText(/named for the post \(Head-ECE\)/)).toBeInTheDocument();
  });

  /* And renaming stays available for the life of the appointment, because the
     address is known on the day it is made and the name usually is not. */
  it('renames the head of a department in place, by department', async () => {
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Edit the name for the head of CSE' }));
    const field = screen.getByLabelText('Name for the head of CSE');
    await userEvent.clear(field);
    await userEvent.type(field, 'Dr B Kaur');
    await userEvent.click(screen.getByRole('button', { name: 'Save the name for the head of CSE' }));

    await waitFor(() => {
      const call = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('rename-hod'));
      expect(JSON.parse(call[1].body)).toEqual({ dept: 'CSE', name: 'Dr B Kaur' });
    });
    // Read back afterwards, so the row shows what was written.
    await waitFor(() =>
      expect(globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/hods'))).toHaveLength(2));
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
