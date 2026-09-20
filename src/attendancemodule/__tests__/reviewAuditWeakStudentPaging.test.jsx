import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ReviewAuditPanel } from '../confidenceMonitor';

// The weakly-recognised list is ranked worst-first and can be long. It shows
// ten per semester and pages the rest in, so a coordinator gets the students
// worth acting on without a wall of rows — and each semester pages on its own,
// because opening one is not a reason to open the others.

const student = (n, { weakPeriods = 1 } = {}) => ({
  rollNo: `21CS${String(n).padStart(3, '0')}`,
  batch: 'BTECH-ECE-2023',
  semester: '5',
  seen: 10,
  green: 2,
  yellow: 8,
  low: 0,
  greenPct: 20,
  yellowPct: 80,
  lowPct: 0,
  periodsSeen: weakPeriods,
  weakPeriods,
  periods: [{ timeSlot: '09:00-10:00', rooms: ['LT103'], subjects: ['DSP'], seen: 10, green: 2, yellow: 8, low: 0, weak: true }],
});

const group = (semester, count) => ({
  semester,
  weakStudents: count,
  yellow: count * 8,
  green: count * 2,
  students: Array.from({ length: count }, (_, i) => ({
    ...student(i + 1),
    semester,
    rollNo: `${semester}-${String(i + 1).padStart(3, '0')}`,
  })),
});

const audit = (weakStudents) => ({
  from: '2026-07-21',
  days: 60,
  zoneFrom: '2026-09-12',
  zoneDays: 7,
  minReviews: 3,
  departments: [{
    department: 'CSE',
    alwaysReview: [],
    repeatReview: [],
    classes: [],
    periods: [],
    weakStudents,
  }],
  stats: {
    departments: 1,
    alwaysReviewStudents: 0,
    repeatReviewRows: 0,
    flaggedClasses: 0,
    flaggedStudentRows: 0,
    periodsScanned: 0,
    weakPeriods: 0,
    zoneDays: 7,
    weakStudents: weakStudents.reduce((n, g) => n + g.students.length, 0),
    studentsScanned: 0,
  },
});

function mountWith(weakStudents) {
  global.fetch = vi.fn((url) => {
    const body = String(url).includes('review-audit') ? audit(weakStudents) : { periods: [] };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  });
  return render(
    <MemoryRouter>
      <ReviewAuditPanel fixedDepartment="CSE" showToast={() => {}} />
    </MemoryRouter>,
  );
}

/** The roll numbers currently rendered under one semester heading. */
function rollsUnder(semester) {
  const heading = screen.getByText(new RegExp(`^Semester ${semester}$`));
  const block = heading.closest('div').parentElement;
  return within(block)
    .getAllByRole('row')
    .slice(1)                       // drop the header row
    .map((tr) => within(tr).getAllByRole('cell')[0].textContent);
}

afterEach(() => { vi.restoreAllMocks(); });

describe('paging the weakly recognised students', () => {
  it('shows only the first ten of a long semester', async () => {
    mountWith([group('5', 25)]);
    await screen.findByText(/^Semester 5$/);
    expect(rollsUnder('5')).toHaveLength(10);
    // Ranked worst-first, so the first ten are the ones to act on.
    expect(rollsUnder('5')[0]).toBe('5-001');
  });

  it('says how many it is showing and how many are hidden', async () => {
    mountWith([group('5', 25)]);
    expect(await screen.findByText(/showing 10 of 25 students/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show 10 more — 15 still hidden/ }))
      .toBeInTheDocument();
  });

  it('reveals ten more per click', async () => {
    mountWith([group('5', 25)]);
    await screen.findByText(/^Semester 5$/);

    fireEvent.click(screen.getByRole('button', { name: /Show 10 more/ }));
    await waitFor(() => expect(rollsUnder('5')).toHaveLength(20));

    // Last page is short, and the button says so rather than promising ten.
    fireEvent.click(screen.getByRole('button', { name: /Show 5 more — 5 still hidden/ }));
    await waitFor(() => expect(rollsUnder('5')).toHaveLength(25));
  });

  it('drops the button once everything is shown', async () => {
    mountWith([group('5', 12)]);
    await screen.findByText(/^Semester 5$/);
    fireEvent.click(screen.getByRole('button', { name: /Show 2 more/ }));
    await waitFor(() => expect(rollsUnder('5')).toHaveLength(12));
    expect(screen.queryByRole('button', { name: /Show .* more/ })).not.toBeInTheDocument();
  });

  it('does not page a semester that fits', async () => {
    mountWith([group('5', 4)]);
    expect(await screen.findByText(/4 students/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show .* more/ })).not.toBeInTheDocument();
  });

  it('pages each semester on its own', async () => {
    mountWith([group('3', 25), group('5', 25)]);
    await screen.findByText(/^Semester 3$/);
    expect(rollsUnder('3')).toHaveLength(10);
    expect(rollsUnder('5')).toHaveLength(10);

    const [firstButton] = screen.getAllByRole('button', { name: /Show 10 more/ });
    fireEvent.click(firstButton);

    await waitFor(() => expect(rollsUnder('3')).toHaveLength(20));
    expect(rollsUnder('5')).toHaveLength(10);      // untouched
  });
});

// The panel filters the departments it renders. That filter used to test only
// the two strictest cuts — never present in any run, and flagged three times
// inside one subject — so a department whose only signal was a flagged class,
// a weak period or a weakly recognised student was dropped before render and
// every section below showed its empty state. Same shape as the server-side
// bug in getReviewAudit, one layer later, and fixing only the server left the
// page just as blank.

describe('a department is kept for any cut, not just the strict two', () => {
  it('renders a department whose only signal is weakly recognised students', async () => {
    mountWith([group('5', 3)]);
    expect(await screen.findByText(/^Semester 5$/)).toBeInTheDocument();
    expect(rollsUnder('5')).toHaveLength(3);
  });

  it('filters the weak-student rows by the roll-number search', async () => {
    mountWith([group('5', 25)]);
    await screen.findByText(/^Semester 5$/);

    fireEvent.change(screen.getByPlaceholderText(/roll/i), { target: { value: '5-007' } });

    await waitFor(() => expect(rollsUnder('5')).toEqual(['5-007']));
    // One match is not ten, so nothing is left to page.
    expect(screen.queryByRole('button', { name: /Show .* more/ })).not.toBeInTheDocument();
  });

  it('drops the department when the search matches nobody', async () => {
    mountWith([group('5', 25)]);
    await screen.findByText(/^Semester 5$/);
    fireEvent.change(screen.getByPlaceholderText(/roll/i), { target: { value: 'nobody' } });
    await waitFor(() =>
      expect(screen.queryByText(/^Semester 5$/)).not.toBeInTheDocument());
  });
});
