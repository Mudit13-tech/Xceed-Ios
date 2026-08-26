import { useState, useEffect } from 'react';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

export function useAccountManager() {
  const [accounts, setAccounts] = useState([]);
  const [lastActiveEmail, setLastActiveEmail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLegacyData, setHasLegacyData] = useState(false);

  useEffect(() => {
    loadStorage();
  }, []);

  const loadStorage = async () => {
    try {
      setIsLoading(true);
      
      let foundLegacy = false;
      // Check for legacy keys
      try {
        const legacyPin = await SecureStoragePlugin.get({ key: 'user_pin' });
        if (legacyPin.value) foundLegacy = true;
      } catch (e) {}
      
      try {
        const legacyToken = await SecureStoragePlugin.get({ key: 'auth_token' });
        if (legacyToken.value) foundLegacy = true;
      } catch (e) {}

      if (foundLegacy) {
        setHasLegacyData(true);
      }

      // Check for new accounts array
      try {
        const accountsStr = await SecureStoragePlugin.get({ key: 'saved_accounts' });
        if (accountsStr.value) {
          setAccounts(JSON.parse(accountsStr.value));
          setHasLegacyData(false); // If they have new accounts, we don't care about wiping legacy
        }
      } catch (e) {
        setAccounts([]);
      }

      // Check for last active email
      try {
        const activeStr = await SecureStoragePlugin.get({ key: 'last_active_email' });
        if (activeStr.value) {
          setLastActiveEmail(activeStr.value);
        }
      } catch (e) {
        setLastActiveEmail(null);
      }
    } catch (e) {
      console.error('Failed to load secure storage', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAccount = async (accountData) => {
    // accountData: { email, token, pin, name }
    const updatedAccounts = [...accounts];
    const existingIndex = updatedAccounts.findIndex(a => a.email === accountData.email);
    
    if (existingIndex >= 0) {
      updatedAccounts[existingIndex] = { ...updatedAccounts[existingIndex], ...accountData };
    } else {
      updatedAccounts.push(accountData);
    }

    setAccounts(updatedAccounts);
    setLastActiveEmail(accountData.email);

    await SecureStoragePlugin.set({ key: 'saved_accounts', value: JSON.stringify(updatedAccounts) });
    await SecureStoragePlugin.set({ key: 'last_active_email', value: accountData.email });
  };

  const removeAccount = async (email) => {
    const updatedAccounts = accounts.filter(a => a.email !== email);
    setAccounts(updatedAccounts);
    await SecureStoragePlugin.set({ key: 'saved_accounts', value: JSON.stringify(updatedAccounts) });
    
    if (lastActiveEmail === email) {
      const newActive = updatedAccounts.length > 0 ? updatedAccounts[0].email : null;
      setLastActiveEmail(newActive);
      if (newActive) {
        await SecureStoragePlugin.set({ key: 'last_active_email', value: newActive });
      } else {
        await SecureStoragePlugin.remove({ key: 'last_active_email' }).catch(() => {});
      }
    }
  };

  const updateLastActiveEmail = async (email) => {
    setLastActiveEmail(email);
    await SecureStoragePlugin.set({ key: 'last_active_email', value: email });
  };

  const clearLegacyData = async () => {
    try {
      await SecureStoragePlugin.remove({ key: 'user_pin' });
    } catch (e) {}
    try {
      await SecureStoragePlugin.remove({ key: 'auth_token' });
    } catch (e) {}
    localStorage.removeItem('token');
    setHasLegacyData(false);
  };

  return {
    accounts,
    lastActiveEmail,
    isLoading,
    hasLegacyData,
    saveAccount,
    removeAccount,
    updateLastActiveEmail,
    clearLegacyData,
    loadStorage
  };
}
