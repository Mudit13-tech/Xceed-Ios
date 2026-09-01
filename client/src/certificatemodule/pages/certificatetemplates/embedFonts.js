// html2canvas's foreignObject renderer serialises the certificate into an SVG
// and loads it through `new Image()`. An SVG loaded as an image runs in a
// restricted context that cannot fetch external resources, and that includes
// webfonts — so every Google Font the certificate designer offers silently
// falls back to a generic in the capture. Different metrics mean different text
// widths, which moves every centred and wrapped line: the downloaded
// certificate comes out the right size with its text in the wrong places.
//
// The way out is to give the serialised SVG its own fonts. This module builds a
// stylesheet of @font-face rules whose `src` is a base64 data URI rather than a
// URL — data URIs are not "external", so they load in the image context.

const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
  'inherit',
  'initial',
  'unset',
  'auto',
]);

// Embedding is the slow part of a download (a handful of network round trips),
// and the answer never changes within a session.
const cssCache = new Map();

/** Every non-generic font family named anywhere inside `root`. */
export const collectFontFamilies = (root) => {
  const families = new Set();
  const nodes = [root, ...root.querySelectorAll('*')];

  for (const node of nodes) {
    const declared = window.getComputedStyle(node).fontFamily;
    if (!declared) continue;

    for (const part of declared.split(',')) {
      const name = part.trim().replace(/^["']|["']$/g, '');
      if (name && !GENERIC_FAMILIES.has(name.toLowerCase())) {
        families.add(name);
      }
    }
  }

  return [...families];
};

const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Chunked, because String.fromCharCode(...bytes) blows the call stack on
  // anything bigger than a small font subset.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return window.btoa(binary);
};

/**
 * Fetch one family's @font-face rules from Google Fonts. Families that are not
 * hosted there (a name typed by hand, a locally installed face) simply come
 * back empty rather than failing the whole download.
 */
const fetchFamilyCss = async (family) => {
  const url =
    'https://fonts.googleapis.com/css2?family=' +
    encodeURIComponent(family).replace(/%20/g, '+') +
    '&display=swap';

  try {
    const response = await fetch(url);
    return response.ok ? await response.text() : '';
  } catch {
    return '';
  }
};

/** Replace every remote font URL in `css` with an inline base64 data URI. */
const inlineFontUrls = async (css) => {
  const urls = [
    ...new Set(
      [...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((match) => match[1])
    ),
  ];

  const inlined = await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const buffer = await response.arrayBuffer();
        // Google Fonts serves woff2 to any browser that can run this code.
        const format = url.endsWith('.woff') ? 'woff' : 'woff2';
        return [url, `data:font/${format};base64,${bufferToBase64(buffer)}`];
      } catch {
        return null;
      }
    })
  );

  let result = css;
  for (const entry of inlined) {
    if (entry) result = result.split(entry[0]).join(entry[1]);
  }

  // Any face whose binary could not be fetched would fall back anyway, so drop
  // it rather than shipping a rule pointing at a URL the image cannot load.
  return result
    .split('@font-face')
    .filter((block, index) => index === 0 || block.includes('data:font/'))
    .join('@font-face');
};

/**
 * A stylesheet carrying every webfont used inside `root`, with the font
 * binaries inlined. Returns '' when there is nothing to embed or the fonts
 * cannot be reached — the caller should treat that as "capture anyway".
 */
export const buildEmbeddedFontCss = async (root) => {
  const families = collectFontFamilies(root);
  if (!families.length) return '';

  const key = [...families].sort().join('|');
  if (cssCache.has(key)) return cssCache.get(key);

  const sheets = await Promise.all(families.map(fetchFamilyCss));
  const combined = sheets.filter(Boolean).join('\n');
  const css = combined ? await inlineFontUrls(combined) : '';

  cssCache.set(key, css);
  return css;
};
