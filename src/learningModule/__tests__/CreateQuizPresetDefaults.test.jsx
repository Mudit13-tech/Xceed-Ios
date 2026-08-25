import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * What a new exam-style quiz shows a student by default.
 *
 * The score and the worked answers are two different things to withhold, and
 * an exam preset used to hold both back until the teacher pressed release —
 * so every paper created from it left students with no mark at all until
 * then, not just no answer key. Only the answer key is what an exam actually
 * has reason to default to withholding; the raw score should reach a student
 * the moment they submit, the same as the plain quiz preset already does.
 * `showAnswersAfterSubmit` staying off is the one faculty still control
 * per quiz from the editor's Marking tab.
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
const createQuiz = vi.fn();
const getSharedSebConfig = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    listQuizzes: (...a) => listQuizzes(...a),
    createQuiz: (...a) => createQuiz(...a),
    getSharedSebConfig: (...a) => getSharedSebConfig(...a),
    quizResults: vi.fn(),
    exportQuizQuestions: vi.fn(),
    setSebBypassCode: vi.fn(),
    LmApiError: class LmApiError extends Error {},
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  listQuizzes.mockResolvedValue([]);
  getSharedSebConfig.mockResolvedValue({ ready: true });
  createQuiz.mockResolvedValue({ _id: 'q1' });
});

const openCreateModal = async () => {
  const { default: Quizzes } = await import('../pages/Quizzes');
  renderWithProviders(<Quizzes />);
  fireEvent.click(await screen.findByRole('button', { name: /\+ create quiz/i }));
  fireEvent.change(await screen.findByPlaceholderText(/fourier transforms/i), {
    target: { value: 'Midterm' },
  });
};

it('shows the score immediately by default on the one-timer exam preset, the dialog\'s own default', async () => {
  await openCreateModal();
  // exam_paper_timer is the dialog's default selection — nothing to click.
  fireEvent.click(screen.getByRole('button', { name: /create & add questions/i }));

  await waitFor(() => expect(createQuiz).toHaveBeenCalled());
  const [, body] = createQuiz.mock.calls[0];
  expect(body.settings).toMatchObject({ showScoreImmediately: true, showAnswersAfterSubmit: false });
});

it('shows the score immediately by default on the per-question-timer exam preset too', async () => {
  await openCreateModal();
  fireEvent.click(screen.getByRole('radio', { name: /one question at a time, a timer on each question/i }));
  fireEvent.click(screen.getByRole('button', { name: /create & add questions/i }));

  await waitFor(() => expect(createQuiz).toHaveBeenCalled());
  const [, body] = createQuiz.mock.calls[0];
  expect(body.settings).toMatchObject({ showScoreImmediately: true, showAnswersAfterSubmit: false });
});

it('still shows both by default on the plain one-page quiz preset', async () => {
  await openCreateModal();
  fireEvent.click(screen.getByRole('radio', { name: /one page, one timer/i }));
  fireEvent.click(screen.getByRole('button', { name: /create & add questions/i }));

  await waitFor(() => expect(createQuiz).toHaveBeenCalled());
  const [, body] = createQuiz.mock.calls[0];
  expect(body.settings).toMatchObject({ showScoreImmediately: true, showAnswersAfterSubmit: true });
});
