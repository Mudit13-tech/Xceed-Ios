/**
 * Replying to a reporter from the superadmin bug queue.
 *
 * The point of this action is that it carries **no status**. All four of the
 * other buttons decide the report, so without a note-only path there is no way
 * to ask "what were you doing when it happened?" without also approving or
 * closing the ticket. The server reads an absent status as "leave it as it is",
 * so the assertion that `status` is not sent is the whole behaviour — and now
 * also what tells the server to email the reply rather than only post it in the
 * app, which makes it load-bearing twice over.
 *
 * Since the reply is now an email, the box is a paragraph box: Enter starts a
 * line and Ctrl/Cmd+Enter sends.
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
  reporterEmail: 'asha@nitj.ac.in',
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

const noteBox = () =>
  screen.getByPlaceholderText('Reply to the reporter — this is emailed to them');
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

  it('starts empty on a report that has already been replied to', async () => {
    // It used to open holding the last note sent, which had to be selected and
    // deleted before a second reply could be written — and left the button dim,
    // reading as though replying again were not allowed.
    renderPage({ ...REPORT, adminNote: 'Already told them this.' });
    await screen.findByText('Document count is wrong');

    expect(noteBox().value).toBe('');
    expect(sendButton()).toBeDisabled();
  });

  it('will send the same thing twice', async () => {
    // Chasing an unanswered question means saying it again. The button used to
    // refuse text matching the stored note, so the second ask was impossible.
    const user = userEvent.setup();
    renderPage({ ...REPORT, adminNote: 'Which browser were you using?' });
    await screen.findByText('Document count is wrong');

    await user.type(noteBox(), 'Which browser were you using?');
    expect(sendButton()).toBeEnabled();

    await user.click(sendButton());
    await waitFor(() => expect(lmApi.reviewBug).toHaveBeenCalledTimes(1));
    expect(lmApi.reviewBug.mock.calls[0][1]).toEqual({
      adminNote: 'Which browser were you using?',
    });
  });

  it('empties the box after sending, ready for the next reply', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Document count is wrong');

    await user.type(noteBox(), 'First question.');
    await user.click(sendButton());

    await waitFor(() => expect(noteBox().value).toBe(''));
    expect(sendButton()).toBeDisabled();
  });

  it('does not wipe the stored note when a verdict is pressed with an empty box', async () => {
    // The box starts empty now, so passing it through on every verdict would
    // post "" and erase the last reply from the report.
    const user = userEvent.setup();
    renderPage({ ...REPORT, adminNote: 'Already told them this.' });
    await screen.findByText('Document count is wrong');

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(lmApi.reviewBug).toHaveBeenCalled());
    expect(lmApi.reviewBug.mock.calls[0][1]).toEqual({ status: 'rejected' });
  });

  it('sends on Ctrl+Enter', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Document count is wrong');

    await user.type(noteBox(), 'Any console errors?');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => expect(lmApi.reviewBug).toHaveBeenCalledTimes(1));
    expect(lmApi.reviewBug.mock.calls[0][1]).toEqual({ adminNote: 'Any console errors?' });
  });

  it('starts a new line on plain Enter instead of sending', async () => {
    // It used to send on Enter, which was right for a one-line box. A reply
    // that is going out as an email needs paragraphs more than it needs a
    // keyboard shortcut one key shorter.
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Document count is wrong');

    await user.type(noteBox(), 'line one{Enter}line two');

    expect(lmApi.reviewBug).not.toHaveBeenCalled();
    expect(noteBox().value).toBe('line one\nline two');
  });

  it('is a box a real reply fits in', async () => {
    // A 2000-character email body cannot be written into a one-line input.
    renderPage();
    await screen.findByText('Document count is wrong');
    expect(noteBox().tagName).toBe('TEXTAREA');
    expect(noteBox()).toHaveAttribute('maxLength', '2000');
  });

  it('tells the admin where the reply is going before they type it', async () => {
    renderPage();
    await screen.findByText('Document count is wrong');
    expect(screen.getByText(/emailed to asha@nitj\.ac\.in/i)).toBeInTheDocument();
  });

  it('says the note was emailed once it has been', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Document count is wrong');

    await user.type(noteBox(), 'Which browser?');
    await user.click(sendButton());

    expect(await screen.findByText('Note emailed to the reporter')).toBeInTheDocument();
  });

  it('does not claim delivery the server did not report', async () => {
    // The note is stored either way — the reporter can read it on their own
    // page — but a toast that says "emailed" when the mail never left is how an
    // admin comes to believe somebody was answered.
    lmApi.reviewBug.mockResolvedValue({ emailed: false });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Document count is wrong');

    await user.type(noteBox(), 'Which browser?');
    await user.click(sendButton());

    expect(
      await screen.findByText('Note saved, but it could not be emailed to the reporter'),
    ).toBeInTheDocument();
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
