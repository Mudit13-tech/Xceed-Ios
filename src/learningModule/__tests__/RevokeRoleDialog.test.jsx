import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The dialog behind the "remove role" action in both lm-admin directories.
 *
 * What is worth pinning here is the guard rail rather than the write: the
 * button is disabled until the account's name has been typed, and it is the
 * *current* row's name — a dialog reopened on a second row carrying the first
 * row's typed confirmation is exactly how the wrong account loses a role.
 */

const adminRevokeFaculty = vi.fn();
const adminRevokeStudent = vi.fn();

vi.mock('../api/lmApi', () => ({
  default: {
    adminRevokeFaculty: (...a) => adminRevokeFaculty(...a),
    adminRevokeStudent: (...a) => adminRevokeStudent(...a),
  },
}));

const person = {
  _id: 's1',
  name: 'Aarav Gupta',
  email: 'aarav@nitj.ac.in',
  dept: 'Computer Science and Engineering',
  classCount: 2,
};

const result = { name: 'Aarav Gupta', rolesLeft: [], hasNoRolesLeft: true, enrolmentsEnded: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  adminRevokeStudent.mockResolvedValue(result);
  adminRevokeFaculty.mockResolvedValue({ ...result, ownedClasses: 0 });
});

const open = async (props = {}) => {
  const { default: RevokeRoleDialog } = await import('../components/RevokeRoleDialog');
  return renderWithProviders(
    <RevokeRoleDialog
      role="STUDENT"
      person={person}
      isOpen
      onClose={() => {}}
      onDone={() => {}}
      {...props}
    />,
  );
};

describe('RevokeRoleDialog', () => {
  it('says what the revocation leaves behind, not only what it takes', async () => {
    await open();
    expect(await screen.findByText(/Remove the STUDENT role/i)).toBeInTheDocument();
    expect(screen.getByText(/What this does not touch/i)).toBeInTheDocument();
    expect(screen.getByText(/Their account, and every other role on it\./i)).toBeInTheDocument();
  });

  it('keeps the button disabled until the account name is typed', async () => {
    await open();
    const confirm = await screen.findByRole('button', { name: /Remove STUDENT/i });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Aarav Gupta'), { target: { value: 'Aarav' } });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Aarav Gupta'), { target: { value: 'Aarav Gupta' } });
    expect(confirm).toBeEnabled();
  });

  it('leaves the enrolments alone unless the box is ticked', async () => {
    await open();
    fireEvent.change(await screen.findByPlaceholderText('Aarav Gupta'), {
      target: { value: 'Aarav Gupta' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Remove STUDENT/i }));

    await waitFor(() => expect(adminRevokeStudent).toHaveBeenCalledWith('s1', { endEnrolments: false }));
  });

  it('passes the enrolment option through when it is', async () => {
    await open();
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.change(screen.getByPlaceholderText('Aarav Gupta'), {
      target: { value: 'Aarav Gupta' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Remove STUDENT/i }));

    await waitFor(() => expect(adminRevokeStudent).toHaveBeenCalledWith('s1', { endEnrolments: true }));
  });

  it('offers no enrolment option on the faculty side, where it would not work', async () => {
    // A faculty member's standing in the classes they own comes off the class,
    // not a membership, so the checkbox would promise what it cannot carry out.
    await open({ role: 'FACULTY' });
    expect(await screen.findByText(/Remove the FACULTY role/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('surfaces a refusal instead of reporting a revocation that did not happen', async () => {
    adminRevokeStudent.mockRejectedValue(new Error('That account does not hold STUDENT.'));
    const onDone = vi.fn();
    await open({ onDone });

    fireEvent.change(await screen.findByPlaceholderText('Aarav Gupta'), {
      target: { value: 'Aarav Gupta' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Remove STUDENT/i }));

    expect(await screen.findByText(/does not hold STUDENT/i)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
