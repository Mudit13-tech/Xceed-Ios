import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConflictModal } from '../SchedulerPage';
import { extraClassConflictDialogOptions } from '../extraClassConflictDialog';

describe('extra-class conflict dialog', () => {
  const callbacks = {
    onCancel: vi.fn(),
    onChangeRoom: vi.fn(),
    onReplace: vi.fn(),
  };

  it('does not offer replacement for ambiguous timetable data', () => {
    render(
      <ConflictModal
        open
        message="Two timetables claim this room"
        {...extraClassConflictDialogOptions('ambiguous_timetable')}
        {...callbacks}
      />,
    );

    expect(
      screen.getByText('Multiple current-session timetables use this slot'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Different Room' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /replace/i })).not.toBeInTheDocument();
  });

  it('does not offer room change or replacement for a busy faculty member', () => {
    render(
      <ConflictModal
        open
        message="Faculty is already teaching"
        {...extraClassConflictDialogOptions('faculty_regular_busy')}
        {...callbacks}
      />,
    );

    expect(
      screen.getByText('Faculty member is already teaching at this time'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose Different Room' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /replace/i })).not.toBeInTheDocument();
  });
});
