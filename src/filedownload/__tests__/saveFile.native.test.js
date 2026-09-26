/**
 * saveBlob inside the installed app.
 *
 * saveFile.test.js is AMS's, and it checks the web: a download anchor over an
 * object URL. The WebView drops that anchor without saving anything, which is
 * why saveBlob exists. On native the bytes go through
 * nativeCapabilities.mobile.js into Downloads instead. That branch only runs
 * when Capacitor says it is native, which it never does under jsdom, so it is
 * forced here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const writeFile = vi.fn();

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => true, getPlatform: () => 'android' },
  };
});
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: (...args) => writeFile(...args) },
  Directory: { ExternalStorage: 'EXTERNAL_STORAGE', Documents: 'DOCUMENTS', Cache: 'CACHE' },
}));
vi.mock('../../utils/appToast', () => ({ appToast: vi.fn() }));

const { saveBlob } = await import('../saveFile');
const { appToast } = await import('../../utils/appToast');

describe('saveBlob in the app', () => {
  beforeEach(() => {
    writeFile.mockReset().mockResolvedValue({ uri: 'file:///x' });
    appToast.mockClear();
  });

  it('writes the exact bytes into Downloads, BOM included, and never clicks an anchor', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    await saveBlob(new Blob(['﻿a,b'], { type: 'text/csv;charset=utf-8' }), 'FirstYear_Faculty_2025-26.csv');

    expect(writeFile).toHaveBeenCalledTimes(1);
    const [{ path, data, directory }] = writeFile.mock.calls[0];
    expect(path).toBe('Download/FirstYear_Faculty_2025-26.csv');
    expect(directory).toBe('EXTERNAL_STORAGE');
    // EF BB BF is the UTF-8 BOM Excel needs; then "a,b".
    expect([...atob(data)].map((c) => c.charCodeAt(0))).toEqual([0xef, 0xbb, 0xbf, 0x61, 0x2c, 0x62]);
    expect(appToast).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it('keeps the name to characters Android accepts', async () => {
    await saveBlob(new Blob(['x'], { type: 'text/csv' }), 'CSE / 3rd: sem?.csv');

    expect(writeFile.mock.calls[0][0].path).toBe('Download/CSE _ 3rd_ sem_.csv');
  });

  it('rejects, after telling the user, when nothing could be written', async () => {
    writeFile.mockRejectedValue(new Error('denied'));

    await expect(saveBlob(new Blob(['x']), 'x.csv')).rejects.toThrow('denied');
    expect(appToast).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
  });
});
