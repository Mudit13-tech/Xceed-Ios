import { expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * What a student is told when a checked answer is wrong.
 *
 * The badge used to read "not yet", which is the language of something still
 * arriving rather than something that is wrong — students read it as "keep
 * waiting" instead of "that answer is not the answer". It says "Incorrect"
 * now, in the tutorial player and in the assignment player, which carries the
 * identical component.
 *
 * Deliberately no assertion about *how* wrong the answer is: the badge still
 * says only that it is wrong and how many checks are left, because anything
 * finer makes a numeric answer brute-forceable.
 */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    // Both players read this; each takes only the id it knows about.
    useParams: () => ({ classId: 'c1', tutorialId: 't1', assignmentId: 'a1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' }, isTeacher: false }),
  };
});

const getTutorial = vi.fn();
const myTutorialAttempt = vi.fn();
const checkTutorialAnswer = vi.fn();
const getAssignment = vi.fn();
const myAssignmentAttempt = vi.fn();
const checkAssignmentAnswer = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    getTutorial: (...a) => getTutorial(...a),
    myTutorialAttempt: (...a) => myTutorialAttempt(...a),
    checkTutorialAnswer: (...a) => checkTutorialAnswer(...a),
    saveTutorialAttempt: vi.fn(),
    submitTutorialAttempt: vi.fn(),
    // No stream in these tests: the player subscribes only when given a URL.
    tutorialLiveStreamUrl: () => null,
    tutorialLiveState: vi.fn(),
    addTutorialUploads: vi.fn(),
    removeTutorialUpload: vi.fn(),
    getAssignment: (...a) => getAssignment(...a),
    myAssignmentAttempt: (...a) => myAssignmentAttempt(...a),
    checkAssignmentAnswer: (...a) => checkAssignmentAnswer(...a),
    saveAssignmentAttempt: vi.fn(),
    submitAssignmentAttempt: vi.fn(),
  },
}));

const paper = (title) => ({ _id: 'x1', title, description: '', settings: { dueDate: null } });

const sitting = () => ({
  attempt: {
    _id: 'att1',
    attemptNumber: 1,
    status: 'in_progress',
    instantFeedback: true,
    allowFileUpload: false,
    uploads: [],
    responses: [],
    teacherFeedback: '',
    questions: [
      {
        questionId: 'q1',
        open: true,
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

/** Type a wrong answer and press Check, in whichever player is mounted. */
const checkAWrongAnswer = async () => {
  await screen.findByText(/find the power/i);
  fireEvent.change(screen.getByPlaceholderText(/your answer/i), { target: { value: '12' } });
  fireEvent.click(screen.getByRole('button', { name: /^check$/i }));
};

beforeEach(() => {
  vi.clearAllMocks();
});

it('tells a tutorial student the answer is incorrect, not that it is "not yet"', async () => {
  getTutorial.mockResolvedValue(paper('Resistive Networks Practice'));
  myTutorialAttempt.mockResolvedValue(sitting());
  checkTutorialAnswer.mockResolvedValue({ checkable: true, correct: false, checksUsed: 1, checksAllowed: 3 });

  const { default: TutorialPlayer } = await import('../pages/TutorialPlayer');
  renderWithProviders(<TutorialPlayer />);
  await checkAWrongAnswer();

  expect(await screen.findByText(/^Incorrect · 2 left$/)).toBeInTheDocument();
  expect(screen.queryByText(/not yet/i)).not.toBeInTheDocument();
});

it('drops the count once a tutorial student has spent their last check', async () => {
  getTutorial.mockResolvedValue(paper('Resistive Networks Practice'));
  myTutorialAttempt.mockResolvedValue(sitting());
  checkTutorialAnswer.mockResolvedValue({ checkable: true, correct: false, checksUsed: 3, checksAllowed: 3 });

  const { default: TutorialPlayer } = await import('../pages/TutorialPlayer');
  renderWithProviders(<TutorialPlayer />);
  await checkAWrongAnswer();

  expect(await screen.findByText(/^Incorrect$/)).toBeInTheDocument();
});

it('says the same thing in the assignment player, which carries the same component', async () => {
  getAssignment.mockResolvedValue(paper('Resistive Networks (Graded)'));
  myAssignmentAttempt.mockResolvedValue(sitting());
  checkAssignmentAnswer.mockResolvedValue({ checkable: true, correct: false, checksUsed: 1, checksAllowed: 2 });

  const { default: AssignmentPlayer } = await import('../pages/AssignmentPlayer');
  renderWithProviders(<AssignmentPlayer />);
  await checkAWrongAnswer();

  expect(await screen.findByText(/^Incorrect · 1 left$/)).toBeInTheDocument();
  expect(screen.queryByText(/not yet/i)).not.toBeInTheDocument();
});

it('still shows a tick, unchanged, when the answer is right', async () => {
  getTutorial.mockResolvedValue(paper('Resistive Networks Practice'));
  myTutorialAttempt.mockResolvedValue(sitting());
  checkTutorialAnswer.mockResolvedValue({ checkable: true, correct: true, checksUsed: 1, checksAllowed: 3 });

  const { default: TutorialPlayer } = await import('../pages/TutorialPlayer');
  renderWithProviders(<TutorialPlayer />);
  await checkAWrongAnswer();

  expect(await screen.findByText('✓')).toBeInTheDocument();
  expect(screen.queryByText(/incorrect/i)).not.toBeInTheDocument();
});
