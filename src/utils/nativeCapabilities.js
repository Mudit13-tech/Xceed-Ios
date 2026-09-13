import { Capacitor, CapacitorCookies, registerPlugin } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Browser } from '@capacitor/browser';
import { Filesystem, Directory } from '@capacitor/filesystem';
import getEnvironment from '../getenvironment';
import { appToast } from './appToast';

const Downloads = registerPlugin('Downloads');

/**
 * Checks if the app is running as a native app (iOS or Android)
 */
export const isNativeApp = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Saves a file into the device's public Downloads folder. Android's native
 * DownloadManager streams the response to disk, so large files do not occupy
 * WebView memory and can keep downloading in the background.
 */
export const downloadFileNative = async (url, fileName) => {
  if (!isNativeApp()) {
    // Fallback for web
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    appToast({
      status: 'success',
      title: 'Downloaded successfully',
      description: `${fileName || 'Your file'} — check your Downloads folder.`,
    });
    return;
  }

  try {
    // DownloadManager only accepts absolute http(s) URLs. The download buttons
    // use paths such as `/subject_template.xlsx`, which browsers resolve for
    // us but native Android does not.
    const downloadUrl = new URL(url, window.location.href).href;

    // iOS does not expose a public Downloads directory to apps, so the file
    // goes through "Save to Files" -- but it has to be fetched here first.
    //
    // Handing Share.share() the https URL let iOS fetch it, and iOS fetches as
    // itself: no bearer token, and no cookie either, since the API cookie is
    // cross-site to this WebView (see the Android branch below, and
    // src/mobile/httpSession.js). The server answered {"message":"Unauthorized"}
    // and that JSON is what the user was handed -- the preview sheet rendered
    // it in place of the assignment. Android never hit this because
    // DownloadManager is given the session explicitly.
    //
    // So the request is made here, where the session exists, and iOS is handed
    // a local file rather than a URL. downloadBase64Native already knows how to
    // write to Cache and present the share sheet.
    if (Capacitor.getPlatform() !== 'android') {
      const iosHeaders = {};
      const iosToken = localStorage.getItem('token');
      // Same-origin check as the Android branch: a download URL pointing
      // anywhere else must not be handed the user's token.
      if (iosToken && new URL(downloadUrl).origin === new URL(getEnvironment()).origin) {
        iosHeaders.Authorization = `Bearer ${iosToken}`;
      }

      const response = await fetch(downloadUrl, { headers: iosHeaders, credentials: 'omit' });
      if (!response.ok) {
        throw new Error(`Server returned ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        // readAsDataURL yields "data:<mime>;base64,<payload>"; Filesystem wants
        // only the payload.
        reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      return await downloadBase64Native(
        base64,
        fileName,
        blob.type || 'application/octet-stream',
      );
    }

    // DownloadManager is outside the WebView, so explicitly forward the
    // session cookies needed by authenticated file endpoints.
    const cookies = await CapacitorCookies.getCookies({ url: downloadUrl });
    const cookieHeader = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    const headers = cookieHeader ? { Cookie: cookieHeader } : {};

    // The cookie alone is not the whole session. In the app the WebView is
    // served from a different origin than the API, so the API's cookie is a
    // cross-site one and may not be in the jar at all; the bearer token in
    // localStorage is what every lmApi call actually authenticates with. Sent
    // only to our own API origin — a download URL pointing anywhere else must
    // not be handed the user's token.
    const token = localStorage.getItem('token');
    if (token && new URL(downloadUrl).origin === new URL(getEnvironment()).origin) {
      headers.Authorization = `Bearer ${token}`;
    }

    const result = await Downloads.download({ url: downloadUrl, fileName, headers });

    // DownloadManager has the file and posts its own progress notification from
    // here, so this is the point the tap is known to have worked — the same
    // green box the web build shows.
    appToast({
      status: 'success',
      title: 'Downloaded successfully',
      description: `${fileName || 'Your file'} — check your Downloads folder.`,
    });
    return result;
  } catch (error) {
    console.error('Native download failed', error);
    appToast({
      status: 'error',
      title: 'Download failed',
      description: 'Could not start the download. Please try again.',
      duration: 6000,
    });
    throw error;
  }
};

/**
 * Saves a base64 string to a file on the device.
 * On Android, attempts to save to the public Downloads folder via ExternalStorage.
 * On iOS, saves to Cache and presents the Share sheet.
 */
export const downloadBase64Native = async (base64Data, fileName, mimeType = 'application/pdf') => {
  if (!isNativeApp()) {
    // Fallback for web
    const a = document.createElement('a');
    a.href = `data:${mimeType};base64,${base64Data}`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    appToast({
      status: 'success',
      title: 'Downloaded successfully',
      description: `${fileName} — check your Downloads folder.`,
    });
    return;
  }

  try {
    if (Capacitor.getPlatform() !== 'android') {
      // iOS doesn't have a public Downloads folder accessible without the Share sheet
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });
      return await Share.share({
        title: fileName,
        url: result.uri,
        dialogTitle: 'Save file',
      });
    }

    // Android: attempt to write to Downloads folder via ExternalStorage
    try {
      const result = await Filesystem.writeFile({
        path: `Download/${fileName}`,
        data: base64Data,
        directory: Directory.ExternalStorage,
        recursive: true
      });
      appToast({
        status: 'success',
        title: 'Downloaded successfully',
        description: `${fileName} — check your Downloads folder.`,
      });
      return result;
    } catch (e) {
      console.warn('Failed writing to Download/, falling back to Documents/', e);
      const fallbackResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
      });
      appToast({
        status: 'success',
        title: 'Downloaded successfully',
        description: `${fileName} — check your Documents folder.`,
      });
      return fallbackResult;
    }
  } catch (error) {
    console.error('Native base64 save failed', error);
    appToast({
      status: 'error',
      title: 'Download failed',
      description: 'Could not save the file. Please try again.',
      duration: 6000,
    });
    throw error;
  }
};

/**
 * Opens the native file picker to select a file from the phone.
 * @param {object} options Optional settings (e.g., types, multiple)
 */
export const pickFileNative = async (options = { multiple: false }) => {
  if (!isNativeApp()) {
    // We could fallback to an input element here, but usually the calling
    // component has its own web fallback input element.
    console.warn('Native file picker called on web environment');
    return null;
  }

  try {
    const result = await FilePicker.pickFiles(options);
    return result.files; // Array of selected files
  } catch (error) {
    console.error('Error picking file', error);
    return null;
  }
};

/**
 * Opens the native camera to take a photo.
 */
export const takePhotoNative = async () => {
  if (!isNativeApp()) {
    alert('Camera is only supported in the native app.');
    return null;
  }

  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
    });
    return photo;
  } catch (error) {
    console.error('Error taking photo', error);
    return null;
  }
};

/**
 * `name` with the URL's extension appended when it has none of its own.
 *
 * An attachment's display name is whatever the uploader typed — "Lecture 3
 * notes" as often as "notes.pdf" — and DownloadManager writes the name it is
 * given verbatim. A file saved without its extension is one Android cannot
 * hand to a viewer, so the tap succeeds and the student still cannot read it.
 */
const withExtension = (name, url) => {
  if (!name) return undefined;
  if (/\.[a-z0-9]{2,5}$/i.test(name)) return name;
  const ext = new URL(url, window.location.href).pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  return ext ? `${name}.${ext}` : name;
};

/**
 * Props for a link to a file the API serves — an attachment, a submission, a
 * generated report.
 *
 * On the web an ordinary anchor is exactly right, and this returns one.
 *
 * In the app it must not be one. The WebView is served from
 * xceed.learning.app (capacitor.config.json) while files come from the API
 * host, so an anchor is an off-origin navigation: Capacitor hands it to Android
 * as an ACTION_VIEW intent, the app-links filter in AndroidManifest.xml claims
 * every URL on the API host — `/api/...` included — and Android routes the file
 * back into this app instead of opening it. See src/utils/deepLink.js for the
 * rest of that loop and the net::ERR_INVALID_RESPONSE it ended in.
 *
 * So on native the tap goes to Android's DownloadManager instead, with the
 * session forwarded, which streams the file to Downloads and posts the
 * notification that opens it.
 */
export const serverFileLinkProps = (url, fileName) => {
  if (!url) return { href: url };
  if (!isNativeApp()) return { href: url, isExternal: true };
  return {
    href: url,
    onClick: (event) => {
      event.preventDefault();
      // downloadFileNative already tells the user when it cannot start; this
      // only keeps the failure from surfacing as an unhandled rejection.
      downloadFileNative(url, withExtension(fileName, url)).catch(() => {});
    },
  };
};
