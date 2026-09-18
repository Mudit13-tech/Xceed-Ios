import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import lmApi from '../api/lmApi';
import People from '../pages/People';

/**
 * A student unenrolling themselves from the People tab.
 *
 * Leaving is one click away from a screen students open to look at the roster,
 * and it cannot be undone without the class code, so the two things these tests
 * hold are: it asks before it acts, and it is a student's button only — a
 * teacher opening the same page must not find a way to drop themselves out of
 * a class they are running.
 */

vi.mock('../api/lmApi', () => ({
  default: {
    listMembers: vi.fn(),
    requestLeaveCode: vi.fn(),
    leaveClass: vi.fn(),
  },
}));

const navigate = vi.fn();
vi.mock('../hooks/useStableNavigate', () => ({ default: () => navigate }));

let outletContext;
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useOutletContext: () => outletContext };
});

const asStudent = () => {
  outletContext = {
    classId: 'c1',
    klass: { _id: 'c1', name: 'Digital Signal Processing', code: 'ABC123', ownerName: 'Dr. Rao', isOwner: false },
    isTeacher: false,
    reloadClass: vi.fn(),
  };
};

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

const openLeaveDialog = async () => {
  renderPeople();
  fireEvent.click(await screen.findByRole('button', { name: /leave class/i }));
  return screen.findByRole('dialog');
};

beforeEach(() => {
  vi.clearAllMocks();
  asStudent();
  lmApi.listMembers.mockResolvedValue({
    teachers: [{ _id: 't1', name: 'Dr. Rao', role: 'teacher', status: 'active' }],
    students: [{ _id: 's1', name: 'Asha', role: 'student', status: 'active' }],
  });
  lmApi.requestLeaveCode.mockResolvedValue({ sent: true, email: 'asha@nitj.ac.in' });
  lmApi.leaveClass.mockResolvedValue({ left: true });
});

describe('leaving a class from People', () => {
  it('offers the student a way out and names the class in the confirmation', async () => {
    const dialog = await openLeaveDialog();

    expect(within(dialog).getByText(/Leave Digital Signal Processing\?/)).toBeInTheDocument();
    // Nothing has happened yet — the dialog is the whole point.
    expect(lmApi.leaveClass).not.toHaveBeenCalled();
  });

  it('does nothing when the student backs out', async () => {
    const dialog = await openLeaveDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(lmApi.leaveClass).not.toHaveBeenCalled();
  });

  const sendCodeAndEnter = async (dialog, code = '123456') => {
    fireEvent.click(within(dialog).getByRole('button', { name: /send code/i }));
    const input = await within(dialog).findByPlaceholderText(/6-digit code/i);
    fireEvent.change(input, { target: { value: code } });
  };

  it('does not offer to leave until a code has been sent', async () => {
    const dialog = await openLeaveDialog();

    expect(within(dialog).queryByRole('button', { name: /^leave class$/i })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /send code/i }));

    await waitFor(() => expect(lmApi.requestLeaveCode).toHaveBeenCalledWith('c1'));
    expect(await within(dialog).findByText(/Sent to asha@nitj.ac.in/)).toBeInTheDocument();
    // A code is needed before the leave button does anything.
    expect(within(dialog).getByRole('button', { name: /^leave class$/i })).toBeDisabled();
    expect(lmApi.leaveClass).not.toHaveBeenCalled();
  });

  it('leaves the class with the code and returns to the dashboard', async () => {
    const dialog = await openLeaveDialog();
    await sendCodeAndEnter(dialog, '123456');
    fireEvent.click(within(dialog).getByRole('button', { name: /^leave class$/i }));

    await waitFor(() => expect(lmApi.leaveClass).toHaveBeenCalledWith('c1', '123456'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/learning', { replace: true }));
  });

  it('stays on the send step when the code cannot be sent', async () => {
    lmApi.requestLeaveCode.mockRejectedValue(new Error('The code could not be sent.'));
    const dialog = await openLeaveDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /send code/i }));

    await waitFor(() => expect(lmApi.requestLeaveCode).toHaveBeenCalled());
    expect(within(dialog).queryByPlaceholderText(/6-digit code/i)).not.toBeInTheDocument();
  });

  it('keeps the student in the class when the server refuses the code', async () => {
    lmApi.leaveClass.mockRejectedValue(new Error('That code is not right.'));
    const dialog = await openLeaveDialog();
    await sendCodeAndEnter(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: /^leave class$/i }));

    await waitFor(() => expect(lmApi.leaveClass).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('is not offered to a teacher', async () => {
    outletContext = { ...outletContext, isTeacher: true, klass: { ...outletContext.klass, isOwner: true } };
    renderPeople();

    await screen.findByText(/Students \(1\)/);
    expect(screen.queryByRole('button', { name: /leave class/i })).not.toBeInTheDocument();
  });
});
