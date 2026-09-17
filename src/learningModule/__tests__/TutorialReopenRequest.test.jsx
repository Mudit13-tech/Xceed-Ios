import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * Which of the two things the player asks the server for.
 *
 * A student opening a tutorial is here to work, and asks for a paper. Only the
 * live stream's own refresh — fired because the teacher opened the next
 * question, not because this student did anything — asks to review what is on
 * file. Getting that round the wrong way handed a student who had already
 * submitted their marked paper instead, answers and all, with nothing to answer.
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

// A pace the test can advance: the player re-fetches when `revision` changes.
let streamResult = { state: null, connection: 'live', error: '', merge: () => {} };
vi.mock('../hooks/useShortStream', () => ({
  default: () => streamResult,
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

const sitting = (live) => ({
  attempt: {
    _id: 'a1',
    attemptNumber: 1,
    status: 'in_progress',
    allowFileUpload: false,
    uploads: [],
    responses: [],
    teacherFeedback: '',
    live,
    questions: [
      {
        questionId: 'q1',
        open: true,
        prompt: '<p>Opened question.</p>',
        values: {},
        answers: [{ key: 'p', label: 'Power', unit: 'W', marks: 5, partIndex: null }],
        parts: [],
      },
    ],
  },
  attemptsUsed: 1,
  attemptsAllowed: 0,
});

const renderPlayer = async () => {
  const { default: TutorialPlayer } = await import('../pages/TutorialPlayer');
  renderWithProviders(<TutorialPlayer />);
};

beforeEach(() => {
  vi.clearAllMocks();
  streamResult = { state: null, connection: 'live', error: '', merge: () => {} };
  getTutorial.mockResolvedValue(tutorial);
});

describe('what the player asks the server for', () => {
  it('a student opening the tutorial asks for a paper, not a review', async () => {
    myTutorialAttempt.mockResolvedValue(sitting(null));

    await renderPlayer();

    await screen.findByText('Live Practice');
    expect(myTutorialAttempt).toHaveBeenCalledWith('c1', 't1', { review: false });
  });

  it('the live stream nudging a refresh asks to review, so it spends no attempt', async () => {
    const live = { sessionId: 's1', status: 'live', openedCount: 1, currentIndex: 0, revision: 0 };
    myTutorialAttempt.mockResolvedValue(sitting(live));
    streamResult = {
      state: { revision: 0, openedCount: 1, status: 'live' },
      connection: 'live',
      error: '',
      merge: () => {},
    };

    await renderPlayer();
    await screen.findByText('Live Practice');

    // The teacher opens the next question: same player, a new frame.
    streamResult = {
      state: { revision: 1, openedCount: 2, status: 'live' },
      connection: 'live',
      error: '',
      merge: () => {},
    };
    myTutorialAttempt.mockResolvedValue(sitting({ ...live, openedCount: 2, revision: 1 }));
    // A re-render is what delivers the frame the mocked hook now returns.
    await renderPlayer();

    await waitFor(() =>
      expect(myTutorialAttempt).toHaveBeenCalledWith('c1', 't1', { review: true }),
    );
  });
});
