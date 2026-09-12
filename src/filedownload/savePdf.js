import { isNativeApp, downloadBase64Native } from '../utils/nativeCapabilities';

/**
 * Hands a finished PDF to the user.
 *
 * On the web an anchor with `download`, or pdfMake's own `.download()`, is
 * exactly right. In the app it is not: the WebView cannot save a blob: URL, so
 * `.open()` and a download anchor both end up as an off-origin navigation that
 * Android hands to the external browser — the PDF leaves the app and is never
 * saved. See src/utils/nativeCapabilities.js for the rest of that story.
 *
 * So on native the bytes go through Capacitor's Filesystem into the public
 * Downloads folder (Share sheet on iOS), which is what the quiz export already
 * does — this is the same branch, shared.
 */

const sanitize = (name) => {
  // Keep it to characters every filesystem accepts — Android's Downloads
  // folder and the iOS Share sheet both take the name verbatim.
  const cleaned = String(name || 'document').replace(/[^\w.\- ]+/g, '_').trim();
  const withName = cleaned || 'document';
  return /\.pdf$/i.test(withName) ? withName : `${withName}.pdf`;
};

/** Saves a pdfMake document definition as `fileName`. */
export const savePdfDoc = (docDefinition, fileName) => {
  const pdfMake = globalThis.pdfMake;
  if (!pdfMake) throw new Error('PDF generator library is not initialized.');

  const name = sanitize(fileName);
  const doc = pdfMake.createPdf(docDefinition);

  if (!isNativeApp()) {
    doc.download(name);
    return;
  }

  doc.getBase64(async (base64Data) => {
    try {
      await downloadBase64Native(base64Data, name, 'application/pdf');
    } catch (err) {
      // downloadBase64Native already tells the user; this only keeps the
      // failure from surfacing as an unhandled rejection inside the callback.
      console.error('Saving the PDF failed:', err);
    }
  });
};

/** Saves already-rendered PDF bytes (Uint8Array / ArrayBuffer) as `fileName`. */
export const savePdfBytes = async (bytes, fileName) => {
  const name = sanitize(fileName);
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  if (!isNativeApp()) {
    const url = URL.createObjectURL(new Blob([view], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    // The link has to be in the document for the download to fire reliably,
    // and the URL can only be revoked once the browser has picked it up.
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  // btoa() takes a binary string, and spreading a multi-megabyte array into
  // String.fromCharCode blows the argument limit — so chunk it.
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < view.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, view.subarray(i, i + CHUNK));
  }
  await downloadBase64Native(btoa(binary), name, 'application/pdf');
};

export default savePdfDoc;
