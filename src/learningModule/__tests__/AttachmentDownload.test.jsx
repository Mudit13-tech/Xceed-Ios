import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AttachmentList } from '../components/Attachments';

/**
 * Material PDFs could not be downloaded from the installed app on iOS: a plain
 * link authenticates by cookie alone, and the tab it opens does not have the
 * app's cookies. The Download button fetches with the session token instead,
 * and saves the file under the name the teacher uploaded it with rather than
 * the random name it is stored under.
 */

const pdf = {
  kind: 'file',
  name: 'Unit 3 Notes.pdf',
  url: '/api/v1/learningmodule/files/data-structures-a-223344/1718900000000-deadbeef.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2048,
};
const link = { kind: 'link', name: 'https://example.com', url: 'https://example.com' };

const renderList = (attachments) =>
  render(
    <ChakraProvider>
      <AttachmentList attachments={attachments} />
    </ChakraProvider>,
  );

const fakeResponse = (status, body = '%PDF-1.4') => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  blob: async () => new Blob([body], { type: 'application/pdf' }),
});

let saved;

beforeEach(() => {
  saved = [];
  localStorage.setItem('token', 'session-token');
  URL.createObjectURL = vi.fn(() => 'blob:attachment');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    saved.push({ href: this.getAttribute('href'), download: this.download });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('learningModule <AttachmentList /> downloads', () => {
  it('opens a file under its display name, so the viewer saves it as that', () => {
    renderList([pdf]);
    const href = screen.getByRole('link').getAttribute('href');
    expect(href).toContain(`${pdf.url}?name=Unit+3+Notes.pdf`);
  });

  it('fetches with the session token and saves under the uploaded name', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200));
    vi.stubGlobal('fetch', fetchMock);

    renderList([pdf]);
    fireEvent.click(screen.getByRole('button', { name: 'Download Unit 3 Notes.pdf' }));

    await waitFor(() => expect(saved).toEqual([{ href: 'blob:attachment', download: 'Unit 3 Notes.pdf' }]));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.endsWith(pdf.url)).toBe(true);
    expect(options.headers.Authorization).toBe('Bearer session-token');
  });

  it('says the session has expired rather than failing silently on a 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401)));

    renderList([pdf]);
    fireEvent.click(screen.getByRole('button', { name: 'Download Unit 3 Notes.pdf' }));

    expect(await screen.findByText(/session has expired/i)).toBeInTheDocument();
    expect(saved).toEqual([]);
  });

  it('offers no download for a link, which is someone else\'s page', () => {
    renderList([link]);
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://example.com');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
