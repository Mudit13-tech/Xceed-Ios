import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ErpPushSettingsTab from '../ErpPushSettingsTab';

describe('ERP sync status report details (#2250)', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/attendance/edit-session-dates?demo=1');
  });

  it('shows present and absent counts and links each row to its attendance report', async () => {
    render(
      <MemoryRouter>
        <ErpPushSettingsTab />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('columnheader', { name: 'Present' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Absent' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Report' })).toBeInTheDocument();

    const [subjectCell] = await screen.findAllByText('Digital Signal Processing');
    const row = subjectCell.closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row).getAllByRole('cell');
    expect(cells[5]).toHaveTextContent('42');
    expect(cells[6]).toHaveTextContent('5');
    expect(within(row).getByRole('link', { name: 'View report →' })).toHaveAttribute(
      'href',
      '/attendance/reports?tab=detail&reportId=demo-1',
    );
  });
});
