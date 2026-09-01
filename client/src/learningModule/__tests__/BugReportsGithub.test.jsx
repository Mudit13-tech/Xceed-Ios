/**
 * Where the "Raise on GitHub" link appears on the bug report page — and, more
 * importantly, where it does not.
 *
 * It exists in exactly one place: on a report inside the admin queue. Nobody
 * filing a report gets a route to the tracker, admin or not. Two reasons, and
 * the tests below pin both: the repository is private, so most people following
 * such a link would land on a 404 that reads as the app being broken; and an
 * unfiltered path from a course page to the issue tracker fills it with reports
 * nobody has triaged.
 *
 * The negative assertions are the ones that matter. A regression that puts the
 * link back on the form is invisible to anyone testing as an admin, which is
 * everyone who would think to check.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import BugReports from '../pages/BugReports';
import lmApi from '../api/lmApi';
import { LABEL, TEMPLATE } from '../githubIssue';

vi.mock('../api/lmApi', () => ({
  default: {
    myBugReports: vi.fn(),
    listClasses: vi.fn(),
    allBugReports: vi.fn(),
    reportBug: vi.fn(),
    reviewBug: vi.fn(),
  },
}));

const REPORT = {
  _id: 'r1',
  kind: 'bug',
  title: 'Document count is wrong',
  description: 'Front page says 1, the class says 3.',
  pageUrl: 'https://xceed.nitj.ac.in/learning/class/abc',
  className: 'Soft Computing',
  status: 'open',
  reporterName: 'Asha Rao',
  created_at: new Date().toISOString(),
};

const renderPage = () =>
  render(
    <ChakraProvider>
      <BugReports />
    </ChakraProvider>,
  );

const githubLinks = () => screen.queryAllByRole('link', { name: /Raise on GitHub/ });

/** Opens the queue tab, which is lazily rendered. */
const openQueue = async () => {
  (await screen.findByRole('tab', { name: /Queue/ })).click();
  return screen.findByText(REPORT.title);
};

beforeEach(() => {
  vi.clearAllMocks();
  lmApi.myBugReports.mockResolvedValue({ reports: [], pointsPerReport: 5 });
  lmApi.listClasses.mockResolvedValue([]);
});

describe('BugReports — students never reach GitHub', () => {
  it('offers no GitHub link at all to a student', async () => {
    // GET /bugs 403s for anyone who is not a platform admin, so the queue — and
    // with it the only link — never renders.
    lmApi.allBugReports.mockRejectedValue(new Error('403'));
    renderPage();

    await screen.findByText('Bug / Suggestion');
    expect(githubLinks()).toHaveLength(0);
  });

  it('offers no GitHub link on a student’s own submission history', async () => {
    lmApi.allBugReports.mockRejectedValue(new Error('403'));
    lmApi.myBugReports.mockResolvedValue({
      reports: [{ ...REPORT, awarded: false }],
      pointsPerReport: 5,
    });
    renderPage();

    await screen.findByText(REPORT.title);
    expect(githubLinks()).toHaveLength(0);
  });
});

describe('BugReports — the report form is not a route to the tracker', () => {
  it('offers no GitHub link beside Send, even for an admin', async () => {
    // The form is the same component for everybody. Escalation is a triage
    // decision and belongs in the queue, not next to the Send button.
    lmApi.allBugReports.mockResolvedValue({ reports: [], counts: {} });
    renderPage();

    await screen.findByRole('button', { name: 'Send' });
    expect(githubLinks()).toHaveLength(0);
  });

  it('offers no GitHub link when an admin’s queue is empty', async () => {
    lmApi.allBugReports.mockResolvedValue({ reports: [], counts: {} });
    renderPage();

    (await screen.findByRole('tab', { name: /Queue/ })).click();
    await screen.findByText('Nothing in the queue');
    expect(githubLinks()).toHaveLength(0);
  });
});

describe('BugReports — escalating from the admin queue', () => {
  beforeEach(() => {
    lmApi.allBugReports.mockResolvedValue({ reports: [REPORT], counts: { open: 1 } });
  });

  it('gives an admin a link on the report', async () => {
    renderPage();
    await openQueue();
    expect(githubLinks()).toHaveLength(1);
  });

  it('carries the label and the template', async () => {
    renderPage();
    await openQueue();

    const href = new URL(githubLinks()[0].getAttribute('href'));
    expect(href.pathname).toBe('/xceed-nitj/AMS-with-TimeTable/issues/new');
    expect(href.searchParams.get('labels')).toBe(LABEL);
    expect(href.searchParams.get('template')).toBe(TEMPLATE);
  });

  it('forwards the report without retyping it', async () => {
    // The case this exists for: a student files in the app, an admin passes it
    // on with everything the reporter already supplied.
    renderPage();
    await openQueue();

    const href = new URL(githubLinks()[0].getAttribute('href'));
    expect(href.searchParams.get('title')).toBe('Document count is wrong');
    const body = href.searchParams.get('body');
    expect(body).toContain('Front page says 1, the class says 3.');
    expect(body).toContain('https://xceed.nitj.ac.in/learning/class/abc');
    expect(body).toContain('Soft Computing');
  });

  it('opens in a new tab without handing the opener over', async () => {
    renderPage();
    await openQueue();

    expect(githubLinks()[0]).toHaveAttribute('target', '_blank');
    expect(githubLinks()[0].getAttribute('rel')).toContain('noopener');
  });

  it('does not put the reporter’s name in the issue', async () => {
    // The GitHub account filing it is already on the issue; an institute
    // identity in the tracker is a second copy of personal data for no benefit.
    renderPage();
    await openQueue();

    githubLinks().forEach((node) =>
      expect(decodeURIComponent(node.getAttribute('href'))).not.toContain('Asha Rao'),
    );
  });

  it('escalates without deciding the report', async () => {
    // Opening an issue must not mark it approved — that pays the reporter, and
    // it stays a separate, deliberate click.
    renderPage();
    await openQueue();

    githubLinks()[0].click();
    await waitFor(() => expect(lmApi.reviewBug).not.toHaveBeenCalled());
  });
});
