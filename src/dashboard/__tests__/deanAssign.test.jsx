import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import DeanAssignPanel from '../deanAssign';

/**
 * Assigning the Dean (Academic) — the panel on the academic leadership screen.
 *
 * The rule it exists to hold is that the appointment is an address and nothing
 * else: no department, because the role is scoped to none, which is exactly
 * what separates it from the head of department panel above it. What is pinned
 * here is that the form asks for nothing more, that it says the account already
 * holds the role *before* the server has to answer that to a submitted form,
 * and that removing somebody says plainly that the account survives — because
 * the person on the other end of it usually still teaches.
 *
 * Rendered on its own rather than through the whole page, so a failure here
 * names this panel rather than whichever of the three broke.
 */

const DEANS = [
  {
    _id: 'd1',
    name: 'Dr A Sharma',
    email: 'a.sharma@nitj.ac.in',
    claimed: true,
    createdAt: '2026-08-01T10:00:00.000Z',
  },
  {
    _id: 'd2',
    // An account created for an address it has never signed into carries the
    // address as its name, which is why the name column shows an em dash.
    name: 'new.dean@nitj.ac.in',
    email: 'new.dean@nitj.ac.in',
    claimed: false,
    createdAt: '2026-09-01T10:00:00.000Z',
  },
];

const jsonResponse = (body, ok = true) => ({ ok, json: async () => body });

const routeFetch = (overrides = {}) =>
  vi.fn(async (url, options) => {
    if (String(url).includes('/user/getuser/deans')) {
      return overrides.list ? overrides.list() : jsonResponse({ deans: DEANS });
    }
    if (String(url).includes('assign-dean')) {
      return overrides.assign
        ? overrides.assign(options)
        : jsonResponse({ roleAdded: true, dean: { email: 'b@nitj.ac.in' } });
    }
    if (String(url).includes('rename-dean')) {
      return overrides.rename ? overrides.rename(options) : jsonResponse({ dean: DEANS[0] });
    }
    if (String(url).includes('remove-dean')) {
      return overrides.remove ? overrides.remove(options) : jsonResponse({ dean: DEANS[0] });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });

const renderPage = () =>
  render(
    <ChakraProvider>
      <MemoryRouter>
        <DeanAssignPanel />
      </MemoryRouter>
    </ChakraProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = routeFetch();
});

describe('the assignment form', () => {
  it('asks for an address and nothing else', async () => {
    renderPage();
    await screen.findByText('Dr A Sharma');

    expect(screen.getByLabelText(/email ID/i)).toBeInTheDocument();
    // The absence is the point: a department here would be a field the role is
    // not scoped by, and a value nobody could act on.
    expect(screen.queryByLabelText(/Department/i)).not.toBeInTheDocument();
  });

  it('posts just the address, and reloads the list afterwards', async () => {
    renderPage();
    await screen.findByText('Dr A Sharma');

    await userEvent.type(screen.getByLabelText(/email ID/i), 'b@nitj.ac.in');
    await userEvent.click(screen.getByRole('button', { name: /Assign dean/ }));

    await waitFor(() => {
      const call = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('assign-dean'));
      expect(JSON.parse(call[1].body)).toEqual({ email: 'b@nitj.ac.in' });
    });
    // Two list reads: the one on mount, and the one after the write — so the
    // table cannot sit there showing the state from before the assignment.
    await waitFor(() =>
      expect(globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/deans'))).toHaveLength(2));
  });

  /* An administrator should not have to submit a form to be told the account
   * already holds the role. The server is still the authority — it answers
   * idempotently rather than refusing — but the screen says so first. */
  it('says an address already holds the role before it is submitted', async () => {
    renderPage();
    await screen.findByText('Dr A Sharma');

    await userEvent.type(screen.getByLabelText(/email ID/i), 'a.sharma@nitj.ac.in');

    expect(await screen.findByText('This account already holds the role.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Assign dean/ })).toBeDisabled();
  });

  it('matches that address whatever case it is typed in', async () => {
    renderPage();
    await screen.findByText('Dr A Sharma');

    await userEvent.type(screen.getByLabelText(/email ID/i), '  A.Sharma@NITJ.ac.in  ');
    expect(await screen.findByText('This account already holds the role.')).toBeInTheDocument();
  });

  it('reports a refusal without clearing what was typed', async () => {
    globalThis.fetch = routeFetch({
      assign: () => jsonResponse({ error: 'A valid email is required' }, false),
    });
    renderPage();
    await screen.findByText('Dr A Sharma');

    await userEvent.type(screen.getByLabelText(/email ID/i), 'b@nitj.ac.in');
    await userEvent.click(screen.getByRole('button', { name: /Assign dean/ }));

    expect(await screen.findByText('A valid email is required')).toBeInTheDocument();
    expect(screen.getByLabelText(/email ID/i)).toHaveValue('b@nitj.ac.in');
  });
});

describe('the list of deans', () => {
  it('separates an account in use from one nobody has signed into', async () => {
    renderPage();
    await screen.findByText('Dr A Sharma');

    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Claimed')).toBeInTheDocument();
    // The one an administrator has to chase after making the appointment.
    expect(within(rows[1]).getByText('Not signed in yet')).toBeInTheDocument();
    // And its name reads as an em dash rather than repeating the address.
    expect(within(rows[1]).getByText('—')).toBeInTheDocument();
  });

  it('removes by user id and says the account itself survives', async () => {
    renderPage();
    await screen.findByText('Dr A Sharma');

    await userEvent.click(screen.getByRole('button', { name: /Remove Dr A Sharma|Remove a\.sharma/ }));

    await waitFor(() => {
      const call = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('remove-dean'));
      expect(JSON.parse(call[1].body)).toEqual({ userId: 'd1' });
    });
    expect(await screen.findByText(/The account itself is untouched/)).toBeInTheDocument();
  });

  /* The form asks for an address and nothing else, so an account it creates has
   * never been named by anybody. The name is set here instead — and the control
   * is in the row permanently, because the name is usually learned long after
   * the address, and a rename that needs another screen never happens. */
  it('renames an account that was never named, by user id', async () => {
    renderPage();
    await screen.findByText('Dr A Sharma');

    await userEvent.click(screen.getByRole('button', { name: /Edit the name for new\.dean/ }));
    await userEvent.type(screen.getByLabelText(/Name for new\.dean/), 'Dr B Kaur');
    await userEvent.click(screen.getByRole('button', { name: /Save the name for new\.dean/ }));

    await waitFor(() => {
      const call = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('rename-dean'));
      expect(JSON.parse(call[1].body)).toEqual({ userId: 'd2', name: 'Dr B Kaur' });
    });
    // And the list is read again, so the table shows what was written rather
    // than what the cell happens to be holding.
    await waitFor(() =>
      expect(globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/deans'))).toHaveLength(2));
  });

  it('keeps the typed name in the cell when the write is refused', async () => {
    globalThis.fetch = routeFetch({
      rename: () => jsonResponse({ error: 'A name is required' }, false),
    });
    renderPage();
    await screen.findByText('Dr A Sharma');

    await userEvent.click(screen.getByRole('button', { name: /Edit the name for new\.dean/ }));
    await userEvent.type(screen.getByLabelText(/Name for new\.dean/), 'Dr B Kaur');
    await userEvent.click(screen.getByRole('button', { name: /Save the name for new\.dean/ }));

    expect(await screen.findByText('A name is required')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name for new\.dean/)).toHaveValue('Dr B Kaur');
  });

  it('says so plainly when nobody has been appointed yet', async () => {
    globalThis.fetch = routeFetch({ list: () => jsonResponse({ deans: [] }) });
    renderPage();

    expect(await screen.findByText('No Dean (Academic) assigned yet.')).toBeInTheDocument();
  });
});
