import { Capacitor, CapacitorCookies, registerPlugin } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Browser } from '@capacitor/browser';
import { Filesystem, Directory } from '@capacitor/filesystem';

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
    return;
  }

  try {
    // DownloadManager only accepts absolute http(s) URLs. The download buttons
    // use paths such as `/subject_template.xlsx`, which browsers resolve for
    // us but native Android does not.
    const downloadUrl = new URL(url, window.location.href).href;

    // iOS does not expose a public Downloads directory to apps. Keep its
    // platform-standard "Save to Files" flow instead of calling Android code.
    if (Capacitor.getPlatform() !== 'android') {
      return await Share.share({
        title: fileName,
        text: `Save ${fileName} to Files`,
        url: downloadUrl,
        dialogTitle: 'Save file',
      });
    }

    // DownloadManager is outside the WebView, so explicitly forward the
    // session cookies needed by authenticated file endpoints.
    const cookies = await CapacitorCookies.getCookies({ url: downloadUrl });
    const cookieHeader = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    return await Downloads.download({
      url: downloadUrl,
      fileName,
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
    });
  } catch (error) {
    console.error('Native download failed', error);
    alert('Could not start the download. Please try again.');
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
      alert(`File saved to Downloads folder as ${fileName}`);
      return result;
    } catch (e) {
      console.warn('Failed writing to Download/, falling back to Documents/', e);
      const fallbackResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
      });
      alert(`File saved to Documents folder as ${fileName}`);
      return fallbackResult;
    }
  } catch (error) {
    console.error('Native base64 save failed', error);
    alert('Could not save the file. Please try again.');
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
