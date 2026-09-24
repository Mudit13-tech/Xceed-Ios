// Helpers for the rich text content produced by <RichTextEditor>.
//
// Kept out of the component files so those export components only — mixing
// non-component exports in breaks React Fast Refresh for the whole module.

/**
 * Quill's "empty" document is `<p><br></p>`, not an empty string, so a plain
 * `.trim()` check on the editor's value is always truthy and would let an
 * empty announcement through.
 */
export const isRichTextEmpty = (html) =>
  !String(html || '')
    .replace(/<(p|div|br|span)[^>]*>/gi, '')
    .replace(/<\/(p|div|span)>/gi, '')
    .replace(/&nbsp;/gi, '')
    .replace(/\s/g, '').length;

/**
 * Flattens rich text to one line for places that cannot render markup —
 * table cells, list previews, notification titles.
 */
export function richTextToPlain(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits rich text into the ordered run of text and images it is made of.
 *
 * `richTextToPlain` above drops every tag, `<img>` included, which is right for
 * a table cell or a notification title but silently loses a circuit diagram
 * when the destination can actually draw one — a PDF, say. This keeps the
 * pictures and says where in the text they sat.
 *
 * The editor is stock Quill with its default image handler, so a pasted or
 * uploaded picture arrives as a `data:` URI embedded in the markup. A `src`
 * pointing at a URL is still possible (typed by hand, or carried in from an
 * import), so callers that need bytes have to resolve those themselves — see
 * pdfImages.js.
 *
 * Returns `[{ type: 'text', text }, { type: 'image', src, alt }, …]` with empty
 * text runs dropped.
 */
export function richTextBlocks(value) {
  const source = String(value ?? '');
  if (!source) return [];

  const blocks = [];
  const pattern = /<img\b[^>]*>/gi;
  let cursor = 0;

  const pushText = (html) => {
    const text = richTextToPlain(html);
    if (text) blocks.push({ type: 'text', text });
  };

  let match = pattern.exec(source);
  while (match) {
    pushText(source.slice(cursor, match.index));
    const tag = match[0];
    const src = (tag.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i) || [])
      .slice(2)
      .find((group) => group !== undefined) || '';
    const alt = (tag.match(/\balt\s*=\s*("([^"]*)"|'([^']*)')/i) || [])
      .slice(2)
      .find((group) => group !== undefined) || '';
    if (src) blocks.push({ type: 'image', src, alt });
    cursor = match.index + tag.length;
    match = pattern.exec(source);
  }

  pushText(source.slice(cursor));
  return blocks;
}
