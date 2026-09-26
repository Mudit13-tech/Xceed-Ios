import { cloneElement } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * Two things the Dean (Academic) screen gained, and one promise that moved
 * with them.
 *
 * **Names on feedback.** A dean reads every author; a head of department reads
 * one only where staff marked a note inappropriate. The server decides that
 * per note — the presence of `student` on a row *is* the permission — so the
 * screen has nothing to decide and only has to be honest about what it was
 * given: the panel heading says "Anonymous" only when no row on it carries a
 * name. That the promise students read matches the rule is pinned on the
 * server side, in feedbackAuthorVisibility.test.js.
 *
 * **Filters inside the tables.** The page already had a department dropdown at
 * the top, and it re-fetches — every tile and chart moves with it. These new
 * ones narrow one table and leave the rest of the screen where it is, which is
 * what reading down an institute-wide list actually needs.
 */

const getDeanDashboard = vi.fn();
const getHodDashboard = vi.fn();

vi.mock('../api/lmApi', () => ({
  default: {
    getHodDashboard: (...a) => getHodDashboard(...a),
    getDeanDashboard: (...a) => getDeanDashboard(...a),
  },
}));

vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => cloneElement(children, { width: 640, height: 240 }),
  };
});

const klass = (over = {}) => ({
  _id: 'c1',
  name: 'Data Structures',
  subject: 'Data Structures',
  subjectCode: 'CS201',
  semester: '3',
  session: '2026-27 Odd',
  status: 'active',
  dept: 'CSE',
  ownerName: 'Dr A',
  ownerEmail: 'a@nitj.ac.in',
  studentCount: 30,
  activeStudents: 2,
  activity: { posts: 2, shorts: 1, quizzes: 0, coding: 1, forms: 0, total: 4 },
  coursework: 4,
  submissions: { total: 10, turnedIn: 8, graded: 4, late: 2, avgGradePercent: 80 },
  quiz: { attempts: 0, avgPercent: null, passRate: null },
  ...over,
});

const note = (over = {}) => ({
  _id: 'f1',
  category: 'teaching',
  sentiment: 'concern',
  text: 'The lab sheets arrive after the lab.',
  status: 'new',
  created_at: '2026-09-21T00:00:00.000Z',
  classId: 'c1',
  className: 'Data Structures',
  semester: '3',
  dept: 'CSE',
  facultyName: 'Dr A',
  ...over,
});

const dashboard = (over = {}) => ({
  scope: { dept: '', departments: [], locked: false, institute: true },
  filters: { semesters: ['3'], sessions: ['2026-27 Odd'], departments: ['CSE', 'ECE'] },
  totals: {
    faculty: 40, teachingFaculty: 12, students: 900, activeStudents: 6, classrooms: 4,
    classesWithActivity: 3, enrolments: 120, active: 3, archived: 1, completed: 0, coursework: 12,
    submissionsTotal: 20, turnedIn: 16, graded: 8, late: 4, awaitingGrading: 8, onTimeRate: 75,
    gradedRate: 50, quizAttempts: 20, avgQuizPercent: 70, quizPassRate: 60, engagementWindowDays: 30,
  },
  semesters: [],
  departments: [],
  trend: [],
  classes: [
    klass(),
    klass({ _id: 'c2', name: 'Signals', subject: 'Signals', dept: 'ECE', ownerName: 'Dr B' }),
    klass({ _id: 'c3', name: 'Compilers', subject: 'Compilers', dept: 'CSE', ownerName: 'Dr C' }),
  ],
  ...over,
});

const withFeedback = (unusedIdentified, items) =>
  dashboard({
    feedback: {
      total: items.length,
      unread: 1,
      answered: 0,
      answeredRate: 0,
      bySentiment: { concern: items.length },
      items,
      truncated: false,
      limit: 100,
    },
  });

const renderPage = async (data) => {
  getDeanDashboard.mockResolvedValue(data);
  const { default: LmDeanDashboard } = await import('../pages/LmDeanDashboard');
  renderWithProviders(<LmDeanDashboard />);
  await screen.findByText('Dean (Academic) Dashboard');
};

/** A table found by its first column header, not by its position on the page. */
const tableHeaded = (heading) =>
  screen
    .getAllByRole('table')
    .find((table) => within(table).getAllByRole('columnheader')[0]?.textContent === heading);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('feedback with its authors', () => {
  it('names the student who wrote each note', async () => {
    await renderPage(
      withFeedback(true, [
        note({ student: { id: 'u1', name: 'Asha Rao', rollNumber: '21103045' } }),
      ]),
    );

    expect(await screen.findByText(/Asha Rao/)).toBeInTheDocument();
    expect(screen.getByText(/21103045/)).toBeInTheDocument();
  });

  /* A heading that says "anonymous" over a column of names is worse than no
     heading, so the title follows what was actually sent. */
  it('stops calling the panel anonymous once a row carries a name', async () => {
    await renderPage(
      withFeedback(true, [note({ student: { id: 'u1', name: 'Asha Rao' } })]),
    );

    expect(await screen.findByText('Student feedback')).toBeInTheDocument();
    expect(screen.queryByText('Anonymous student feedback')).not.toBeInTheDocument();
  });

  /* The head of department's view, which the same component renders. */
  it('still says anonymous, and shows no name, when the server sent none', async () => {
    await renderPage(withFeedback(false, [note()]));

    expect(await screen.findByText('Anonymous student feedback')).toBeInTheDocument();
    expect(screen.queryByText(/Asha Rao/)).not.toBeInTheDocument();
  });

  /* An account removed since writing leaves a note with no author even on this
     screen. A blank there would read as anonymity, which it is not. */
  it('says the sender is unknown rather than leaving a gap', async () => {
    await renderPage(withFeedback(true, [note({ student: { id: 'u1', name: '' } })]));

    expect(await screen.findByText('Unknown')).toBeInTheDocument();
  });

  /* A head of department's list: mostly anonymous, with one note opened by a
     mark. The heading has to follow the rows, not the reader. */
  it('shows the one named note in an otherwise anonymous list', async () => {
    await renderPage(
      withFeedback(true, [
        note(),
        note({
          _id: 'f9',
          inappropriate: true,
          student: { id: 'u9', name: 'Chandra Iyer' },
        }),
      ]),
    );

    expect(await screen.findByText(/Chandra Iyer/)).toBeInTheDocument();
    expect(screen.getByText('Marked inappropriate — sender')).toBeInTheDocument();
    expect(screen.getByText('Student feedback')).toBeInTheDocument();
  });
});

describe('the department filter inside the feedback panel', () => {
  const twoDepts = [
    note({ student: { id: 'u1', name: 'Asha Rao' } }),
    note({ _id: 'f2', dept: 'ECE', className: 'Signals', classId: 'c2', text: 'Slides are hard to read.', student: { id: 'u2', name: 'Bilal Khan' } }),
  ];

  it('narrows the notes to one department', async () => {
    await renderPage(withFeedback(true, twoDepts));
    await screen.findByText(/Asha Rao/);

    await userEvent.selectOptions(
      screen.getByLabelText('Filter feedback by department'),
      'ECE',
    );

    expect(screen.getByText(/Bilal Khan/)).toBeInTheDocument();
    expect(screen.queryByText(/Asha Rao/)).not.toBeInTheDocument();
  });

  /* It filters what is read, not what was fetched — moving it must not send
     the page back to the server and move every tile on it. */
  it('does not re-fetch the dashboard', async () => {
    await renderPage(withFeedback(true, twoDepts));
    await screen.findByText(/Asha Rao/);
    getDeanDashboard.mockClear();

    await userEvent.selectOptions(
      screen.getByLabelText('Filter feedback by department'),
      'ECE',
    );

    expect(getDeanDashboard).not.toHaveBeenCalled();
  });
});

describe('the department filter inside the classrooms table', () => {
  const classTable = () => tableHeaded('Class / Subject');

  it('narrows the table to one department', async () => {
    await renderPage(dashboard());
    await screen.findByText('Compilers');

    await userEvent.selectOptions(
      screen.getByLabelText('Filter classrooms by department'),
      'ECE',
    );

    const rows = within(classTable()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText('Signals')).toBeInTheDocument();
  });

  it('says what it is showing', async () => {
    await renderPage(dashboard());
    await screen.findByText('Compilers');

    await userEvent.selectOptions(
      screen.getByLabelText('Filter classrooms by department'),
      'ECE',
    );

    expect(screen.getByText(/1 class in ECE/)).toBeInTheDocument();
  });

  it('gives every department back when cleared', async () => {
    await renderPage(dashboard());
    await screen.findByText('Compilers');
    const select = screen.getByLabelText('Filter classrooms by department');

    await userEvent.selectOptions(select, 'ECE');
    await userEvent.selectOptions(select, '');

    expect(within(classTable()).getAllByRole('row').slice(1)).toHaveLength(3);
  });

  /* The page-level bar re-fetches; this one does not. That is the whole reason
     it exists rather than being a second copy of the bar at the top. */
  it('leaves the rest of the page where it is', async () => {
    await renderPage(dashboard());
    await screen.findByText('Compilers');
    getDeanDashboard.mockClear();

    await userEvent.selectOptions(
      screen.getByLabelText('Filter classrooms by department'),
      'ECE',
    );

    expect(getDeanDashboard).not.toHaveBeenCalled();
  });
});
