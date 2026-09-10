import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import DashboardSectionsPanel from '../dashboardSections';

/**
 * Choosing what each leadership dashboard shows.
 *
 * Three rules carry this panel, and all three are easy to break later:
 *
 *  - **The rows come from the server.** They are generated from its catalogue,
 *    not from a list kept in the client, which is what stops a panel added to
 *    the dashboard from being invisible here until somebody remembers to add it
 *    twice.
 *  - **Absent means on.** A panel nobody has an opinion about is shown, so the
 *    first click on it must turn it *off*. Getting this backwards would flip
 *    every default the moment an administrator touched the form.
 *  - **The two columns are independent.** Saving the HOD column must not post
 *    the dean's, or an administrator adjusting one dashboard silently rewrites
 *    the other.
 */

const CATALOGUE = [
  { key: 'people', label: 'People & classrooms', description: 'Headline counts.' },
  { key: 'trend', label: 'Six-month trend', description: 'Month by month.' },
  { key: 'subjects', label: 'Subjects & faculty', description: 'The timetable allocation.' },
];

const jsonResponse = (body, ok = true) => ({ ok, json: async () => body });

const routeFetch = (overrides = {}) =>
  vi.fn(async (url, options) => {
    if (options?.method === 'PUT') {
      return overrides.save
        ? overrides.save(options)
        : jsonResponse({ sections: JSON.parse(options.body).sections });
    }
    return overrides.load
      ? overrides.load()
      : jsonResponse({
        catalogue: CATALOGUE,
        // `trend` off for heads of department, and nothing said about the rest.
        values: { hod: { trend: false }, dean: {} },
      });
  });

const renderPanel = () =>
  render(
    <ChakraProvider>
      <DashboardSectionsPanel />
    </ChakraProvider>,
  );

/** One dashboard's column, found by its heading. */
const column = (title) =>
  screen.getByRole('heading', { name: title }).closest('div').parentElement.parentElement;

const switchFor = (title, label) =>
  within(column(title)).getByRole('checkbox', { name: new RegExp(label) });

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = routeFetch();
});

describe('the toggles', () => {
  it('builds its rows from the server catalogue, not from a list of its own', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: 'HOD Dashboard' });

    // Once per column — a panel added to the dashboard shows up here without
    // this file being touched.
    for (const section of CATALOGUE) {
      expect(screen.getAllByText(section.label)).toHaveLength(2);
    }
    expect(screen.getByRole('heading', { name: 'Dean Dashboard' })).toBeInTheDocument();
  });

  it('shows a panel nobody has an opinion about as on, and a stored false as off', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: 'HOD Dashboard' });

    // Stored as false for the HOD, absent for the dean.
    expect(switchFor('HOD Dashboard', 'Six-month trend')).not.toBeChecked();
    expect(switchFor('Dean Dashboard', 'Six-month trend')).toBeChecked();
    // Absent everywhere else, and therefore on — including Subjects, which both
    // audiences get unless somebody deliberately takes it away.
    expect(switchFor('HOD Dashboard', 'Subjects')).toBeChecked();
    expect(switchFor('Dean Dashboard', 'Subjects')).toBeChecked();
  });

  it('turns a defaulted-on panel off on the first click, not on', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: 'HOD Dashboard' });

    await userEvent.click(switchFor('HOD Dashboard', 'People & classrooms'));
    expect(switchFor('HOD Dashboard', 'People & classrooms')).not.toBeChecked();
  });

  it('offers Save only once something has changed', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: 'HOD Dashboard' });

    const hodSave = within(column('HOD Dashboard')).getByRole('button', { name: /Save/ });
    expect(hodSave).toBeDisabled();

    await userEvent.click(switchFor('HOD Dashboard', 'People & classrooms'));
    expect(hodSave).toBeEnabled();
    // And the other column is untouched by an edit that was not made to it.
    expect(within(column('Dean Dashboard')).getByRole('button', { name: /Save/ })).toBeDisabled();
  });

  it('saves one dashboard without posting the other', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: 'HOD Dashboard' });

    await userEvent.click(switchFor('Dean Dashboard', 'Subjects'));
    await userEvent.click(within(column('Dean Dashboard')).getByRole('button', { name: /Save/ }));

    await waitFor(() => {
      const call = globalThis.fetch.mock.calls.find(([, options]) => options?.method === 'PUT');
      const body = JSON.parse(call[1].body);
      expect(body.audience).toBe('dean');
      expect(body.sections.subjects).toBe(false);
    });

    // Exactly one write: an administrator adjusting the dean's dashboard has
    // said nothing about the head of department's.
    const writes = globalThis.fetch.mock.calls.filter(([, o]) => o?.method === 'PUT');
    expect(writes).toHaveLength(1);
  });

  it('takes the saved state from the response rather than from what was typed', async () => {
    globalThis.fetch = routeFetch({
      // The server drops panels it does not know about, so the form has to show
      // what was stored and not what it sent.
      save: () => jsonResponse({ sections: { people: true, trend: true, subjects: true } }),
    });
    renderPanel();
    await screen.findByRole('heading', { name: 'HOD Dashboard' });

    await userEvent.click(switchFor('HOD Dashboard', 'People & classrooms'));
    await userEvent.click(within(column('HOD Dashboard')).getByRole('button', { name: /Save/ }));

    await waitFor(() =>
      expect(switchFor('HOD Dashboard', 'People & classrooms')).toBeChecked());
  });

  it('says plainly that this is not an access control', async () => {
    renderPanel();
    await screen.findByRole('heading', { name: 'HOD Dashboard' });

    expect(
      screen.getByText(/control what appears on a screen, not who may open it/),
    ).toBeInTheDocument();
  });
});
