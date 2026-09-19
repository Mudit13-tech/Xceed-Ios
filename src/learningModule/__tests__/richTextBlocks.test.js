import { describe, expect, it } from 'vitest';

import { richTextBlocks, richTextToPlain } from '../richTextUtils';
import { fitImage } from '../utils/pdfImages';

/**
 * Splitting rich text into the words and the pictures.
 *
 * `richTextToPlain` drops every tag, which is right for a table cell and wrong
 * for a PDF — it is how diagrams were being stripped out of printed papers.
 */

describe('richTextBlocks', () => {
  it('keeps a picture in the place it sat between the words', () => {
    expect(richTextBlocks('<p>Before</p><img src="a.png" alt="fig"><p>After</p>')).toEqual([
      { type: 'text', text: 'Before' },
      { type: 'image', src: 'a.png', alt: 'fig' },
      { type: 'text', text: 'After' },
    ]);
  });

  it('reads a src however it was quoted', () => {
    const single = richTextBlocks("<img src='a.png'>");
    const none = richTextBlocks('<img src=a.png>');
    const attrs = richTextBlocks('<img class="x" src="a.png" width="30">');

    expect([single, none, attrs].map((blocks) => blocks[0].src)).toEqual(['a.png', 'a.png', 'a.png']);
  });

  it('handles a data URI, which is what the editor actually produces', () => {
    const uri = 'data:image/png;base64,iVBORw0KGgo=';
    expect(richTextBlocks(`<img src="${uri}">`)).toEqual([{ type: 'image', src: uri, alt: '' }]);
  });

  it('keeps several pictures in order', () => {
    const blocks = richTextBlocks('<img src="1.png"><p>middle</p><img src="2.png">');
    expect(blocks.map((block) => block.src || block.text)).toEqual(['1.png', 'middle', '2.png']);
  });

  it('ignores an img with no src rather than emitting an empty one', () => {
    expect(richTextBlocks('<p>a</p><img alt="broken">')).toEqual([{ type: 'text', text: 'a' }]);
  });

  it('drops empty text runs, so markup between two pictures adds nothing', () => {
    expect(richTextBlocks('<img src="1.png"><p></p><img src="2.png">')).toHaveLength(2);
  });

  it('agrees with richTextToPlain when there are no pictures at all', () => {
    const html = '<p>5 &lt; 7</p><p>Second line</p>';
    expect(richTextBlocks(html).map((block) => block.text).join(' ')).toBe(richTextToPlain(html));
  });

  it('copes with nothing', () => {
    expect(richTextBlocks('')).toEqual([]);
    expect(richTextBlocks(null)).toEqual([]);
    expect(richTextBlocks(undefined)).toEqual([]);
  });
});

describe('fitImage', () => {
  it('never upscales a small picture to fill the column', () => {
    expect(fitImage({ width: 60, height: 40 }, { maxWidth: 500 })).toEqual({ width: 60, height: 40 });
  });

  it('scales a wide picture down to the column, keeping its shape', () => {
    const fitted = fitImage({ width: 1000, height: 500 }, { maxWidth: 500 });
    expect(fitted.width).toBe(500);
    expect(fitted.height).toBe(250);
  });

  it('caps a tall picture so one figure cannot take a whole page', () => {
    const fitted = fitImage({ width: 400, height: 2000 }, { maxWidth: 500, maxHeight: 320 });
    expect(fitted.height).toBe(320);
    expect(fitted.width).toBe(64);
  });

  it('falls back to the full width when the natural size is unknown', () => {
    expect(fitImage(null, { maxWidth: 500 })).toEqual({ width: 500, height: undefined });
    expect(fitImage({ width: 0, height: 0 }, { maxWidth: 500 })).toEqual({ width: 500, height: undefined });
  });
});
