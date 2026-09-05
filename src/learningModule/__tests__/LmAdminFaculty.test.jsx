import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../test/renderWithProviders';

const adminListFaculty = vi.fn();
const adminCreateFaculty = vi.fn();
const adminFacultyImportPreview = vi.fn();
const adminImportFaculty = vi.fn();
const ttBranches = vi.fn();

vi.mock('../api/lmApi', () => ({
  default: {
    adminListFaculty: (...a) => adminListFaculty(...a),
    adminCreateFaculty: (...a) => adminCreateFaculty(...a),
    adminFacultyImportPreview: (...a) => adminFacultyImportPreview(...a),
    adminImportFaculty: (...a) => adminImportFaculty(...a),
    ttBranches: (...a) => ttBranches(...a),
  },
}));

// Already ordered the way the server returns it: department first, and within a
// department the account opened first at the top. The page must not re-sort it.
const sampleData = {
  totals: {
    faculty: 3,
    claimedFaculty: 1,
    classes: 4,
    activeClasses: 2,
    departments: [
      { dept: 'Computer Science and Engineering', count: 2, claimed: 1 },
      { dept: 'Civil Engineering', count: 1, claimed: 0 },
    ],
  },
  faculty: [
    {
      _id: 'f1',
      name: 'Dr Older Account',
      email: 'older@nitj.ac.in',
      dept: 'Computer Science and Engineering',
      createdAt: '2023-01-15T10:00:00.000Z',
      classCount: 3,
      claimed: true,
    },
    {
      _id: 'f2',
      name: 'Dr Newer Account',
      email: 'newer@nitj.ac.in',
      dept: 'Computer Science and Engineering',
      createdAt: '2025-06-01T10:00:00.000Z',
      classCount: 0,
      claimed: false,
    },
    {
      _id: 'f3',
      name: 'Dr Civil',
      email: 'civil@nitj.ac.in',
      dept: 'Civil Engineering',
      createdAt: '2024-03-09T10:00:00.000Z',
      classCount: 1,
      claimed: false,
    },
  ],
  truncated: false,
};

const samplePreview = {
  departments: [
    { dept: 'Civil Engineering', total: 8, alreadyInvited: 8, pending: 0 },
    { dept: 'Computer Science and Engineering', total: 12, alreadyInvited: 2, pending: 10 },
  ],
  totals: { total: 20, alreadyInvited: 10, pending: 10, withoutEmail: 3, duplicates: 1 },
};

beforeEach(() => {
  vi.clearAllMocks();
  adminListFaculty.mockResolvedValue(sampleData);
  adminFacultyImportPreview.mockResolvedValue(samplePreview);
  adminImportFaculty.mockResolvedValue({
    imported: 10,
    roleAdded: 0,
    alreadyInvited: 2,
    failed: 0,
    skippedWithoutEmail: 3,
    skippedDuplicates: 1,
  });
  ttBranches.mockResolvedValue([{ code: 'CSE', dept: 'Computer Science and Engineering' }]);
});

const load = async () => {
  const { default: LmAdminFaculty } = await import('../pages/LmAdminFaculty');
  renderWithProviders(<LmAdminFaculty />);
  return screen.findByText('Faculty accounts');
};

describe('LmAdminFaculty directory', () => {
  it('groups the rows under department headings', async () => {
    await load();
    // The heading carries its own claimed count, so a department can be read
    // without adding up the badges under it.
    expect(await screen.findByText(/2 shown · 1 claimed/)).toBeInTheDocument();
    expect(screen.getByText(/1 shown · 0 claimed/)).toBeInTheDocument();
  });

  it('keeps the server order — oldest account first inside a department', async () => {
    await load();
    const rows = screen.getAllByRole('row').map((row) => row.textContent);
    const older = rows.findIndex((text) => text.includes('older@nitj.ac.in'));
    const newer = rows.findIndex((text) => text.includes('newer@nitj.ac.in'));
    expect(older).toBeGreaterThan(-1);
    expect(older).toBeLessThan(newer);
  });

  it('shows when each account was added', async () => {
    await load();
    expect(screen.getByText(/15 Jan 2023/)).toBeInTheDocument();
  });

  it('reports the claimed status of each account', async () => {
    await load();
    expect(screen.getAllByText('active')).toHaveLength(1);
    expect(screen.getAllByText('not claimed')).toHaveLength(2);
  });

  it('asks the server for one department when a chip is clicked', async () => {
    // Filtering server-side rather than in the page, so the filter still finds
    // people past the row cap.
    await load();
    await userEvent.click(await screen.findByRole('button', { name: /Civil Engineering \(0\/1\)/ }));
    await waitFor(() =>
      expect(adminListFaculty).toHaveBeenLastCalledWith({ q: '', dept: 'Civil Engineering' }),
    );
  });
});

describe('LmAdminFaculty import from master faculty', () => {
  it('leads with one button for every department', async () => {
    await load();
    expect(await screen.findByRole('button', { name: /Import all 10 faculty/ })).toBeInTheDocument();
  });

  it('says how many are already invited and why some rows cannot be', async () => {
    await load();
    expect(await screen.findByText(/3 do not and cannot be invited/)).toBeInTheDocument();
    expect(screen.getByText(/10 already have an account and are skipped/)).toBeInTheDocument();
  });

  it('imports every department when the main button is pressed', async () => {
    await load();
    await userEvent.click(await screen.findByRole('button', { name: /Import all 10 faculty/ }));
    await waitFor(() =>
      expect(adminImportFaculty).toHaveBeenCalledWith('', { sendMail: true }),
    );
    // The directory and the preview both move — the accounts are new in one and
    // no longer pending in the other.
    await waitFor(() => expect(adminFacultyImportPreview).toHaveBeenCalledTimes(2));
  });

  it('imports a single department from its own chip', async () => {
    await load();
    await userEvent.click(
      await screen.findByRole('button', { name: /Computer Science and Engineering · 10 to invite/ }),
    );
    await waitFor(() =>
      expect(adminImportFaculty).toHaveBeenCalledWith(
        'Computer Science and Engineering',
        { sendMail: true },
      ),
    );
  });

  it('opens the accounts without mailing anybody when the email box is unticked', async () => {
    // The accounts exist either way — the mail only carries the link that lets
    // somebody claim one — so a department seeded ahead of a term can be
    // imported now and told later.
    await load();
    await userEvent.click(
      await screen.findByRole('checkbox', { name: /Email each new faculty member/ }),
    );
    await userEvent.click(await screen.findByRole('button', { name: /Import all 10 faculty/ }));
    await waitFor(() =>
      expect(adminImportFaculty).toHaveBeenCalledWith('', { sendMail: false }),
    );
  });

  it('offers no button for a department whose people all have accounts', async () => {
    await load();
    const done = await screen.findByRole('button', { name: /Civil Engineering · all invited/ });
    expect(done).toBeDisabled();
  });

  it('stays out of the way when the master faculty list cannot be read', async () => {
    // The timetable module having no master table is not this screen's failure;
    // the form below still works.
    adminFacultyImportPreview.mockRejectedValue(new Error('nope'));
    await load();
    await waitFor(() =>
      expect(screen.queryByText('Import from timetable master faculty')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Add a faculty member')).toBeInTheDocument();
  });
});
