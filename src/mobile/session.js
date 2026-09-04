import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

/**
 * Forgets the signed-in session on this device.
 *
 * Signing out of the app is not the same as signing out of the web client. The
 * web client's session is a cookie the server drops; here the session is also a
 * bearer token and a PIN held in the device keystore, and those outlive the
 * request that ended the session. Left behind, the next launch finds a PIN with
 * a token behind it and lets the previous user back in without a password.
 *
 * This used to be six lines copied into all four places that sign a user out —
 * two navbars, the learning shell and the 401 handler — every one of them in a
 * file that comes from AMS. Four copies of the same block are four conflicts
 * waiting for the sync that reformats a logout handler, and they had already
 * drifted apart in how they swallowed the error.
 *
 * Saved accounts deliberately survive. `saved_accounts` and
 * `last_active_email` are the account switcher's list, not the session — the
 * point of signing out of one account is to pick another, and clearing them
 * would empty the list the user came back to.
 */
export async function clearNativeSession() {
  localStorage.removeItem('token');
  try {
    await SecureStoragePlugin.remove({ key: 'user_pin' });
    await SecureStoragePlugin.remove({ key: 'auth_token' });
  } catch {
    // Not a failure. On the web the plugin is not there at all, and after a
    // sign-out that already ran there is nothing left to remove.
  }
}

export default clearNativeSession;
