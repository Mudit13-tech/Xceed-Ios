/**
 * Replying to a reporter from the superadmin bug queue.
 *
 * The point of this action is that it carries **no status**. All four of the
 * other buttons decide the report, so without a note-only path there is no way
 * to ask "what were you doing when it happened?" without also approving or
 * closing the ticket. The server reads an absent status as "leave it as it is",
 * so the assertion that `status` is not sent is the whole behaviour.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import BugReportsAdmin from '../bugReports';
import lmApi from '../../learningModule/api/lmApi';

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
  adminNote: '',
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

const noteBox = () => screen.getByPlaceholderText('Note back to the reporter (optional)');
const sendButton = () => screen.getByRole('button', { name: 'Send note' });

beforeEach(() => {
  vi.clearAllMocks();
  lmApi.reviewBug.mockResolvedValue({});
});

describe('superadmin bug queue — Send note', () => {
  it('offers the button', async () => {
    // It was missing entirely: the note field existed but only ever travelled
    // attached to a verdict.
    renderPage();
    await screen.findByText('Document count is wrong');
    expect(sendButton()).toBeInTheDocument();
  });

  it('sends the note without a status', async () => {
    // The behaviour this exists for. A status here would take an open report out
    // of the queue just for asking a question about it.
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Document count is wrong');

    await user.type(noteBox(), 'Which browser were you using?');
    await user.click(sendButton());

    await waitFor(() => expect(lmApi.reviewBug).toHaveBeenCalledTimes(1));
    const [reportId, payload] = lmApi.reviewBug.mock.calls[0];
    expect(reportId).toBe('r1');
    expect(payload).toEqual({ adminNote: 'Which browser were you using?' });
    expect(payload.status).toBeUndefined();
  });

  it('trims the note', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Document count is wrong');

    await user.type(noteBox(), '   spaces both ends   ');
    await user.click(sendButton());

    await waitFor(() => expect(lmApi.reviewBug).toHaveBeenCalled());
    expect(lmApi.reviewBug.mock.calls[0][1].adminNote).toBe('spaces both ends');
  });

  it('is disabled until something is typed', async () => {
    renderPage();
    await screen.findByText('Document count is wrong');
    expect(sendButton()).toBeDisabled();
  });

  it('is disabled when the note has not changed', async () => {
    // Re-sending text the reporter has already seen notifies nobody, because the
    // server only raises a notification when the stored note actually changes.
    // A button that appears to work but does nothing is worse than a dim one.
    renderPage({ ...REPORT, adminNote: 'Already told them this.' });
    await screen.findByText('Document count is wrong');
    expect(sendButton()).toBeDisabled();
  });

  it('becomes available once the existing note is edited', async () => {
    const user = userEvent.setup();
    renderPage({ ...REPORT, adminNote: 'Already told them this.' });
    await screen.findByText('Document count is wrong');

    await user.type(noteBox(), ' And one more thing.');
    expect(sendButton()).toBeEnabled();
  });

  it('sends on Enter', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Document count is wrong');

    await user.type(noteBox(), 'Any console errors?{Enter}');

    await waitFor(() => expect(lmApi.reviewBug).toHaveBeenCalledTimes(1));
    expect(lmApi.reviewBug.mock.calls[0][1]).toEqual({ adminNote: 'Any console errors?' });
  });

  it('does not decide the report when the verdict buttons are left alone', async () => {
    // Guards against the note path quietly acquiring a status later.
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Document count is wrong');

    await user.type(noteBox(), 'Just asking.');
    await user.click(sendButton());

    await waitFor(() => expect(lmApi.reviewBug).toHaveBeenCalled());
    lmApi.reviewBug.mock.calls.forEach(([, payload]) => {
      expect(payload).not.toHaveProperty('status');
    });
  });

  it('reloads the queue so the stored note is what is shown', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Document count is wrong');
    expect(lmApi.allBugReports).toHaveBeenCalledTimes(1);

    await user.type(noteBox(), 'Reloaded after this.');
    await user.click(sendButton());

    await waitFor(() => expect(lmApi.allBugReports).toHaveBeenCalledTimes(2));
  });

  it('says so when the note could not be sent', async () => {
    // The admin has to know the reporter was not told.
    lmApi.reviewBug.mockRejectedValue(new Error('Forbidden'));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Document count is wrong');

    await user.type(noteBox(), 'This will fail.');
    await user.click(sendButton());

    await screen.findByText('Forbidden');
  });
});
