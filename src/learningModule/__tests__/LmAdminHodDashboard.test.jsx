import { cloneElement } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The HOD dashboard page.
 *
 * The charts are recharts' problem; what these tests hold onto is everything a
 * head of department would misread if it drifted — that one filter bar drives
 * the whole page, that a semester with nothing in it still gets a row, and that
 * a rate with no denominator shows an em dash rather than a 0% that reads as
 * failure.
 */

const getHodDashboard = vi.fn();

vi.mock('../api/lmApi', () => ({
  default: { getHodDashboard: (...a) => getHodDashboard(...a) },
}));

/* ResponsiveContainer measures its parent, and jsdom has no layout — every
   chart would render as an empty box. Handing the chart a fixed size instead
   lets it mount, so a crash inside one still fails a test here. */
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => cloneElement(children, { width: 640, height: 240 }),
  };
});

const semester = (over = {}) => ({
  semester: '3',
  label: 'Sem 3',
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

const emptySemester = semester({
  semester: '5',
  label: 'Sem 5',
  classes: 1,
  enrolments: 10,
  faculty: 1,
  activeStudents: 0,
  posts: 0,
  shorts: 0,
  quizzes: 0,
  coding: 0,
  forms: 0,
  content: 0,
  coursework: 0,
  submissions: { total: 0, turnedIn: 0, graded: 0, late: 0, onTimeRate: null, gradedRate: null },
  quiz: { attempts: 0, avgPercent: null, passRate: null },
  engagementRate: 0,
});

const sampleData = {
  scope: { dept: 'CSE', locked: true },
  filters: { semesters: ['3', '5'], sessions: ['2026-27 Odd'], departments: ['CSE'] },
  totals: {
    faculty: 9,
    teachingFaculty: 2,
    students: 200,
    activeStudents: 3,
    classrooms: 3,
    classesWithActivity: 2,
    enrolments: 60,
    active: 2,
    archived: 1,
    completed: 0,
    coursework: 6,
    submissionsTotal: 10,
    turnedIn: 8,
    graded: 4,
    late: 2,
    awaitingGrading: 4,
    onTimeRate: 75,
    gradedRate: 50,
    quizAttempts: 10,
    avgQuizPercent: 70,
    quizPassRate: 60,
    engagementWindowDays: 30,
  },
  semesters: [semester(), emptySemester],
  trend: [
    { month: '2026-04', label: 'Apr', coursework: 0, submissions: 0, quizAttempts: 0, posts: 0 },
    { month: '2026-05', label: 'May', coursework: 1, submissions: 2, quizAttempts: 0, posts: 1 },
    { month: '2026-06', label: 'Jun', coursework: 2, submissions: 3, quizAttempts: 4, posts: 0 },
    { month: '2026-07', label: 'Jul', coursework: 1, submissions: 1, quizAttempts: 2, posts: 1 },
    { month: '2026-08', label: 'Aug', coursework: 1, submissions: 1, quizAttempts: 3, posts: 0 },
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
  getHodDashboard.mockResolvedValue(sampleData);
});

const renderPage = async () => {
  const { default: LmAdminHodDashboard } = await import('../pages/LmAdminHodDashboard');
  renderWithProviders(<LmAdminHodDashboard />);
  return screen.findByText('HOD Dashboard');
};

describe('LmAdminHodDashboard', () => {
  it('leads with the department, not with a league table', async () => {
    await renderPage();

    // "Faculty" is a column header in both tables below as well, so the tile is
    // recognised by the sentence under it rather than by its label alone.
    expect(screen.getAllByText('Faculty').length).toBeGreaterThan(0);
    expect(screen.getByText('2 running a classroom')).toBeInTheDocument();
    expect(screen.getByText('3 active in 30 days')).toBeInTheDocument();
    expect(screen.getByText('2 with activity')).toBeInTheDocument();

    // Teaching and learning, not just how much was posted.
    // Also the name of a line on the trend chart, hence getAll.
    expect(screen.getAllByText('Classwork set').length).toBeGreaterThan(0);
    expect(screen.getByText('75% before the deadline')).toBeInTheDocument();
    expect(screen.getByText('Awaiting marking')).toBeInTheDocument();
    expect(screen.getByText('50% of submissions marked')).toBeInTheDocument();
  });

  it('draws the semester charts and repeats every figure in a table', async () => {
    await renderPage();

    expect(screen.getByText('Cohort size by semester')).toBeInTheDocument();
    expect(screen.getByText('Content by semester')).toBeInTheDocument();
    expect(screen.getByText('Outcomes by semester')).toBeInTheDocument();
    expect(screen.getByText('Student engagement by semester')).toBeInTheDocument();
    expect(screen.getByText('The last six months')).toBeInTheDocument();

    // The semester table is the first of the two. The charts print the same
    // labels on their axes, which is exactly the relief the table exists for.
    const [semesterTable] = screen.getAllByRole('table');
    expect(within(semesterTable).getByText('Sem 3')).toBeInTheDocument();
    expect(within(semesterTable).getByText('Sem 5')).toBeInTheDocument();
  });

  it('shows an em dash, not a zero, where a rate has no denominator', async () => {
    await renderPage();

    // Sem 5 handed nothing in: on-time, marked, average and pass rate are all
    // "no answer", which is a different fact from "0%".
    const [semesterTable] = screen.getAllByRole('table');
    const semFiveRow = within(semesterTable).getByText('Sem 5').closest('tr');
    expect(within(semFiveRow).getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });

  it('locks the department for an HOD and refetches when a filter changes', async () => {
    await renderPage();

    expect(getHodDashboard).toHaveBeenCalledWith({ dept: '', semester: '', session: '' });
    // Locked scope shows the department as a fact, not as a dropdown.
    expect(screen.queryByText('All departments')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('All semesters'), { target: { value: '3' } });

    await waitFor(() => {
      expect(getHodDashboard).toHaveBeenLastCalledWith({ dept: '', semester: '3', session: '' });
    });
  });

  it('carries the per-class outcome columns alongside the content counts', async () => {
    await renderPage();

    const classRow = screen.getByText('Data Structures').closest('tr');
    expect(within(classRow).getByText('CS201 · Data Structures')).toBeInTheDocument();
    // students, active, posts…forms, classwork, handed in
    expect(within(classRow).getByText('30')).toBeInTheDocument();
    expect(within(classRow).getByText('4')).toBeInTheDocument();
    expect(within(classRow).getByText('8')).toBeInTheDocument();
  });
});

/**
 * The anonymous feedback panel.
 *
 * Every other panel on this screen is arithmetic; this one is a student's own
 * words about a named colleague, reaching somebody senior to that colleague.
 * What is pinned here is the part of it that is a promise rather than a
 * feature — that nothing in the response can put an author on screen, and that
 * an institute which switched the panel off gets no notes at all rather than
 * notes it merely declines to draw.
 */
const feedbackData = (over = {}) => ({
  ...sampleData,
  feedback: {
    total: 3,
    unread: 1,
    actioned: 0,
    answered: 1,
    answeredRate: 33.3,
    bySentiment: { praise: 1, suggestion: 1, concern: 1 },
    byCategory: { pace: 2, teaching: 1 },
    truncated: false,
    limit: 100,
    items: [
      {
        _id: 'fb1',
        category: 'pace',
        sentiment: 'concern',
        text: 'The lab moves faster than the lecture it follows.',
        status: 'new',
        response: '',
        created_at: '2026-08-14T00:00:00.000Z',
        classId: 'c1',
        className: 'Data Structures',
        subject: 'Data Structures',
        semester: '3',
        dept: 'CSE',
        facultyName: 'Dr A',
      },
      {
        _id: 'fb2',
        category: 'teaching',
        sentiment: 'praise',
        text: 'The worked examples in class are the reason I keep up.',
        status: 'read',
        response: 'Thank you — we will keep them.',
        respondedByName: 'Dr A',
        created_at: '2026-08-02T00:00:00.000Z',
        classId: 'c1',
        className: 'Data Structures',
        semester: '3',
        dept: 'CSE',
        facultyName: 'Dr A',
      },
    ],
    ...over,
  },
});

describe('anonymous student feedback panel', () => {
  it('shows what students wrote, and which class it was about', async () => {
    getHodDashboard.mockResolvedValue(feedbackData());
    await renderPage();

    expect(await screen.findByText('Anonymous student feedback')).toBeInTheDocument();
    expect(screen.getByText(/lab moves faster than the lecture/)).toBeInTheDocument();
    // The classroom and the colleague who runs it — without which a note is
    // not actionable by a head of department at all.
    expect(screen.getAllByText(/Dr A/).length).toBeGreaterThan(0);
  });

  it('counts concerns apart from praise without sorting them to the top', async () => {
    getHodDashboard.mockResolvedValue(feedbackData());
    await renderPage();

    await screen.findByText('Anonymous student feedback');
    expect(screen.getByText('Concerns')).toBeInTheDocument();
    expect(screen.getByText('1 praise · 1 suggestion')).toBeInTheDocument();

    // The order on screen is the order they were written, newest first — the
    // concern happens to be first here because it is the newer note, not
    // because it is a concern.
    const texts = screen.getAllByText(/lab moves faster|worked examples/);
    expect(texts[0].textContent).toMatch(/lab moves faster/);
  });

  it('shows the reply a member of staff already gave', async () => {
    getHodDashboard.mockResolvedValue(feedbackData());
    await renderPage();
    expect(await screen.findByText(/Replied by Dr A/)).toBeInTheDocument();
    expect(screen.getByText(/we will keep them/)).toBeInTheDocument();
  });

  it('draws nothing when the panel is switched off for this audience', async () => {
    /* Both halves of "off": the flag the superadmin screen writes, and the
       null the server sends because it did not read the collection. */
    getHodDashboard.mockResolvedValue({
      ...sampleData,
      sections: { feedback: false },
      feedback: null,
    });
    await renderPage();

    expect(screen.queryByText('Anonymous student feedback')).not.toBeInTheDocument();
    expect(screen.queryByText(/lab moves faster/)).not.toBeInTheDocument();
  });

  it('draws nothing when the flag is on but the server sent no feedback', async () => {
    // A response from a server that predates the panel. The screen must not
    // fall over reading `items` off nothing.
    getHodDashboard.mockResolvedValue({ ...sampleData, sections: { feedback: true } });
    await renderPage();
    expect(screen.queryByText('Anonymous student feedback')).not.toBeInTheDocument();
  });

  it('says the box is open when a department has written nothing', async () => {
    getHodDashboard.mockResolvedValue(
      feedbackData({ total: 0, unread: 0, answered: 0, answeredRate: null, items: [] }),
    );
    await renderPage();
    expect(await screen.findByText('No feedback yet')).toBeInTheDocument();
  });

  it('holds the list back to ten, and says how many more there are', async () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      _id: `fb${i}`,
      category: 'pace',
      sentiment: 'suggestion',
      text: `Note number ${i}`,
      status: 'read',
      response: '',
      created_at: '2026-08-14T00:00:00.000Z',
      classId: 'c1',
      className: 'Data Structures',
      semester: '3',
      dept: 'CSE',
      facultyName: 'Dr A',
    }));
    getHodDashboard.mockResolvedValue(feedbackData({ total: 14, items: many }));
    await renderPage();

    expect(await screen.findByText('Note number 0')).toBeInTheDocument();
    expect(screen.queryByText('Note number 12')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Show all 14 notes/ }));
    await waitFor(() => expect(screen.getByText('Note number 12')).toBeInTheDocument());
  });
});
