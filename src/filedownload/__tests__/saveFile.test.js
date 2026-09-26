/**
 * saveBlob on the web: the download anchor the call sites used before it
 * existed. (The native branch belongs to the mobile app.)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

import { saveBlob } from '../saveFile';

describe('saveBlob on the web', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('clicks a download anchor over the blob, named as given', async () => {
    const clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function record() {
      clicked.push({ href: this.href, download: this.download, attached: document.body.contains(this) });
    });
    const blob = new Blob(['a,b'], { type: 'text/csv;charset=utf-8' });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();

    await saveBlob(blob, 'FirstYear_Faculty_2025-26 ODD.csv');

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([{ href: 'blob:x', download: 'FirstYear_Faculty_2025-26 ODD.csv', attached: true }]);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('revokes the object URL once the browser has had it', async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();

    await saveBlob(new Blob(['x']), 'x.csv');

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });
});
