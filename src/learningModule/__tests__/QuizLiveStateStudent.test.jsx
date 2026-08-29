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
    // It should render disabled "Quiz ended" button
    const endedBtn = screen.getByRole('button', { name: /Quiz ended/i });
    expect(endedBtn).toBeTruthy();
    expect(endedBtn.disabled).toBe(true);
    // Explanatory text should explain results are published
    expect(screen.getByText(/Quiz ended · Results published/i)).toBeTruthy();
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
