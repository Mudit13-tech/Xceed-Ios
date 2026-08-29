import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * Live (teacher-paced) mode in the tutorial player: only the questions the
 * teacher has opened are shown, the paper wears a Live badge, and a "waiting"
 * line stands in for the questions still to come. The server does the
 * withholding (an unopened question arrives with `open: false` and no content);
 * the player must render exactly what it was handed and no more.
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

// The live stream is mocked to a fixed pace so the test does not depend on SSE.
// The returned object is a stable module-level reference — the real hook hands
// back a useState value that only changes on a new frame, and a fresh object per
// render here would spin the player's "react to a new frame" effect forever.
const LIVE_STREAM_RESULT = {
  state: { revision: 0, openedCount: 1, status: 'live' },
  connection: 'live',
  error: '',
  merge: () => {},
};
vi.mock('../hooks/useShortStream', () => ({
  default: () => LIVE_STREAM_RESULT,
}));

const getTutorial = vi.fn();
const myTutorialAttempt = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    getTutorial: (...a) => getTutorial(...a),
    myTutorialAttempt: (...a) => myTutorialAttempt(...a),
    saveTutorialAttempt: vi.fn(),
    checkTutorialAnswer: vi.fn(),
    submitTutorialAttempt: vi.fn(),
    tutorialLiveStreamUrl: () => 'https://example.test/live/stream',
    tutorialLiveState: vi.fn(),
    addTutorialUploads: vi.fn(),
    removeTutorialUpload: vi.fn(),
  },
}));

const tutorial = { _id: 't1', title: 'Live Practice', description: '', settings: { dueDate: null } };

const liveSitting = () => ({
  attempt: {
    _id: 'a1',
    attemptNumber: 1,
    status: 'in_progress',
    instantFeedback: true,
    allowFileUpload: false,
    uploads: [],
    responses: [],
    teacherFeedback: '',
    // The pace: one of two questions opened.
    live: { sessionId: 's1', status: 'live', openedCount: 1, currentIndex: 0, revision: 0 },
    questions: [
      {
        questionId: 'q1',
        open: true,
        prompt: '<p>Opened question.</p>',
        values: { R: 45 },
        answers: [{ key: 'p', label: 'Power', unit: 'W', marks: 5, partIndex: null }],
        parts: [],
      },
      {
        // Withheld by the server — no prompt, no answers.
        questionId: 'q2',
        open: false,
        prompt: '',
        values: {},
        answers: [],
        parts: [],
      },
    ],
  },
  attemptsUsed: 1,
  attemptsAllowed: 1,
  exhausted: false,
});

beforeEach(() => {
  vi.clearAllMocks();
});

it('shows only the opened question, the Live badge, and a waiting line for the rest', async () => {
  getTutorial.mockResolvedValue(tutorial);
  myTutorialAttempt.mockResolvedValue(liveSitting());

  const { default: TutorialPlayer } = await import('../pages/TutorialPlayer');
  renderWithProviders(<TutorialPlayer />);

  // The opened question renders…
  expect(await screen.findByText(/opened question/i)).toBeInTheDocument();
  // …the Live badge is present…
  expect(screen.getByText(/^Live$/)).toBeInTheDocument();
  // …and there is a standing "waiting for the next question" line because one
  // of the two questions is still closed.
  expect(screen.getByText(/waiting for the teacher to open the next question/i)).toBeInTheDocument();
});
