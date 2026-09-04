/**
 * The query cache, on a device.
 *
 * A full replacement rather than a wrapper: the AMS original is a *sync*
 * persister over window.localStorage, and neither half survives the move. The
 * WebView's localStorage is cleared by the system under storage pressure — the
 * cache it is meant to protect is exactly what goes first — and Capacitor
 * Preferences is async, so the persister type itself has to change. There is no
 * seam between the two versions to share.
 *
 * Because this replaces the file outright it inherits nothing from AMS. That is
 * fine here (five lines upstream, unchanged in 55 of 56 syncs) but it is a real
 * cost: run npm run drift to see anything upstream has changed here.
 * See build/mobileOverrides.js.
 */
import { Preferences } from '@capacitor/preferences';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const capacitorStorage = {
  getItem: async (key) => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key, value) => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key) => {
    await Preferences.remove({ key });
  },
};

export const queryPersister = createAsyncStoragePersister({
  storage: capacitorStorage,
});
