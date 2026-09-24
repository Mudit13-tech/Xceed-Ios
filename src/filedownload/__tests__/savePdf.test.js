/**
 * savePdf on the web: each call site keeps exactly the behaviour it had before
 * it was routed through here. (The native branch belongs to the mobile app.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { savePdfDoc, savePdfBytes } from '../savePdf';

describe('savePdfDoc on the web', () => {
  let doc;

  beforeEach(() => {
    doc = { download: vi.fn(), open: vi.fn(), getBase64: vi.fn() };
    globalThis.pdfMake = { createPdf: vi.fn(() => doc) };
  });

  afterEach(() => {
    delete globalThis.pdfMake;
  });

  it('downloads under the name given, unaltered, by default', () => {
    savePdfDoc({ content: [] }, 'CSE / 3rd sem_timetable.pdf');

    expect(doc.download).toHaveBeenCalledWith('CSE / 3rd sem_timetable.pdf');
    expect(doc.open).not.toHaveBeenCalled();
  });

  it('opens a tab instead when asked to', () => {
    savePdfDoc({ content: [] }, 'x.pdf', { web: 'open' });

    expect(doc.open).toHaveBeenCalledTimes(1);
    expect(doc.download).not.toHaveBeenCalled();
  });

  it('does both, in order, when asked for both', () => {
    const calls = [];
    doc.download.mockImplementation(() => calls.push('download'));
    doc.open.mockImplementation(() => calls.push('open'));

    savePdfDoc({ content: [] }, 'x.pdf', { web: ['download', 'open'] });

    expect(calls).toEqual(['download', 'open']);
  });

  it('never takes the native path', () => {
    savePdfDoc({ content: [] }, 'x.pdf');
    expect(doc.getBase64).not.toHaveBeenCalled();
  });
});

describe('savePdfBytes on the web', () => {
  it('clicks a download anchor named as given', async () => {
    const clicked = [];
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function record() {
        clicked.push(this.download);
      });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();

    await savePdfBytes(new Uint8Array([37, 80, 68, 70]), 'CSE_TT.pdf');

    expect(clicked).toEqual(['CSE_TT.pdf']);
    click.mockRestore();
  });
});
