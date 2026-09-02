import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';
import Timetable from '../pages/Timetable';

/**
 * Tests for the student timetable view (Issue #2065, PR #2082).
 * Verifies that:
 * - The student view pre-fills their suggested department and semester.
 * - The quick picker ("My Registered Semesters") and main selectors synchronize.
 * - Fallback to saved class timetable works when locked timetable is empty.
 * - Authorization Bearer tokens are attached to API requests for mobile WebView/PWA support.
 * - Coordinator notes, unpublished warnings, and empty states display correctly.
 * - Teachers can view both the faculty schedule and student semester timetables.
 */

const timetableOptions = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    timetableOptions: (...args) => timetableOptions(...args),
  },
}));

let me = { roles: ['STUDENT'], email: 's@nitj.ac.in' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useOutletContext: () => ({ me }) };
});

vi.mock('../components/TimetableWidget', () => ({
  default: () => <div>faculty widget</div>,
}));

const mockOptions = (overrides = {}) => ({
  suggested: { dept: 'ECE', sem: '6' },
  basis: [
    { dept: 'ECE', sem: '6', subjects: 5 },
    { dept: 'ME', sem: '6', subjects: 1 },
  ],
  enrolledCount: 6,
  depts: ['CSE', 'Electronics and Communication Engineering', 'ME'],
  semsByDept: {
    'Electronics and Communication Engineering': ['4', '6'],
    CSE: ['2'],
    ME: ['6'],
  },
  sessions: [
    {
      dept: 'Electronics and Communication Engineering',
      session: '2024-25',
      code: 'ECE24',
      published: true,
    },
    { dept: 'CSE', session: '2024-25', code: 'CSE24', published: true },
    { dept: 'ME', session: '2024-25', code: 'ME24', published: false },
  ],
  ...overrides,
});

const mockTimetableData = {
  timetableData: {
    Monday: {
      period1: [[{ subject: 'DSP', faculty: 'Dr. RK', room: 'L-204' }]],
    },
    Tuesday: {
      period2: [[{ subject: 'VLSI', faculty: 'Dr. SR', room: 'L-101' }]],
    },
  },
  notes: ['Batch A in Lab 1', 'Class starts at 8:30 AM'],
};

const mockSubjects = [
  {
    subName: 'DSP',
    subCode: 'ECPC-301',
    subjectFullName: 'Digital Signal Processing',
    type: 'Theory',
    sem: '6',
  },
  {
    subName: 'VLSI',
    subCode: 'ECPC-302',
    subjectFullName: 'VLSI Design',
    type: 'Theory',
    sem: '6',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  me = { roles: ['STUDENT'], email: 's@nitj.ac.in' };
  localStorage.setItem('token', 'mock-token-xyz');

  // Mock global fetch for timetable endpoints
  global.fetch = vi.fn().mockImplementation((url) => {
    const urlStr = String(url);
    if (urlStr.includes('/timetablemodule/lock/lockclasstt/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTimetableData),
      });
    }
    if (urlStr.includes('/timetablemodule/tt/viewclasstt/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTimetableData),
      });
    }
    if (urlStr.includes('/timetablemodule/subject/subjectdetails/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSubjects),
      });
    }
    if (urlStr.includes('/timetablemodule/timetable/alldetails/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ code: 'ECE24', session: '2024-25' }),
      });
    }
    if (urlStr.includes('/timetablemodule/lock/viewsem/')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            updatedTime: { lockTimeIST: '15/01/2025, 10:30:00 AM' },
          }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });
});

describe('student timetable page', () => {
  it('opens pre-filled on the suggested department (matching acronym) and semester', async () => {
    timetableOptions.mockResolvedValue(mockOptions());

    renderWithProviders(<Timetable />);

    // Waits for the prefilled department and semester to load
    await waitFor(() => {
      expect(
        screen.getByDisplayValue('Electronics and Communication Engineering'),
      ).toBeTruthy();
      expect(screen.getByDisplayValue('6')).toBeTruthy();
    });

    // Renders timetable classes
    expect(await screen.findAllByText('DSP')).not.toHaveLength(0);
    expect(screen.getAllByText('VLSI').length).toBeGreaterThan(0);

    // Checks that fetch sent Authorization Bearer token
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/timetablemodule/lock/lockclasstt/ECE24/6'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token-xyz',
        }),
      }),
    );
  });

  it('allows switching semesters via the Registered Semesters quick picker', async () => {
    timetableOptions.mockResolvedValue(mockOptions());

    renderWithProviders(<Timetable />);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue('Electronics and Communication Engineering'),
      ).toBeTruthy();
    });

    const selects = screen.getAllByRole('combobox');
    const registeredSelect = selects[0];

    // Switch to ME Semester 6
    fireEvent.change(registeredSelect, { target: { value: 'ME|6' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('ME')).toBeTruthy();
      expect(screen.getByDisplayValue('6')).toBeTruthy();
    });
  });

  it('falls back to saved class timetable if locked timetable is empty', async () => {
    timetableOptions.mockResolvedValue(mockOptions());

    // Make lockclasstt return empty, and viewclasstt return active classes
    global.fetch = vi.fn().mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/timetablemodule/lock/lockclasstt/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ timetableData: {}, notes: [] }),
        });
      }
      if (urlStr.includes('/timetablemodule/tt/viewclasstt/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTimetableData),
        });
      }
      if (urlStr.includes('/timetablemodule/subject/subjectdetails/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSubjects),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    renderWithProviders(<Timetable />);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue('Electronics and Communication Engineering'),
      ).toBeTruthy();
    });

    // Classes should still display via fallback
    expect(await screen.findAllByText('DSP')).not.toHaveLength(0);
    expect(
      await screen.findByText(/Showing active saved class schedule/i),
    ).toBeTruthy();
  });

  it('renders coordinator notes when present', async () => {
    timetableOptions.mockResolvedValue(mockOptions());

    renderWithProviders(<Timetable />);

    expect(await screen.findByText(/Batch A in Lab 1/i)).toBeTruthy();
    expect(await screen.findByText(/Class starts at 8:30 AM/i)).toBeTruthy();
  });

  it('warns that an unpublished timetable may still change', async () => {
    timetableOptions.mockResolvedValue(
      mockOptions({
        suggested: { dept: 'ME', sem: '6' },
      }),
    );

    renderWithProviders(<Timetable />);

    expect(
      await screen.findByText(/has not been published yet/i),
    ).toBeTruthy();
  });

  it('says why nothing was pre-filled when no class carries a department', async () => {
    timetableOptions.mockResolvedValue(
      mockOptions({ suggested: null, basis: [], enrolledCount: 2 }),
    );

    renderWithProviders(<Timetable />);

    expect(
      await screen.findByText(/None of your classes has a department/i),
    ).toBeTruthy();
  });

  it('lets a teacher toggle between their own schedule and the student one', async () => {
    me = { roles: ['FACULTY'], email: 't@nitj.ac.in' };
    timetableOptions.mockResolvedValue(mockOptions());

    renderWithProviders(<Timetable />);

    const mine = await screen.findByRole('button', { name: 'My Schedule' });
    const student = screen.getByRole('button', { name: 'Student Schedule' });

    // A teacher lands on their own schedule, and the control says so.
    expect(await screen.findByText('faculty widget')).toBeTruthy();
    expect(mine.getAttribute('aria-pressed')).toBe('true');
    expect(student.getAttribute('aria-pressed')).toBe('false');

    // Across to the student semester timetable.
    fireEvent.click(student);
    expect(await screen.findByText('Department')).toBeTruthy();
    expect(screen.queryByText('faculty widget')).toBeNull();
    expect(student.getAttribute('aria-pressed')).toBe('true');
    expect(mine.getAttribute('aria-pressed')).toBe('false');

    // ...and back again. The half of the control that was selected used to be a
    // dead button that set the state it was already in, so this leg is the one
    // that regressed silently.
    fireEvent.click(mine);
    expect(await screen.findByText('faculty widget')).toBeTruthy();
    expect(mine.getAttribute('aria-pressed')).toBe('true');
  });

  it('gives a student the semester timetable and no schedule toggle', async () => {
    me = { roles: ['STUDENT'], email: 's@nitj.ac.in' };
    timetableOptions.mockResolvedValue(mockOptions());

    renderWithProviders(<Timetable />);

    expect(await screen.findByText('Department')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'My Schedule' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Student Schedule' })).toBeNull();
  });
});
