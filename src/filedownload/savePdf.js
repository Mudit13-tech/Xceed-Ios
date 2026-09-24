import { isNativeApp, downloadBase64Native } from '../utils/nativeCapabilities';

/**
 * Hands a finished PDF to the user.
 *
 * On the web this does exactly what the call sites did before it existed:
 * pdfMake's own `.download()` / `.open()`, or an anchor with `download` for raw
 * bytes. Nothing about the web path changed when they were routed through here.
 *
 * In the mobile app it cannot: the WebView cannot save a blob: URL, so
 * `.open()` and a download anchor both end up as an off-origin navigation that
 * Android hands to the external browser — the PDF leaves the app and is never
 * saved. So on native the bytes go through Capacitor's Filesystem into the
 * public Downloads folder (Share sheet on iOS). `isNativeApp()` is always false
 * in this repo's build; see src/mobile/README.md.
 */

// Native only. Android's Downloads folder and the iOS Share sheet take the name
// verbatim, so keep it to characters every filesystem accepts. The web path
// passes the caller's name through untouched, as it always did.
const sanitize = (name) => {
  const cleaned = String(name || 'document').replace(/[^\w.\- ]+/g, '_').trim();
  const withName = cleaned || 'document';
  return /\.pdf$/i.test(withName) ? withName : `${withName}.pdf`;
};

/**
 * Saves a pdfMake document definition as `fileName`.
 *
 * `web` is what the browser does with it, and exists so each call site keeps
 * the behaviour it had: 'download' (the default), 'open' (a new tab), or both.
 */
export const savePdfDoc = (docDefinition, fileName, { web = 'download' } = {}) => {
  const pdfMake = globalThis.pdfMake;
  if (!pdfMake) throw new Error('PDF generator library is not initialized.');

  if (!isNativeApp()) {
    const actions = Array.isArray(web) ? web : [web];
    for (const action of actions) {
      const doc = pdfMake.createPdf(docDefinition);
      if (action === 'open') doc.open();
      else doc.download(fileName);
    }
    return;
  }

  pdfMake.createPdf(docDefinition).getBase64(async (base64Data) => {
    try {
      await downloadBase64Native(base64Data, sanitize(fileName), 'application/pdf');
    } catch (err) {
      // downloadBase64Native already tells the user; this only keeps the
      // failure from surfacing as an unhandled rejection inside the callback.
      console.error('Saving the PDF failed:', err);
    }
  });
};

/** Saves already-rendered PDF bytes (Uint8Array / ArrayBuffer) as `fileName`. */
export const savePdfBytes = async (bytes, fileName) => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  if (!isNativeApp()) {
    const url = URL.createObjectURL(new Blob([view], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
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
  await downloadBase64Native(btoa(binary), sanitize(fileName), 'application/pdf');
};

export default savePdfDoc;
