/**
 * The logout confirmation.
 *
 * Three behaviours worth pinning, because each replaces something the two
 * copied-out dialogs this component replaced got wrong, and none of them shows
 * up as a broken render:
 *
 *  - focus starts on Cancel, so the keystroke that opened the dialog cannot be
 *    the keystroke that signs you out;
 *  - the dialog stays up while the logout request is in flight, and the button
 *    cannot be pressed twice;
 *  - the overlay is not an exit, so the question is always answered on purpose.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { describe, it, expect, vi } from 'vitest';

import LogoutConfirmModal from '../LogoutConfirmModal';

const renderModal = (props = {}) =>
  render(
    <ChakraProvider>
      <LogoutConfirmModal isOpen onClose={() => {}} onConfirm={() => {}} {...props} />
    </ChakraProvider>,
  );

describe('LogoutConfirmModal', () => {
  it('asks the question and says what logging out does', async () => {
    renderModal();

    expect(await screen.findByText(/log out of xceed\?/i)).toBeInTheDocument();
    expect(screen.getByText(/returned to the login page/i)).toBeInTheDocument();
  });

  // On a shared lab machine "log out" is ambiguous in the one way that matters.
  it('names the account when the caller knows it', async () => {
    renderModal({ accountLabel: 'asha@nitj.ac.in' });

    expect(await screen.findByText('asha@nitj.ac.in')).toBeInTheDocument();
    expect(screen.getByText(/signed in as/i)).toBeInTheDocument();
  });

  it('leaves the account panel out when there is nothing to name', async () => {
    renderModal();

    await screen.findByText(/log out of xceed\?/i);
    expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument();
  });

  it('opens with focus on Cancel, not on the destructive button', async () => {
    renderModal();

    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancel).toHaveFocus());
  });

  it('runs the logout and reports it as it happens', async () => {
    let release;
    const onConfirm = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const user = userEvent.setup();
    renderModal({ onConfirm });

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    // Still up, and saying so — the old dialogs closed on the press and left a
    // slow connection looking like nothing had happened.
    expect(await screen.findByRole('button', { name: /logging out/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    release();
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it('cannot be asked to log out twice', async () => {
    let release;
    const onConfirm = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const user = userEvent.setup();
    renderModal({ onConfirm });

    const button = await screen.findByRole('button', { name: 'Log out' });
    await user.click(button);
    await user.click(screen.getByRole('button', { name: /logging out/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    release();
  });

  it('cancels without logging out', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onConfirm, onClose });

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // An alertdialog, not a plain dialog: the question is announced rather than
  // read out as an unlabelled container.
  it('is an alert dialog', async () => {
    renderModal();

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });
});
