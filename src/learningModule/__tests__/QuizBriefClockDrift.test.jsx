import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The bug report: a student in Safe Exam Browser watched the "opens in"
 * countdown reach zero and the Start button never enabled.
 *
 * The brief's countdowns used to compare a server timestamp against this
 * browser's own `Date.now()`. On a machine whose clock runs behind the
 * server's — exam lab machines running Safe Exam Browser are exactly where
 * an unmanaged system clock turns up — the countdown hits zero and fires its
 * one-shot reload before the window has actually opened by the server's own
 * clock. That reload sees `notYetOpen` still true, and nothing tries again:
 * `useCountdown`'s reload effect only fires when its value *changes* to zero,
 * and it is already zero. The fix is `serverClock.now()` in place of
 * `Date.now()`, corrected from `serverTime` on the brief response itself —
 * see serverClock.js and the `useCountdown` comment in QuizBrief.jsx.
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

// A server clock this test controls outright, independent of the real wall
// clock the test runner happens to be on. Deliberately offset from the real
// clock in every test below — a test where the mocked server time and the
// real system clock happen to agree cannot tell "reads the server clock"
// apart from "reads the browser clock and got lucky".
let mockServerNow = Date.now();
vi.mock('../serverClock', () => ({
  default: {
    sync: vi.fn(),
    now: () => mockServerNow,
    state: () => ({ offset: 0, synced: true }),
    reset: vi.fn(),
  },
}));

document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);

// This browser's clock is five minutes behind the server's — plausible drift
// for an unmanaged exam lab machine, and large enough that a countdown or a
// reload decision computed against the wrong clock is never a coincidence.
const DRIFT_MS = 5 * 60_000;

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
    closesAt: null,
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
  quizBrief.mockResolvedValueOnce(fixture);
  const { default: QuizBrief } = await import('../pages/QuizBrief');
  renderWithProviders(<QuizBrief />);
  return screen.findByRole('heading', { name: /midterm/i });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockServerNow = Date.now() + DRIFT_MS;
});
afterEach(() => vi.useRealTimers());

it('counts down against the server clock rather than the browser clock', async () => {
  // The system clock this test runs on is irrelevant here — opensAt is set
  // relative to the *mocked* server time, ten seconds out. If the countdown
  // were still reading raw Date.now() — five minutes behind the mocked
  // server clock, per DRIFT_MS — it would show five-odd minutes remaining,
  // not ten seconds.
  const opensAt = new Date(mockServerNow + 10_000).toISOString();
  await open(brief({ window: { notYetOpen: true, canStart: false, open: false, opensAt } }));

  await waitFor(() => {
    // Scoped to the countdown's own `role="timer"` container — the brief
    // also renders other two-digit numbers (question count, marks) that
    // would otherwise pollute an unscoped query. CountdownPanel renders
    // exactly three cells inside it, hrs/min/sec in that order. Checking only
    // the seconds cell in isolation would pass by coincidence whenever the
    // wrong clock's seconds digits happen to line up with the right clock's
    // — as DRIFT_MS (300s) plus a 10s target (310s = 05:10) very nearly does
    // against a 10s target read correctly (00:10) — so hours and minutes
    // both reading zero is what actually rules the five-minutes-off reading
    // out.
    const timer = within(screen.getByRole('timer'));
    const [hrs, min, sec] = timer.getAllByText(/^\d{2}$/).map((el) => el.textContent);
    expect(hrs).toBe('00');
    expect(min).toBe('00');
    expect(['08', '09', '10']).toContain(sec);
  });
});

it('does not leave the Start button stuck disabled when this browser is behind the server clock', async () => {
  // Server time says the window is already open (opensAt is now-or-earlier by
  // the server's own clock) — exactly the state a clock-drifted browser used
  // to reach and then never recover from, because the reload fires once and
  // the countdown was already at zero. Both responses are queued before the
  // first render: the reload this fires can happen as early as the first
  // effect flush, before a test could otherwise react to the heading
  // appearing and queue the second one in time.
  const opensAt = new Date(mockServerNow - 1000).toISOString();
  quizBrief
    .mockResolvedValueOnce(brief({ window: { notYetOpen: true, canStart: false, open: false, opensAt } }))
    .mockResolvedValueOnce(brief({ window: { notYetOpen: false, canStart: true, open: true } }));

  const { default: QuizBrief } = await import('../pages/QuizBrief');
  renderWithProviders(<QuizBrief />);

  // The reload this fires must ask the server again — and this time the
  // server agrees the window is open.
  await waitFor(() => expect(quizBrief).toHaveBeenCalledTimes(2));
  const startButton = await screen.findByRole('button', { name: /start test/i });
  await waitFor(() => expect(startButton).not.toBeDisabled());
});
