import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The mid-exam control panel, opened from the quiz card.
 *
 * Two things are only ever asked while the hall is sitting: who is writing
 * outside Safe Exam Browser, and who has had the paper taken off them. Both
 * are answered here, and the second comes with the remedy attached — a single
 * **Let in** per student, pre-loaded with the minutes they lost so nobody
 * works out a clock under exam-hall pressure.
 *
 * The minutes are what these tests guard most closely: they are the difference
 * between handing a student back their paper and handing them a sitting that
 * expires on the first click.
 *
 * It opens from the quiz list rather than from the results page: when an exam
 * starts, the list is the page a teacher has in front of them, and the panel was
 * two navigations away behind analytics nobody reads mid-exam.
 */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ classId: 'c1', quizId: 'q1' }),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' }, isTeacher: true }),
  };
});

const quizResults = vi.fn();
const reopenQuizAttempt = vi.fn();
const listQuizzes = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    quizResults: (...args) => quizResults(...args),
    reopenQuizAttempt: (...args) => reopenQuizAttempt(...args),
    listQuizzes: (...args) => listQuizzes(...args),
    quizResultsCsvUrl: () => 'https://api.test/export.csv',
    LmApiError: class LmApiError extends Error {},
  },
}));

const MINUTES = 60000;

const quizWith = (overrides = {}) => ({
  _id: 'q1',
  title: 'Midterm',
  published: true,
  questions: [{ _id: 'ques1' }, { _id: 'ques2' }],
  totalMarks: 10,
  settings: { deliveryMode: 'all_at_once', timeLimitMinutes: 60, ...overrides },
});

/** Terminated 10 minutes ago, 25 minutes into a 60 minute paper. */
const shutOut = (overrides = {}) => ({
  _id: 'a1',
  studentName: 'Asha Rao',
  studentEmail: 'asha@example.com',
  rollNumber: '21EC001',
  status: 'terminated',
  score: 0,
  maxScore: 10,
  answeredCount: 1,
  questionCount: 2,
  cursor: 0,
  reopenCount: 0,
  startedAt: new Date(Date.now() - 35 * MINUTES).toISOString(),
  submittedAt: new Date(Date.now() - 10 * MINUTES).toISOString(),
  durationSec: 25 * 60,
  terminationReason: 'Safe Exam Browser was no longer active.',
  ...overrides,
});

const writingWithoutSeb = (overrides = {}) => ({
  _id: 'a2',
  studentName: 'Vikram Iyer',
  studentEmail: 'vikram@example.com',
  rollNumber: '21EC002',
  status: 'in_progress',
  answeredCount: 1,
  questionCount: 2,
  cursor: 0,
  score: 0,
  maxScore: 10,
  startedAt: new Date(Date.now() - 5 * MINUTES).toISOString(),
  sebBypassed: true,
  sebBypassAt: new Date(Date.now() - 4 * MINUTES).toISOString(),
  ...overrides,
});

const resultsFixture = (quiz, attempts) => ({
  quiz,
  attempts,
  notStartedStudents: [],
  summary: {
    submitted: 0,
    enrolled: attempts.length,
    started: attempts.length,
    inProgress: attempts.filter((a) => a.status === 'in_progress').length,
    notStarted: 0,
    average: null,
    passRate: null,
    avgDurationSec: 0,
    flagged: 0,
    terminated: attempts.filter((a) => a.status === 'terminated').length,
    seb: {
      required: Boolean(quiz.settings.requireSafeExamBrowser),
      verified: attempts.filter((a) => a.sebVerified && !a.sebBypassed).length,
      bypassed: attempts.filter((a) => a.sebBypassed).length,
    },
  },
  perQuestion: [],
  perSection: [],
  results: { released: false },
  distribution: [],
  serverTime: new Date().toISOString(),
});

/** The row the panel hangs off: a published paper whose window is open. */
const listedLive = (quiz, attempts) => [
  {
    ...quiz,
    questionCount: quiz.questions.length,
    window: { open: true, closed: false, notYetOpen: false },
    publish: { scheduled: false },
    stats: { attempts: attempts.length, avg: null, lastSubmittedAt: null },
    live: {
      writing: attempts.filter((a) => a.status === 'in_progress').length,
      submitted: 0,
      shutOut: attempts.filter((a) => a.status === 'terminated' || a.status === 'expired').length,
      offSeb: attempts.filter((a) => a.status === 'in_progress' && a.sebBypassed).length,
    },
    sittingNow: attempts.filter((a) => a.status === 'in_progress').length,
  },
];

const openPanel = async (fixture) => {
  quizResults.mockResolvedValue(fixture);
  listQuizzes.mockResolvedValue(listedLive(fixture.quiz, fixture.attempts));
  const { default: Quizzes } = await import('../pages/Quizzes');
  renderWithProviders(<Quizzes />);
  fireEvent.click(await screen.findByRole('button', { name: /live control/i }));
  await waitFor(() => expect(quizResults).toHaveBeenCalled());
  return screen.findByRole('dialog');
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the live exam control panel', () => {
  /**
   * The header answers the two questions asked from the doorway: how long is
   * left, and how many are still in it. The clock counts to the *last* paper
   * running, because that is when the invigilator can leave.
   */
  it('counts down to the last paper still running, with the writing and submitted numbers', async () => {
    const fixture = resultsFixture(quizWith(), [
      // 60 min paper: 5 min in, so 55 left; 20 min in, so 40 left.
      writingWithoutSeb(),
      writingWithoutSeb({
        _id: 'a3',
        studentName: 'Meera Nair',
        startedAt: new Date(Date.now() - 20 * MINUTES).toISOString(),
      }),
      { ...shutOut(), _id: 'a4', status: 'submitted', submittedAt: new Date().toISOString() },
    ]);
    const dialog = await openPanel(fixture);
    const header = within(dialog);

    expect(header.getByText(/until the last paper ends/i)).toBeTruthy();
    expect(header.getByText(/^54:5\d$/)).toBeTruthy();
    expect(header.getByText('Writing').nextSibling.textContent).toBe('2');
    expect(header.getByText('Submitted').nextSibling.textContent).toBe('1');
    expect(header.getByText('Shut out').nextSibling.textContent).toBe('0');
  });

  it('counts down to the closing time when nobody is writing yet', async () => {
    const dialog = await openPanel(
      resultsFixture(
        quizWith({ availableTo: new Date(Date.now() + 90 * MINUTES).toISOString() }),
        [shutOut()],
      ),
    );

    expect(within(dialog).getByText(/until the window closes/i)).toBeTruthy();
    expect(within(dialog).getByText(/^1:29:5\d$/)).toBeTruthy();
  });

  it('says there is no clock on an untimed paper with no closing time', async () => {
    const dialog = await openPanel(
      resultsFixture(quizWith({ timeLimitMinutes: 0 }), [writingWithoutSeb()]),
    );

    expect(within(dialog).getByText('No clock')).toBeTruthy();
  });

  it('lists a shut-out student by email, with when the paper ended', async () => {
    const dialog = await openPanel(
      resultsFixture(quizWith({ requireSafeExamBrowser: true }), [shutOut()]),
    );

    expect(within(dialog).getByText('asha@example.com')).toBeTruthy();
    expect(within(dialog).getByText(/shut out \(1\)/i)).toBeTruthy();
    expect(within(dialog).getByText(/ended/i)).toBeTruthy();
  });

  it('pre-fills the time lost: what was left on the clock plus the wait since', async () => {
    // 60 min paper, 25 min used, terminated 10 min ago → 35 left + 10 waited.
    const dialog = await openPanel(resultsFixture(quizWith(), [shutOut()]));

    expect(within(dialog).getByLabelText('Minutes').value).toBe('45');
  });

  it('falls back to the wait alone when the paper has no whole-paper clock', async () => {
    const dialog = await openPanel(
      resultsFixture(quizWith({ timeLimitMinutes: 0, perQuestionTiming: true }), [
        shutOut({ submittedAt: new Date(Date.now() - 22 * MINUTES).toISOString() }),
      ]),
    );

    expect(within(dialog).getByLabelText('Minutes').value).toBe('22');
  });

  it('reopens the sitting with those minutes on one click, answers intact', async () => {
    reopenQuizAttempt.mockResolvedValue({ attempt: {}, mode: 'continue' });
    const dialog = await openPanel(resultsFixture(quizWith(), [shutOut()]));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Let in' }));

    await waitFor(() =>
      expect(reopenQuizAttempt).toHaveBeenCalledWith(
        'c1',
        'a1',
        expect.objectContaining({ mode: 'continue', minutes: 45 }),
      ),
    );
  });

  it('honours a minutes figure the invigilator overrides by hand', async () => {
    reopenQuizAttempt.mockResolvedValue({ attempt: {}, mode: 'continue' });
    const dialog = await openPanel(resultsFixture(quizWith(), [shutOut()]));

    fireEvent.change(within(dialog).getByLabelText('Minutes'), { target: { value: '15' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Let in' }));

    await waitFor(() =>
      expect(reopenQuizAttempt).toHaveBeenCalledWith(
        'c1',
        'a1',
        expect.objectContaining({ minutes: 15 }),
      ),
    );
  });

  it('names who is writing outside Safe Exam Browser, with their progress', async () => {
    const dialog = await openPanel(
      resultsFixture(quizWith({ requireSafeExamBrowser: true }), [writingWithoutSeb()]),
    );

    expect(within(dialog).getByText(/1 of 1 are writing outside safe exam browser/i)).toBeTruthy();
    // Twice over: the panel renders the narrow-screen cards and the wide-screen
    // table together and picks between them in CSS, which jsdom does not apply.
    expect(within(dialog).getAllByText('vikram@example.com').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('1/2 answered').length).toBeGreaterThan(0);
  });

  it('waives SEB on a let-in only when asked, and never by default', async () => {
    reopenQuizAttempt.mockResolvedValue({ attempt: {}, mode: 'continue' });
    const dialog = await openPanel(
      resultsFixture(quizWith({ requireSafeExamBrowser: true }), [shutOut()]),
    );

    const waive = within(dialog).getByRole('checkbox', {
      name: /let them back in without safe exam browser/i,
    });
    expect(waive).not.toBeChecked();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Let in' }));
    await waitFor(() =>
      expect(reopenQuizAttempt).toHaveBeenCalledWith(
        'c1',
        'a1',
        expect.objectContaining({ sebExempt: false }),
      ),
    );
  });

  it('leaves the SEB section quiet on a quiz that never asked for it', async () => {
    const dialog = await openPanel(resultsFixture(quizWith(), [shutOut()]));

    expect(within(dialog).getByText(/does not require safe exam browser/i)).toBeTruthy();
    expect(
      within(dialog).queryByRole('checkbox', { name: /without safe exam browser/i }),
    ).toBeNull();
  });
});
