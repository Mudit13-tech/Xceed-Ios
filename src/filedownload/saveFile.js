import { isNativeApp, downloadBase64Native } from '../utils/nativeCapabilities';

/**
 * Hands a file built in the browser — a CSV, a spreadsheet, anything held as a
 * Blob — to the user. savePdf.js is the same thing for PDFs.
 *
 * On the web this is the usual download anchor over an object URL, which is
 * what the call sites did before it existed.
 *
 * In the mobile app that anchor does nothing: the WebView cannot save a blob:
 * URL, so the tap is silently dropped. So on native the bytes go through
 * `nativeCapabilities` into the public Downloads folder (Share sheet on iOS),
 * which also tells the user where the file went, or that saving failed.
 * `isNativeApp()` is always false in this repo's build; see src/mobile/README.md.
 */

// Native only. Android's Downloads folder and the iOS Share sheet take the name
// verbatim, so keep it to characters every filesystem accepts. The web path
// passes the caller's name through untouched.
const sanitize = (name) => String(name || 'download').replace(/[^\w.\- ]+/g, '_').trim() || 'download';

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    // A data: URL, so the base64 is everything after the first comma.
    reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(',') + 1));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Saves `blob` as `fileName`. Rejects if the app could not save it. */
export const saveBlob = async (blob, fileName) => {
  if (!isNativeApp()) {
    const url = URL.createObjectURL(blob);
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

  await downloadBase64Native(await toBase64(blob), sanitize(fileName), blob.type || 'application/octet-stream');
};

export default saveBlob;
