import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

const adminListStudents = vi.fn();
const adminCreateStudent = vi.fn();
const ttBranches = vi.fn();

vi.mock('../api/lmApi', () => ({
  default: {
    adminListStudents: (...a) => adminListStudents(...a),
    adminCreateStudent: (...a) => adminCreateStudent(...a),
    ttBranches: (...a) => ttBranches(...a),
  },
}));

const sampleData = {
  totals: {
    students: 2,
    activeStudents: 1,
    classes: 3,
    departments: [
      { dept: 'Computer Science and Engineering', count: 1 },
      { dept: 'Information Technology', count: 1 },
    ],
  },
  students: [
    {
      _id: 's1',
      name: 'Aarav Gupta',
      email: 'aarav@nitj.ac.in',
      rollNumber: '21103001',
      dept: 'Computer Science and Engineering',
      classCount: 2,
      claimed: true,
    },
    {
      _id: 's2',
      name: 'Sneha Patel',
      email: 'sneha@nitj.ac.in',
      rollNumber: '21103002',
      dept: 'Information Technology',
      classCount: 1,
      claimed: false,
    },
  ],
  truncated: false,
};

const sampleBranches = [
  { code: 'CSE', dept: 'Computer Science and Engineering' },
  { code: 'IT', dept: 'Information Technology' },
];

beforeEach(() => {
  vi.clearAllMocks();
  adminListStudents.mockResolvedValue(sampleData);
  ttBranches.mockResolvedValue(sampleBranches);
});

describe('LmAdminStudents page', () => {
  it('renders student summary stats, department filters, and directory table', async () => {
    const { default: LmAdminStudents } = await import('../pages/LmAdminStudents');
    renderWithProviders(<LmAdminStudents />);

    expect(await screen.findByText(/Student accounts & enrollment/i)).toBeInTheDocument();
    expect(screen.getByText('Total students')).toBeInTheDocument();
    expect(screen.getByText('Active (Claimed)')).toBeInTheDocument();
    expect(screen.getByText('Total classes')).toBeInTheDocument();

    // Table rows
    expect(screen.getByText('Aarav Gupta')).toBeInTheDocument();
    expect(screen.getByText('aarav@nitj.ac.in')).toBeInTheDocument();
    expect(screen.getByText('21103001')).toBeInTheDocument();
    expect(screen.getByText('Sneha Patel')).toBeInTheDocument();
    expect(screen.getByText('sneha@nitj.ac.in')).toBeInTheDocument();
    expect(screen.getByText('21103002')).toBeInTheDocument();

    // Claimed badges
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('not claimed')).toBeInTheDocument();
  });

  it('filters by department when a department chip is clicked', async () => {
    const { default: LmAdminStudents } = await import('../pages/LmAdminStudents');
    renderWithProviders(<LmAdminStudents />);

    await screen.findByText('Aarav Gupta');

    const cseChip = screen.getByRole('button', { name: /Computer Science and Engineering \(1\)/i });
    fireEvent.click(cseChip);

    await waitFor(() => {
      expect(adminListStudents).toHaveBeenCalledWith({
        q: '',
        dept: 'Computer Science and Engineering',
      });
    });
  });

  it('searches for students via the search bar', async () => {
    const { default: LmAdminStudents } = await import('../pages/LmAdminStudents');
    renderWithProviders(<LmAdminStudents />);

    await screen.findByText('Aarav Gupta');

    const searchInput = screen.getByPlaceholderText(/Search name, email, roll/i);
    fireEvent.change(searchInput, { target: { value: 'Aarav' } });

    await waitFor(() => {
      expect(adminListStudents).toHaveBeenCalledWith({
        q: 'Aarav',
        dept: '',
      });
    });
  });

  it('creates a new student account and refreshes directory', async () => {
    adminCreateStudent.mockResolvedValue({
      student: {
        _id: 's3',
        name: 'Rohan Sharma',
        email: 'rohan@nitj.ac.in',
        dept: 'Computer Science and Engineering',
        rollNumber: '21103003',
        claimed: false,
      },
      created: true,
      roleAdded: false,
      mailQueued: true,
    });

    const { default: LmAdminStudents } = await import('../pages/LmAdminStudents');
    renderWithProviders(<LmAdminStudents />);

    await screen.findByText('Aarav Gupta');

    const nameInput = screen.getByPlaceholderText(/e\.g\. Rahul Sharma/i);
    const emailInput = screen.getByPlaceholderText(/student@nitj\.ac\.in/i);
    const rollInput = screen.getByPlaceholderText(/e\.g\. 21103001/i);

    fireEvent.change(nameInput, { target: { value: 'Rohan Sharma' } });
    fireEvent.change(emailInput, { target: { value: 'rohan@nitj.ac.in' } });
    fireEvent.change(rollInput, { target: { value: '21103003' } });

    const submitButton = screen.getByRole('button', { name: /Create student account/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(adminCreateStudent).toHaveBeenCalledWith({
        name: 'Rohan Sharma',
        email: 'rohan@nitj.ac.in',
        dept: '',
        rollNumber: '21103003',
      });
    });
  });

  it('displays inline error alert if student creation fails', async () => {
    adminCreateStudent.mockRejectedValue(new Error('That account already exists and is already a student.'));

    const { default: LmAdminStudents } = await import('../pages/LmAdminStudents');
    renderWithProviders(<LmAdminStudents />);

    await screen.findByText('Aarav Gupta');

    const nameInput = screen.getByPlaceholderText(/e\.g\. Rahul Sharma/i);
    const emailInput = screen.getByPlaceholderText(/student@nitj\.ac\.in/i);

    fireEvent.change(nameInput, { target: { value: 'Aarav Gupta' } });
    fireEvent.change(emailInput, { target: { value: 'aarav@nitj.ac.in' } });

    const submitButton = screen.getByRole('button', { name: /Create student account/i });
    fireEvent.click(submitButton);

    expect(await screen.findByText(/That account already exists and is already a student\./i)).toBeInTheDocument();
  });

  it('displays empty state when no students match filters', async () => {
    adminListStudents.mockResolvedValue({
      totals: { students: 0, activeStudents: 0, classes: 0, departments: [] },
      students: [],
      truncated: false,
    });

    const { default: LmAdminStudents } = await import('../pages/LmAdminStudents');
    renderWithProviders(<LmAdminStudents />);

    expect(await screen.findByText(/No student accounts yet/i)).toBeInTheDocument();
  });
});
