import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import lmApi from '../api/lmApi';
import People from '../pages/People';

/**
 * Putting students on a roster — by individual email address, and by nothing
 * else.
 *
 * A roster used to be fillable from roll numbers too: the invite modal offered
 * the attendance module's ERP roster for the subject, and the page nagged when
 * that roster held students the class did not. Both resolved a roll number to
 * whatever address the ERP had for it, or guessed `<roll>@nitj.ac.in` when it
 * had none — a guess that enrols a stranger when a roll is mistyped or
 * reassigned. The route is gone from the UI and refused by the server (see
 * ROLL_NUMBER_REGISTRATION_ENABLED in memberController).
 *
 * These tests are what stops it growing back in: the modal must ask for
 * addresses and nothing else, the page must not read a roster, and an invite
 * must still carry exactly what the teacher typed.
 */

vi.mock('../api/lmApi', () => ({
  default: {
    listMembers: vi.fn(),
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

const openInvite = async () => {
  renderPeople();
  await screen.findByText(/Students \(0\)/);
  fireEvent.click(screen.getByRole('button', { name: /invite students/i }));
  return screen.findByRole('dialog');
};

beforeEach(() => {
  vi.clearAllMocks();
  lmApi.listMembers.mockResolvedValue({ teachers: [], students: [] });
});

describe('inviting students', () => {
  it('asks for email addresses and offers no roll-number route', async () => {
    const dialog = await openInvite();

    expect(within(dialog).getByLabelText(/email addresses/i)).toBeInTheDocument();
    // Word-bounded: "enrolled" is fine, "roll number" is the thing being kept out.
    expect(dialog.textContent).not.toMatch(/\broll\b|roll ?n(o|umber)/i);
    expect(dialog.textContent).not.toMatch(/ERP/i);
  });

  /* The three cases a teacher has to pick between, in the dialog itself:
     B.Tech accounts already exist (share the code), everyone else is invited
     by individual ID, and someone with no account makes one from the help
     desk first. */
  it('spells out the individual-ID rule and the class-code route', async () => {
    const dialog = await openInvite();
    const text = dialog.textContent;

    expect(text).toMatch(/Individual student IDs only/i);
    expect(text).toMatch(/never a group ID/i);
    expect(text).toMatch(/B\.Tech students/);
    expect(text).toMatch(/ABC123/); // the class code, offered instead of inviting them
    expect(text).toMatch(/M\.Tech, PhD/);
    expect(within(dialog).getByRole('link', { name: /xceed\.nitj\.ac\.in\/help/ })).toHaveAttribute(
      'href',
      'https://xceed.nitj.ac.in/help',
    );
  });

  it('sends exactly the addresses that were typed', async () => {
    lmApi.inviteMembers.mockResolvedValue({ results: [], batchId: null, mailPending: 0 });
    const dialog = await openInvite();

    fireEvent.change(within(dialog).getByLabelText(/email addresses/i), {
      target: { value: 'asha.rao@nitj.ac.in, vikram@nitj.ac.in' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /send invites/i }));

    await waitFor(() =>
      expect(lmApi.inviteMembers).toHaveBeenCalledWith(
        'c1',
        ['asha.rao@nitj.ac.in', 'vikram@nitj.ac.in'],
        'student',
      ),
    );
  });

  it('reads no roster while the page and the modal are open', async () => {
    await openInvite();

    // Every call the page made, by name — none of them may be a roster read.
    const called = Object.entries(lmApi)
      .filter(([, fn]) => vi.isMockFunction(fn) && fn.mock.calls.length)
      .map(([name]) => name);
    expect(called).toEqual(['listMembers']);
  });

  it('does not nudge the teacher about students on an ERP roster', async () => {
    const { container } = renderPeople();
    await screen.findByText(/Students \(0\)/);

    expect(container.textContent).not.toMatch(/not in this class/i);
    expect(container.textContent).not.toMatch(/ERP/i);
  });
});

describe('the learning API surface', () => {
  it('no longer exposes the ERP roster endpoint', async () => {
    const actual = await vi.importActual('../api/lmApi');
    expect(actual.default.inviteMembers).toBeTypeOf('function');
    expect(actual.default.previewErpImport).toBeUndefined();
  });
});
