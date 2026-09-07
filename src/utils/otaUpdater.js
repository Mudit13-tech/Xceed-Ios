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
 * The file list for a delta download, or null to fetch the whole bundle.
 *
 * Two shapes are accepted because the server is free to choose either: the
 * manifest inline on version.json, or a `manifest_url` pointing at it. Prefer
 * publishing the url — see the note at the call site on why this bundle's
 * manifest does not belong in a response fetched on every launch. What an entry
 * means, and why its hash describes the file on disk rather than the bytes on
 * the wire, is in scripts/otaManifest.cjs.
 *
 * Every failure here returns null rather than throwing. A manifest is an
 * optimisation; not being able to read one is a reason to download the bundle
 * the old way, not a reason to leave the user on a stale version.
 */
async function resolveManifest(versionData, serverUrl) {
  if (Array.isArray(versionData?.manifest) && versionData.manifest.length > 0) {
    return versionData.manifest;
  }

  const manifestUrl = versionData?.manifest_url;
  if (!manifestUrl) {
    console.log('[OTA] Server published no manifest — downloading the full bundle.');
    return null;
  }

  const absoluteUrl = manifestUrl.startsWith('http')
    ? manifestUrl
    : `${serverUrl}${manifestUrl.startsWith('/') ? '' : '/'}${manifestUrl}`;

  try {
    const { data } = await axios.get(absoluteUrl);
    const entries = Array.isArray(data) ? data : data?.manifest;
    if (Array.isArray(entries) && entries.length > 0) {
      return entries;
    }
    console.log('[OTA] Manifest was empty — downloading the full bundle.');
    return null;
  } catch (error) {
    console.log('[OTA] Could not fetch manifest, downloading the full bundle.', error);
    return null;
  }
}

/**
 * Log how much of the update the device actually has to fetch.
 *
 * Purely diagnostic — the plugin does this comparison again internally, against
 * the APK's builtin assets and its own cache, and downloads accordingly whether
 * or not this ran. It is here because the saving is otherwise invisible: a
 * delta download and a full one look identical from the outside.
 *
 * getMissingBundleFiles landed in plugin 8.47.0, and the installed APK may be
 * older than the web bundle asking for it — that skew is the normal state of
 * things here, so a missing method is expected and reported as nothing at all.
 */
async function logDeltaSize(manifest, version) {
  try {
    const result = await CapacitorUpdater.getMissingBundleFiles({ manifest, version });
    const missing = result?.missing?.length ?? 0;
    const total = result?.total ?? manifest.length;
    console.log(`[OTA] Delta: fetching ${missing} of ${total} files; ${total - missing} already on device.`);
  } catch (e) {
    console.log('[OTA] Delta size unavailable on this build.', e);
  }
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

      // Resolve the manifest only now, once an update is actually going to
      // happen. It is ~140 kB for this bundle, and this check runs on every
      // launch — inlining it in version.json would put that on every user every
      // time they open the app to save it for the few who have an update to take.
      const manifest = await resolveManifest(response.data, serverUrl);

      // Notify updater to start downloading
      const downloadOptions = {
        url: downloadUrl,
        version: latestVersion,
      };
      if (manifest) {
        // Absent this the plugin fetches `url` — the whole bundle — exactly as
        // before. That is also what an APK whose plugin predates manifest
        // support does with it: unknown options are ignored rather than
        // rejected, so a new server stays safe for an old app.
        downloadOptions.manifest = manifest;
        await logDeltaSize(manifest, latestVersion);
      }

      const versionData = await CapacitorUpdater.download(downloadOptions);

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
