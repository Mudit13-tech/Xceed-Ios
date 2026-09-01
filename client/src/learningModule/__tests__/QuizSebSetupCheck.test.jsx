import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The pre-flight check a teacher runs before an exam, not during one.
 *
 * Nothing in this module could answer "is my Safe Exam Browser setup actually
 * correct". The admin card can say a file and a key are *stored*; it cannot say
 * they agree, and only a real request from a real SEB can. Staff were shown no
 * SEB panel at all on the brief, so the first evidence of a stale Config Key was
 * a hall of students who could not start — by which time the fix is a trip
 * through the Configuration Tool that nobody has time for.
 *
 * A teacher opening this page inside SEB now makes exactly the request a student
 * will make, and is told which of the causes it was. The reasons come from
 * `sebGate.describeFailure`, now wired into `getQuizBrief`.
 */

const mockNavigate = vi.fn();
let isTeacher = true;
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ classId: 'c1', quizId: 'q1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' }, isTeacher }),
  };
});

const quizBrief = vi.fn();
const sebLaunchToken = vi.fn(async () => ({ token: 't', expiresInSec: 600 }));
vi.mock('../api/lmApi', () => ({
  default: {
    quizBrief: (...args) => quizBrief(...args),
    listQuizzes: vi.fn(),
    startAttempt: vi.fn(),
    sebConfigUrl: () => 'https://api.test/seb-config',
    sebLaunchToken: (...args) => sebLaunchToken(...args),
    sebLaunchUrlFromToken: (token) => `sebs://api.test/seb-launch/${token}`,
    LmApiError: class LmApiError extends Error {},
  },
}));

document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);

const brief = (overrides = {}) => ({
  _id: 'q1',
  title: 'Midterm',
  instructions: [],
  sections: [],
  questionCount: 10,
  totalMarks: 20,
  estimatedDurationSec: 1800,
  settings: { deliveryMode: 'all_at_once', requireSafeExamBrowser: true, sebReady: true },
  window: {
    open: true,
    closed: false,
    notYetOpen: false,
    canStart: true,
    lateToStart: false,
    closesAt: new Date(Date.now() + 3600_000).toISOString(),
    opensAt: null,
    startDeadline: null,
  },
  attemptsUsed: 0,
  hasInProgress: false,
  inProgressId: null,
  lastAttemptId: null,
  resultsPending: false,
  resultsReleased: false,
  sebVerified: false,
  sebReason: 'no-seb-headers',
  ...overrides,
});

const render = async (overrides) => {
  quizBrief.mockResolvedValue(brief(overrides));
  const { default: QuizBrief } = await import('../pages/QuizBrief');
  renderWithProviders(<QuizBrief />);
  // The page has several mentions of SEB; wait on the heading that always renders.
  return screen.findByRole('heading', { name: /midterm/i });
};

beforeEach(() => {
  vi.clearAllMocks();
  isTeacher = true;
});

describe('the setup check a teacher sees', () => {
  it('confirms a setup that a real SEB request just passed', async () => {
    // The only proof that exists. Everything short of this — a file uploaded, a
    // key pasted — is a setup that has never been tried.
    await render({ sebVerified: true, sebReason: null });
    expect(await screen.findByText(/setup check/i)).toBeInTheDocument();
    expect(await screen.findByText(/verified/i)).toBeInTheDocument();
  });

  it('names a stale Config Key as the Configuration Tool trip that it is', async () => {
    // The commonest mistake, and the one that looks like every other refusal:
    // the sample was uploaded rather than the copy saved out of the tool.
    await render({ sebReason: 'hash-mismatch' });
    expect(await screen.findByText(/does not match/i)).toBeInTheDocument();
    expect(await screen.findByText(/configuration tool/i)).toBeInTheDocument();
  });

  it('names the unticked header option separately from a wrong key', async () => {
    // One checkbox. Reported as a key mismatch it sends whoever is fixing it to
    // re-generate a key that was never the problem.
    await render({ sebReason: 'config-key-header-missing' });
    expect(await screen.findByText(/not sending the config key header/i)).toBeInTheDocument();
  });

  it('says plainly that an ordinary browser proves nothing either way', async () => {
    // Guards against the worst misreading available: a teacher checking from
    // Chrome, seeing a refusal, and re-doing a setup that was already correct.
    await render({ sebReason: 'no-seb-headers' });
    expect(await screen.findByText(/no safe exam browser headers/i)).toBeInTheDocument();
    expect(await screen.findByText(/open this page inside safe exam browser/i)).toBeInTheDocument();
  });

  it('says nothing can pass when no Config Key is stored', async () => {
    await render({ sebReason: 'no-config-key', settings: { deliveryMode: 'all_at_once', requireSafeExamBrowser: true, sebReady: true } });
    expect(await screen.findByText(/no config key is stored/i)).toBeInTheDocument();
  });

  it('says the setup is unfinished before it blames anything else', async () => {
    // No file and no key is not a diagnosis, it is an upload — and it must not
    // be reported as a mismatch.
    await render({ settings: { deliveryMode: 'all_at_once', requireSafeExamBrowser: true, sebReady: false } });
    expect(await screen.findByText(/no settings file and config key yet/i)).toBeInTheDocument();
  });

  it('never offers staff the launch button, download or access code', async () => {
    /* Those are the student's instructions. A teacher reading "Safe Exam Browser
       has to be installed on this computer first" while checking a setup is how
       a working paper gets reported as broken. */
    await render({ sebVerified: true, sebReason: null });
    expect(screen.queryByRole('link', { name: /download the exam file/i })).toBeNull();
    expect(screen.queryByText(/has to be installed on this computer/i)).toBeNull();
  });
});

describe('the student is shown none of it', () => {
  beforeEach(() => {
    isTeacher = false;
  });

  it('gets the launch instructions, not the diagnosis meant for staff', async () => {
    // A student can do nothing about a Config Key, and telling them about one
    // reads as the exam being broken rather than as something being fixed.
    await render({ sebReason: 'hash-mismatch' });
    expect(screen.queryByText(/setup check/i)).toBeNull();
    expect(screen.queryByText(/configuration tool/i)).toBeNull();
    // What they get instead: the message that names an invigilator.
    expect(await screen.findByText(/tell your invigilator/i)).toBeInTheDocument();
  });

  it('is told plainly when SEB did match, instead of being sold it again', async () => {
    await render({ sebVerified: true, sebReason: null });
    expect(await screen.findByText(/has been matched to it/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /download the exam file/i })).toBeNull();
  });
});
