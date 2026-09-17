import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';

import AutosaveStatus from '../components/AutosaveStatus';

/**
 * The line an author glances at to answer one question: is my work safe?
 *
 * Every state has to answer it plainly, including the ones where the answer is
 * no. "Unsaved changes" with no explanation is the failure mode worth guarding
 * against — an author who cannot tell a paused editor from a broken one will
 * either lose work or stop trusting the indicator entirely.
 */

const show = (props) =>
  render(
    <ChakraProvider>
      <AutosaveStatus status="idle" lastSavedAt={null} {...props} />
    </ChakraProvider>,
  );

const at = (hours, minutes) => new Date(2026, 8, 16, hours, minutes);

describe('AutosaveStatus', () => {
  it('says when the work last reached the server', () => {
    show({ status: 'saved', lastSavedAt: at(14, 32) });
    expect(screen.getByRole('status')).toHaveTextContent(/saved at\b.*\b32/i);
  });

  it('shows a save in progress', () => {
    show({ status: 'saving' });
    expect(screen.getByRole('status')).toHaveTextContent(/saving/i);
  });

  it('shows an edit that has not been saved yet', () => {
    show({ status: 'dirty' });
    expect(screen.getByRole('status')).toHaveTextContent(/unsaved/i);
  });

  it('says the work is still there when a save fails', () => {
    // The author must not think the failure cost them the paragraph they are
    // looking at — it is on screen, and Save still works.
    show({ status: 'error', lastSavedAt: at(14, 32) });
    expect(screen.getByRole('status')).toHaveTextContent(/couldn't autosave/i);
  });

  it('says why autosave is off rather than leaving it silent', () => {
    show({ status: 'dirty', pausedReason: 'published' });
    expect(screen.getByRole('status')).toHaveTextContent(/autosave off.*published/i);
  });

  it('renders nothing before anything has happened', () => {
    show({ status: 'idle' });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('announces changes without stealing focus', () => {
    show({ status: 'saved', lastSavedAt: at(9, 5) });
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
