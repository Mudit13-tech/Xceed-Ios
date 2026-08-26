import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The bug: `checkOne` (a useCallback near the top of the component) closed
 * over `submitted` — both in its body and its dependency array — before
 * `const submitted = attempt.status !== 'in_progress'` was declared further
 * down the same function. Hooks run unconditionally on every render, before
 * any early return, so this was a `ReferenceError: Cannot access 'submitted'
 * before initialization` on the very first render of every tutorial attempt,
 * regardless of whether instant feedback was even turned on. Fixed by
 * declaring `submitted` (null-safe, via `attempt?.status`) before `checkOne`.
 */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ classId: 'c1', tutorialId: 't1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' }, isTeacher: false }),
  };
});

const getTutorial = vi.fn();
const myTutorialAttempt = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    getTutorial: (...a) => getTutorial(...a),
    myTutorialAttempt: (...a) => myTutorialAttempt(...a),
    saveTutorialAttempt: vi.fn(),
    checkTutorialAnswer: vi.fn(),
    submitTutorialAttempt: vi.fn(),
  },
}));

const tutorial = {
  _id: 't1',
  title: 'Resistive Networks Practice',
  description: '',
  settings: { dueDate: null },
};

const sitting = ({ instantFeedback = false } = {}) => ({
  attempt: {
    _id: 'a1',
    attemptNumber: 1,
    status: 'in_progress',
    instantFeedback,
    responses: [],
    teacherFeedback: '',
    questions: [
      {
        questionId: 'q1',
        prompt: '<p>Find the power.</p>',
        values: { R: 45, I: 1.5 },
        answers: [{ key: 'p', label: 'Power', unit: 'W', marks: 5, partIndex: null }],
        parts: [],
      },
    ],
  },
  attemptsUsed: 0,
  attemptsAllowed: 1,
  exhausted: false,
});

beforeEach(() => {
  vi.clearAllMocks();
});

it('renders a tutorial attempt without crashing, with instant feedback off', async () => {
  getTutorial.mockResolvedValueOnce(tutorial);
  myTutorialAttempt.mockResolvedValueOnce(sitting({ instantFeedback: false }));

  const { default: TutorialPlayer } = await import('../pages/TutorialPlayer');
  renderWithProviders(<TutorialPlayer />);

  expect(await screen.findByText(/find the power/i)).toBeInTheDocument();
});

it('renders a tutorial attempt without crashing, with instant feedback on', async () => {
  // This is the path that actually calls checkOne's guard, but the crash
  // happened on mount regardless — both cases are kept so a future change
  // that reintroduces the bug only on one branch is still caught.
  getTutorial.mockResolvedValueOnce(tutorial);
  myTutorialAttempt.mockResolvedValueOnce(sitting({ instantFeedback: true }));

  const { default: TutorialPlayer } = await import('../pages/TutorialPlayer');
  renderWithProviders(<TutorialPlayer />);

  expect(await screen.findByText(/find the power/i)).toBeInTheDocument();
});
