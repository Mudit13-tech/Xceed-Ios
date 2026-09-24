/**
 * Device capabilities — the web implementation.
 *
 * The mobile app (xceed-app) builds from this same client and swaps this file
 * for `nativeCapabilities.mobile.js`, which does these things through
 * Capacitor. Here every function takes its web path, so this repo carries no
 * Capacitor dependency and the web build is unaffected by any of it. Keep the
 * exports and their signatures in step with that file. See src/mobile/README.md.
 */

/** Whether this is the installed app. Never, in the web build. */
export const isNativeApp = () => false;

const clickDownload = (href, fileName) => {
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

/** Downloads `url` as `fileName`. */
export const downloadFileNative = async (url, fileName) => {
  clickDownload(url, fileName);
};

/** Downloads base64 content as `fileName`. */
export const downloadBase64Native = async (base64Data, fileName, mimeType = 'application/pdf') => {
  clickDownload(`data:${mimeType};base64,${base64Data}`, fileName);
};

/** The native file picker. Callers keep their own <input type="file">. */
export const pickFileNative = async () => null;

/** The native camera. Callers keep their own upload control. */
export const takePhotoNative = async () => null;

/**
 * Props for a link to a file the API serves — an attachment, a submission, a
 * generated report. On the web an ordinary external anchor is exactly right.
 * (In the app an anchor to the API host is routed back into the app by its
 * app-links filter, so there the tap becomes a native download instead.)
 */
export const serverFileLinkProps = (url) => (url ? { href: url, isExternal: true } : { href: url });

/**
 * Where a site-relative media url (`/explainer-videos/x.mp4`) should load from.
 * On the web, from this origin, so it is returned unchanged. (The app's pages
 * are served from a local origin, so there it is anchored to the API host.)
 */
export const mediaUrl = (url) => url;
