import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import lmApi from '../api/lmApi';
import People from '../pages/People';

/**
 * Adding a co-teacher — the timetable gate, as the teacher meets it.
 *
 * A co-teacher reads every answer key and every mark in the class, and until
 * now the only thing between a typo and that power was the address parsing. So
 * the address is checked against the timetable module's faculty list, and the
 * teacher is shown who it resolved to before anything is sent. A PhD scholar or
 * TA will never be on that list, so the unlisted case is not a refusal but an
 * approval the inviting teacher signs with a code mailed to their own address.
 *
 * These tests hold the three things the screen has to get right: one address at
 * a time, the readback, and that the approval step cannot be skipped past.
 */

vi.mock('../api/lmApi', () => ({
  default: {
    listMembers: vi.fn(),
    inviteMembers: vi.fn(),
    inviteStatus: vi.fn(),
    checkCoTeacherEmail: vi.fn(),
    requestCoTeacherCode: vi.fn(),
    updateMember: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({
      classId: 'c1',
      klass: { _id: 'c1', code: 'ABC123', subject: 'Digital Signal Processing', semester: '5', isOwner: true },
      isTeacher: true,
      reloadClass: vi.fn(),
    }),
  };
});

const renderPeople = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChakraProvider>
        <MemoryRouter>
          <People />
        </MemoryRouter>
      </ChakraProvider>
    </QueryClientProvider>,
  );

/* The Teachers card's own button. Named for the role it adds, so it cannot be
   confused with the Students one sitting a few lines below it. */
const openFacultyInvite = async () => {
  renderPeople();
  await screen.findByText(/Teachers \(0\)/);
  fireEvent.click(screen.getByRole('button', { name: /faculty invite/i }));
  return screen.findByRole('dialog');
};

const typeAddress = (dialog, value) =>
  fireEvent.change(within(dialog).getByLabelText(/faculty email address/i), { target: { value } });

describe('inviting a co-teacher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lmApi.listMembers.mockResolvedValue({ teachers: [], students: [] });
  });

  it('asks for one address, not a list', async () => {
    const dialog = await openFacultyInvite();

    const field = within(dialog).getByLabelText(/faculty email address/i);
    expect(field.tagName).toBe('INPUT');
    expect(dialog.textContent).toMatch(/one co-teacher at a time/i);
    // The student advice — share the class code, invite the rest by ID — is
    // about a roster, and there is no roster here.
    expect(dialog.textContent).not.toMatch(/Individual student IDs only/i);
  });

  it('reads back who the address resolves to in the timetable', async () => {
    lmApi.checkCoTeacherEmail.mockResolvedValue({
      email: 'asha.rao@nitj.ac.in',
      listed: true,
      faculty: { name: 'Asha Rao', designation: 'Assistant Professor', dept: 'CSE' },
      message: null,
    });
    const dialog = await openFacultyInvite();
    typeAddress(dialog, 'asha.rao@nitj.ac.in');

    await within(dialog).findByText(/Listed in the timetable faculty list/i);
    // The name is the point: an address that is one keystroke out resolves to
    // somebody else, and only the person who typed it can see that.
    expect(dialog.textContent).toMatch(/Asha Rao/);
    expect(dialog.textContent).toMatch(/Assistant Professor/);
  });

  it('explains an unlisted address and offers the coordinator and the OTP route', async () => {
    lmApi.checkCoTeacherEmail.mockResolvedValue({
      email: 'scholar@nitj.ac.in',
      listed: false,
      faculty: null,
      message:
        'This email ID is not listed in the timetable module’s faculty list. ' +
        'Please double-check the address for a typo. If it is correct and the person is faculty ' +
        'here, ask your timetable coordinator to add their email ID to the timetable module first.',
    });
    const dialog = await openFacultyInvite();
    typeAddress(dialog, 'scholar@nitj.ac.in');

    // Matched on the panel's own heading: the server's explanation quoted
    // below it says "not listed in the timetable" too.
    await within(dialog).findByText(/This faculty is not listed in the timetable/i);
    expect(dialog.textContent).toMatch(/double-check/i);
    expect(dialog.textContent).toMatch(/timetable coordinator/i);
    expect(dialog.textContent).toMatch(/PhD scholar or a TA/i);
    expect(within(dialog).getByRole('button', { name: /email me an approval code/i })).toBeEnabled();
  });

  it('will not send an unlisted invitation until the code is entered', async () => {
    lmApi.checkCoTeacherEmail.mockResolvedValue({ email: 'ta@nitj.ac.in', listed: false, faculty: null, message: 'not listed' });
    lmApi.requestCoTeacherCode.mockResolvedValue({ sent: true, email: 'ta@nitj.ac.in', sentTo: 'prof@nitj.ac.in' });
    lmApi.inviteMembers.mockResolvedValue({ results: [], batchId: null, mailPending: 0 });

    const dialog = await openFacultyInvite();
    typeAddress(dialog, 'ta@nitj.ac.in');
    await within(dialog).findByRole('button', { name: /email me an approval code/i });

    const send = within(dialog).getByRole('button', { name: /approve and invite/i });
    expect(send).toBeDisabled();

    fireEvent.click(within(dialog).getByRole('button', { name: /email me an approval code/i }));
    // The code goes to the teacher's own mailbox, never to the address being
    // added — it is the teacher's approval that is being asked for.
    await waitFor(() => expect(lmApi.requestCoTeacherCode).toHaveBeenCalledWith('c1', 'ta@nitj.ac.in'));
    await within(dialog).findByText(/prof@nitj\.ac\.in/);

    fireEvent.change(within(dialog).getByPlaceholderText(/6-digit code/i), { target: { value: '123456' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /approve and invite/i }));

    await waitFor(() =>
      expect(lmApi.inviteMembers).toHaveBeenCalledWith('c1', ['ta@nitj.ac.in'], 'co-teacher', '123456'),
    );
  });

  it('drops a code already in hand when the address is edited', async () => {
    lmApi.checkCoTeacherEmail.mockResolvedValue({ email: 'ta@nitj.ac.in', listed: false, faculty: null, message: 'not listed' });
    lmApi.requestCoTeacherCode.mockResolvedValue({ sent: true, email: 'ta@nitj.ac.in', sentTo: 'prof@nitj.ac.in' });

    const dialog = await openFacultyInvite();
    typeAddress(dialog, 'ta@nitj.ac.in');
    await within(dialog).findByRole('button', { name: /email me an approval code/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /email me an approval code/i }));
    fireEvent.change(await within(dialog).findByPlaceholderText(/6-digit code/i), { target: { value: '123456' } });

    // A code approves one named person. Typing a different address must not
    // leave the last approval sitting in the box ready to be spent on them.
    typeAddress(dialog, 'someone.else@nitj.ac.in');
    await waitFor(() => expect(within(dialog).getByPlaceholderText(/6-digit code/i)).toHaveValue(''));
    expect(within(dialog).getByRole('button', { name: /approve and invite/i })).toBeDisabled();
  });

  it('shows the server’s refusal when the address was never checked', async () => {
    lmApi.checkCoTeacherEmail.mockRejectedValue(new Error('offline'));
    const refusal = Object.assign(new Error('Not in the faculty list — ask your timetable coordinator.'), {
      payload: { code: 'CO_TEACHER_NOT_IN_TIMETABLE', message: 'Not in the faculty list — ask your timetable coordinator.' },
    });
    lmApi.inviteMembers.mockRejectedValue(refusal);

    const dialog = await openFacultyInvite();
    typeAddress(dialog, 'ta@nitj.ac.in');
    fireEvent.click(within(dialog).getByRole('button', { name: /send invite/i }));

    // The lookup failed, so the panel only appears because the invitation
    // itself came back refused — the gate is the server's, not the form's.
    await within(dialog).findByText(/not listed in the timetable/i);
    expect(within(dialog).getByRole('button', { name: /email me an approval code/i })).toBeInTheDocument();
  });
});

/**
 * The same gate, on the other door.
 *
 * "Make co-teacher" on the roster grants exactly what an invitation grants, so
 * a gate on the invite box alone would be worked around in a minute: enrol the
 * address as a student, which asks nothing of anybody, then promote it.
 */
describe('promoting a student to co-teacher', () => {
  const student = {
    _id: 'm1',
    name: 'Ravi (PhD)',
    email: 'scholar@nitj.ac.in',
    role: 'student',
    status: 'active',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    lmApi.listMembers.mockResolvedValue({ teachers: [], students: [student] });
  });

  const openPromote = async () => {
    renderPeople();
    await screen.findByText(/Ravi \(PhD\)/);
    // The row's overflow menu, labelled with the vertical ellipsis it shows.
    fireEvent.click(screen.getByRole('button', { name: '\u22EE' }));
    fireEvent.click(await screen.findByText('Make co-teacher'));
    return screen.findByRole('dialog');
  };

  it('asks for the approval code before an unlisted student may teach', async () => {
    lmApi.checkCoTeacherEmail.mockResolvedValue({ listed: false, faculty: null, message: 'not listed' });
    lmApi.requestCoTeacherCode.mockResolvedValue({ sent: true, sentTo: 'prof@nitj.ac.in' });
    lmApi.updateMember.mockResolvedValue({});

    const dialog = await openPromote();
    await within(dialog).findByText(/This faculty is not listed in the timetable/i);

    // The role is not written on the way to asking — the menu item opens this
    // dialog instead of promoting and then apologising.
    expect(lmApi.updateMember).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: /approve and promote/i })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole('button', { name: /email me an approval code/i }));
    fireEvent.change(await within(dialog).findByPlaceholderText(/6-digit code/i), { target: { value: '654321' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /approve and promote/i }));

    await waitFor(() =>
      expect(lmApi.updateMember).toHaveBeenCalledWith('c1', 'm1', { role: 'co-teacher', otp: '654321' }),
    );
  });

  it('promotes a listed faculty member with no code at all', async () => {
    lmApi.checkCoTeacherEmail.mockResolvedValue({
      listed: true,
      faculty: { name: 'Asha Rao', designation: 'Assistant Professor', dept: 'CSE' },
      message: null,
    });
    lmApi.updateMember.mockResolvedValue({});

    const dialog = await openPromote();
    await within(dialog).findByText(/Listed in the timetable faculty list/i);

    fireEvent.click(within(dialog).getByRole('button', { name: /make co-teacher/i }));

    await waitFor(() => expect(lmApi.updateMember).toHaveBeenCalledWith('c1', 'm1', { role: 'co-teacher' }));
  });
});
