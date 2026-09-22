/**
 * Getting the pictures in a question into a PDF.
 *
 * Both generators need the same thing and neither can take a URL: pdfmake wants
 * the bytes up front in the browser, and jsPDF's `addImage` wants a data URI or
 * a decoded element. So every image is resolved to a `data:` URI before the
 * document is built.
 *
 * Most already are one. The editor is stock Quill with its default image
 * handler, which embeds an inserted picture as base64 — so the common case
 * costs nothing and never touches the network. A `src` that is a URL (typed by
 * hand, or carried in by an import) is fetched with credentials, because the
 * module's own `/files/` route is behind the session cookie.
 *
 * Nothing here throws. A picture that cannot be fetched — offline, deleted,
 * a cross-origin host with no CORS headers — comes back null, and the caller
 * prints a line saying an image is missing rather than dropping it silently.
 * A teacher proof-reading a paper needs to know a diagram did not make it.
 */

/** The biggest picture worth embedding, in bytes of base64. */
const MAX_BYTES = 8 * 1024 * 1024;

const isDataUri = (src) => /^data:/i.test(String(src || ''));

const blobToDataUri = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });

/**
 * One `src` as a data URI, or null if it cannot be had.
 *
 * Exported for the tests; callers want `resolveImages` below, which caches.
 */
export async function toDataUri(src) {
  const value = String(src || '');
  if (!value) return null;
  if (isDataUri(value)) return value.length > MAX_BYTES ? null : value;

  try {
    const response = await fetch(value, { credentials: 'include' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob || !blob.type.startsWith('image/')) return null;
    if (blob.size > MAX_BYTES) return null;
    return await blobToDataUri(blob);
  } catch {
    return null;
  }
}

/**
 * Resolves every distinct image in a set of rich-text blocks, once each.
 *
 * Takes the block lists rather than the raw HTML so a caller can hand over
 * everything in the paper — prompts, options, explanations — in one pass and
 * get a single map back, which is what keeps a question used twice from being
 * fetched twice.
 *
 * Returns a Map from src to data URI. A src that could not be resolved is
 * absent from the map, which is how the caller tells the two apart.
 */
export async function resolveImages(blockLists) {
  const sources = new Set();
  (blockLists || []).forEach((blocks) => {
    (blocks || []).forEach((block) => {
      if (block?.type === 'image' && block.src) sources.add(block.src);
    });
  });

  const resolved = new Map();
  await Promise.all(
    [...sources].map(async (src) => {
      const dataUri = await toDataUri(src);
      if (dataUri) resolved.set(src, dataUri);
    }),
  );
  return resolved;
}

/**
 * How big to draw a picture, given its natural size and the room available.
 *
 * Never upscales — a 60px icon blown up to the full column width is worse than
 * the icon — and caps the height so one tall diagram cannot take a whole page
 * on its own and push the question it belongs to onto the next one.
 */
export function fitImage(natural, { maxWidth, maxHeight = 320 }) {
  const width = Number(natural?.width) || 0;
  const height = Number(natural?.height) || 0;
  if (!width || !height) return { width: maxWidth, height: undefined };

  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: width * scale, height: height * scale };
}
