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

    await screen.findByRole('button', { name: /start test/i });
    expect(screen.queryByRole('link', { name: /download the exam file/i })).toBeNull();
    expect(sebConfigUrl).not.toHaveBeenCalled();
  });

  it('leaves Start enabled — the server decides whether SEB actually let them in', async () => {
    quizBrief.mockResolvedValue(ready());
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    const button = await screen.findByRole('button', { name: /start test/i });
    expect(button).not.toBeDisabled();
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

  it('disables Start, the same way a mobile-blocked device does', async () => {
    quizBrief.mockResolvedValue(
      brief({ settings: { deliveryMode: 'all_at_once', requireSafeExamBrowser: true, sebReady: false } }),
    );
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    const button = await screen.findByRole('button', { name: /start test/i });
    expect(button).toBeDisabled();
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

  it('sends the typed code on Start, and nothing when the field is empty', async () => {
    quizBrief.mockResolvedValue(withCode());
    startAttempt.mockResolvedValue({ attempt: { _id: 'a1' } });
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    fireEvent.click(await screen.findByText(/don't have safe exam browser/i));
    fireEvent.change(await screen.findByPlaceholderText('Access code'), { target: { value: 'ABC123' } });
    fireEvent.click(screen.getByRole('button', { name: /start test/i }));

    await waitFor(() => expect(startAttempt).toHaveBeenCalledWith('c1', 'q1', 'ABC123'));
  });

  it('does not send a blank code as an empty string', async () => {
    quizBrief.mockResolvedValue(withCode());
    startAttempt.mockResolvedValue({ attempt: { _id: 'a1' } });
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    fireEvent.click(await screen.findByRole('button', { name: /start test/i }));

    // `undefined`, not `''` — the server only looks at the field when it is a
    // non-empty string, and an empty string sent every time would be
    // indistinguishable from one a student actually typed and then cleared.
    await waitFor(() => expect(startAttempt).toHaveBeenCalledWith('c1', 'q1', undefined));
  });

  it('reveals the code field on its own when the server refuses to start without one', async () => {
    // The case this exists for: a student presses Start straight from a
    // download link that never got opened. The toast says why; the field
    // showing up on its own is what tells them what to do about it without
    // having to notice the disclosure link themselves.
    quizBrief.mockResolvedValue(withCode());
    const { default: LmApi } = await import('../api/lmApi');
    startAttempt.mockRejectedValue(
      new LmApi.LmApiError('This quiz must be opened in Safe Exam Browser, or started with the access code.', 403, {
        code: 'SEB_REQUIRED',
        sebBypassEnabled: true,
      }),
    );
    const { default: QuizBrief } = await import('../pages/QuizBrief');
    renderWithProviders(<QuizBrief />);

    fireEvent.click(await screen.findByRole('button', { name: /start test/i }));

    expect(await screen.findByPlaceholderText('Access code')).toBeTruthy();
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
