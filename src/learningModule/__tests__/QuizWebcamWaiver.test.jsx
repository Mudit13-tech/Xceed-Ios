import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';
import QuizAttempt from '../pages/QuizAttempt';

/**
 * A student the teacher waived the camera for, actually sitting the paper.
 *
 * The waiver exists for the one case the requirement cannot serve: a camera
 * nobody can make work, on a machine nobody can swap, ten minutes before the
 * bell. Staff grant it from Live control, and `startAttempt` honours it — the
 * student gets through the door without a camera and the sitting is marked
 * `waivedByName` so it reads as "allowed" rather than "slipped through".
 *
 * Then the paper asked for the camera anyway. The sitting screen mounted the
 * watch on `requireWebcam` alone, so it opened the camera, failed, and went
 * round its retry ramp reporting `blocked` — and after two of those the server
 * latches `webcam.flaggedAt`, which raises the row in Live control as a camera
 * flag. The invigilator was sent back to a desk to look at the exact fault they
 * had already ruled on, and the student sat the rest of the paper under a red
 * "No camera" box.
 *
 * The waiver now reaches the sitting (`webcamExempt` on the server's `getQuiz`)
 * and the watch is not mounted for it at all.
 */

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ classId: 'c1', quizId: 'q1', attemptId: 'a1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' } }),
  };
});

const getQuiz = vi.fn();
const getAttemptPaper = vi.fn();
const recordWebcamCheck = vi.fn().mockResolvedValue({ ok: true });

vi.mock('../api/lmApi', () => ({
  default: {
    getQuiz: (...args) => getQuiz(...args),
    getAttemptPaper: (...args) => getAttemptPaper(...args),
    getAttempt: vi.fn().mockResolvedValue({ attempt: { status: 'submitted' } }),
    saveAttemptDraft: vi.fn().mockResolvedValue({ saved: true }),
    submitAttempt: vi.fn(),
    recordViolation: vi.fn().mockResolvedValue({}),
    heartbeat: vi.fn().mockResolvedValue({}),
    recordWebcamCheck: (...args) => recordWebcamCheck(...args),
  },
}));

// The camera itself. `acquireCamera` being called at all is the whole question
// here, so it is the thing observed rather than anything it returns.
const acquireCamera = vi.fn().mockRejectedValue(
  Object.assign(new Error('no camera'), { reason: 'notfound' }),
);
vi.mock('../webcam', () => ({
  acquireCamera: (...args) => acquireCamera(...args),
  releaseCamera: vi.fn(),
  hasLiveVideo: () => false,
  captureThumbnail: () => null,
  getFaceDetector: () => Promise.resolve({ available: false, detect: () => null }),
}));

const quiz = (webcamExempt) => ({
  _id: 'q1',
  title: 'Midterm',
  subject: 'Signals',
  facultyName: 'Dr Rao',
  settings: {
    deliveryMode: 'all_at_once',
    requireWebcam: true,
    webcamSnapshotCount: 3,
    timeLimitMinutes: 30,
  },
  webcamExempt,
});

const paper = {
  attempt: { _id: 'a1', status: 'in_progress', sebVerified: false },
  questions: [
    { _id: 'ques1', question: 'What is 2 + 2?', type: 'mcq', options: ['3', '4'], marks: 1 },
  ],
  deadline: new Date(Date.now() + 30 * 60_000).toISOString(),
};

describe('the webcam watch on a paper that requires a camera', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    getAttemptPaper.mockResolvedValue(paper);
  });

  it('opens the camera for an ordinary student', async () => {
    getQuiz.mockResolvedValue(quiz(false));
    renderWithProviders(<QuizAttempt />);

    await waitFor(() => expect(acquireCamera).toHaveBeenCalled());
  });

  it('does not ask a waived student for a camera at all', async () => {
    getQuiz.mockResolvedValue(quiz(true));
    renderWithProviders(<QuizAttempt />);

    // Wait for the paper itself, so this is "the sitting has loaded and the
    // camera was not asked for" rather than "nothing has happened yet".
    await waitFor(() => expect(getAttemptPaper).toHaveBeenCalled());
    await waitFor(() => expect(acquireCamera).not.toHaveBeenCalled());

    // And nothing is reported against them either: a `blocked` report is what
    // used to latch the flag that put a waived student back in front of an
    // invigilator.
    expect(recordWebcamCheck).not.toHaveBeenCalled();
  });

  it('treats a missing flag as no waiver, so an old server does not disable the watch', async () => {
    getQuiz.mockResolvedValue({ ...quiz(false), webcamExempt: undefined });
    renderWithProviders(<QuizAttempt />);

    await waitFor(() => expect(acquireCamera).toHaveBeenCalled());
  });
});
