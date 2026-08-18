import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';
import Timetable from '../pages/Timetable';
import TimetableGrid from '../components/TimetableGrid';

/**
 * The two things a student notices about this page: whether it opened on their
 * own timetable, and whether it fits the screen.
 *
 * The old version failed the first by passing a department where the API wanted a
 * session code, so every student got "No timetable available" — which is also why
 * "renders without crashing" is not a useful test here. What matters is that the
 * dropdowns come back pre-filled from the student's enrolments and that the fetch
 * uses those values.
 */

const timetableOptions = vi.fn();
const timetableGrid = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    timetableOptions: (...args) => timetableOptions(...args),
    timetableGrid: (...args) => timetableGrid(...args),
  },
}));

/* Mutable so one test can be a teacher; `vi.mock` is hoisted, so the mock has to
   read a variable rather than close over a value. */
let me = { roles: ['STUDENT'], email: 's@nitj.ac.in' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useOutletContext: () => ({ me }) };
});

/* The faculty widget fetches on mount against the real `fetch`. This page is not
   the place to exercise it, so it stands in as a marker. */
vi.mock('../components/TimetableWidget', () => ({
  default: () => <div>faculty widget</div>,
}));

const options = (overrides = {}) => ({
  suggested: { dept: 'ECE', sem: '6' },
  basis: [
    { dept: 'ECE', sem: '6', subjects: 5 },
    { dept: 'ME', sem: '6', subjects: 1 },
  ],
  enrolledCount: 6,
  depts: ['CSE', 'ECE', 'ME'],
  semsByDept: { ECE: ['4', '6'], CSE: ['2'], ME: ['6'] },
  sessions: [],
  ...overrides,
});

const grid = (overrides = {}) => ({
  found: true,
  dept: 'ECE',
  sem: '6',
  session: { code: 'ECE24', session: '2024-25', published: true },
  days: ['Monday', 'Tuesday'],
  slots: [
    { key: 'period1', label: 'Period 1' },
    { key: 'period2', label: 'Period 2' },
  ],
  cells: {
    'Monday|period1': [{ subject: 'DSP', faculty: 'R Kumar', room: 'L-204' }],
    'Tuesday|period2': [{ subject: 'VLSI', faculty: 'S Rao', room: 'L-101' }],
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  me = { roles: ['STUDENT'], email: 's@nitj.ac.in' };
});

describe('student timetable page', () => {
  it('opens pre-filled on the suggestion and fetches that timetable', async () => {
    timetableOptions.mockResolvedValue(options());
    timetableGrid.mockResolvedValue(grid());

    renderWithProviders(<Timetable />);

    await waitFor(() => expect(timetableGrid).toHaveBeenCalledWith('ECE', '6'));

    const [deptSelect, semSelect] = screen.getAllByRole('combobox');
    expect(deptSelect.value).toBe('ECE');
    expect(semSelect.value).toBe('6');
    // Both classes appear, so the grid is reading the flat `day|slot` map right.
    expect(await screen.findAllByText('DSP')).not.toHaveLength(0);
    expect(screen.getAllByText('VLSI').length).toBeGreaterThan(0);
  });

  it('offers only the semesters the chosen department has, and re-picks on change', async () => {
    timetableOptions.mockResolvedValue(options());
    timetableGrid.mockResolvedValue(grid());

    renderWithProviders(<Timetable />);
    await waitFor(() => expect(timetableGrid).toHaveBeenCalledWith('ECE', '6'));

    const [deptSelect, semSelect] = screen.getAllByRole('combobox');
    // ECE offers 4 and 6; semester 2 belongs to CSE and must not be listed here.
    expect([...semSelect.options].map((option) => option.value)).toEqual(['4', '6']);

    fireEvent.change(deptSelect, { target: { value: 'CSE' } });

    // Semester 6 does not exist in CSE, so leaving it selected would fetch a
    // combination the dropdowns never offered. It moves to CSE's only semester.
    await waitFor(() => expect(semSelect.value).toBe('2'));
    await waitFor(() => expect(timetableGrid).toHaveBeenCalledWith('CSE', '2'));
  });

  it('says why nothing was pre-filled when no class carries a department', async () => {
    timetableOptions.mockResolvedValue(
      options({ suggested: null, basis: [], enrolledCount: 2 }),
    );
    timetableGrid.mockResolvedValue(grid());

    renderWithProviders(<Timetable />);

    expect(await screen.findByText(/None of your classes has a department/i)).toBeTruthy();
  });

  it('warns that an unpublished timetable may still change', async () => {
    timetableOptions.mockResolvedValue(options());
    timetableGrid.mockResolvedValue(
      grid({ session: { code: 'ECE24', session: '2024-25', published: false } }),
    );

    renderWithProviders(<Timetable />);

    expect(await screen.findByText(/has not been published yet/i)).toBeTruthy();
  });

  it("shows the server's explanation instead of a bare empty state", async () => {
    timetableOptions.mockResolvedValue(options());
    timetableGrid.mockResolvedValue({
      found: false,
      message: 'No live timetable session for ECE.',
      dept: 'ECE',
      sem: '6',
    });

    renderWithProviders(<Timetable />);

    // The old view said "No timetable available" for a bug in its own query. If it
    // is genuinely missing, the reason has to reach the reader.
    expect(await screen.findByText(/No live timetable session for ECE/)).toBeTruthy();
  });

  it('surfaces a failed fetch rather than an empty week', async () => {
    timetableOptions.mockResolvedValue(options());
    timetableGrid.mockRejectedValue(new Error('Server unreachable'));

    renderWithProviders(<Timetable />);

    expect(await screen.findByText('Server unreachable')).toBeTruthy();
  });

  it('leaves a teacher on the existing faculty widget', async () => {
    me = { roles: ['FACULTY'], email: 't@nitj.ac.in' };

    renderWithProviders(<Timetable />);

    // The faculty timetable is keyed by name against the session, that path
    // already resolved its session correctly, and it was not what was reported.
    expect(await screen.findByText('faculty widget')).toBeTruthy();
    expect(timetableOptions).not.toHaveBeenCalled();
    expect(timetableGrid).not.toHaveBeenCalled();
  });
});

describe('timetable grid layout', () => {
  const props = {
    days: ['Monday', 'Tuesday'],
    slots: [
      { key: 'period1', label: 'Period 1' },
      { key: 'lunch', label: 'Lunch' },
    ],
    cells: {
      'Monday|period1': [{ subject: 'DSP', faculty: 'R Kumar', room: 'L-204' }],
    },
  };

  it('lays the week out as a grid with no horizontal scroll', () => {
    const { container } = renderWithProviders(<TimetableGrid {...props} />);

    // Chakra compiles style props to emotion classes, so the declaration is in an
    // injected stylesheet rather than on the element.
    const css = [...document.querySelectorAll('style')].map((tag) => tag.textContent).join('');

    // `minmax(0, 1fr)` per day, not a fixed `minW` per cell: without the zero
    // minimum a long subject name forces the column past its share and brings
    // back the sideways drag this replaces.
    expect(css).toContain('minmax(0, 0.7fr) repeat(2, minmax(0, 1fr))');
    // And nothing anywhere opts back into horizontal scrolling.
    expect(css).not.toMatch(/overflow-x:\s*(auto|scroll)/);
    expect(container.querySelector('[style*="overflow-x"]')).toBeNull();
  });

  it('renders both layouts so neither flashes in on first paint', () => {
    renderWithProviders(<TimetableGrid {...props} />);

    // The grid heading and the phone stack both name the day, so it appears twice
    // — one copy hidden by breakpoint rather than by a width hook that has to
    // measure first.
    expect(screen.getAllByText('Monday').length).toBe(2);
  });

  it('marks a day with no classes as free instead of leaving it blank', () => {
    renderWithProviders(<TimetableGrid {...props} />);

    // Tuesday has a column but nothing in it. On the phone stack that has to read
    // as "free", not as a section that failed to load.
    expect(screen.getByText('free')).toBeTruthy();
    expect(screen.getByText('1 class')).toBeTruthy();
  });

  it('renders nothing at all when there is no week to show', () => {
    const { container } = renderWithProviders(
      <TimetableGrid days={[]} slots={[]} cells={{}} />,
    );
    // The page owns the empty state and explains it; a bordered empty frame here
    // would just be a second, less informative one.
    expect(container.textContent).toBe('');
  });
});
