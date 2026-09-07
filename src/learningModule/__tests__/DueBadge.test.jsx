import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DueBadge } from '../components/common';

/**
 * Issue #2225: a faculty member owns the assignment, not a submission for it,
 * so a passed deadline read as "Overdue" (red, bold) on their own view of it —
 * a state only meaningful for the student who has to turn something in.
 */

describe('learningModule <DueBadge />', () => {
  const pastDueDate = new Date(Date.now() - 2 * 86400000).toISOString();

  it('flags a passed deadline as overdue for a student', () => {
    render(<DueBadge dueDate={pastDueDate} />);

    const badge = screen.getByText(/Due /);
    expect(badge).toHaveStyle({ fontWeight: '600' });
  });

  it('does not flag a passed deadline as overdue for the teacher who owns it', () => {
    render(<DueBadge dueDate={pastDueDate} isTeacher />);

    const badge = screen.getByText(/Due /);
    expect(badge).toHaveStyle({ fontWeight: '400' });
  });
});
