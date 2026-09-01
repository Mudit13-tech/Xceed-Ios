import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Networks' }, isTeacher: false }),
  };
});

const listQuizzes = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    listQuizzes: (...args) => listQuizzes(...args),
    quizResults: vi.fn(),
    exportQuizQuestions: vi.fn(),
    getSharedSebConfig: vi.fn(async () => ({ ready: false })),
    LmApiError: class LmApiError extends Error {},
  },
}));

const render = async (quizzes) => {
  listQuizzes.mockResolvedValue(quizzes);
  const { default: Quizzes } = await import('../pages/Quizzes');
  renderWithProviders(<Quizzes />);
  await screen.findByText(/Quizzes & exams/i);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Student view of Quiz live status and published results (Issue #2115)', () => {
  it('renders green Live button and Start test when quiz is actively open and unattempted', async () => {
    const liveQuiz = {
      _id: 'q1',
      title: 'Active Live Quiz',
      totalMarks: 20,
      questionCount: 5,
      attemptsUsed: 0,
      inProgress: false,
      completedAt: null,
      resultsReleased: false,
      resultsPending: false,
      window: { open: true, closed: false, notYetOpen: false, canStart: true },
      settings: { timeLimitMinutes: 30 },
    };

    await render([liveQuiz]);

    expect(screen.getByText('Active Live Quiz')).toBeTruthy();
    // Live button is rendered for active quiz
    expect(screen.getByText(/🟢 Live/)).toBeTruthy();
    // Start test button is available
    expect(screen.getByRole('link', { name: /Start test/i })).toBeTruthy();
  });

  it('does NOT render Live button or Start test for unattempted student after results are published', async () => {
    const resultsPublishedQuiz = {
      _id: 'q2',
      title: 'Concluded Quiz With Results',
      totalMarks: 20,
      questionCount: 5,
      attemptsUsed: 0,
      inProgress: false,
      completedAt: null,
      resultsReleased: true,
      resultsPending: false,
      window: { open: false, closed: true, notYetOpen: false, canStart: false, resultsPublished: true },
      settings: { timeLimitMinutes: 30 },
    };

    await render([resultsPublishedQuiz]);

    expect(screen.getByText('Concluded Quiz With Results')).toBeTruthy();
    // Live button MUST NOT be rendered
    expect(screen.queryByText(/🟢 Live/)).toBeNull();
    // Start test MUST NOT be rendered
    expect(screen.queryByRole('link', { name: /Start test/i })).toBeNull();
    /* A "Missed" badge, not a disabled "Quiz ended" button.
     *
     * This assertion used to demand the button, which is what this row rendered
     * when the test was written for #2115. The Missed badge replaced it
     * deliberately — a student who never sat a paper that has now closed is
     * told what happened to *them*, rather than being handed a greyed-out
     * control naming the one thing it refuses to do.
     *
     * The row falls here rather than to "View Result" because `reviewable`
     * needs a `lastAttemptId`, and somebody who never started has none — so
     * published results give them nothing to open. What #2115 actually fixed is
     * asserted above and is untouched: no Live pill, and no way to start a
     * closed paper. */
    expect(screen.getByText('Missed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Quiz ended/i })).toBeNull();
    // Explanatory text should still explain results are published
    expect(screen.getByText(/Quiz ended · Results published/i)).toBeTruthy();
  });

  it('lets a student open a published paper that has not opened yet, to read it and watch the clock', async () => {
    /* "Cannot start" and "cannot look" are different questions. A paper
       published on Monday for Friday used to sit behind a greyed-out button
       labelled *View instructions* — a button naming the one thing it refused
       to do. The brief carries the instructions, the duration and a "Starts in"
       countdown that unlocks itself on the moment; none of that is the paper. */
    const scheduledQuiz = {
      _id: 'q4',
      title: 'Friday Midterm',
      totalMarks: 20,
      questionCount: 5,
      attemptsUsed: 0,
      inProgress: false,
      resultsReleased: false,
      resultsPending: false,
      window: {
        open: false,
        closed: false,
        notYetOpen: true,
        canStart: false,
        opensAt: new Date(Date.now() + 86400000).toISOString(),
      },
      settings: { timeLimitMinutes: 30 },
    };

    await render([scheduledQuiz]);

    // A link, not a dead button: it goes to the brief for this paper.
    const link = screen.getByRole('link', { name: /View instructions/i });
    expect(link.getAttribute('href')).toBe('/learning/class/c1/quiz/q4');
    // And still not an invitation to start — the paper is not open.
    expect(screen.queryByRole('link', { name: /Start test/i })).toBeNull();
  });

  it('renders completed badge and result review button for student who submitted the quiz', async () => {
    const attemptedQuiz = {
      _id: 'q3',
      title: 'Completed Quiz',
      totalMarks: 20,
      questionCount: 5,
      attemptsUsed: 1,
      inProgress: false,
      completedAt: new Date().toISOString(),
      resultsReleased: true,
      resultsPending: false,
      resultsUnread: true,
      lastAttemptId: 'att1',
      bestAttempt: { score: 18, maxScore: 20, percent: 90, passed: true },
      window: { open: false, closed: true, notYetOpen: false, canStart: false, resultsPublished: true },
      settings: { timeLimitMinutes: 30 },
    };

    await render([attemptedQuiz]);

    expect(screen.getByRole('heading', { name: 'Completed Quiz' })).toBeTruthy();
    // Live button is not rendered
    expect(screen.queryByText(/🟢 Live/)).toBeNull();
    // Completed badge is shown
    expect(screen.getByText('✅ Completed')).toBeTruthy();
    // See your result button is available
    expect(screen.getByRole('link', { name: /See your result/i })).toBeTruthy();
  });
});
