import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * The verification control, on the card where the Config Key is pasted in.
 *
 * The card could say a file and a key were *stored*. It could not say they
 * agree, and nothing on the page could: a Config Key is a value copied out of
 * another application, and only a real Safe Exam Browser making a real request
 * can prove it belongs to the file beside it. So two green ticks described a
 * setup that had never been tried, and the first request that ever tried it was
 * a student starting an exam — at which point the fix is a trip through the
 * Configuration Tool that an exam hall does not have time for.
 *
 * These pin the control that closes that, and the two ways it could mislead: an
 * unrun check must not read as a pass, and a verdict must not outlive the
 * configuration it was about.
 */

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, Link: ({ children }) => <span>{children}</span> };
});

const getSharedSebConfig = vi.fn();
const checkSharedSebConfig = vi.fn();
const setSharedSebConfig = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    // The page renders nothing until the summary resolves; the SEB card sits
    // below these, so they have to be shaped well enough to get past them.
    adminSummary: vi.fn(async () => ({
      courses: { total: 0, active: 0 },
      people: { total: 0, students: 0, teachers: 0 },
      bugs: { total: 0, byStatus: { open: 0 }, recent: [] },
      feedback: { total: 0, byStatus: { new: 0 }, recent: [] },
    })),
    getSharedSebConfig: (...a) => getSharedSebConfig(...a),
    checkSharedSebConfig: (...a) => checkSharedSebConfig(...a),
    setSharedSebConfig: (...a) => setSharedSebConfig(...a),
    sampleSebUrl: () => 'https://api.test/sample.seb',
  },
}));

const configured = (overrides = {}) => ({
  hasFile: true,
  hasKey: true,
  ready: true,
  fileName: 'xceed-exam-lockdown.seb',
  fileSize: 3878,
  uploadedByName: 'Hari',
  uploadedAt: new Date().toISOString(),
  ...overrides,
});

const openCard = async () => {
  const { default: LmAdmin } = await import('../pages/LmAdmin');
  renderWithProviders(<LmAdmin />);
  return screen.findByRole('button', { name: /run the check/i });
};

beforeEach(() => {
  vi.clearAllMocks();
  getSharedSebConfig.mockResolvedValue(configured());
});

describe('the check button on the shared configuration card', () => {
  it('says nothing at all until it is pressed', async () => {
    // An unrun check that looked like a result would be the same false comfort
    // the two stored-file ticks already gave.
    await openCard();
    expect(screen.queryByText(/verified/i)).toBeNull();
    expect(checkSharedSebConfig).not.toHaveBeenCalled();
  });

  it('reports a real pass as the proof it is', async () => {
    checkSharedSebConfig.mockResolvedValue({ verified: true, reason: null, hasFile: true, hasKey: true });
    fireEvent.click(await openCard());
    expect(await screen.findByText(/matched the stored config key/i)).toBeInTheDocument();
  });

  it('names a stale key, and says what to do about it', async () => {
    /* The mistake the whole card now guards against: uploading the downloaded
       sample instead of the copy saved out of the Configuration Tool. */
    checkSharedSebConfig.mockResolvedValue({
      verified: false,
      reason: 'hash-mismatch',
      hasFile: true,
      hasKey: true,
      seenHost: 'xceed.nitj.ac.in',
    });
    fireEvent.click(await openCard());
    expect(await screen.findByText(/does not match the one stored here/i)).toBeInTheDocument();
    // The instruction, not merely the words — step 1 above also names the tool.
    expect(await screen.findByText(/copy the config key it shows/i)).toBeInTheDocument();
  });

  it('tells an administrator running it from an ordinary browser that they are', async () => {
    // The way this feature could be worse than nothing: a check run from Chrome,
    // read as a broken setup, and a correct configuration rebuilt for no reason.
    checkSharedSebConfig.mockResolvedValue({ verified: false, reason: 'no-seb-headers', hasFile: true, hasKey: true });
    fireEvent.click(await openCard());
    expect(await screen.findByText(/says nothing about your setup/i)).toBeInTheDocument();
  });

  it('shows the address the request arrived on, which is how a wrong Start URL reads', async () => {
    // A sample downloaded from a laptop points at localhost, and the Config Key
    // is computed over that Start URL. There is no other symptom.
    checkSharedSebConfig.mockResolvedValue({
      verified: false,
      reason: 'hash-mismatch',
      hasFile: true,
      hasKey: true,
      seenHost: 'xceed.nitj.ac.in',
    });
    fireEvent.click(await openCard());
    expect(await screen.findByText(/xceed\.nitj\.ac\.in/i)).toBeInTheDocument();
  });

  it('still answers when the request itself fails, rather than going quiet', async () => {
    checkSharedSebConfig.mockRejectedValue(new Error('offline'));
    fireEvent.click(await openCard());
    // The heading says it and the fallback advice repeats it; either will do.
    expect((await screen.findAllByText(/not verified/i)).length).toBeGreaterThan(0);
  });

  it('throws the verdict away when the configuration is replaced', async () => {
    /* A green tick describing a file that has since been swapped is worse than
       no tick: it is the exact false confidence this control exists to remove. */
    checkSharedSebConfig.mockResolvedValue({ verified: true, reason: null, hasFile: true, hasKey: true });
    fireEvent.click(await openCard());
    await screen.findByText(/matched the stored config key/i);

    setSharedSebConfig.mockResolvedValue(configured({ fileName: 'new.seb' }));
    const [fileInput] = document.querySelectorAll('input[type="file"]');
    const file = new File(['<plist/>'], 'new.seb', { type: 'application/seb' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.change(screen.getByPlaceholderText(/config key/i), { target: { value: 'a-new-key' } });
    fireEvent.click(screen.getByRole('button', { name: /replace the shared configuration/i }));

    await waitFor(() => expect(screen.queryByText(/matched the stored config key/i)).toBeNull());
  });

  it('cannot be pressed before there is a file to check', async () => {
    getSharedSebConfig.mockResolvedValue(configured({ hasFile: false, hasKey: false, ready: false }));
    expect(await openCard()).toBeDisabled();
  });
});
