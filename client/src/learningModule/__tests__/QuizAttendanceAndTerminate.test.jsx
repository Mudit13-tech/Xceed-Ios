import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The two mid-exam acts that were missing: taking the register, and taking the
 * paper off somebody.
 *
 * They sit in different places on purpose, and these tests pin that placement
 * as much as the behaviour. **Attendance** hangs off the quiz card beside Live
 * control, because it is walked once down the whole roster — including the
 * students with no attempt at all, who are exactly the people an absence is
 * recorded for and who the live panel, built from attempts, cannot show.
 * **Terminate** lives on those same register rows: the hand that stops a paper
 * is the hand already holding the roster, and stopping somebody is not the same
 * record as marking them absent — a student caught cheating was present — so
 * it ends the sitting and leaves the attendance mark alone. Live control keeps
 * the shut-out list and "Let in", and is otherwise read-only.
 *
 * What matters most here is that neither is a one-tap accident and neither is
 * final. Ending a live paper asks twice; the student lands in the shut-out list
 * with their answers, where the existing "Let in" button returns it.
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
const listQuizzes = vi.fn();
const quizAttendance = vi.fn();
const markQuizAttendance = vi.fn();
const terminateQuizAttempt = vi.fn();
const reopenQuizAttempt = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    quizResults: (...args) => quizResults(...args),
    listQuizzes: (...args) => listQuizzes(...args),
    quizAttendance: (...args) => quizAttendance(...args),
    markQuizAttendance: (...args) => markQuizAttendance(...args),
    terminateQuizAttempt: (...args) => terminateQuizAttempt(...args),
    reopenQuizAttempt: (...args) => reopenQuizAttempt(...args),
    quizResultsCsvUrl: () => 'https://api.test/export.csv',
    LmApiError: class LmApiError extends Error {},
  },
}));

const MINUTES = 60000;

const quiz = {
  _id: 'q1',
  title: 'Midterm',
  published: true,
  questions: [{ _id: 'ques1' }, { _id: 'ques2' }],
  totalMarks: 10,
  settings: { deliveryMode: 'all_at_once', timeLimitMinutes: 60 },
};

const writing = (overrides = {}) => ({
  _id: 'a1',
  studentName: 'Asha Rao',
  studentEmail: 'asha@example.com',
  rollNumber: '21EC001',
  status: 'in_progress',
  answeredCount: 1,
  questionCount: 2,
  cursor: 0,
  score: 0,
  maxScore: 10,
  startedAt: new Date(Date.now() - 5 * MINUTES).toISOString(),
  ...overrides,
});

const resultsFixture = (attempts) => ({
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
    terminated: 0,
    seb: { required: false, verified: 0, bypassed: 0 },
  },
  perQuestion: [],
  perSection: [],
  results: { released: false },
  distribution: [],
  serverTime: new Date().toISOString(),
});

const listedLive = (attempts) => [
  {
    ...quiz,
    questionCount: quiz.questions.length,
    window: { open: true, closed: false, notYetOpen: false },
    publish: { scheduled: false },
    stats: { attempts: attempts.length, avg: null, lastSubmittedAt: null },
    live: {
      writing: attempts.filter((a) => a.status === 'in_progress').length,
      submitted: 0,
      shutOut: 0,
      offSeb: 0,
    },
    sittingNow: attempts.filter((a) => a.status === 'in_progress').length,
  },
];

const rosterRow = (overrides = {}) => ({
  studentId: 's1',
  studentName: 'Asha Rao',
  studentEmail: 'asha@example.com',
  rollNumber: '21EC001',
  attendance: 'unmarked',
  markedAt: null,
  markedByName: '',
  note: '',
  attemptId: 'a1',
  attemptStatus: 'in_progress',
  startedAt: new Date(Date.now() - 5 * MINUTES).toISOString(),
  ...overrides,
});

const attendanceFixture = (students) => ({
  quiz: { _id: 'q1', title: 'Midterm' },
  students,
  summary: {
    enrolled: students.length,
    present: students.filter((s) => s.attendance === 'present').length,
    absent: students.filter((s) => s.attendance === 'absent').length,
    unmarked: students.filter((s) => s.attendance === 'unmarked').length,
    writing: students.filter((s) => s.attemptStatus === 'in_progress').length,
  },
  serverTime: new Date().toISOString(),
});

/**
 * Imported here rather than inside the first test that needs it.
 *
 * This is a page and it pulls in a large tree; transforming and importing it
 * costs seconds. Done inside a test body, only the *first* test pays — it ran
 * at 4.3s against sibling tests at 0.6s, which is most of the way to the
 * per-test timeout before the test has asserted anything, and over it the
 * moment the machine is busy. At module scope the cost is paid once, at
 * collection time, where no per-test budget applies.
 *
 * Safe above the mocks it depends on: `vi.mock` calls are hoisted above every
 * import in the file, so this still resolves to the mocked modules.
 */
const { default: Quizzes } = await import('../pages/Quizzes');

const renderQuizzes = async (attempts) => {
  quizResults.mockResolvedValue(resultsFixture(attempts));
  listQuizzes.mockResolvedValue(listedLive(attempts));
  renderWithProviders(<Quizzes />);
  return screen.findByRole('button', { name: /live control/i });
};

const openLivePanel = async (attempts) => {
  await renderQuizzes(attempts);
  fireEvent.click(screen.getByRole('button', { name: /live control/i }));
  await waitFor(() => expect(quizResults).toHaveBeenCalled());
  return screen.findByRole('dialog');
};

const openRegister = async (students, attempts = [writing()]) => {
  quizAttendance.mockResolvedValue(attendanceFixture(students));
  await renderQuizzes(attempts);
  fireEvent.click(screen.getByRole('button', { name: /attendance/i }));
  await waitFor(() => expect(quizAttendance).toHaveBeenCalledWith('c1', 'q1'));
  return screen.findByRole('dialog');
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('watching a live paper from the control panel', () => {
  it('lists who is writing, with how far through they are', async () => {
    const dialog = await openLivePanel([writing()]);

    expect(within(dialog).getByText(/writing now \(1\)/i)).toBeTruthy();
    expect(within(dialog).getAllByText('asha@example.com').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(/1\/2 answered/).length).toBeGreaterThan(0);
  });

  it('offers no way to end a paper — that moved to the register', async () => {
    const dialog = await openLivePanel([writing()]);

    expect(within(dialog).queryByRole('button', { name: 'Terminate' })).toBeNull();
  });

  it('narrows both lists to the name searched for', async () => {
    const dialog = await openLivePanel([
      writing(),
      writing({ _id: 'a2', studentName: 'Vikram Iyer', studentEmail: 'vikram@example.com' }),
    ]);

    fireEvent.change(within(dialog).getByLabelText('Search students'), {
      target: { value: 'vikram' },
    });

    expect(within(dialog).queryByText('Asha Rao')).toBeNull();
    expect(within(dialog).getAllByText('Vikram Iyer').length).toBeGreaterThan(0);
  });

  it('searches by roll number too — what a hall list is ordered by', async () => {
    const dialog = await openLivePanel([
      writing(),
      writing({ _id: 'a2', studentName: 'Vikram Iyer', rollNumber: '21EC002' }),
    ]);

    fireEvent.change(within(dialog).getByLabelText('Search students'), {
      target: { value: '21EC002' },
    });

    expect(within(dialog).queryByText('Asha Rao')).toBeNull();
    expect(within(dialog).getByText('Vikram Iyer')).toBeTruthy();
  });
});

describe('the register', () => {
  it('opens from the quiz card, beside live control', async () => {
    await renderQuizzes([writing()]);
    expect(screen.getByRole('button', { name: /attendance/i })).toBeTruthy();
  });

  it('lists the student who never started — the row the live panel cannot show', async () => {
    const dialog = await openRegister([
      rosterRow(),
      rosterRow({
        studentId: 's2',
        studentName: 'Vikram Iyer',
        studentEmail: 'vikram@example.com',
        rollNumber: '21EC002',
        attemptId: null,
        attemptStatus: null,
        startedAt: null,
      }),
    ]);

    expect(within(dialog).getByText('Vikram Iyer')).toBeTruthy();
    expect(within(dialog).getByText('Has not started')).toBeTruthy();
  });

  it('marks a student present in one tap', async () => {
    markQuizAttendance.mockResolvedValue({ marked: [], terminated: [] });
    const dialog = await openRegister([rosterRow()]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Present' }));

    await waitFor(() =>
      expect(markQuizAttendance).toHaveBeenCalledWith('c1', 'q1', [
        { studentId: 's1', status: 'present' },
      ]),
    );
  });

  it('asks before marking absent somebody who is mid-paper — it ends their test', async () => {
    const dialog = await openRegister([rosterRow()]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Absent' }));

    expect(markQuizAttendance).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: /absent — end their test/i })).toBeTruthy();
  });

  it('does not ask twice for somebody who never started — there is nothing to take away', async () => {
    markQuizAttendance.mockResolvedValue({ marked: [], terminated: [] });
    const dialog = await openRegister([
      rosterRow({ attemptId: null, attemptStatus: null, startedAt: null }),
    ]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Absent' }));

    await waitFor(() =>
      expect(markQuizAttendance).toHaveBeenCalledWith('c1', 'q1', [
        { studentId: 's1', status: 'absent' },
      ]),
    );
  });

  it('marks everyone writing present in one action, skipping those already marked', async () => {
    markQuizAttendance.mockResolvedValue({ marked: [], terminated: [] });
    const dialog = await openRegister([
      rosterRow(),
      rosterRow({ studentId: 's2', studentName: 'Vikram Iyer', attendance: 'present' }),
      rosterRow({ studentId: 's3', studentName: 'Meera Nair', attemptStatus: null }),
    ]);

    fireEvent.click(within(dialog).getByRole('button', { name: /mark all writing present \(1\)/i }));

    await waitFor(() =>
      expect(markQuizAttendance).toHaveBeenCalledWith('c1', 'q1', [
        { studentId: 's1', status: 'present' },
      ]),
    );
  });

  it('offers no way to mark a whole hall absent — that would end every paper at once', async () => {
    const dialog = await openRegister([rosterRow()]);

    expect(within(dialog).queryByRole('button', { name: /mark all .*absent/i })).toBeNull();
  });

  it('offers Terminate on the row of somebody mid-paper', async () => {
    const dialog = await openRegister([rosterRow()]);

    expect(within(dialog).getByRole('button', { name: 'Terminate' })).toBeTruthy();
  });

  it('offers no Terminate for somebody who never started — there is no paper to take', async () => {
    const dialog = await openRegister([
      rosterRow({ attemptId: null, attemptStatus: null, startedAt: null }),
    ]);

    expect(within(dialog).queryByRole('button', { name: 'Terminate' })).toBeNull();
  });

  it('asks a second time before ending a paper, and sends nothing on the first tap', async () => {
    const dialog = await openRegister([rosterRow()]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Terminate' }));

    expect(terminateQuizAttempt).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: /end asha.s test/i })).toBeTruthy();
  });

  it('ends the sitting once the second tap confirms it, leaving the register mark alone', async () => {
    terminateQuizAttempt.mockResolvedValue({ terminated: true });
    const dialog = await openRegister([rosterRow()]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Terminate' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /end asha.s test/i }));

    await waitFor(() => expect(terminateQuizAttempt).toHaveBeenCalledWith('c1', 'a1'));
    expect(markQuizAttendance).not.toHaveBeenCalled();
  });

  it('backs out cleanly, leaving the paper running', async () => {
    const dialog = await openRegister([rosterRow()]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Terminate' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(terminateQuizAttempt).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Terminate' })).toBeTruthy();
  });

  it('narrows the roster to the name searched for', async () => {
    const dialog = await openRegister([
      rosterRow(),
      rosterRow({ studentId: 's2', studentName: 'Vikram Iyer', rollNumber: '21EC002' }),
    ]);

    fireEvent.change(within(dialog).getByLabelText('Search students'), {
      target: { value: 'vikram' },
    });

    expect(within(dialog).queryByText('Asha Rao')).toBeNull();
    expect(within(dialog).getByText('Vikram Iyer')).toBeTruthy();
  });

  it('shows the register totals, with "not marked" distinct from present', async () => {
    const dialog = await openRegister([
      rosterRow({ attendance: 'present' }),
      rosterRow({ studentId: 's2', attendance: 'absent' }),
      rosterRow({ studentId: 's3' }),
    ]);

    // Scoped to the header: "Present" and "Absent" are also the verbs on every
    // row's buttons, and the totals are the ones in the summary strip.
    const header = within(dialog.querySelector('header'));
    expect(header.getByText('Present').nextSibling.textContent).toBe('1');
    expect(header.getByText('Absent').nextSibling.textContent).toBe('1');
    expect(header.getByText('Not marked').nextSibling.textContent).toBe('1');
  });
});
