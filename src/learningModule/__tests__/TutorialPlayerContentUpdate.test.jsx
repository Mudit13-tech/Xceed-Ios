import { expect, it, vi, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * A teacher's edit reaching a student who already has the paper open.
 *
 * Saving a published tutorial re-works every issued paper and bumps the
 * tutorial's `contentRevision`, which every open player — self-paced as well as
 * live — watches on the tutorial's state stream. When it moves, the player
 * reloads its paper and says why.
 */

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ classId: 'c1', tutorialId: 't1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' }, isTeacher: false }),
  };
});

// A stream the test can push frames into, standing in for the server's.
let pushFrame;
vi.mock('../hooks/useShortStream', async () => {
  const React = await vi.importActual('react');
  function useMockStream() {
    const [state, setState] = React.useState(null);
    pushFrame = setState;
    return { state, connection: 'live', error: '', merge: () => {} };
  }
  return { default: useMockStream };
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
    tutorialLiveStreamUrl: () => 'https://example.test/state/stream',
    tutorialLiveState: vi.fn(),
    addTutorialUploads: vi.fn(),
    removeTutorialUpload: vi.fn(),
  },
}));

const sitting = (prompt) => ({
  attempt: {
    _id: 'a1',
    attemptNumber: 1,
    status: 'in_progress',
    instantFeedback: false,
    allowFileUpload: false,
    uploads: [],
    responses: [],
    teacherFeedback: '',
    live: null,
    questions: [
      {
        questionId: 'q1',
        open: true,
        prompt,
        values: { R: 4 },
        answers: [{ key: 'p', label: 'Power', unit: 'W', marks: 2, partIndex: null }],
        parts: [],
      },
    ],
  },
  attemptsUsed: 1,
  attemptsAllowed: 0,
  exhausted: false,
});

// The page is imported lazily on first use, which can outlast the default wait.
const SLOW = { timeout: 5000 };

beforeEach(() => {
  vi.clearAllMocks();
  // Reset, not just cleared: a queued once-value must not leak into the next test.
  myTutorialAttempt.mockReset();
  getTutorial.mockResolvedValue({ _id: 't1', title: 'Self-paced practice', description: '', settings: {} });
});

it('reloads a self-paced paper when the teacher edits the questions, and says so', async () => {
  myTutorialAttempt.mockResolvedValueOnce(sitting('<p>Old wording.</p>'));
  const { default: TutorialPlayer } = await import('../pages/TutorialPlayer');
  renderWithProviders(<TutorialPlayer />);
  expect(await screen.findByText(/old wording/i, {}, SLOW)).toBeInTheDocument();
  // The stream's first frame is the baseline, as the server always sends one.
  act(() => pushFrame({ live: false, contentRevision: 0 }));

  myTutorialAttempt.mockResolvedValueOnce(sitting('<p>Corrected wording.</p>'));
  act(() => pushFrame({ live: false, contentRevision: 1 }));

  expect(await screen.findByText(/corrected wording/i, {}, SLOW)).toBeInTheDocument();
  expect(screen.getByText(/your teacher updated the questions/i)).toBeInTheDocument();
  // A reload the student did not ask for reviews the paper on file rather than
  // starting anything.
  expect(myTutorialAttempt).toHaveBeenLastCalledWith('c1', 't1', { review: true });
});

it('does not reload on the first frame, which matches what was just fetched', async () => {
  myTutorialAttempt.mockResolvedValue(sitting('<p>Only wording.</p>'));
  const { default: TutorialPlayer } = await import('../pages/TutorialPlayer');
  renderWithProviders(<TutorialPlayer />);
  await screen.findByText(/only wording/i, {}, SLOW);
  act(() => pushFrame({ live: false, contentRevision: 3 }));

  await waitFor(() => expect(myTutorialAttempt).toHaveBeenCalledTimes(1));
  expect(screen.queryByText(/your teacher updated the questions/i)).not.toBeInTheDocument();
});
