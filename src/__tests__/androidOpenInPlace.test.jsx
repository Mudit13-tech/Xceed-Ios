import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Android opens a downloaded file once it lands, as iOS does with Quick Look,
 * while still saving it to Downloads. The JS reaches APKs built before and
 * after that native change (it ships by OTA), so both must read correctly.
 */
const download = vi.fn();
const writeFile = vi.fn();
const openDocumentFromLocalPath = vi.fn();
let fileViewerInstalled = true;

vi.mock('../getenvironment', () => ({ default: () => 'http://api.test' }));
vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Capacitor: {
      ...actual.Capacitor,
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      isPluginAvailable: (name) => name === 'FileViewer' && fileViewerInstalled,
    },
    CapacitorCookies: { getCookies: async () => ({}) },
    registerPlugin: () => ({ download }),
  };
});
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: (...args) => writeFile(...args) },
  Directory: { ExternalStorage: 'EXTERNAL_STORAGE', Documents: 'DOCUMENTS', Cache: 'CACHE' },
}));
vi.mock('@capacitor/file-viewer', () => ({
  FileViewer: { openDocumentFromLocalPath: (...args) => openDocumentFromLocalPath(...args) },
}));

const { AppToastContainer } = await import('../utils/appToast');
const { downloadFileNative, downloadBase64Native } = await import('../utils/nativeCapabilities');

beforeEach(() => {
  download.mockReset();
  writeFile.mockReset();
  openDocumentFromLocalPath.mockReset();
  fileViewerInstalled = true;
});

describe('Android open-in-place', () => {
  it('asks DownloadManager to open the file, and says so', async () => {
    download.mockResolvedValue({ id: 1, opens: true });
    render(<AppToastContainer />);

    await downloadFileNative('http://api.test/files/notes.pdf', 'notes.pdf');

    expect(download).toHaveBeenCalledWith(expect.objectContaining({ open: true, fileName: 'notes.pdf' }));
    expect(await screen.findByText('Opening file')).toBeInTheDocument();
  });

  it('keeps the old message on an APK that cannot open it', async () => {
    download.mockResolvedValue({ id: 1 });
    render(<AppToastContainer />);

    await downloadFileNative('http://api.test/files/notes.pdf', 'notes.pdf');

    expect(await screen.findByText('Downloaded successfully')).toBeInTheDocument();
    expect(await screen.findByText(/notes\.pdf — check your Downloads folder\./)).toBeInTheDocument();
  });

  it('opens a saved base64 file with FileViewer', async () => {
    writeFile.mockResolvedValue({ uri: 'file:///storage/emulated/0/Download/report.pdf' });

    await downloadBase64Native('AAAA', 'report.pdf');

    expect(openDocumentFromLocalPath).toHaveBeenCalledWith({ path: 'file:///storage/emulated/0/Download/report.pdf' });
  });

  it('still saves when FileViewer is not in this APK', async () => {
    fileViewerInstalled = false;
    writeFile.mockResolvedValue({ uri: 'file:///storage/emulated/0/Download/report.pdf' });

    await expect(downloadBase64Native('AAAA', 'report.pdf')).resolves.toBeTruthy();
    expect(openDocumentFromLocalPath).not.toHaveBeenCalled();
  });

  it('does not report a failed save when no app opens the file', async () => {
    writeFile.mockResolvedValue({ uri: 'file:///storage/emulated/0/Download/data.xyz' });
    openDocumentFromLocalPath.mockRejectedValue(new Error('No app found'));

    await expect(downloadBase64Native('AAAA', 'data.xyz')).resolves.toBeTruthy();
  });
});
