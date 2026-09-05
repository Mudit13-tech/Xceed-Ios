import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { App as CapacitorApp } from '@capacitor/app';
import axios from 'axios';
import getEnvironment from '../getenvironment';

// Helper to compare semantic versions (e.g. 1.0.1 vs 1.0.2)
function compareVersions(v1, v2) {
  const p1 = (v1 || '0').split('.').map(Number);
  const p2 = (v2 || '0').split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

/**
 * @param onUpdateDownloaded optional. Called with the new version number once
 *   the bundle is on disk, and awaited before the update is applied. The
 *   plain `alert()` this replaces was synchronous, and the apply below relied
 *   on that: it only ran once the box had been dismissed. A rendered dialog
 *   does not block, so it returns a promise instead and resolves it when the
 *   user presses the button, keeping the same order.
 * @param onUpdateFailed optional. Called when the check or download did not
 *   finish. Nothing is awaited on this one — it only reports.
 */
export async function setupOtaUpdater({ onUpdateDownloaded, onUpdateFailed } = {}) {
  // Only run in native context (iOS/Android)
  if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
    console.log('[OTA] Running in browser, skipping OTA update check.');
    return;
  }

  try {
    // Notify Capgo that this version successfully booted (prevents rollbacks)
    await CapacitorUpdater.notifyAppReady();

    const serverUrl = getEnvironment();
    const versionUrl = `${serverUrl}/api/v1/ota/version.json`;

    console.log(`[OTA] Checking for updates at ${versionUrl}`);
    const response = await axios.get(versionUrl);
    const latestVersion = response.data.version;
    const rawUrl = response.data.url;
    // If the server returns a relative URL, prepend the server URL
    const downloadUrl = rawUrl.startsWith('http') ? rawUrl : `${serverUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;

    if (!latestVersion || latestVersion === '0.0.0') {
      console.log('[OTA] No updates available on server.');
      return;
    }

    // Get the native version from Google Play / APK
    const info = await CapacitorApp.getInfo();
    const nativeVersion = info.version; // e.g. "1.0.0"
    
    // Get currently running bundle version from Capgo
    let activeVersion = nativeVersion;
    try {
      const currentBundle = await CapacitorUpdater.current();
      if (currentBundle && currentBundle.bundle && currentBundle.bundle.version) {
        activeVersion = currentBundle.bundle.version;
      }
    } catch (e) {
      console.log('[OTA] No active bundle found or error getting current bundle, using native version', e);
    }

    console.log(`[OTA] Native Version: ${nativeVersion}, Active Bundle Version: ${activeVersion}, Latest Available: ${latestVersion}`);



    // If the native app version is strictly greater than the latest OTA available,
    // (e.g. they just downloaded a major update from Play Store), we don't need OTA.
    if (compareVersions(nativeVersion, latestVersion) >= 0) {
      console.log(`[OTA] Native app (${nativeVersion}) is up to date or newer than OTA (${latestVersion}).`);
      return;
    }

    // Only download if the server version is strictly GREATER than our currently running version
    if (compareVersions(latestVersion, activeVersion) > 0) {
      console.log(`[OTA] Found update ${latestVersion}! Downloading from: ${downloadUrl}`);
      
      // Notify updater to start downloading
      const versionData = await CapacitorUpdater.download({
        url: downloadUrl,
        version: latestVersion,
      });

      console.log(`[OTA] Download complete! Applying update immediately...`);
      
      if (onUpdateDownloaded) {
        await onUpdateDownloaded(latestVersion);
      }
      
      // Apply immediately so the app reloads and user sees the change right away
      await CapacitorUpdater.set({ id: versionData.id });
    } else {
      console.log(`[OTA] App is up to date (Running Version ${activeVersion}).`);
    }
  } catch (error) {
    if (onUpdateFailed) {
      onUpdateFailed();
    }
    console.error('[OTA] Update check failed', error);
  }
}
