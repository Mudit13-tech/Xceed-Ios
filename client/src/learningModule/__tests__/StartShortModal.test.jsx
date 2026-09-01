import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import StartShortModal from '../components/StartShortModal';

/**
 * The launch mail cannot be recalled, so the only behaviour worth pinning here
 * is what the dialog hands back: a boolean the teacher chose, never one the
 * deck's setting chose on its own.
 */

const deck = (emailOnStart) => ({
  _id: 'd1',
  title: 'Warm-up',
  settings: typeof emailOnStart === 'boolean' ? { emailOnStart } : {},
});

const open = (short, onConfirm = vi.fn()) => {
  render(
    <StartShortModal isOpen short={short} onClose={vi.fn()} onConfirm={onConfirm} isBusy={false} />,
  );
  return onConfirm;
};

describe('learningModule <StartShortModal />', () => {
  it('opens on "email" for a deck that mails on start, and confirms with true', () => {
    const onConfirm = open(deck(true));

    fireEvent.click(screen.getByRole('button', { name: /start & email/i }));
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it('treats a deck saved before the setting existed as mailing on start', () => {
    const onConfirm = open(deck(undefined));

    fireEvent.click(screen.getByRole('button', { name: /start & email/i }));
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it('opens on "quiet" for a deck configured not to mail, and confirms with false', () => {
    const onConfirm = open(deck(false));

    fireEvent.click(screen.getByRole('button', { name: /start without email/i }));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it('sends the teacher’s answer, not the deck’s, when they flip it', () => {
    const onConfirm = open(deck(true));

    fireEvent.click(screen.getByRole('radio', { name: /start without emailing/i }));
    fireEvent.click(screen.getByRole('button', { name: /start without email/i }));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });
});
