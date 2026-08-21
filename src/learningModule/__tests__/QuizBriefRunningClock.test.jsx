import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The clock the brief was not showing, and the sentence that contradicted it.
 *
 * `attemptDeadline` takes the *earlier* of a student's own time limit and the
 * paper's closing time, so on a scheduled exam the paper ends when it ends —
 * however late somebody started. The brief said the opposite in words ("the
 * clock does not start until you press Start") and showed no clock at all for a
 * paper already running. Both halves were reassuring, both were wrong, and the
 * screen they were on is exactly where a student decides how long to spend
 * reading the rules or wrestling Safe Exam Browser onto a machine.
 */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ classId: 'c1', quizId: 'q1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' }, isTeacher: false }),
  };
});

const quizBrief = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    quizBrief: (...a) => quizBrief(...a),
    listQuizzes: vi.fn(),
    startAttempt: vi.fn(),
    sebConfigUrl: () => '',
    sebLaunchToken: vi.fn(async () => ({ token: 't' })),
    sebLaunchUrlFromToken: () => '',
    LmApiError: class LmApiError extends Error {},
  },
}));

document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);

const inAnHour = () => new Date(Date.now() + 3600_000).toISOString();

const brief = ({ window: win = {}, ...overrides } = {}) => ({
  _id: 'q1',
  title: 'Midterm',
  instructions: [],
  sections: [],
  questionCount: 10,
  totalMarks: 20,
  estimatedDurationSec: 1800,
  settings: { deliveryMode: 'all_at_once', timeLimitMinutes: 30 },
  window: {
    open: true,
    closed: false,
    notYetOpen: false,
    canStart: true,
    lateToStart: false,
    closesAt: inAnHour(),
    opensAt: null,
    startDeadline: null,
    ...win,
  },
  attemptsUsed: 0,
  hasInProgress: false,
  inProgressId: null,
  lastAttemptId: null,
  resultsPending: false,
  resultsReleased: false,
  ...overrides,
});

const open = async (fixture) => {
  quizBrief.mockResolvedValue(fixture);
  const { default: QuizBrief } = await import('../pages/QuizBrief');
  renderWithProviders(<QuizBrief />);
  return screen.findByRole('heading', { name: /midterm/i });
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe('a paper that is already running', () => {
  it('says so, before the student has started anything', async () => {
    // The state that was invisible: the exam is under way and this student is
    // reading rules while it burns.
    await open(brief());
    expect(await screen.findByText(/this test is running/i)).toBeInTheDocument();
  });

  it('shows a live countdown to the close, not just a date', async () => {
    await open(brief());
    expect(await screen.findByText(/this test is running/i)).toBeInTheDocument();
    // CountdownPanel renders hrs/min/sec cells under a role="timer".
    expect(document.querySelector('[role="timer"]')).not.toBeNull();
  });

  it('says plainly that not starting does not pause it', async () => {
    await open(brief());
    expect(await screen.findByText(/whether or not you have started/i)).toBeInTheDocument();
  });

  it('speaks to a student mid-paper about their own sitting', async () => {
    await open(brief({ hasInProgress: true }));
    expect(await screen.findByText(/your test is running/i)).toBeInTheDocument();
    expect(await screen.findByText(/even if you are still answering/i)).toBeInTheDocument();
  });

  it('shows no running clock before the paper opens', async () => {
    // "Starts in" already covers that case, and two countdowns disagreeing about
    // what is happening is worse than one.
    await open(brief({ window: { open: false, notYetOpen: true, canStart: false, opensAt: inAnHour() } }));
    expect(screen.queryByText(/is running/i)).toBeNull();
  });

  it('shows no running clock on a paper with no closing time', async () => {
    // Nothing is bleeding away, and "your time starts when you press Start" is
    // then the truth rather than a comforting lie.
    await open(brief({ window: { closesAt: null } }));
    expect(screen.queryByText(/is running/i)).toBeNull();
  });
});

describe('what the brief promises about the clock', () => {
  it('never repeats the old claim that starting late costs nothing', async () => {
    /* The exact sentence that had to go. It survived on two screens, and on a
       scheduled paper both were wrong. */
    await open(brief());
    expect(screen.queryByText(/clock does not start until/i)).toBeNull();
  });

  it('falls back to the honest wording when there is genuinely no deadline', async () => {
    /* Read on the Safe Exam Browser panel, which is where the old claim lived —
       an ordinary paper never made it, so there is nothing there to correct. With
       no closing time, "your time starts when you press Start" is simply true. */
    await open(
      brief({
        window: { closesAt: null },
        settings: { deliveryMode: 'all_at_once', requireSafeExamBrowser: true, sebReady: true },
        sebVerified: true,
        sebReason: null,
      }),
    );
    expect(await screen.findByText(/your time starts when you press start/i)).toBeInTheDocument();
  });
});
