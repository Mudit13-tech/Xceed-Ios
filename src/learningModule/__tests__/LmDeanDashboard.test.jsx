import { cloneElement } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The Dean (Academic) dashboard.
 *
 * It is the head of department's screen in its `dean` variant, so the numbers,
 * the charts and the semester table are already covered by
 * LmAdminHodDashboard's tests. What is pinned here is only what the variant is
 * for — the four things that would silently make it the wrong screen:
 *
 *  - it reads the dean's endpoint, not the HOD's, because they are different
 *    gates and the HOD one would hand a dean somebody else's scoping;
 *  - it says so, rather than heading an institute-wide page "HOD Dashboard";
 *  - it draws the department breakdown, which is the one figure a head of
 *    department never sees and the whole reason the role exists;
 *  - it does not offer the faculty directory, which is behind the lm-admin gate
 *    and would be a 403 with a link on it.
 */

const getHodDashboard = vi.fn();
const getDeanDashboard = vi.fn();

vi.mock('../api/lmApi', () => ({
  default: {
    getHodDashboard: (...a) => getHodDashboard(...a),
    getDeanDashboard: (...a) => getDeanDashboard(...a),
  },
}));

/* ResponsiveContainer measures its parent and jsdom has no layout, so every
   chart would render as an empty box. A fixed size lets them mount, so a crash
   inside one still fails a test here. */
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => cloneElement(children, { width: 640, height: 240 }),
  };
});

const rollup = (over = {}) => ({
  classes: 2,
  enrolments: 50,
  faculty: 2,
  activeStudents: 3,
  posts: 2,
  shorts: 1,
  quizzes: 3,
  coding: 1,
  forms: 0,
  content: 7,
  coursework: 6,
  submissions: { total: 10, turnedIn: 8, graded: 4, late: 2, onTimeRate: 75, gradedRate: 50 },
  quiz: { attempts: 10, avgPercent: 70, passRate: 60 },
  engagementRate: 6,
  ...over,
});

const instituteData = {
  // Unscoped: no single department in view, and no dropdown clamped to one.
  scope: { dept: '', departments: [], locked: false, institute: true },
  filters: { semesters: ['3'], sessions: ['2026-27 Odd'], departments: ['CSE', 'ECE'] },
  totals: {
    faculty: 40,
    teachingFaculty: 12,
    students: 900,
    activeStudents: 6,
    classrooms: 4,
    classesWithActivity: 3,
    enrolments: 120,
    active: 3,
    archived: 1,
    completed: 0,
    coursework: 12,
    submissionsTotal: 20,
    turnedIn: 16,
    graded: 8,
    late: 4,
    awaitingGrading: 8,
    onTimeRate: 75,
    gradedRate: 50,
    quizAttempts: 20,
    avgQuizPercent: 70,
    quizPassRate: 60,
    engagementWindowDays: 30,
  },
  semesters: [rollup({ key: '3', semester: '3', label: 'Sem 3' })],
  departments: [
    rollup({ key: 'CSE', dept: 'CSE', label: 'CSE' }),
    rollup({
      key: 'ECE',
      dept: 'ECE',
      label: 'ECE',
      classes: 1,
      enrolments: 10,
      faculty: 1,
      activeStudents: 0,
      content: 0,
      coursework: 0,
      submissions: {
        total: 0, turnedIn: 0, graded: 0, late: 0, onTimeRate: null, gradedRate: null,
      },
      quiz: { attempts: 0, avgPercent: null, passRate: null },
      engagementRate: 0,
    }),
  ],
  trend: [
    { month: '2026-09', label: 'Sep', coursework: 1, submissions: 1, quizAttempts: 1, posts: 0 },
  ],
  classes: [
    {
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
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  getDeanDashboard.mockResolvedValue(instituteData);
  getHodDashboard.mockResolvedValue(instituteData);
});

const renderPage = async () => {
  const { default: LmDeanDashboard } = await import('../pages/LmDeanDashboard');
  renderWithProviders(<LmDeanDashboard />);
  return screen.findByText('Dean (Academic) Dashboard');
};

/**
 * The department table, found by its first column header rather than by
 * position — the page has three tables and their order is a layout decision
 * this test has no business pinning.
 */
const departmentTable = () =>
  screen
    .getAllByRole('table')
    .find((table) => within(table).getAllByRole('columnheader')[0]?.textContent === 'Department');

describe('LmDeanDashboard', () => {
  it('reads the dean endpoint and never the head of department one', async () => {
    await renderPage();

    expect(getDeanDashboard).toHaveBeenCalledTimes(1);
    // The two paths are different gates. Calling the HOD one as a dean would
    // 403, and calling it as an admin would quietly work — which is worse,
    // because it would only break for the person the screen is named after.
    expect(getHodDashboard).not.toHaveBeenCalled();
  });

  it('names the institute rather than a department', async () => {
    await renderPage();

    expect(screen.queryByText('HOD Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText(/Whole institute · 1 class/)).toBeInTheDocument();
  });

  it('breaks the institute down by department, empty departments included', async () => {
    await renderPage();

    const rows = within(departmentTable()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('CSE')).toBeInTheDocument();

    // A department that has done nothing still gets a row — it is the one an
    // institute-wide reader most needs to see — and its rates read as em
    // dashes, because nobody has been asked yet rather than everybody failing.
    const ece = within(rows[1]);
    expect(ece.getByText('ECE')).toBeInTheDocument();
    expect(ece.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('drills into a department when its name is clicked', async () => {
    await renderPage();
    getDeanDashboard.mockClear();

    await userEvent.click(within(departmentTable()).getByRole('button', { name: 'ECE' }));

    // The same filter the dropdown sets, so the two can never disagree about
    // what is in view.
    await waitFor(() =>
      expect(getDeanDashboard).toHaveBeenCalledWith({ dept: 'ECE', semester: '', session: '' }));
  });

  it('points Subjects at the dean path, not the head of department one', async () => {
    await renderPage();

    expect(screen.getByRole('link', { name: /Subjects/ })).toHaveAttribute(
      'href',
      '/learning/dean-subjects',
    );
  });

  it('does not offer the faculty directory, which is behind the admin gate', async () => {
    await renderPage();

    expect(screen.queryByRole('link', { name: /Faculty directory/ })).not.toBeInTheDocument();
  });

  /* The panel toggles an administrator sets on the leadership screen. They are
     a display preference and never an access control — everything below was
     already scoped by the gate — but a panel switched off has to actually go,
     and one nobody has an opinion about has to stay. */
  it('drops a panel the configuration switches off', async () => {
    getDeanDashboard.mockResolvedValue({
      ...instituteData,
      sections: { trend: false, classrooms: false },
    });
    await renderPage();

    expect(screen.queryByText('The last six months')).not.toBeInTheDocument();
    // The classroom *list*, recognised by its own subtitle — "Classrooms" alone
    // is also the label on a stat tile in the panel above, which stays.
    expect(screen.queryByText('All classes · 1 total')).not.toBeInTheDocument();
    // Everything the configuration says nothing about is still there.
    expect(screen.getByText('Semester analysis')).toBeInTheDocument();
    expect(screen.getByText('Department analysis')).toBeInTheDocument();
  });

  it('shows every panel when the response mentions none', async () => {
    // A server that predates a panel, or an institute that has never opened the
    // settings screen — neither may blank half the dashboard.
    getDeanDashboard.mockResolvedValue({ ...instituteData, sections: undefined });
    await renderPage();

    expect(screen.getByText('The last six months')).toBeInTheDocument();
    expect(screen.getByText('All classes · 1 total')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Subjects/ })).toBeInTheDocument();
  });

  it('hides the Subjects link with its panel, because that screen then refuses', async () => {
    getDeanDashboard.mockResolvedValue({ ...instituteData, sections: { subjects: false } });
    await renderPage();

    expect(screen.queryByRole('link', { name: /Subjects/ })).not.toBeInTheDocument();
  });

  it('leaves the department breakdown out when the view covers one department', async () => {
    getDeanDashboard.mockResolvedValue({ ...instituteData, departments: [] });
    await renderPage();

    // A one-row "by department" table restating the tiles above it is noise,
    // so the server sends nothing and the section does not appear at all.
    expect(screen.queryByText('Department analysis')).not.toBeInTheDocument();
    // The semester rollup is a head of department's breakdown and the dean's
    // alike, so it stays.
    expect(screen.getByText('Semester analysis')).toBeInTheDocument();
  });
});
