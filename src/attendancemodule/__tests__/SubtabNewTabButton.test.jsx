import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubtabNewTabButton from '../SubtabNewTabButton';
import {
  buildSubtabUrl,
  readSubtabFromSearch,
} from '../subtabNavigation';

describe('SubtabNewTabButton', () => {
  it('reads only an allowed tab value from the URL', () => {
    expect(readSubtabFromSearch(['summary', 'upload'], 'summary', 'tab', '?tab=upload')).toBe('upload');
    expect(readSubtabFromSearch(['summary', 'upload'], 'summary', 'tab', '?tab=invalid')).toBe('summary');
    expect(readSubtabFromSearch([3, 1, 2], 3, 'tab', '?tab=2')).toBe(2);
  });

  it('builds a same-page URL while preserving existing query parameters and the hash', () => {
    expect(buildSubtabUrl(
      'detail',
      'tab',
      { reportId: 'report-7' },
      'https://example.test/attendance/reports?department=CSE#results',
    )).toBe('/attendance/reports?department=CSE&tab=detail&reportId=report-7#results');
  });

  it('opens the selected subtab in a separate browser tab', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    window.history.replaceState({}, '', '/attendance/groundtruth/upload?department=CSE');

    render(<SubtabNewTabButton value="manage" label="Manage Photos" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Manage Photos in new tab' }));

    expect(open).toHaveBeenCalledWith(
      '/attendance/groundtruth/upload?department=CSE&tab=manage',
      '_blank',
      'noopener,noreferrer',
    );
    open.mockRestore();
  });
});
