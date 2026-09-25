/**
 * The screenshot a reporter attached, shown on the superadmin bug queue. The
 * report always carried `screenshotUrl`; the page never drew it.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import BugReportsAdmin from '../bugReports';
import lmApi from '../../learningModule/api/lmApi';

vi.mock('../../learningModule/api/lmApi', () => ({
  default: { allBugReports: vi.fn(), reviewBug: vi.fn() },
}));

const SHOT = '/api/v1/learningmodule/bug-screenshots/abc123.png';

const renderWith = (report) => {
  lmApi.allBugReports.mockResolvedValue({ reports: [report], counts: { open: 1 }, kindCounts: { bug: 1 } });
  return render(
    <ChakraProvider>
      <MemoryRouter>
        <BugReportsAdmin />
      </MemoryRouter>
    </ChakraProvider>,
  );
};

const report = (extra = {}) => ({
  _id: 'r1',
  kind: 'bug',
  title: 'Button does nothing',
  description: 'Pressed it twice.',
  status: 'open',
  created_at: new Date().toISOString(),
  ...extra,
});

beforeEach(() => vi.clearAllMocks());

describe('superadmin bug queue — screenshots', () => {
  it('shows the attached screenshot, linked to the full-size file', async () => {
    renderWith(report({ screenshotUrl: SHOT }));

    const image = await screen.findByAltText('Screenshot attached to "Button does nothing"');
    expect(image).toHaveAttribute('src', SHOT);
    expect(image.closest('a')).toHaveAttribute('href', SHOT);
  });

  it('says so when the file has gone', async () => {
    renderWith(report({ screenshotUrl: SHOT }));

    fireEvent.error(await screen.findByAltText('Screenshot attached to "Button does nothing"'));

    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
  });

  it('draws nothing for a report without one', async () => {
    renderWith(report());
    await screen.findByText('Button does nothing');
    expect(screen.queryByText('Screenshot')).not.toBeInTheDocument();
  });
});
