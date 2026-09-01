import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubtabNewTabButton, { AmsSubtab } from '../SubtabNewTabButton';
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

  it('keeps the new-tab plus visually attached to its subtab label', () => {
    const { container } = render(
      <AmsSubtab
        value="assign"
        label="Assign"
        active
        onSelect={() => {}}
      />,
    );

    const option = container.querySelector('.ams-subtab-option');
    const labelButton = screen.getByRole('button', { name: 'Assign' });
    const newTabButton = screen.getByRole('button', { name: 'Open Assign in new tab' });

    expect(option).toHaveStyle({ gap: '0' });
    expect(option).toHaveStyle({ background: '#ffffff' });
    expect(labelButton).toHaveStyle({ paddingRight: '0' });
    expect(labelButton).toHaveStyle({ background: 'transparent' });
    expect(newTabButton).toHaveClass('compact');
    expect(newTabButton.style.width).toBe('24px');
    expect(newTabButton.style.minWidth).toBe('24px');
    expect(newTabButton.style.height).toBe('24px');
    expect(newTabButton.style.padding).toBe('0px');
    expect(newTabButton.style.borderLeftWidth).toBe('0px');
    expect(newTabButton.style.borderRadius).toBe('6px');
    expect(newTabButton.style.background).toBe('transparent');
    expect(newTabButton.style.justifyContent).toBe('center');
  });
});
