import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * What a student sees after their teacher reopens or extends their paper.
 *
 * The reported bug: a teacher gave one student more time, and on the student's
 * screen nothing changed — the test still read as completed, with no way back
 * into it. The server was right the whole way through (`reopenAttempt` sets the
 * sitting back to `in_progress` with its own `deadlineOverride`, and
 * `startAttempt` resumes an open sitting before it looks at the window); it was
 * the two student-facing screens that decided the sitting was over.
 *
 * Both did it the same way: they answered "has this student used their one
 * attempt?" and stopped there. A reopened attempt is still an attempt — the row
 * is kept, which is the whole point of "continue" — so `attemptsUsed` stays at
 * 1 and the student was handed a verdict instead of a door.
 *
 * These tests pin the rule that fixes both: an open sitting outranks the used
 * attempt and the closed window alike.
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
const listQuizzes = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    quizBrief: (...args) => quizBrief(...args),
    listQuizzes: (...args) => listQuizzes(...args),
    startAttempt: vi.fn(),
  },
}));

// Fullscreen requests are not implemented in jsdom, and the brief asks for one
// on mount.
document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);

/** A paper whose window shut an hour ago, reopened for this one student. */
const reopened = {
  _id: 'q1',
  title: 'Unit 2 test',
  instructions: [],
  sections: [],
  questionCount: 10,
  totalMarks: 20,
  estimatedDurationSec: 1800,
  settings: { deliveryMode: 'one_at_a_time', timeLimitMinutes: 30 },
  window: {
    open: false,
    closed: true,
    notYetOpen: false,
    canStart: false,
    lateToStart: true,
    closesAt: new Date(Date.now() - 3600_000).toISOString(),
    opensAt: null,
    startDeadline: null,
  },
  // The sitting is open again, but it is still the student's one attempt.
  attemptsUsed: 1,
  hasInProgress: true,
  inProgressId: 'a1',
  lastAttemptId: null,
  resultsPending: false,
  resultsReleased: false,
};

describe('a reopened sitting on the student brief', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers the way back in rather than a results verdict', async () => {
    quizBrief.mockResolvedValue(reopened);
    const { default: QuizBrief } = await import('../pages/QuizBrief');

    renderWithProviders(<QuizBrief />);

    const button = await screen.findByRole('button', { name: /continue attempt/i });
    expect(button).toBeEnabled();
    expect(screen.queryByText(/results pending/i)).toBeNull();
  });

  it('still refuses a student who has finished and has no sitting open', async () => {
    quizBrief.mockResolvedValue({
      ...reopened,
      hasInProgress: false,
      inProgressId: null,
      lastAttemptId: 'a1',
      resultsPending: true,
    });
    const { default: QuizBrief } = await import('../pages/QuizBrief');

    renderWithProviders(<QuizBrief />);

    await waitFor(() => expect(quizBrief).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /continue attempt|start test/i })).toBeNull();
    expect(screen.getByText(/results pending/i)).toBeTruthy();
  });
});

describe('a reopened sitting in the student quiz list', () => {
  const row = {
    ...reopened,
    inProgress: true,
    completedAt: null,
    bestAttempt: null,
    resultsUnread: false,
    questions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the test as live with a way to resume, not as completed', async () => {
    listQuizzes.mockResolvedValue([row]);
    const { default: Quizzes } = await import('../pages/Quizzes');

    renderWithProviders(<Quizzes />);

    expect(await screen.findByRole('link', { name: /resume test/i })).toBeTruthy();
    expect(screen.queryByText(/^Completed$/)).toBeNull();
  });

  it('marks a genuinely finished paper as completed', async () => {
    listQuizzes.mockResolvedValue([
      { ...row, inProgress: false, completedAt: new Date().toISOString() },
    ]);
    const { default: Quizzes } = await import('../pages/Quizzes');

    renderWithProviders(<Quizzes />);

    await waitFor(() => expect(listQuizzes).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: /resume test/i })).toBeNull();
    expect(screen.getByText(/^Completed$/)).toBeTruthy();
  });
});
