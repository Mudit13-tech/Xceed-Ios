/**
 * The replies already sent on a report, under the verdict buttons.
 *
 * There used to be one note on a report, overwritten each time. An admin could
 * not tell from the queue whether they had already asked the reporter this, and
 * the reporter saw only the newest line — so a question, its answer and the
 * follow-up read as though only the follow-up had happened.
 *
 * The thread is placed *below* the decision, not above it: the queue is read
 * verdict-first, and the history is what you go to when the verdict is not
 * obvious.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import BugReportsAdmin from '../bugReports';
import lmApi from '../../learningModule/api/lmApi';
import { noteThread } from '../../learningModule/bugNotes';

vi.mock('../../learningModule/api/lmApi', () => ({
  default: { allBugReports: vi.fn(), reviewBug: vi.fn() },
}));

const REPORT = {
  _id: 'r1',
  kind: 'bug',
  title: 'Document count is wrong',
  description: 'Front page says 1, the class says 3.',
  status: 'open',
  reporterName: 'Asha Rao',
  reporterEmail: 'asha@nitj.ac.in',
  adminNote: 'Thanks, that is fixed now.',
  adminNotes: [
    {
      _id: 'n1',
      body: 'Which browser were you using?',
      authorName: 'An Admin',
      status: '',
      at: '2026-09-18T09:30:00.000Z',
    },
    {
      _id: 'n2',
      body: 'Thanks, that is fixed now.',
      authorName: 'Another Admin',
      status: 'fixed',
      at: '2026-09-20T14:05:00.000Z',
    },
  ],
  created_at: new Date().toISOString(),
};

const renderPage = (report = REPORT) => {
  lmApi.allBugReports.mockResolvedValue({
    reports: [report],
    counts: { open: 1 },
    kindCounts: { bug: 1 },
  });
  return render(
    <ChakraProvider>
      <MemoryRouter>
        <BugReportsAdmin />
      </MemoryRouter>
    </ChakraProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  lmApi.reviewBug.mockResolvedValue({});
});

describe('reading the thread off a report', () => {
  it('keeps the order the replies were written in', () => {
    expect(noteThread(REPORT).map((entry) => entry.body)).toEqual([
      'Which browser were you using?',
      'Thanks, that is fixed now.',
    ]);
  });

  /* Reports filed before the thread existed carry one note and the time of the
     review that wrote it. Backfilling the collection to show them would be a
     migration for no gain — a single note is a thread of one. */
  it('reads a report from before the thread existed as a thread of one', () => {
    const thread = noteThread({
      adminNote: 'We are looking at it.',
      reviewedByName: 'An Admin',
      reviewedAt: '2026-08-01T10:00:00.000Z',
      adminNotes: [],
    });

    expect(thread).toHaveLength(1);
    expect(thread[0].body).toBe('We are looking at it.');
    expect(thread[0].authorName).toBe('An Admin');
    expect(thread[0].at).toBe('2026-08-01T10:00:00.000Z');
  });

  it('says nothing about a report nobody has replied to', () => {
    expect(noteThread({ adminNote: '', adminNotes: [] })).toEqual([]);
  });
});

describe('the thread on the queue card', () => {
  it('shows every reply, not just the last one', async () => {
    renderPage();
    await screen.findByText('Document count is wrong');

    expect(screen.getByText('Which browser were you using?')).toBeInTheDocument();
    expect(screen.getByText('Thanks, that is fixed now.')).toBeInTheDocument();
  });

  it('says who wrote each one and when', async () => {
    renderPage();
    await screen.findByText('Document count is wrong');

    const first = screen.getByText('Which browser were you using?').parentElement;
    const byline = within(first).getByText(/An Admin/);
    // The exact rendering is the browser's locale; what matters is that the
    // date is on the line at all, since "when did we ask" is the question.
    expect(byline.textContent).toMatch(/2026/);
  });

  /* A reason typed alongside Reject is the reason for the rejection, and reads
     as a loose remark if the thread does not say what it rode with. */
  it('says which verdict a reply rode with', async () => {
    renderPage();
    await screen.findByText('Document count is wrong');

    const second = screen.getByText('Thanks, that is fixed now.').parentElement;
    expect(within(second).getByText(/marked Done/i)).toBeInTheDocument();
  });

  it('counts them', async () => {
    renderPage();
    await screen.findByText('Document count is wrong');
    expect(screen.getByText('2 notes sent to the reporter')).toBeInTheDocument();
  });

  it('shows nothing at all on a report nobody has replied to', async () => {
    renderPage({ ...REPORT, adminNote: '', adminNotes: [] });
    await screen.findByText('Document count is wrong');
    expect(screen.queryByText(/notes? sent to the reporter/)).not.toBeInTheDocument();
  });
});
