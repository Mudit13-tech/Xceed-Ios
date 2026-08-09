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
