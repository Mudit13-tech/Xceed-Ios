import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * Subjects & faculty.
 *
 * What is pinned here is the counting rule the department asked for — the
 * headline is theory, and the filter is how you see the rest — plus the two
 * things this screen exists to surface: a theory subject nobody has opened a
 * classroom for, and a timetable name that matches nobody in the faculty list.
 */

const getHodSubjects = vi.fn();

vi.mock('../api/lmApi', () => ({
  default: { getHodSubjects: (...a) => getHodSubjects(...a) },
}));

const exportCsv = vi.fn();
vi.mock('../csv', () => ({
  exportCsv: (...a) => exportCsv(...a),
  csvFilename: (...parts) => `${parts.filter(Boolean).join('-')}.csv`,
}));

const row = (over = {}) => ({
  faculty: 'Dr A Sharma',
  facultyEmail: 'a.sharma@nitj.ac.in',
  designation: 'Professor',
  facultyKnown: true,
  subject: 'DS',
  subjectName: 'Data Structures',
  subjectCode: 'CS201',
  semester: '3',
  type: 'theory',
  rawType: 'Theory',
  slots: 3,
  credits: 4,
  studentCount: 60,
  rooms: ['CR1'],
  lmClass: { _id: 'c1', name: 'Data Structures', status: 'active', studentCount: 58, ownerName: 'Dr A Sharma' },
  ...over,
});

const sampleData = {
  dept: 'CSE',
  session: '2026-27 Odd',
  scope: { locked: true, departments: ['CSE'] },
  filters: {
    departments: ['CSE'],
    sessions: ['2026-27 Odd', '2025-26 Even'],
    types: [
      { key: 'theory', label: 'Theory' },
      { key: 'lab', label: 'Lab' },
      { key: 'tutorial', label: 'Tutorial' },
      { key: 'others', label: 'Others' },
    ],
  },
  totals: {
    faculty: 3,
    teaching: 2,
    subjects: 4,
    theory: 2,
    lab: 1,
    tutorial: 1,
    others: 0,
    slots: 9,
    withClassroom: 1,
    theoryWithoutClassroom: 1,
  },
  faculty: [
    {
      name: 'Dr A Sharma',
      email: 'a.sharma@nitj.ac.in',
      designation: 'Professor',
      inFacultyList: true,
      counts: { theory: 1, lab: 1, tutorial: 0, others: 0, total: 2 },
      slots: 5,
      semesters: ['3'],
      lmClasses: 1,
      missingClassrooms: 0,
    },
    {
      name: 'Dr D Verma',
      email: 'd.verma@nitj.ac.in',
      designation: 'Associate Professor',
      inFacultyList: true,
      counts: { theory: 0, lab: 0, tutorial: 0, others: 0, total: 0 },
      slots: 0,
      semesters: [],
      lmClasses: 0,
      missingClassrooms: 0,
    },
  ],
  rows: [
    row(),
    row({
      subject: 'DSLAB', subjectName: 'Data Structures Lab', subjectCode: 'CS291',
      type: 'lab', rawType: 'Laboratory', slots: 2, credits: 2, lmClass: null,
    }),
    row({
      faculty: 'Dr C Singh', facultyKnown: false, designation: '',
      subject: 'OS', subjectName: 'Operating Systems', subjectCode: 'CS301',
      semester: '5', type: 'theory', slots: 3, lmClass: null,
    }),
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  getHodSubjects.mockResolvedValue(sampleData);
});

const renderPage = async () => {
  const { default: LmHodSubjects } = await import('../pages/LmHodSubjects');
  renderWithProviders(<LmHodSubjects />);
  return screen.findByText('Subjects & faculty');
};

describe('LmHodSubjects', () => {
  it('counts theory in the headline and says what is not opened', async () => {
    await renderPage();

    expect(screen.getByText('Theory subjects')).toBeInTheDocument();
    expect(screen.getByText('4 allocations of every kind')).toBeInTheDocument();
    expect(screen.getByText('Theory, no classroom')).toBeInTheDocument();
    expect(screen.getByText('of 3 in the department')).toBeInTheDocument();
  });

  it('shows theory only until another kind is asked for', async () => {
    await renderPage();

    // Both theory rows, and not the lab.
    expect(screen.getByText('Operating Systems')).toBeInTheDocument();
    expect(screen.queryByText('Data Structures Lab')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lab' }));
    expect(await screen.findByText('Data Structures Lab')).toBeInTheDocument();
    expect(screen.queryByText('Operating Systems')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(await screen.findByText('Data Structures Lab')).toBeInTheDocument();
    expect(screen.getByText('Operating Systems')).toBeInTheDocument();
  });

  it('links a subject that has a classroom and names the ones that do not', async () => {
    await renderPage();

    // Located by its code line: "Data Structures" is both the subject name and
    // the name of the classroom it links to, in the same row.
    const withClass = screen.getByText('CS201 · DS').closest('tr');
    expect(within(withClass).getByRole('link', { name: 'Data Structures' }))
      .toHaveAttribute('href', '/learning/class/c1');

    const withoutClass = screen.getByText('Operating Systems').closest('tr');
    expect(within(withoutClass).getByText('no classroom')).toBeInTheDocument();
  });

  it('marks a timetable name that matches nobody in the faculty list', async () => {
    await renderPage();
    const row3 = screen.getByText('Operating Systems').closest('tr');
    expect(within(row3).getByText('not in the faculty list')).toBeInTheDocument();
  });

  it('keeps a faculty member the timetable allocated nothing to', async () => {
    await renderPage();
    const [facultyTable] = screen.getAllByRole('table');
    expect(within(facultyTable).getByText('Dr D Verma')).toBeInTheDocument();
  });

  it('downloads what is on screen, under the filter in force', async () => {
    await renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: 'Download CSV' })[1]);
    const [filename, headers, rows] = exportCsv.mock.calls[0];
    expect(filename).toContain('CSE');
    expect(filename).toContain('theory');
    expect(headers[0]).toBe('Faculty');
    // Theory is the filter, so the lab row is not in the file either.
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r[3])).toEqual(['Data Structures', 'Operating Systems']);

    exportCsv.mockClear();
    fireEvent.click(screen.getAllByRole('button', { name: 'Download CSV' })[0]);
    const [, facultyHeaders, facultyRows] = exportCsv.mock.calls[0];
    expect(facultyHeaders).toContain('Theory without classroom');
    expect(facultyRows).toHaveLength(2);
  });

  it('refetches when the session changes', async () => {
    await renderPage();
    expect(getHodSubjects).toHaveBeenCalledWith({ dept: '', session: '' });

    fireEvent.change(screen.getByDisplayValue('2026-27 Odd'), { target: { value: '2025-26 Even' } });

    await waitFor(() => {
      expect(getHodSubjects).toHaveBeenLastCalledWith({ dept: '', session: '2025-26 Even' });
    });
  });
});
