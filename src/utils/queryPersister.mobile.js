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
 * Because this replaces the file outright it inherits nothing from AMS - with
 * the one exception re-exported at the bottom. Run npm run drift to see what
 * upstream has changed here. See build/mobileOverrides.js.
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

/**
 * Which queries may be written to storage, taken straight from AMS rather than
 * copied down here.
 *
 * The predicate names the query keys that describe who is signed in; nothing
 * about it is storage-specific, so the reason this file exists at all does not
 * apply to it. Copying it would mean a privacy allowlist that stops growing
 * when AMS adds a key to it - the one kind of drift worth paying to avoid.
 *
 * `./queryPersister` from inside the override reaches the real AMS module (see
 * build/mobileOverrides.js), which does construct its localStorage persister on
 * the way past. That object is never used here, and the WebView has a
 * localStorage for it to be built over.
 */
export { shouldPersistQuery } from './queryPersister';
