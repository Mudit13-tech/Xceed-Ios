import { expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The formula engine has always accepted a complex answer from a student —
 * cartesian ("3+4i", "3+4j") or polar ("polar(5,90)", "5∠90"), see
 * parseStudentValue. Nothing ever said so on the paper, and the one form the
 * teacher's own formula reference showed off, "5∠90", cannot be typed: ∠ is
 * not on any keyboard a student sits in front of.
 *
 * So the capability was real and unreachable. These tests pin the guidance to
 * the paper itself, in the note that already tells a student they may type an
 * expression rather than a decimal — one place per paper rather than one per
 * input, and it names polar() rather than the symbol.
 */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    // Both players read their own id off the same params object.
    useParams: () => ({ classId: 'c1', assignmentId: 'a1', tutorialId: 't1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' }, isTeacher: false }),
  };
});

const getAssignment = vi.fn();
const myAssignmentAttempt = vi.fn();
const getTutorial = vi.fn();
const myTutorialAttempt = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    getAssignment: (...a) => getAssignment(...a),
    myAssignmentAttempt: (...a) => myAssignmentAttempt(...a),
    saveAssignmentAttempt: vi.fn(),
    checkAssignmentAnswer: vi.fn(),
    submitAssignmentAttempt: vi.fn(),
    getTutorial: (...a) => getTutorial(...a),
    myTutorialAttempt: (...a) => myTutorialAttempt(...a),
    saveTutorialAttempt: vi.fn(),
    checkTutorialAnswer: vi.fn(),
    submitTutorialAttempt: vi.fn(),
  },
}));

const paper = { _id: 'x1', title: 'Impedance of an RL branch', description: '', settings: { dueDate: null } };

// No `type` on the question, which is what marks it parametric — the note is
// gated on that, because a paper of pure MCQs has nothing to type into.
const sitting = () => ({
  attempt: {
    _id: 'att1',
    attemptNumber: 1,
    status: 'in_progress',
    instantFeedback: false,
    responses: [],
    teacherFeedback: '',
    questions: [
      {
        questionId: 'q1',
        prompt: '<p>Find the impedance.</p>',
        values: { R: 30, X: 40 },
        answers: [{ key: 'z', label: 'Impedance', unit: 'Ω', marks: 5, partIndex: null }],
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

it('tells a student on an assignment how to type a complex answer', async () => {
  getAssignment.mockResolvedValueOnce(paper);
  myAssignmentAttempt.mockResolvedValueOnce(sitting());

  const { default: AssignmentPlayer } = await import('../pages/AssignmentPlayer');
  renderWithProviders(<AssignmentPlayer />);

  expect(await screen.findByText('3+4i')).toBeInTheDocument();
  expect(screen.getByText('polar(5, 45)')).toBeInTheDocument();
});

it('tells a student on a tutorial the same thing', async () => {
  getTutorial.mockResolvedValueOnce(paper);
  myTutorialAttempt.mockResolvedValueOnce(sitting());

  const { default: TutorialPlayer } = await import('../pages/TutorialPlayer');
  renderWithProviders(<TutorialPlayer />);

  expect(await screen.findByText('3+4i')).toBeInTheDocument();
  expect(screen.getByText('polar(5, 45)')).toBeInTheDocument();
});
