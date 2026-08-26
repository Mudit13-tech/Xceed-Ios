import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * Same bug as TutorialPlayerCrash.test.jsx, mirrored line-for-line in this
 * file: `checkOne` closed over `submitted` before its declaration further
 * down the component, throwing a temporal-dead-zone ReferenceError on every
 * render. Fixed by declaring `submitted` (null-safe) before `checkOne`.
 */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ classId: 'c1', assignmentId: 'a1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' }, isTeacher: false }),
  };
});

const getAssignment = vi.fn();
const myAssignmentAttempt = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    getAssignment: (...a) => getAssignment(...a),
    myAssignmentAttempt: (...a) => myAssignmentAttempt(...a),
    saveAssignmentAttempt: vi.fn(),
    checkAssignmentAnswer: vi.fn(),
    submitAssignmentAttempt: vi.fn(),
  },
}));

const assignment = {
  _id: 'a1',
  title: 'Resistive Networks (Graded)',
  description: '',
  settings: { dueDate: null },
};

const sitting = ({ instantFeedback = false } = {}) => ({
  attempt: {
    _id: 'att1',
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

it('renders an assignment attempt without crashing, with instant feedback off', async () => {
  getAssignment.mockResolvedValueOnce(assignment);
  myAssignmentAttempt.mockResolvedValueOnce(sitting({ instantFeedback: false }));

  const { default: AssignmentPlayer } = await import('../pages/AssignmentPlayer');
  renderWithProviders(<AssignmentPlayer />);

  expect(await screen.findByText(/find the power/i)).toBeInTheDocument();
});

it('renders an assignment attempt without crashing, with instant feedback on', async () => {
  getAssignment.mockResolvedValueOnce(assignment);
  myAssignmentAttempt.mockResolvedValueOnce(sitting({ instantFeedback: true }));

  const { default: AssignmentPlayer } = await import('../pages/AssignmentPlayer');
  renderWithProviders(<AssignmentPlayer />);

  expect(await screen.findByText(/find the power/i)).toBeInTheDocument();
});
