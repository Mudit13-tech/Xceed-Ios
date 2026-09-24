/**
 * Reporting a bug that is not about a class.
 *
 * A bug had to name one, and plenty of them do not have one to name — the
 * sign-in page, a mail that never arrived, the module being down. With nothing
 * to choose, a reporter picked a class at random and the queue learned
 * something false about where the trouble was.
 *
 * The queue could always render it ("platform-wide") and the server could
 * always store it (`classId: null`). Only the form refused to offer it. Three
 * things are worth holding:
 *
 *  - **General is offered, and offered first.** A reporter who has to scroll
 *    past their classes to reach it will pick one of the classes instead.
 *  - **It sends null**, not the sentinel the dropdown holds. The sentinel is a
 *    client-side placeholder; platform-wide on the wire is an absent class.
 *  - **It counts as an answer.** A bug still has to say where it is, so Send
 *    stays disabled until something is chosen — but General is a something.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import BugReports from '../pages/BugReports';
import lmApi from '../api/lmApi';

vi.mock('../api/lmApi', () => ({
  default: {
    myBugReports: vi.fn(),
    listClasses: vi.fn(),
    allBugReports: vi.fn(),
    reportBug: vi.fn(),
    reviewBug: vi.fn(),
  },
}));

const CLASSES = [
  { _id: 'c1', name: 'Thermodynamics' },
  { _id: 'c2', name: 'Signals and Systems' },
];

const renderPage = () =>
  render(
    <ChakraProvider>
      <BugReports />
    </ChakraProvider>,
  );

/** The dropdown that carries the class names. */
const whereSelect = async () =>
  waitFor(() => {
    const select = screen
      .getAllByRole('combobox')
      .find((candidate) =>
        Array.from(candidate.options).some((o) => o.textContent === 'Thermodynamics'));
    expect(select).toBeDefined();
    return select;
  });

const optionLabels = (select) => Array.from(select.options).map((o) => o.textContent);

const generalValue = (select) =>
  Array.from(select.options).find((o) => /general/i.test(o.textContent)).value;

/** The kind selector — bug or suggestion. */
const kindSelect = () =>
  screen
    .getAllByRole('combobox')
    .find((candidate) =>
      Array.from(candidate.options).some((o) => /suggestion/i.test(o.textContent)));

const titleBox = () => screen.getByPlaceholderText(/in one line/i);
const sendButton = () => screen.getByRole('button', { name: /^send$/i });

beforeEach(() => {
  vi.clearAllMocks();
  lmApi.myBugReports.mockResolvedValue({ reports: [], pointsPerReport: 5 });
  lmApi.listClasses.mockResolvedValue(CLASSES);
  // The page asks, and expects a rejection for everyone who is not a platform
  // admin. An unmocked vi.fn() returns undefined, and .catch on undefined
  // throws into the loader's own try — the page then renders its error state
  // and there is no form to test.
  lmApi.allBugReports.mockResolvedValue(null);
  lmApi.reportBug.mockResolvedValue({});
});

describe('filing a report that is not about a class', () => {
  it('offers General above the classes', async () => {
    renderPage();
    const select = await whereSelect();

    const labels = optionLabels(select);
    const general = labels.findIndex((label) => /general/i.test(label));
    expect(general).toBeGreaterThanOrEqual(0);
    expect(general).toBeLessThan(labels.indexOf('Thermodynamics'));
  });

  it('sends no class at all when General is chosen', async () => {
    renderPage();
    const select = await whereSelect();

    await userEvent.type(titleBox(), 'Sign-in page is blank');
    await userEvent.selectOptions(select, [generalValue(select)]);
    await userEvent.click(sendButton());

    await waitFor(() => expect(lmApi.reportBug).toHaveBeenCalled());
    // Not the sentinel and not an empty string: platform-wide is an absent class.
    expect(lmApi.reportBug.mock.calls[0][0].classId).toBeNull();
  });

  it('still refuses a bug that says nothing about where it is', async () => {
    renderPage();
    await whereSelect();

    await userEvent.type(titleBox(), 'Something broke');
    expect(sendButton()).toBeDisabled();
  });

  it('accepts General as that answer', async () => {
    renderPage();
    const select = await whereSelect();

    await userEvent.type(titleBox(), 'Something broke');
    await userEvent.selectOptions(select, [generalValue(select)]);
    expect(sendButton()).toBeEnabled();
  });

  /* The form files two things and the dropdown is shared. A General option
     that only appeared for bugs would be the same gap one kind further on:
     a suggestion about the platform rather than a class had nowhere to say so
     either, it was just allowed to say nothing at all. */
  it('offers General for a suggestion too, not only a bug', async () => {
    renderPage();
    const where = await whereSelect();
    await userEvent.selectOptions(kindSelect(), ['suggestion']);

    expect(optionLabels(where).some((label) => /general/i.test(label))).toBe(true);
  });

  it('sends no class for a General suggestion', async () => {
    renderPage();
    const where = await whereSelect();
    await userEvent.selectOptions(kindSelect(), ['suggestion']);

    await userEvent.type(titleBox(), 'Let me filter the leaderboard');
    await userEvent.selectOptions(where, [generalValue(where)]);
    await userEvent.click(sendButton());

    await waitFor(() => expect(lmApi.reportBug).toHaveBeenCalled());
    expect(lmApi.reportBug.mock.calls[0][0].kind).toBe('suggestion');
    expect(lmApi.reportBug.mock.calls[0][0].classId).toBeNull();
  });

  it('still sends a real class when one is chosen', async () => {
    renderPage();
    const select = await whereSelect();

    await userEvent.type(titleBox(), 'Quiz timer drifts');
    await userEvent.selectOptions(select, ['c2']);
    await userEvent.click(sendButton());

    await waitFor(() => expect(lmApi.reportBug).toHaveBeenCalled());
    expect(lmApi.reportBug.mock.calls[0][0].classId).toBe('c2');
  });
});
