import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * Uploading Safe Exam Browser's own installer, one per platform.
 *
 * Separate from the shared .seb settings card next to it: this never reads or
 * writes anything about a quiz, an attempt, or the Config Key. What matters
 * here is the shape any admin-managed singleton upload needs — the card shows
 * what is currently stored, an upload replaces it, and the two platforms are
 * independent of one another.
 *
 * Every query below is scoped to this card's own container
 * (`seb-installer-card`) rather than the page as a whole: the shared .seb
 * card sitting next to it has its own file input and its own "Not uploaded"
 * text, and an unscoped query would silently pass by matching the wrong
 * card's element.
 */

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, Link: ({ children }) => <span>{children}</span> };
});

const getSebInstallers = vi.fn();
const uploadSebInstaller = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    adminSummary: vi.fn(async () => ({
      courses: { total: 0, active: 0 },
      people: { total: 0, students: 0, teachers: 0 },
      bugs: { total: 0, byStatus: { open: 0 }, recent: [] },
      feedback: { total: 0, byStatus: { new: 0 }, recent: [] },
    })),
    getSharedSebConfig: vi.fn(async () => ({ hasFile: false, hasKey: false, ready: false })),
    checkSharedSebConfig: vi.fn(),
    setSharedSebConfig: vi.fn(),
    sampleSebUrl: () => 'https://api.test/sample.seb',
    getSebInstallers: (...a) => getSebInstallers(...a),
    uploadSebInstaller: (...a) => uploadSebInstaller(...a),
    sebInstallerDownloadUrl: (platform) => `https://api.test/seb-installer/${platform}/download`,
  },
}));

const neither = () => ({
  windows: { available: false, fileName: '', fileSize: 0, uploadedByName: '', uploadedAt: null },
  mac: { available: false, fileName: '', fileSize: 0, uploadedByName: '', uploadedAt: null },
});

/**
 * The card's own container, scoped away from the shared .seb card beside it.
 * Returns both the bound queries (`find*`/`get*`) and the raw element, for
 * the one thing `within()` does not wrap: a direct `querySelectorAll`.
 */
const openCard = async () => {
  const { default: LmAdmin } = await import('../pages/LmAdmin');
  renderWithProviders(<LmAdmin />);
  const cardEl = await screen.findByTestId('seb-installer-card');
  return Object.assign(within(cardEl), { cardEl });
};

beforeEach(() => {
  vi.clearAllMocks();
  getSebInstallers.mockResolvedValue(neither());
});

describe('the installer card', () => {
  it('shows both platforms as not uploaded when nothing has been set', async () => {
    const card = await openCard();
    expect(await card.findAllByText(/not uploaded/i)).toHaveLength(2);
  });

  it('shows what is stored, and who set it, once uploaded', async () => {
    getSebInstallers.mockResolvedValue({
      windows: { available: true, fileName: 'SEBSetup-3.6.exe', fileSize: 5000, uploadedByName: 'Hari', uploadedAt: new Date().toISOString() },
      mac: { available: false, fileName: '', fileSize: 0, uploadedByName: '', uploadedAt: null },
    });
    const card = await openCard();
    expect(await card.findByText(/SEBSetup-3\.6\.exe — set by Hari/i)).toBeInTheDocument();
  });

  it('offers a download link only for the platform that has one', async () => {
    getSebInstallers.mockResolvedValue({
      windows: { available: true, fileName: 'SEBSetup.exe', fileSize: 1, uploadedByName: '', uploadedAt: null },
      mac: { available: false, fileName: '', fileSize: 0, uploadedByName: '', uploadedAt: null },
    });
    const card = await openCard();
    const links = await card.findAllByRole('link', { name: /download the file currently stored/i });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://api.test/seb-installer/windows/download');
  });

  it('cannot upload before a file is chosen', async () => {
    const card = await openCard();
    const uploadButtons = await card.findAllByRole('button', { name: /^upload$/i });
    expect(uploadButtons).toHaveLength(2);
    uploadButtons.forEach((button) => expect(button).toBeDisabled());
  });

  it('uploads the chosen file for the right platform', async () => {
    uploadSebInstaller.mockResolvedValue({
      platform: 'mac',
      available: true,
      fileName: 'SafeExamBrowser.dmg',
      fileSize: 1000,
      uploadedByName: 'Hari',
      uploadedAt: new Date().toISOString(),
    });
    getSebInstallers
      .mockResolvedValueOnce(neither())
      .mockResolvedValueOnce({
        windows: neither().windows,
        mac: { available: true, fileName: 'SafeExamBrowser.dmg', fileSize: 1000, uploadedByName: 'Hari', uploadedAt: new Date().toISOString() },
      });
    const card = await openCard();

    const fileInputs = card.cardEl.querySelectorAll('input[type="file"]');
    expect(fileInputs).toHaveLength(2); // windows, mac — nothing from the card next door
    const macInput = fileInputs[1];
    const file = new File(['bytes'], 'SafeExamBrowser.dmg', { type: 'application/octet-stream' });
    fireEvent.change(macInput, { target: { files: [file] } });

    const uploadButtons = await card.findAllByRole('button', { name: /^upload$/i });
    fireEvent.click(uploadButtons[1]); // the mac row's button

    await waitFor(() => expect(uploadSebInstaller).toHaveBeenCalledWith('mac', file));
    expect(await card.findByText(/students see the download on the quiz screen/i)).toBeInTheDocument();
  });

  it('labels a replacement upload differently from a first one', async () => {
    getSebInstallers.mockResolvedValue({
      windows: { available: true, fileName: 'SEBSetup.exe', fileSize: 1, uploadedByName: '', uploadedAt: null },
      mac: { available: false, fileName: '', fileSize: 0, uploadedByName: '', uploadedAt: null },
    });
    const card = await openCard();
    expect(await card.findByRole('button', { name: /^replace$/i })).toBeInTheDocument();
    expect(card.getByRole('button', { name: /^upload$/i })).toBeInTheDocument();
  });

  it('reports a failed upload without losing the rest of the card', async () => {
    uploadSebInstaller.mockRejectedValue(new Error('The windows installer must be a .exe or .msi file.'));
    const card = await openCard();

    const [windowsInput] = card.cardEl.querySelectorAll('input[type="file"]');
    const file = new File(['bytes'], 'SafeExamBrowser.dmg', { type: 'application/octet-stream' });
    fireEvent.change(windowsInput, { target: { files: [file] } });
    fireEvent.click((await card.findAllByRole('button', { name: /^upload$/i }))[0]);

    expect(await card.findByText(/must be a \.exe or \.msi file/i)).toBeInTheDocument();
  });
});
