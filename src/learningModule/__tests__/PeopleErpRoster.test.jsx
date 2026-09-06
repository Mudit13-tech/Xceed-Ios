import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import lmApi from '../api/lmApi';
import People from '../pages/People';

/**
 * Pulling a class roster out of the attendance module's ERP.
 *
 * The whole point of the flow is that it *fills the invite box* rather than
 * enrolling anybody: the attendance roster stores roll numbers, the server
 * resolves each to an address, and the faculty confirm the list before pressing
 * the same Send invites a typed address goes through. So what these tests hold
 * onto is the handover — that roll numbers are what the teacher is shown, that
 * addresses are what lands in the box, that somebody already in the class is
 * listed but not re-invited by default, and that nothing is sent by loading.
 *
 * The page carries the other half: a roster that has gained students since the
 * class was filled says so, by roll number, without anyone having to go
 * looking.
 */

vi.mock('../api/lmApi', () => ({
  default: {
    listMembers: vi.fn(),
    previewErpImport: vi.fn(),
    inviteMembers: vi.fn(),
    inviteStatus: vi.fn(),
  },
}));

/* The page takes its class off the outlet context, and this renders it outside
   the layout that supplies one. */
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

const ERP_ROSTER = {
  totalErp: 3,
  existingCount: 1,
  newCount: 2,
  subjectName: 'Digital Signal Processing',
  students: [
    { rollNo: '21103001', name: 'Asha Rao', email: 'asha.rao@nitj.ac.in', alreadyMember: false },
    { rollNo: '21103002', name: 'Vikram Iyer', email: '21103002@nitj.ac.in', alreadyMember: false },
    { rollNo: '21103003', name: 'Meera Nair', email: 'meera@nitj.ac.in', alreadyMember: true },
  ],
};

/** Opens the invite modal, which loads the roster on its own. */
const openInvite = async () => {
  renderPeople();
  await screen.findByText(/Students \(0\)/);
  fireEvent.click(screen.getByRole('button', { name: /invite students/i }));
  return screen.findByRole('dialog');
};

beforeEach(() => {
  vi.clearAllMocks();
  lmApi.listMembers.mockResolvedValue({ teachers: [], students: [] });
  lmApi.previewErpImport.mockResolvedValue(ERP_ROSTER);
});

describe('fetching a class roster from the ERP', () => {
  it('loads the roster as soon as the invite modal opens', async () => {
    await openInvite();

    await waitFor(() => expect(lmApi.previewErpImport).toHaveBeenCalledWith('c1'));
  });

  it('reads the roster once for the page and the modal together', async () => {
    const dialog = await openInvite();
    await within(dialog).findByText(/21103001 · Asha Rao/);

    // The notice on the page and the list in the modal are the same answer.
    // Asking the server twice for it is a second walk of the subject roster.
    expect(lmApi.previewErpImport).toHaveBeenCalledTimes(1);
  });

  it('shows the roll number against every student, which is what the ERP is keyed on', async () => {
    const dialog = await openInvite();

    await within(dialog).findByText(/21103001 · Asha Rao/);
    expect(within(dialog).getByText(/21103002 · Vikram Iyer/)).toBeTruthy();
    expect(within(dialog).getByText(/21103003 · Meera Nair/)).toBeTruthy();
  });

  it('pastes the resolved addresses into the email box, not the roll numbers', async () => {
    const dialog = await openInvite();
    await within(dialog).findByText(/21103001 · Asha Rao/);

    fireEvent.click(within(dialog).getByRole('button', { name: /add 2 addresses to the list/i }));

    const box = within(dialog).getByPlaceholderText(/one@nitj\.ac\.in/);
    expect(box.value).toContain('asha.rao@nitj.ac.in');
    // No mailID on the ERP record, so the server fell back to <roll>@nitj.ac.in
    // — an address, still, and that is what has to reach the box.
    expect(box.value).toContain('21103002@nitj.ac.in');
    expect(box.value).not.toMatch(/^21103001$/m);
  });

  it('leaves somebody already in the class listed but unticked', async () => {
    const dialog = await openInvite();
    await within(dialog).findByText(/21103003 · Meera Nair/);

    expect(within(dialog).getByText(/already in class/i)).toBeTruthy();
    // Two of the three are new, and the button counts what is actually ticked.
    expect(within(dialog).getByRole('button', { name: /add 2 addresses to the list/i })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: /add 2 addresses to the list/i }));
    expect(within(dialog).getByPlaceholderText(/one@nitj\.ac\.in/).value).not.toContain('meera@nitj.ac.in');
  });

  it('invites nobody until Send invites is pressed', async () => {
    const dialog = await openInvite();
    await within(dialog).findByText(/21103001 · Asha Rao/);
    fireEvent.click(within(dialog).getByRole('button', { name: /add 2 addresses to the list/i }));

    // Fetching and filling the box are not enrolment. The old flow enrolled
    // straight off its own button; this one cannot.
    expect(lmApi.inviteMembers).not.toHaveBeenCalled();

    lmApi.inviteMembers.mockResolvedValue({ results: [], batchId: null, mailPending: 0 });
    fireEvent.click(within(dialog).getByRole('button', { name: /send invites/i }));

    await waitFor(() =>
      expect(lmApi.inviteMembers).toHaveBeenCalledWith(
        'c1',
        ['asha.rao@nitj.ac.in', '21103002@nitj.ac.in'],
        'student',
      ),
    );
  });

  it('does not repeat an address the teacher has already typed', async () => {
    const dialog = await openInvite();
    await within(dialog).findByText(/21103001 · Asha Rao/);

    const box = within(dialog).getByPlaceholderText(/one@nitj\.ac\.in/);
    fireEvent.change(box, { target: { value: 'asha.rao@nitj.ac.in' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /add 2 addresses to the list/i }));

    expect(box.value.match(/asha\.rao@nitj\.ac\.in/g)).toHaveLength(1);
    expect(box.value).toContain('21103002@nitj.ac.in');
  });

  it('says what is wrong rather than showing an empty list when the subject has no roster', async () => {
    lmApi.previewErpImport.mockResolvedValue({
      totalErp: 0,
      existingCount: 0,
      newCount: 0,
      students: [],
      message: 'Subject "DSP" was found in Attendance ERP, but its enrolled student roster is empty.',
    });

    const dialog = await openInvite();

    await within(dialog).findByText(/its enrolled student roster is empty/i);
  });
});

describe('the page noticing the roster has changed', () => {
  it('names the roll numbers the ERP has and the class does not', async () => {
    renderPeople();

    await screen.findByText(/2 students on the ERP roster are not in this class/i);
    // The roll number is what a teacher recognises a missing student by — an
    // address they have never seen before means nothing to them.
    expect(screen.getByText(/21103001, 21103002/)).toBeTruthy();
  });

  it('leaves the inviting to the faculty rather than acting on it', async () => {
    renderPeople();
    await screen.findByText(/2 students on the ERP roster are not in this class/i);

    expect(lmApi.inviteMembers).not.toHaveBeenCalled();
    // The notice is a way in to the confirmation step, not a shortcut past it.
    fireEvent.click(screen.getByRole('button', { name: /review & invite/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /send invites/i })).toBeTruthy();
    expect(lmApi.inviteMembers).not.toHaveBeenCalled();
  });

  it('says nothing while the class already has everyone on the roster', async () => {
    lmApi.previewErpImport.mockResolvedValue({
      totalErp: 1,
      existingCount: 1,
      newCount: 0,
      students: [{ rollNo: '21103003', name: 'Meera Nair', email: 'meera@nitj.ac.in', alreadyMember: true }],
    });

    renderPeople();
    await screen.findByText(/Students \(0\)/);
    await waitFor(() => expect(lmApi.previewErpImport).toHaveBeenCalled());

    expect(screen.queryByText(/not in this class/i)).toBeNull();
  });

  it('abbreviates a long list rather than printing every number', async () => {
    lmApi.previewErpImport.mockResolvedValue({
      totalErp: 11,
      existingCount: 0,
      newCount: 11,
      students: Array.from({ length: 11 }, (_, i) => ({
        rollNo: `2110300${i}`,
        name: `Student ${i}`,
        email: `2110300${i}@nitj.ac.in`,
        alreadyMember: false,
      })),
    });

    renderPeople();

    await screen.findByText(/11 students on the ERP roster are not in this class/i);
    expect(screen.getByText(/and 3 more/)).toBeTruthy();
  });
});

describe('the guidance around the address box', () => {
  it('tells the teacher not to use a group ID, and what to use instead', async () => {
    const dialog = await openInvite();

    await within(dialog).findByText(/do not use a group ID/i);
    expect(
      within(dialog).getByText(/use individual IDs, fetch from the ERP, or share the class code/i),
    ).toBeTruthy();
  });

  it('names the two routes that do not need the ERP when the roster is empty', async () => {
    lmApi.previewErpImport.mockResolvedValue({
      totalErp: 0,
      existingCount: 0,
      newCount: 0,
      students: [],
      message: 'No matching subject record found in Attendance ERP.',
    });

    const dialog = await openInvite();

    await within(dialog).findByText(/individual addresses into the box below/i);
    // The class code itself, not just the phrase — a teacher reading this is
    // about to say it out loud.
    expect(within(dialog).getByText('ABC123')).toBeTruthy();
  });

  it('offers the same two routes when the ERP lookup fails outright', async () => {
    lmApi.previewErpImport.mockRejectedValue(new Error('Attendance module unreachable'));

    const dialog = await openInvite();

    await within(dialog).findByText(/individual addresses into the box below/i);
    expect(within(dialog).getByText('ABC123')).toBeTruthy();
  });
});
