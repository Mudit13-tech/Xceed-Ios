import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The student-facing half of Safe Exam Browser support.
 *
 * A quiz that requires SEB has to tell a student three things before they try
 * to start it: that it requires SEB at all, how to actually launch it, and —
 * only if their teacher has enabled it — that there is a way in without it.
 * Getting any of these wrong either strands a student who did everything
 * right, or hides a door their teacher put there on purpose.
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
// Checking the access code on its own, before the sitting is spent. The screen
// asks the two gates in order — right browser, then right room — so nothing
// below the code field exists until this has answered.
const verifyAccessCode = vi.fn(async () => ({ ok: true, roomCodeRequired: false }));
const sebConfigUrl = vi.fn(() => 'https://api.test/api/v1/learningmodule/classes/c1/quizzes/q1/seb-config');
// The one-click launch: the same address with the scheme swapped, which is what
// makes a browser hand it to Safe Exam Browser instead of opening it.
// The launch address is minted, not assembled: Safe Exam Browser fetches the
// settings itself, carrying none of the student's session, so the link has to
// carry a short-lived token instead.
const sebLaunchToken = vi.fn(async () => ({ token: 'a-launch-token', expiresInSec: 600 }));
const sebLaunchUrlFromToken = vi.fn(
  (token) => `sebs://api.test/api/v1/learningmodule/seb-launch/${token}`,
);
// The separate "get SEB itself" convenience — unrelated to this quiz, but
// QuizBrief fetches it whenever the "not yet in SEB" instructions are on
// screen, so every test reaching that branch needs this mocked or the fetch
// throws synchronously and fails the test for a reason that has nothing to
// do with what it is checking.
const getSebInstallers = vi.fn(async () => ({
  windows: { available: false, fileName: '', fileSize: 0, uploadedByName: '', uploadedAt: null },
  mac: { available: false, fileName: '', fileSize: 0, uploadedByName: '', uploadedAt: null },
}));
vi.mock('../api/lmApi', () => ({
  default: {
    quizBrief: (...args) => quizBrief(...args),
    listQuizzes: vi.fn(),
    startAttempt: (...args) => startAttempt(...args),
    verifyAccessCode: (...args) => verifyAccessCode(...args),
    sebConfigUrl: (...args) => sebConfigUrl(...args),
    sebLaunchToken: (...args) => sebLaunchToken(...args),
    sebLaunchUrlFromToken: (...args) => sebLaunchUrlFromToken(...args),
    getSebInstallers: (...args) => getSebInstallers(...args),
    sebInstallerDownloadUrl: (platform) => `https://api.test/api/v1/learningmodule/seb-installer/${platform}/download`,
    LmApiError: class LmApiError extends Error {
      constructor(message, status, payload) {
        super(message);
        this.status = status;
        this.payload = payload;
      }
    },
  },
}));

// Fullscreen requests are not implemented in jsdom, and the brief asks for one
// on mount.
document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);

const openWindow = ({ canStart = true } = {}) => ({
  open: true,
  closed: false,
  notYetOpen: false,
  canStart,
  lateToStart: false,
  closesAt: new Date(Date.now() + 3600_000).toISOString(),
  opensAt: null,
  startDeadline: null,
});

const brief = (overrides = {}) => ({
  _id: 'q1',
  title: 'Midterm',
  instructions: [],
  sections: [],
  questionCount: 10,
  totalMarks: 20,
  estimatedDurationSec: 1800,
  settings: { deliveryMode: 'all_at_once', timeLimitMinutes: 30 },
  window: openWindow(),
  attemptsUsed: 0,
  hasInProgress: false,
  inProgressId: null,
  lastAttemptId: null,
  resultsPending: false,
  resultsReleased: false,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('a quiz with no Safe Exam Browser requirement', () => {
  it('shows the ordinary Start button with no SEB panel at all', async () => {
    quizBrief.mockResolvedValue(brief());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    await screen.findByRole('button', { name: /start test/i });
    expect(screen.queryByText(/requires safe exam browser/i)).toBeNull();
  });
});

describe('a quiz that requires Safe Exam Browser and is ready', () => {
  const ready = () => brief({ settings: { deliveryMode: 'all_at_once', requireSafeExamBrowser: true, sebReady: true } });

  // The raw `.seb` download was removed from the brief: students were treating
  // it as the normal way in and finishing with a file in Downloads rather than
  // a running exam. The `seb://` launch is the only route offered now.
  it('does not offer the raw exam file for download', async () => {
    quizBrief.mockResolvedValue(ready());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    await screen.findByText(/has to be installed on this computer first/i);
    expect(screen.queryByRole('link', { name: /download the exam file/i })).toBeNull();
    expect(sebConfigUrl).not.toHaveBeenCalled();
  });

  /**
   * Start is not one of two equal ways in.
   *
   * A Start button next to "Open this test in Safe Exam Browser" read as a
   * choice, so students pressed it, collected a refusal they could not act on,
   * and concluded the test was broken. The launch *is* the start now: until the
   * server has verified SEB (or an access code has been checked) there is no
   * Start button on the page at all, only the thing to do instead.
   */
  it('offers no Start button at all — the launch is the only thing to press', async () => {
    quizBrief.mockResolvedValue(ready());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    await screen.findByText(/has to be installed on this computer first/i);
    expect(screen.queryByRole('button', { name: /start test/i })).toBeNull();
    expect(await screen.findByText(/start from safe exam browser/i)).toBeTruthy();
  });

  it('says why the button is missing rather than leaving a blank space', async () => {
    // A gap where the button was reads as a page that failed to load.
    quizBrief.mockResolvedValue(ready());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    expect(await screen.findByText(/that is how this paper begins/i)).toBeTruthy();
  });

  it('does not show a bypass-code option when the teacher has not enabled one', async () => {
    quizBrief.mockResolvedValue(ready());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    await screen.findByText(/has to be installed on this computer first/i);
    expect(screen.queryByText(/don't have safe exam browser/i)).toBeNull();
  });
});

describe('a quiz that requires Safe Exam Browser but is not set up yet', () => {
  it('explains the wait rather than offering a broken download link', async () => {
    quizBrief.mockResolvedValue(
      brief({ settings: { deliveryMode: 'all_at_once', requireSafeExamBrowser: true, sebReady: false } }),
    );
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    expect(await screen.findByText(/has not finished setting this up/i)).toBeTruthy();
    expect(screen.queryByText(/has to be installed on this computer first/i)).toBeNull();
  });

  it('offers no Start button, and says the paper is not ready rather than nothing', async () => {
    quizBrief.mockResolvedValue(
      brief({ settings: { deliveryMode: 'all_at_once', requireSafeExamBrowser: true, sebReady: false } }),
    );
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    expect(await screen.findByText(/not ready to start yet/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /start test/i })).toBeNull();
  });
});

describe('the access-code fallback', () => {
  const withCode = () =>
    brief({ settings: { deliveryMode: 'all_at_once', requireSafeExamBrowser: true, sebReady: true, sebBypassEnabled: true } });

  it('is offered, but collapsed, when the teacher has turned it on', async () => {
    quizBrief.mockResolvedValue(withCode());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    await screen.findByText(/has to be installed on this computer first/i);
    expect(await screen.findByText(/don't have safe exam browser/i)).toBeTruthy();
    // Not shown until asked for — the code field is the fallback, not the
    // headline, and showing it by default reads as though it is the normal way
    // to start this test.
    expect(screen.queryByPlaceholderText('Access code')).toBeNull();
  });

  it('reveals a code field on request', async () => {
    quizBrief.mockResolvedValue(withCode());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    fireEvent.click(await screen.findByText(/don't have safe exam browser/i));
    expect(await screen.findByPlaceholderText('Access code')).toBeTruthy();
  });

  /* Typing is not passing. The code has to be *checked* — by the server, on its
     own endpoint — before anything below it appears, because "the student typed
     something" is not an answer to "is this student allowed in without SEB". */
  it('does not hand over Start for a code that has merely been typed', async () => {
    quizBrief.mockResolvedValue(withCode());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    fireEvent.click(await screen.findByText(/don't have safe exam browser/i));
    fireEvent.change(await screen.findByPlaceholderText('Access code'), { target: { value: 'ABC123' } });

    expect(screen.queryByRole('button', { name: /start test/i })).toBeNull();
    expect(screen.getByRole('button', { name: /check code/i })).toBeTruthy();
  });

  it('checks the code against the server, and only then offers Start', async () => {
    quizBrief.mockResolvedValue(withCode());
    startAttempt.mockResolvedValue({ attempt: { _id: 'a1' } });
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    fireEvent.click(await screen.findByText(/don't have safe exam browser/i));
    fireEvent.change(await screen.findByPlaceholderText('Access code'), { target: { value: 'ABC123' } });
    fireEvent.click(screen.getByRole('button', { name: /check code/i }));

    await waitFor(() => expect(verifyAccessCode).toHaveBeenCalledWith('c1', 'q1', 'ABC123'));
    fireEvent.click(await screen.findByRole('button', { name: /start test/i }));

    // Still sent on Start: the check grants nothing by itself, and the server
    // re-checks the same code before it will mint the attempt.
    await waitFor(() =>
      expect(startAttempt).toHaveBeenCalledWith('c1', 'q1', { sebBypassCode: 'ABC123', roomCode: undefined }),
    );
  });

  it('says so on the page when the code is wrong, and keeps Start away', async () => {
    quizBrief.mockResolvedValue(withCode());
    const { default: LmApi } = await import('../api/lmApi');
    verifyAccessCode.mockRejectedValueOnce(
      new LmApi.LmApiError('That access code is not correct.', 403, {
        code: 'SEB_REQUIRED',
        sebBypassEnabled: true,
        codeRejected: true,
      }),
    );
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    fireEvent.click(await screen.findByText(/don't have safe exam browser/i));
    fireEvent.change(await screen.findByPlaceholderText('Access code'), { target: { value: 'NOPE99' } });
    fireEvent.click(screen.getByRole('button', { name: /check code/i }));

    expect(await screen.findByText(/that access code is not correct/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /start test/i })).toBeNull();
  });

  it('closes the gate again if the code is edited after being accepted', async () => {
    // A checked code that has since been changed has not been checked.
    quizBrief.mockResolvedValue(withCode());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    fireEvent.click(await screen.findByText(/don't have safe exam browser/i));
    fireEvent.change(await screen.findByPlaceholderText('Access code'), { target: { value: 'ABC123' } });
    fireEvent.click(screen.getByRole('button', { name: /check code/i }));
    await screen.findByRole('button', { name: /start test/i });

    // The field locks once accepted, so editing means pressing Change first.
    fireEvent.click(screen.getByRole('button', { name: /change/i }));
    expect(screen.queryByRole('button', { name: /start test/i })).toBeNull();
  });
});

/**
 * The two gates, asked in order.
 *
 * They answer different questions — "are you in the right browser?" and "are you
 * in the right room?" — and the second is worth nothing asked of somebody who has
 * not answered the first. Drawing the room-code keypad for anyone who opens the
 * link also tells a student who should never have got that far that a spoken code
 * exists and how many characters it has. So the pad waits: for Safe Exam Browser
 * to be verified, or for an access code to be checked.
 */
describe('the room code is the second gate, not a simultaneous one', () => {
  const roomAndSeb = (extra = {}) =>
    brief({
      settings: {
        deliveryMode: 'all_at_once',
        requireSafeExamBrowser: true,
        sebReady: true,
        roomCodeRequired: true,
        ...extra,
      },
    });

  it('does not ask for the room code while the browser gate is still shut', async () => {
    quizBrief.mockResolvedValue(roomAndSeb({ sebBypassEnabled: true }));
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    await screen.findByText(/has to be installed on this computer first/i);
    expect(screen.queryByText(/your invigilator will read out a code/i)).toBeNull();
  });

  it('asks for it as soon as Safe Exam Browser is verified', async () => {
    quizBrief.mockResolvedValue(
      brief({
        settings: { deliveryMode: 'all_at_once', requireSafeExamBrowser: true, sebReady: true, roomCodeRequired: true },
        sebVerified: true,
        sebReason: null,
      }),
    );
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    expect(await screen.findByText(/your invigilator will read out a code/i)).toBeTruthy();
  });

  it('asks for it once an access code has been checked, and not before', async () => {
    quizBrief.mockResolvedValue(roomAndSeb({ sebBypassEnabled: true }));
    verifyAccessCode.mockResolvedValueOnce({ ok: true, roomCodeRequired: true });
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    fireEvent.click(await screen.findByText(/don't have safe exam browser/i));
    fireEvent.change(await screen.findByPlaceholderText('Access code'), { target: { value: 'ABC123' } });
    expect(screen.queryByText(/your invigilator will read out a code/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /check code/i }));
    expect(await screen.findByText(/your invigilator will read out a code/i)).toBeTruthy();
  });

  it('leaves Start disabled until the room code is entered too', async () => {
    quizBrief.mockResolvedValue(
      brief({
        settings: { deliveryMode: 'all_at_once', requireSafeExamBrowser: true, sebReady: true, roomCodeRequired: true },
        sebVerified: true,
        sebReason: null,
      }),
    );
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    expect(await screen.findByRole('button', { name: /start test/i })).toBeDisabled();
  });
});

describe('a quiz with no Safe Exam Browser gate to pass', () => {
  it('does not send a blank code as an empty string', async () => {
    quizBrief.mockResolvedValue(brief());
    startAttempt.mockResolvedValue({ attempt: { _id: 'a1' } });
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    fireEvent.click(await screen.findByRole('button', { name: /start test/i }));

    // `undefined`, not `''` — the server only looks at the field when it is a
    // non-empty string, and an empty string sent every time would be
    // indistinguishable from one a student actually typed and then cleared.
    await waitFor(() =>
      expect(startAttempt).toHaveBeenCalledWith('c1', 'q1', { sebBypassCode: undefined, roomCode: undefined }),
    );
  });
});

/**
 * Telling a student their code was wrong.
 *
 * The refusal used to go to a Chakra toast, which portals to `document.body` —
 * outside the quiz stage. On a fullscreened brief it rendered behind the screen
 * the student was looking at, so a wrong access code and a dead button were
 * indistinguishable. Everything the sitting says is already inline for this
 * exact reason; the brief was the page that had been missed.
 */
describe('a refused start', () => {
  it('says so on the page, not in a toast behind it', async () => {
    // Reachable even now that the code is checked first: a teacher who
    // regenerates the code between the check and Start retires the one this
    // student just had accepted, and the refusal lands on Start.
    startAttempt.mockRejectedValueOnce(
      Object.assign(new Error('That access code is not right.'), {
        status: 403,
        payload: { code: 'SEB_REQUIRED', sebBypassEnabled: true },
      }),
    );
    quizBrief.mockResolvedValue(
      brief({
        settings: {
          deliveryMode: 'all_at_once',
          requireSafeExamBrowser: true,
          sebReady: true,
          sebBypassEnabled: true,
        },
      }),
    );
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    fireEvent.click(await screen.findByText(/don't have safe exam browser/i));
    fireEvent.change(await screen.findByPlaceholderText('Access code'), { target: { value: 'ABC123' } });
    fireEvent.click(screen.getByRole('button', { name: /check code/i }));
    fireEvent.click(await screen.findByRole('button', { name: /start test/i }));

    expect(await screen.findByText(/could not start the test/i)).toBeTruthy();
    expect(await screen.findByText(/that access code is not right/i)).toBeTruthy();
  });
});

/**
 * What the brief says to a student who is already inside Safe Exam Browser.
 *
 * This panel used to be drawn from `requireSafeExamBrowser` alone, so it said
 * the identical thing either side of the one event it was describing: a student
 * who had launched SEB, watched the kiosk take over the screen and navigated to
 * their paper was still being told to open the test in Safe Exam Browser, with
 * an access-code field underneath as the only apparent way on. Read from that
 * chair it does not look like instructions — it looks like the check failed.
 *
 * The server now answers the question on the brief itself, with the same
 * function `startAttempt` judges by, so the panel can say which of the three
 * situations this actually is.
 */
describe('the panel reflects whether Safe Exam Browser has actually been verified', () => {
  const sebSettings = (extra = {}) => ({
    deliveryMode: 'all_at_once',
    requireSafeExamBrowser: true,
    sebReady: true,
    ...extra,
  });

  it('stops telling a verified student to open what they have already opened', async () => {
    quizBrief.mockResolvedValue(brief({ settings: sebSettings(), sebVerified: true, sebReason: null }));
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    expect(await screen.findByText(/safe exam browser is active/i)).toBeTruthy();
    // The launch instructions answer a question this student no longer has,
    // and leaving them up is what read as a failure.
    expect(screen.queryByText(/has to be installed on this computer first/i)).toBeNull();
    expect(screen.queryByRole('link', { name: /open this test in safe exam browser/i })).toBeNull();
  });

  it('does not offer a verified student the access code either', async () => {
    // The code exists for the student who could not use SEB. Offering it to one
    // who is demonstrably inside SEB invites them to take the weaker route.
    quizBrief.mockResolvedValue(
      brief({ settings: sebSettings({ sebBypassEnabled: true }), sebVerified: true, sebReason: null }),
    );
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    await screen.findByText(/safe exam browser is active/i);
    expect(screen.queryByPlaceholderText('Access code')).toBeNull();
    expect(screen.queryByText(/don't have safe exam browser/i)).toBeNull();
  });

  it('leaves Start enabled for a verified student', async () => {
    quizBrief.mockResolvedValue(brief({ settings: sebSettings(), sebVerified: true, sebReason: null }));
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    expect(await screen.findByRole('button', { name: /start test/i })).not.toBeDisabled();
  });

  it('names the setup fault when SEB is running and the check still failed', async () => {
    // `hash-mismatch` is only reachable from a real SEB: the header it needs is
    // one nothing else sends. So the fault is at the teacher's end every time,
    // and saying so is the difference between a student retrying forever and a
    // student fetching the invigilator.
    quizBrief.mockResolvedValue(
      brief({ settings: sebSettings({ sebBypassEnabled: true }), sebVerified: false, sebReason: 'hash-mismatch' }),
    );
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    expect(await screen.findByText(/could not be matched to it/i)).toBeTruthy();
    expect(screen.getByText(/tell your invigilator/i)).toBeTruthy();
  });

  it('opens the access code for them rather than hiding it behind the wrong question', async () => {
    // The link reads "Don't have Safe Exam Browser installed?" — which is the
    // one thing this student definitely does have.
    quizBrief.mockResolvedValue(
      brief({ settings: sebSettings({ sebBypassEnabled: true }), sebVerified: false, sebReason: 'hash-mismatch' }),
    );
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    expect(await screen.findByPlaceholderText('Access code')).toBeTruthy();
  });

  it('still gives the ordinary instructions to a student who has not launched SEB', async () => {
    // The unverified-and-no-SEB-headers case, which is most students most of
    // the time: nothing has gone wrong, they simply have not started yet.
    quizBrief.mockResolvedValue(
      brief({ settings: sebSettings(), sebVerified: false, sebReason: 'no-seb-headers' }),
    );
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    expect(await screen.findByText(/has to be installed on this computer first/i)).toBeTruthy();
    expect(screen.queryByText(/could not be matched to it/i)).toBeNull();
  });

  it('says nothing either way on a brief from a server that does not report it', async () => {
    // An older server, or a cached response: absent `sebVerified` must fall back
    // to the instructions, never to a claim that SEB is active.
    quizBrief.mockResolvedValue(brief({ settings: sebSettings() }));
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    expect(await screen.findByText(/has to be installed on this computer first/i)).toBeTruthy();
    expect(screen.queryByText(/safe exam browser is active/i)).toBeNull();
  });
});

describe('getting Safe Exam Browser itself, for a student who does not have it', () => {
  // The panel this belongs to is only ever shown pre-launch — see "still gives
  // the ordinary instructions" above — so every test here reuses that exact
  // brief shape.
  const notYetInSeb = () =>
    brief({
      settings: { deliveryMode: 'all_at_once', requireSafeExamBrowser: true, sebReady: true },
      sebVerified: false,
      sebReason: 'no-seb-headers',
    });

  const setUserAgent = (value) => {
    Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true });
  };

  afterEach(() => {
    // Restore jsdom's own default rather than leaking a fake UA into whatever
    // test runs next in this file.
    setUserAgent(window.navigator.userAgent);
  });

  it('offers nothing when neither installer has been uploaded — no dead links', async () => {
    getSebInstallers.mockResolvedValue({
      windows: { available: false, fileName: '', fileSize: 0, uploadedByName: '', uploadedAt: null },
      mac: { available: false, fileName: '', fileSize: 0, uploadedByName: '', uploadedAt: null },
    });
    quizBrief.mockResolvedValue(notYetInSeb());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    await screen.findByText(/has to be installed on this computer first/i);
    expect(screen.queryByText(/don't have it yet/i)).toBeNull();
  });

  it('offers the Windows build first on a non-Mac browser', async () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    getSebInstallers.mockResolvedValue({
      windows: { available: true, fileName: 'SEBSetup.exe', fileSize: 1, uploadedByName: '', uploadedAt: null },
      mac: { available: true, fileName: 'SafeExamBrowser.dmg', fileSize: 1, uploadedByName: '', uploadedAt: null },
    });
    quizBrief.mockResolvedValue(notYetInSeb());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    const link = await screen.findByRole('link', { name: /download safe exam browser for windows/i });
    expect(link).toHaveAttribute('href', 'https://api.test/api/v1/learningmodule/seb-installer/windows/download');
    const secondary = screen.getByRole('link', { name: /^mac version$/i });
    expect(secondary).toHaveAttribute('href', 'https://api.test/api/v1/learningmodule/seb-installer/mac/download');
  });

  it('offers the Mac build first on a Mac browser', async () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    getSebInstallers.mockResolvedValue({
      windows: { available: true, fileName: 'SEBSetup.exe', fileSize: 1, uploadedByName: '', uploadedAt: null },
      mac: { available: true, fileName: 'SafeExamBrowser.dmg', fileSize: 1, uploadedByName: '', uploadedAt: null },
    });
    quizBrief.mockResolvedValue(notYetInSeb());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    const link = await screen.findByRole('link', { name: /download safe exam browser for mac/i });
    expect(link).toHaveAttribute('href', 'https://api.test/api/v1/learningmodule/seb-installer/mac/download');
    expect(screen.getByRole('link', { name: /^windows version$/i })).toBeTruthy();
  });

  it('offers only the one that is actually uploaded, with no dead link for the other', async () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    getSebInstallers.mockResolvedValue({
      windows: { available: true, fileName: 'SEBSetup.exe', fileSize: 1, uploadedByName: '', uploadedAt: null },
      mac: { available: false, fileName: '', fileSize: 0, uploadedByName: '', uploadedAt: null },
    });
    quizBrief.mockResolvedValue(notYetInSeb());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    await screen.findByRole('link', { name: /download safe exam browser for windows/i });
    expect(screen.queryByRole('link', { name: /mac version/i })).toBeNull();
  });

  it('still offers the Mac build to a Mac student even when only that one exists', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    getSebInstallers.mockResolvedValue({
      windows: { available: false, fileName: '', fileSize: 0, uploadedByName: '', uploadedAt: null },
      mac: { available: true, fileName: 'SafeExamBrowser.dmg', fileSize: 1, uploadedByName: '', uploadedAt: null },
    });
    quizBrief.mockResolvedValue(notYetInSeb());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    expect(await screen.findByRole('link', { name: /download safe exam browser for mac/i })).toBeTruthy();
  });
});
