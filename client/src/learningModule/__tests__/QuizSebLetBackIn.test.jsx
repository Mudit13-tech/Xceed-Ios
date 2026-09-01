import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The teacher-facing side of the SEB "let them in again" remedy.
 *
 * `requireSafeExamBrowser` (and the Config Key / .seb file behind it) can be
 * changed at any time, with no lock while students are mid-attempt — turning
 * it on, or replacing the key/file, terminates every live, innocent sitting
 * within about 30 seconds. The ordinary **Let back in** button did not use to
 * fix this: the reopened attempt still had no `sebBypassed`, so the very next
 * guarded request would fail the SEB check again and end it a second time.
 * These tests pin the checkbox that closes that gap — shown only on a quiz
 * that actually requires SEB, off by default, and threaded through as
 * `sebExempt` on the reopen call.
 */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ classId: 'c1', quizId: 'q1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' }, isTeacher: true }),
  };
});

const quizResults = vi.fn();
const reopenQuizAttempt = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    quizResults: (...args) => quizResults(...args),
    reopenQuizAttempt: (...args) => reopenQuizAttempt(...args),
    quizResultsCsvUrl: () => 'https://api.test/export.csv',
  },
}));

const baseQuiz = (overrides = {}) => ({
  _id: 'q1',
  title: 'Midterm',
  published: true,
  questions: [{ _id: 'ques1' }],
  totalMarks: 10,
  settings: { deliveryMode: 'all_at_once', timeLimitMinutes: 30, ...overrides },
});

const terminatedAttempt = {
  _id: 'a1',
  studentName: 'Asha Rao',
  studentEmail: 'asha@example.com',
  rollNumber: '21EC001',
  status: 'terminated',
  score: 0,
  maxScore: 10,
  answeredCount: 2,
  questionCount: 1,
  cursor: 0,
  reopenCount: 0,
  terminationReason: 'Your test was submitted automatically because Safe Exam Browser was no longer active.',
};

const resultsFixture = (quiz, attempt) => ({
  quiz,
  attempts: [attempt],
  notStartedStudents: [],
  summary: {
    submitted: 0,
    enrolled: 1,
    inProgress: 0,
    notStarted: 0,
    average: null,
    passRate: null,
    avgDurationSec: 0,
    flagged: 0,
    terminated: 1,
  },
  perQuestion: [],
  perSection: [],
  results: { released: false },
  distribution: [],
  serverTime: new Date().toISOString(),
});

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Imported here rather than inside the first test that needs it.
 *
 * This is a page and it pulls in a large tree; transforming and importing it
 * costs seconds. Done inside a test body, only the *first* test pays — it ran
 * at 4.3s against sibling tests at 0.6s, which is most of the way to the
 * per-test timeout before the test has asserted anything, and over it the
 * moment the machine is busy. At module scope the cost is paid once, at
 * collection time, where no per-test budget applies.
 *
 * Safe above the mocks it depends on: `vi.mock` calls are hoisted above every
 * import in the file, so this still resolves to the mocked modules.
 */
const { default: QuizResults } = await import('../pages/QuizResults');

describe('a quiz that requires Safe Exam Browser', () => {
  it('offers the exemption checkbox when letting a terminated student back in', async () => {
    quizResults.mockResolvedValue(resultsFixture(baseQuiz({ requireSafeExamBrowser: true }), terminatedAttempt));
    renderWithProviders(<QuizResults />);

    fireEvent.click(await screen.findByRole('button', { name: /let back in/i }));

    expect(await screen.findByText(/let them in without safe exam browser/i)).toBeTruthy();
  });

  it('leaves it unchecked by default — waiving the check is a decision made per reopen, not a default', async () => {
    quizResults.mockResolvedValue(resultsFixture(baseQuiz({ requireSafeExamBrowser: true }), terminatedAttempt));
    renderWithProviders(<QuizResults />);

    fireEvent.click(await screen.findByRole('button', { name: /let back in/i }));
    const checkbox = await screen.findByRole('checkbox', { name: /let them in without safe exam browser/i });
    expect(checkbox).not.toBeChecked();
  });

  it('sends sebExempt: true only when the teacher checks it, and does not send it at all otherwise', async () => {
    quizResults.mockResolvedValue(resultsFixture(baseQuiz({ requireSafeExamBrowser: true }), terminatedAttempt));
    reopenQuizAttempt.mockResolvedValue({ attempt: { ...terminatedAttempt, status: 'in_progress' }, mode: 'continue' });
    renderWithProviders(<QuizResults />);

    fireEvent.click(await screen.findByRole('button', { name: /let back in/i }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /let them in without safe exam browser/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));

    await waitFor(() =>
      expect(reopenQuizAttempt).toHaveBeenCalledWith(
        'c1',
        'a1',
        expect.objectContaining({ mode: 'continue', sebExempt: true }),
      ),
    );
  });

  it('does not send sebExempt when the box is left unchecked', async () => {
    quizResults.mockResolvedValue(resultsFixture(baseQuiz({ requireSafeExamBrowser: true }), terminatedAttempt));
    reopenQuizAttempt.mockResolvedValue({ attempt: { ...terminatedAttempt, status: 'in_progress' }, mode: 'continue' });
    renderWithProviders(<QuizResults />);

    fireEvent.click(await screen.findByRole('button', { name: /let back in/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));

    await waitFor(() =>
      expect(reopenQuizAttempt).toHaveBeenCalledWith('c1', 'a1', expect.objectContaining({ sebExempt: false })),
    );
  });
});

describe('an ordinary quiz with no Safe Exam Browser requirement', () => {
  it('never shows the checkbox at all', async () => {
    quizResults.mockResolvedValue(resultsFixture(baseQuiz(), terminatedAttempt));
    renderWithProviders(<QuizResults />);

    fireEvent.click(await screen.findByRole('button', { name: /let back in/i }));

    await screen.findByRole('button', { name: 'Reopen' });
    expect(screen.queryByText(/let them in without safe exam browser/i)).toBeNull();
  });
});
