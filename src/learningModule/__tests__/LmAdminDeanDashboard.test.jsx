import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The dean's dashboard, reached from the admin console.
 *
 * An administrator holds no DEAN role, so the rail deliberately never offers
 * them the dean's items — see the `deanOnly` entries in LearningLayout. That
 * leaves nobody but a dean able to find the institute-wide screen, which is a
 * problem for the person who has to check what a dean is being shown. The
 * console card is the way in, and both gates (`RequireDean` here,
 * `requireDean` on the server) already admit platform admins.
 *
 * Pinned: the card exists, and it points at the lm-admin path rather than
 * `/learning/dean-dashboard` — the same page either way, but only the former
 * keeps an admin inside the console they arrived from.
 */

vi.mock('../api/lmApi', () => ({
  default: {
    adminSummary: vi.fn(async () => ({
      courses: { total: 0, active: 0 },
      people: { total: 0, students: 0, teachers: 0 },
      bugs: { total: 0, byStatus: { open: 0 }, recent: [] },
      feedback: { total: 0, byStatus: { new: 0 }, recent: [] },
    })),
    getSharedSebConfig: vi.fn(async () => ({ hasFile: false, hasKey: false, ready: false })),
    getSebInstallers: vi.fn(async () => ({
      windows: { available: false },
      mac: { available: false },
    })),
    sampleSebUrl: () => 'https://api.test/sample.seb',
    sebInstallerDownloadUrl: (platform) => `https://api.test/seb-installer/${platform}/download`,
  },
}));

describe('LmAdmin dean dashboard link', () => {
  it('offers the institute-wide dashboard from the console', async () => {
    const { default: LmAdmin } = await import('../pages/LmAdmin');
    renderWithProviders(<LmAdmin />);

    const link = await screen.findByRole('link', { name: /Open Dean Dashboard/i });
    expect(link).toHaveAttribute('href', '/learning/lm-admin/dean-dashboard');
  });

  it('keeps the head of department card beside it, not in place of it', async () => {
    const { default: LmAdmin } = await import('../pages/LmAdmin');
    renderWithProviders(<LmAdmin />);

    const hod = await screen.findByRole('link', { name: /Open HOD Dashboard/i });
    expect(hod).toHaveAttribute('href', '/learning/lm-admin/hod-dashboard');
  });
});
