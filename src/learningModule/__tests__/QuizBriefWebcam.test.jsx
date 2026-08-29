import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';
import { releaseCameraNow } from '../webcam';

/**
 * The webcam gate on the pre-test screen.
 *
 * A quiz that requires a camera must ask for it here and refuse to start until it
 * is granted — the student cannot begin a watched paper with the watch turned
 * off. A refusal has to read as a refusal, with a way to try again, not as a dead
 * Start button.
 */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ classId: 'c1', quizId: 'q1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' }, isTeacher: false }),
  };
});

const quizBrief = vi.fn();
const startAttempt = vi.fn();
const verifyRoomCode = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    quizBrief: (...args) => quizBrief(...args),
    listQuizzes: vi.fn(),
    startAttempt: (...args) => startAttempt(...args),
    verifyRoomCode: (...args) => verifyRoomCode(...args),
    // A SEB paper mints a launch token as soon as the brief lands; unmocked it
    // throws out of an effect and takes the screen with it.
    sebLaunchToken: vi.fn().mockResolvedValue({}),
    sebLaunchUrlFromToken: vi.fn(() => 'seb://example'),
    LmApiError: class LmApiError extends Error {},
  },
}));

document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

const brief = (overrides = {}) => ({
  _id: 'q1',
  title: 'Midterm',
  instructions: [],
  sections: [],
  questionCount: 10,
  totalMarks: 20,
  estimatedDurationSec: 1800,
  settings: { deliveryMode: 'all_at_once', timeLimitMinutes: 30, requireWebcam: true },
  window: { open: true, closed: false, notYetOpen: false, canStart: true, closesAt: new Date(Date.now() + 3600_000).toISOString(), opensAt: null, startDeadline: null },
  attemptsUsed: 0,
  hasInProgress: false,
  lastAttemptId: null,
  resultsPending: false,
  resultsReleased: false,
  ...overrides,
});

const fakeStream = () => ({ getTracks: () => [{ stop: vi.fn(), readyState: 'live' }], getVideoTracks: () => [{ readyState: 'live' }] });

const setCamera = (impl) => {
  globalThis.navigator.mediaDevices = { getUserMedia: impl };
};

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  delete globalThis.navigator.mediaDevices;
  /* The camera is held by a module-level holder now, so one test's granted
     stream would otherwise still be live for the next one — and a held stream is
     handed back without asking, which is the whole point of it. */
  releaseCameraNow();
});

it('grants the camera, enables Start, and sends cameraReady', async () => {
  setCamera(() => Promise.resolve(fakeStream()));
  quizBrief.mockResolvedValue(brief());
  startAttempt.mockResolvedValue({ attempt: { _id: 'a1' } });
  const { default: QuizBrief } = await import('../pages/QuizBrief');
  renderWithProviders(<QuizBrief />);

  // Once granted, the screen says so and Start is live.
  await screen.findByText(/camera on\. you can start/i);
  const start = screen.getByRole('button', { name: /start test/i });
  await waitFor(() => expect(start).not.toBeDisabled());

  fireEvent.click(start);
  await waitFor(() =>
    expect(startAttempt).toHaveBeenCalledWith('c1', 'q1', expect.objectContaining({ cameraReady: true })),
  );
});

describe('the webcam check on the Safe Exam Browser panel', () => {
  /* A student inside SEB reads that panel and starts from it. The camera gate
     lower down is the same verdict, but it is gone the moment the paper opens —
     so the panel carries a tick of its own, and it must never say something the
     gate below contradicts. */
  const sebBrief = (overrides = {}) =>
    brief({
      settings: {
        deliveryMode: 'all_at_once',
        timeLimitMinutes: 30,
        requireWebcam: true,
        requireSafeExamBrowser: true,
        sebReady: true,
      },
      sebVerified: true,
      ...overrides,
    });

  it('ticks the check once the camera is on', async () => {
    setCamera(() => Promise.resolve(fakeStream()));
    quizBrief.mockResolvedValue(sebBrief());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    await screen.findByText(/webcam check passed/i);
  });

  it('says what is wrong rather than ticking, when the camera will not open', async () => {
    setCamera(() => Promise.reject(Object.assign(new Error('no'), { name: 'NotFoundError' })));
    quizBrief.mockResolvedValue(sebBrief());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    await screen.findByText(/webcam check failed/i);
    expect(screen.queryByText(/webcam check passed/i)).toBeNull();
  });

  it('shows no check at all for a student whose teacher waived the camera', async () => {
    setCamera(() => Promise.resolve(fakeStream()));
    quizBrief.mockResolvedValue(sebBrief({ webcamExempt: true }));
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    await screen.findByText(/webcam waived/i);
    expect(screen.queryByText(/webcam check/i)).toBeNull();
  });
});

it('does not strand a student when Safe Exam Browser blocks the camera', async () => {
  // Inside SEB a denied camera is SEB's config, not the student — let them in and
  // flag it rather than block the whole hall.
  setCamera(() => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })));
  quizBrief.mockResolvedValue(brief({ sebVerified: true }));
  startAttempt.mockResolvedValue({ attempt: { _id: 'a4' } });
  const { default: QuizBrief } = await import('../pages/QuizBrief');
  renderWithProviders(<QuizBrief />);

  await screen.findByText(/camera is not enabled in the exam settings file/i);
  const start = screen.getByRole('button', { name: /start test/i });
  await waitFor(() => expect(start).not.toBeDisabled());

  fireEvent.click(start);
  await waitFor(() =>
    expect(startAttempt).toHaveBeenCalledWith('c1', 'q1', expect.objectContaining({ cameraUnavailable: 'seb_blocked' })),
  );
});

it('does not strand a student in SEB that the Config Key gate never verified', async () => {
  // The case the first cut of this missed: a webcam paper that does not require
  // SEB has no Config Key, so `sebVerified` is false for every student — including
  // the ones sitting in SEB, whose camera the settings file is what blocked.
  setCamera(() => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })));
  quizBrief.mockResolvedValue(brief({ sebVerified: false, sebLikely: true }));
  startAttempt.mockResolvedValue({ attempt: { _id: 'a5' } });
  const { default: QuizBrief } = await import('../pages/QuizBrief');
  renderWithProviders(<QuizBrief />);

  await screen.findByText(/camera is not enabled in the exam settings file/i);
  const start = screen.getByRole('button', { name: /start test/i });
  await waitFor(() => expect(start).not.toBeDisabled());

  fireEvent.click(start);
  await waitFor(() =>
    expect(startAttempt).toHaveBeenCalledWith('c1', 'q1', expect.objectContaining({ cameraUnavailable: 'seb_blocked' })),
  );
});

it('blocks Start when the camera is denied, and offers a way to try again', async () => {
  setCamera(() => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })));
  quizBrief.mockResolvedValue(brief());
  const { default: QuizBrief } = await import('../pages/QuizBrief');
  renderWithProviders(<QuizBrief />);

  await screen.findByText(/camera blocked/i);
  expect(screen.getByRole('button', { name: /start test/i })).toBeDisabled();
  // A refusal is recoverable, not a dead end.
  expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  expect(startAttempt).not.toHaveBeenCalled();
});

it('a waived student starts with no camera asked for', async () => {
  const getUserMedia = vi.fn();
  setCamera(getUserMedia);
  quizBrief.mockResolvedValue(brief({ webcamExempt: true }));
  startAttempt.mockResolvedValue({ attempt: { _id: 'a3' } });
  const { default: QuizBrief } = await import('../pages/QuizBrief');
  renderWithProviders(<QuizBrief />);

  await screen.findByText(/webcam waived/i);
  // No camera is requested for a waived student.
  expect(getUserMedia).not.toHaveBeenCalled();
  const start = screen.getByRole('button', { name: /start test/i });
  await waitFor(() => expect(start).not.toBeDisabled());
});

it('lets a camera-less desktop start, and tells the server it was unavailable', async () => {
  // No camera hardware — not a refusal. The student is let in and flagged.
  setCamera(() => Promise.reject(Object.assign(new Error('none'), { name: 'NotFoundError' })));
  quizBrief.mockResolvedValue(brief());
  startAttempt.mockResolvedValue({ attempt: { _id: 'a2' } });
  const { default: QuizBrief } = await import('../pages/QuizBrief');
  renderWithProviders(<QuizBrief />);

  await screen.findByText(/no camera found on this computer/i);
  // Told they can still start, and that the teacher is notified.
  expect(screen.getByText(/your teacher will be told/i)).toBeTruthy();
  const start = screen.getByRole('button', { name: /start test/i });
  await waitFor(() => expect(start).not.toBeDisabled());

  fireEvent.click(start);
  await waitFor(() =>
    expect(startAttempt).toHaveBeenCalledWith('c1', 'q1', expect.objectContaining({ cameraUnavailable: 'notfound' })),
  );
});

describe('the order the gates are asked in', () => {
  /**
   * The camera is the last thing asked for, and only of a student the room code
   * has already vouched for.
   *
   * Asked any earlier it is a light coming on, and a permission dialog, for a
   * sitting that may never begin — every student who opens the link gets one,
   * including the ones who wandered onto it. The room code is what says somebody
   * is actually in the hall, so nothing is asked of them until it has.
   */
  const roomBrief = (overrides = {}) =>
    brief({ settings: { deliveryMode: 'all_at_once', timeLimitMinutes: 30, requireWebcam: true, roomCodeRequired: true, roomCodeLength: 5 }, ...overrides });

  const typeCode = async (code) => {
    for (const ch of code) {
      fireEvent.click(await screen.findByRole('button', { name: `Enter ${ch}` }));
    }
  };

  it('does not touch the camera until the room code is accepted', async () => {
    const getUserMedia = vi.fn(() => Promise.resolve(fakeStream()));
    setCamera(getUserMedia);
    quizBrief.mockResolvedValue(roomBrief());
    verifyRoomCode.mockResolvedValue({ ok: true });
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    // The room code is what the screen asks for, and the camera is untouched.
    await screen.findByText(/step 1 — enter the room code/i);
    expect(getUserMedia).not.toHaveBeenCalled();

    await typeCode('ABCDE');
    // Accepted, said so, and only now is the camera asked for.
    await screen.findByText(/room code accepted/i);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    await screen.findByText(/camera on\. you can start/i);
    await waitFor(() => expect(screen.getByRole('button', { name: /start test/i })).not.toBeDisabled());
  });

  it('checks the code once it is complete, not on every key', async () => {
    setCamera(() => Promise.resolve(fakeStream()));
    quizBrief.mockResolvedValue(roomBrief());
    verifyRoomCode.mockResolvedValue({ ok: true });
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);
    await screen.findByText(/step 1 — enter the room code/i);

    await typeCode('ABC');
    // Half a code is not a guess — sending it would spend the shared budget.
    expect(verifyRoomCode).not.toHaveBeenCalled();
    await typeCode('DE');
    await waitFor(() => expect(verifyRoomCode).toHaveBeenCalledTimes(1));
  });

  it('says a wrong code is wrong, and leaves the camera alone', async () => {
    const getUserMedia = vi.fn(() => Promise.resolve(fakeStream()));
    setCamera(getUserMedia);
    quizBrief.mockResolvedValue(roomBrief());
    verifyRoomCode.mockRejectedValue(new Error('That room code is not correct.'));
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);
    await screen.findByText(/step 1 — enter the room code/i);

    await typeCode('ZZZZZ');
    await screen.findByText(/that room code is not correct/i);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /start test/i })).toBeDisabled();
  });
});
