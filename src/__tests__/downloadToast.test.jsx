import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppToastContainer } from '../utils/appToast';
import { downloadFileNative } from '../utils/nativeCapabilities';

/**
 * A download leaves the page entirely — the browser takes it on the web, and
 * Android's DownloadManager takes it in the app — so without a toast the tap
 * has no visible result at all and students tap it again.
 */
describe('downloading a file', () => {
  it('says where the file went', async () => {
    render(<AppToastContainer />);

    await downloadFileNative('https://example.com/files/notes.pdf', 'notes.pdf');

    expect(await screen.findByText('Downloaded successfully')).toBeInTheDocument();
    expect(await screen.findByText(/notes\.pdf — check your Downloads folder\./)).toBeInTheDocument();
  });
});
