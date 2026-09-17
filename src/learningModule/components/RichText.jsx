import React, { useEffect, useMemo, useRef } from 'react';
import { Box, Text } from '@chakra-ui/react';
import createDOMPurify from 'dompurify';
import Markdown from './Markdown';

/**
 * Renders content authored in <RichTextEditor>.
 *
 * Sanitisation happens **here, at render time**, rather than on save. That is
 * deliberate: the client is not a security boundary — anyone can POST raw HTML
 * straight to the API — so trusting stored content would be unsafe no matter
 * what the editor sends. Sanitising every time we render is the guarantee that
 * actually holds.
 *
 * Three content shapes reach this component, because the module predates the
 * rich editor and AI generation produces Markdown:
 *
 *   HTML      → sanitised and rendered (anything the editor produced)
 *   Markdown  → handed to <Markdown> (AI-generated notes and tutorials)
 *   plain     → rendered with newlines preserved (older posts, pasted text)
 *
 * Detection is a cheap tag sniff. It only has to separate editor output from
 * the other two, and Quill always emits at least a block-level wrapper.
 */

const HTML_PATTERN = /<(p|div|h[1-6]|ul|ol|li|br|strong|em|u|s|sub|sup|blockquote|pre|img|a|span|table)\b/i;

// Markdown that is unambiguous enough to be worth routing to the Markdown
// renderer: an ATX heading, a fenced block, a bullet or a table pipe row.
const MARKDOWN_PATTERN = /(^|\n)\s{0,3}(#{1,6}\s|```|[-*+]\s|\d+\.\s|\|.*\|)/;

const SANITISE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'div', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'del',
    'sub', 'sup',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
    'table', 'caption', 'thead', 'tbody', 'tr', 'th', 'td',
    'hr',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'style', 'colspan', 'rowspan'],
  // `data:image/svg+xml` is deliberately absent. An SVG loaded through <img> is
  // a sandboxed image context in current browsers and will not run its scripts,
  // but it is attack surface bought for nothing: Quill never produces one, so
  // the only source would be someone hand-posting HTML to the API.
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data:image\/(?:png|jpe?g|gif|webp));?|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  ADD_ATTR: ['target', 'rel'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'srcset', 'formaction'],
};

/**
 * CSS properties an author may set inline.
 *
 * DOMPurify strips scripting but passes `style` through largely intact, and a
 * style attribute alone is enough to do damage without a single line of
 * JavaScript: `position:fixed;width:100vw;height:100vh;z-index:9999` on a
 * comment in the class stream covers the entire page, and wrapped in a link it
 * becomes an in-page phishing overlay. Nobody needs positioning to write an
 * answer, so the allowlist is what Quill actually emits and nothing else.
 */
const ALLOWED_CSS = new Set([
  'color',
  'background-color',
  'font-size',
  'font-family',
  'font-weight',
  'font-style',
  'text-align',
  'text-decoration',
  'line-height',
  'padding-left',
  'margin-left',
  'vertical-align',
  'white-space',
]);

const safeStyle = (value) =>
  String(value)
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .filter((declaration) => {
      const [property, ...rest] = declaration.split(':');
      const body = rest.join(':');
      if (!ALLOWED_CSS.has(property.trim().toLowerCase())) return false;
      // Even on an allowed property: no url() and no expression(). `url()` in
      // CSS cannot execute script in any current browser, but it can silently
      // fetch a remote resource, which turns reading a comment into a beacon.
      return !/url\s*\(|expression\s*\(|@import/i.test(body);
    })
    .map((declaration) => declaration.trim())
    .join('; ');

/**
 * A DOMPurify instance of our own.
 *
 * Hooks are registered per instance, and the default export is shared with
 * every other module in this app. Adding the style filter to it would silently
 * change how the conference, review and timetable modules sanitise their
 * content — an improvement, probably, but not this module's call to make.
 */
const purify = typeof window !== 'undefined' && window.document ? createDOMPurify(window) : { addHook: () => {}, sanitize: (s) => String(s || '') };

purify.addHook('afterSanitizeAttributes', (node) => {
  if (node.hasAttribute?.('style')) {
    const cleaned = safeStyle(node.getAttribute('style'));
    if (cleaned) node.setAttribute('style', cleaned);
    else node.removeAttribute('style');
  }

  // A link opening in a new tab hands the opener to the target page unless
  // told otherwise, which is a redirect of the still-signed-in original.
  if (node.tagName === 'A' && node.getAttribute('target')) {
    node.setAttribute('rel', 'noopener noreferrer');
  }

  // ALLOWED_URI_REGEXP does not govern this. DOMPurify special-cases `data:` on
  // its built-in DATA_URI_TAGS — img among them — and lets any media type
  // through, so narrowing the regexp above is not on its own enough to keep
  // `data:image/svg+xml` out. Re-checking here is what actually excludes it.
  if (node.tagName === 'IMG') {
    const src = node.getAttribute('src') || '';
    if (/^data:/i.test(src) && !/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src)) {
      node.removeAttribute('src');
    }
    /* Something to say when the picture does not arrive.
     *
     * An <img> that fails renders as nothing at all — no box, no icon, on most
     * browsers not even a gap — and in an exam that is the worst possible
     * failure: a question written *about* a diagram reads as a question with no
     * diagram, and a student has no way to tell a picture that is missing from
     * one that was never meant to be there. They answer what they can see, and
     * nobody finds out until the marks are queried.
     *
     * Alt text is the part of this that needs no JavaScript and cannot race the
     * load, so it is set here; the effect below adds the visible frame. */
    if (!node.getAttribute('alt')) node.setAttribute('alt', IMAGE_MISSING_LABEL);
  }
});

/**
 * What stands in for a picture that did not load.
 *
 * Deliberately says the image is missing rather than naming a cause: the causes
 * are a locked-down browser refusing an off-site address, a connection that
 * dropped for one request, and a link that has rotted, and a student cannot act
 * differently on any of them. What they can act on is knowing there is something
 * they are not seeing — which is the difference between raising a hand and
 * answering a question they have only half of.
 */
const IMAGE_MISSING_LABEL = 'Image could not be loaded — tell your invigilator';

const PROSE_STYLES = {
  p: { mb: 2, lineHeight: 1.7, wordBreak: 'break-word', overflowWrap: 'anywhere' },
  'p:last-child': { mb: 0 },
  'ul, ol': { pl: 6, mb: 2, wordBreak: 'break-word' },
  li: { mb: 1, lineHeight: 1.7, wordBreak: 'break-word' },
  'h1, h2, h3, h4, h5, h6': { fontWeight: 700, mt: 3, mb: 1.5, lineHeight: 1.3, wordBreak: 'break-word' },
  h1: { fontSize: '1.4rem' },
  h2: { fontSize: '1.2rem' },
  h3: { fontSize: '1.05rem' },
  strong: { fontWeight: 700 },
  a: { color: 'blue.600', textDecoration: 'underline', wordBreak: 'break-all' },
  img: { maxWidth: '100%', height: 'auto', borderRadius: 'md', my: 2 },
  /* A picture that did not load, shown as a labelled gap. Without this the alt
     text sits in the paragraph flow looking like something the teacher wrote. */
  'img[data-lm-image-failed]': {
    display: 'block',
    width: 'fit-content',
    maxWidth: '100%',
    minWidth: '14rem',
    minHeight: '3rem',
    px: 3,
    py: 2,
    my: 2,
    fontSize: 'xs',
    fontStyle: 'italic',
    color: 'lmFg.muted',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'lmBorder.base',
    borderRadius: 'md',
    bg: 'lmBg.sunken',
  },
  blockquote: {
    borderLeftWidth: '4px',
    borderColor: 'gray.300',
    pl: 3,
    py: 1,
    my: 2,
    color: 'gray.600',
    fontStyle: 'italic',
    wordBreak: 'break-word',
  },
  code: { bg: 'gray.100', px: 1, borderRadius: 'sm', fontSize: '0.875em', fontFamily: 'mono', wordBreak: 'break-word' },
  pre: { bg: 'gray.900', color: 'gray.100', p: 3, borderRadius: 'md', overflowX: 'auto', my: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
  'pre code': { bg: 'transparent', color: 'inherit', p: 0 },
  // `table-layout: fixed` is what makes a table behave: the columns share the
  // available width, so a long cell wraps inside its column instead of
  // stretching the table past the page. That replaces the previous
  // `display: block` + horizontal scroll, which kept cells on one line and
  // pushed the overflow onto the reader.
  table: {
    width: '100%',
    maxWidth: '100%',
    my: 2,
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  },
  'th, td': {
    borderWidth: '1px',
    borderColor: 'lmBorder.base',
    px: 2,
    py: 1,
    fontSize: 'sm',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    verticalAlign: 'top',
  },
  th: { bg: 'lmBg.sunken', fontWeight: '700', textAlign: 'left' },
  caption: { captionSide: 'top', textAlign: 'left', fontSize: 'sm', fontWeight: '600', pb: 1 },
  'sub, sup': { fontSize: '0.75em' },
};

/**
 * @param {boolean} [markdown]
 *        Set by a caller that already knows the content is Markdown — a
 *        notebook's markdown cell, say, where the cell type says so outright.
 *        The sniff below only recognises *block* markers, so `**bold**` on its
 *        own would otherwise fall through to the plain-text branch and render
 *        as literal asterisks. HTML still wins: an .ipynb cell may hold raw
 *        HTML, and that is not markdown whatever the cell is labelled.
 */
export default function RichText({ children, fallback = null, markdown = false, ...rest }) {
  const source = String(children ?? '');
  const hostRef = useRef(null);

  const html = useMemo(() => {
    if (!HTML_PATTERN.test(source)) return null;
    return purify.sanitize(source, SANITISE_CONFIG);
  }, [source]);

  /* Mark the images that did not arrive, so the alt text above is shown in
     something a reader recognises as a gap rather than as a stray line of prose.
     
     Both halves matter and the second is the one that is easy to miss: an image
     may have failed *before* this effect runs — a `data:` src the sanitiser
     stripped fails immediately, and a cached failure can resolve within the same
     tick — and an `error` event that has already fired will never fire again. A
     complete image with no intrinsic width is exactly that case. */
  useEffect(() => {
    const host = hostRef.current;
    if (!host || html === null) return undefined;

    const images = [...host.querySelectorAll('img')];
    const mark = (img) => img.setAttribute('data-lm-image-failed', 'true');
    const onError = (event) => mark(event.target);

    images.forEach((img) => {
      if (!img.getAttribute('src') || (img.complete && img.naturalWidth === 0)) mark(img);
      else img.addEventListener('error', onError);
    });

    return () => images.forEach((img) => img.removeEventListener('error', onError));
  }, [html]);

  if (!source.trim()) return fallback;

  if (html !== null) {
    return (
      <Box
        ref={hostRef}
        className="lm-richtext"
        sx={PROSE_STYLES}
        color="lmFg.body"
        fontSize="sm"
        // Sanitised immediately above with an explicit tag/attribute allowlist.
        dangerouslySetInnerHTML={{ __html: html }}
        {...rest}
      />
    );
  }

  if (markdown || MARKDOWN_PATTERN.test(source)) {
    return <Markdown {...rest}>{source}</Markdown>;
  }

  return (
    <Text whiteSpace="pre-wrap" wordBreak="break-word" overflowWrap="anywhere" color="lmFg.body" fontSize="sm" {...rest}>
      {source}
    </Text>
  );
}

