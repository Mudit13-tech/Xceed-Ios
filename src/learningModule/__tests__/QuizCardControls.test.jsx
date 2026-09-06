import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * What a teacher can do to a paper from the row it sits on.
 *
 * The quiz list is the page staff have open when an exam starts, so the
 * controls that are only wanted then belong on it: the live panel, and the
 * access code that gets a student without Safe Exam Browser into the room. Both
 * used to be pages away — the panel behind the results screen's analytics, the
 * code behind the editor's Access tab — and both were reached under time
 * pressure with a student standing there.
 *
 * The counts are the other half of that: a row that says three people are
 * terminated is a row a teacher opens. Terminated leads because it is the only
 * one of the three that is a person waiting on a decision.
 */

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' }, isTeacher: true }),
  };
});

const listQuizzes = vi.fn();
const setSebBypassCode = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    listQuizzes: (...args) => listQuizzes(...args),
    setSebBypassCode: (...args) => setSebBypassCode(...args),
    quizResults: vi.fn(),
    exportQuizQuestions: vi.fn(),
    getSharedSebConfig: vi.fn(async () => ({ ready: false })),
    LmApiError: class LmApiError extends Error {},
  },
}));

const listed = (overrides = {}) => ({
  _id: 'q1',
  title: 'Midterm',
  published: true,
  questionCount: 2,
  questions: [{ _id: 'ques1' }, { _id: 'ques2' }],
  totalMarks: 10,
  settings: { deliveryMode: 'one_at_a_time', timeLimitMinutes: 60 },
  window: { open: true, closed: false, notYetOpen: false },
  publish: { scheduled: false },
  stats: { attempts: 3, avg: 55, lastSubmittedAt: null },
  live: { writing: 18, submitted: 5, shutOut: 2, offSeb: 1 },
  sittingNow: 18,
  ...overrides,
});

const render = async (quiz) => {
  listQuizzes.mockResolvedValue([quiz]);
  const { default: Quizzes } = await import('../pages/Quizzes');
  renderWithProviders(<Quizzes />);
  await screen.findByText('Midterm');
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('a quiz card while the paper is running', () => {
  it('leads with who has been terminated, then the two reassuring counts', async () => {
    await render(listed());

    const terminated = screen.getByText(/2 terminated/);
    const writing = screen.getByText(/18 writing/);
    const submitted = screen.getByText(/5 submitted/);
    // Node order, not just presence: the point of the line is which number the
    // eye lands on first.
    expect(terminated.compareDocumentPosition(writing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(writing.compareDocumentPosition(submitted) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers the live panel, badged with what needs a decision', async () => {
    await render(listed());
    // 2 shut out + 1 writing outside the lockdown.
    expect(screen.getByRole('button', { name: /live control 3/i })).toBeTruthy();
  });

  it('offers neither counts nor panel before the paper opens', async () => {
    await render(listed({ window: { open: false, closed: false, notYetOpen: true }, live: null }));

    expect(screen.queryByRole('button', { name: /live control/i })).toBeNull();
    expect(screen.queryByText(/terminated/)).toBeNull();
  });

  it('keeps the panel after the window shuts, for the student thrown out at the end', async () => {
    await render(listed({ window: { open: false, closed: true, notYetOpen: false } }));
    expect(screen.getByRole('button', { name: /live control/i })).toBeTruthy();
  });
});

describe('the controls that are only ever wanted about a paper, not inside it', () => {
  it('opens the settings from the row, as a gear and nothing else', async () => {
    await render(listed());

    const gear = screen.getByRole('link', { name: /quiz settings/i });
    expect(gear.getAttribute('href')).toBe('/learning/class/c1/quiz/q1/settings');
    // Icon only: the word was carrying no information the page it opens does
    // not repeat, and it crowded the row on a phone.
    expect(gear.textContent).toBe('');
  });

  it('keeps every wordless control together in the top corner, clear of the labelled ones', async () => {
    await render(listed());

    const follows = (first, second) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
    // The first button that says something in words: the toolbar sits above the
    // row of labelled buttons rather than trailing it, so every icon comes
    // before every word.
    const edit = screen.getByRole('link', { name: /^edit$/i });
    const icons = [
      screen.getByRole('link', { name: /quiz settings/i }),
      screen.getByRole('button', { name: /schedule quiz/i }),
      screen.getByRole('button', { name: /download the paper/i }),
      screen.getByRole('button', { name: /delete quiz/i }),
    ];

    icons.forEach((icon) => expect(follows(icon, edit)).toBe(true));
    // And in that order, which is roughly how often each is reached for.
    icons.slice(0, -1).forEach((icon, index) => expect(follows(icon, icons[index + 1])).toBe(true));
  });

  it('says "schedule" with a clock rather than a word', async () => {
    await render(listed());

    expect(screen.getByRole('button', { name: /schedule quiz/i })).toBeTruthy();
    expect(screen.queryByText(/^Schedule$/)).toBeNull();
  });
});

describe('the paper as a download', () => {
  it('is an icon sitting just before Delete, not a menu opening the row', async () => {
    await render(listed());

    const download = screen.getByRole('button', { name: /download the paper/i });
    const remove = screen.getByRole('button', { name: /delete quiz/i });
    expect(download.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The labelled menu button it replaced.
    expect(screen.queryByRole('button', { name: /PDF/ })).toBeNull();
  });
});

describe('the Safe Exam Browser access code', () => {
  it('is on the card once the paper is published, and keeps showing the code', async () => {
    setSebBypassCode.mockResolvedValue({
      settings: { sebBypassEnabled: true, sebBypassCode: 'K7PQ4M2X' },
    });
    await render(listed({ settings: { deliveryMode: 'one_at_a_time', requireSafeExamBrowser: true } }));

    fireEvent.click(screen.getByRole('button', { name: /access code/i }));
    fireEvent.click(await screen.findByRole('button', { name: /enable and generate a code/i }));

    await waitFor(() => expect(setSebBypassCode).toHaveBeenCalledWith('c1', 'q1', {}));
    expect(await screen.findByText('K7PQ4M2X')).toBeTruthy();
    /* The code used to be shown once and never again, on the reasoning that
       keeps a password hashed. It is handed out by hand by a teacher, so "once"
       only ever meant minting a replacement — retiring the code already given
       out — and the promise is gone with the behaviour. */
    expect(screen.queryByText(/will not be shown again/i)).toBeNull();
  });

  it('shows a code the card already knows about, without opening anything', async () => {
    await render(
      listed({
        settings: {
          deliveryMode: 'one_at_a_time',
          requireSafeExamBrowser: true,
          sebBypassEnabled: true,
          sebBypassCode: 'ZX8HT4',
        },
      }),
    );
    // On the card itself: it is wanted with a student standing in front of you,
    // which is a moment too late to go looking through a dialog for it.
    expect(await screen.findByText('ZX8HT4')).toBeTruthy();
  });

  it('stays off a paper with no lockdown to bypass', async () => {
    await render(listed({ settings: { deliveryMode: 'all_at_once' } }));
    expect(screen.queryByRole('button', { name: /access code/i })).toBeNull();
  });

  it('stays off an unpublished paper', async () => {
    await render(
      listed({
        published: false,
        settings: { deliveryMode: 'one_at_a_time', requireSafeExamBrowser: true },
      }),
    );
    expect(screen.queryByRole('button', { name: /access code/i })).toBeNull();
  });
});
