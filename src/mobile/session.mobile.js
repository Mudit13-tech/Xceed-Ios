import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

const SAVED_ACCOUNTS = 'saved_accounts';
const LAST_ACTIVE_EMAIL = 'last_active_email';

// The keystore rejects a key it does not hold, and on the web there is no
// plugin behind these at all. Neither is an error worth propagating out of a
// sign-out: the goal is for the value to be gone, and it is.
const readKey = async (key) => {
  try {
    const { value } = await SecureStoragePlugin.get({ key });
    return value || null;
  } catch {
    return null;
  }
};

const removeKey = async (key) => {
  try {
    await SecureStoragePlugin.remove({ key });
  } catch {
    /* not there */
  }
};

/**
 * Signs the current account out of this device.
 *
 * Sign-out here has to do more than the web's does, and for a while it did
 * less. The server's logout clears its cookie and keeps no blocklist, so the
 * bearer token it issued stays valid until it expires — which means a token
 * left on the device is a live session, whatever the server was told. Ending
 * the session is therefore something only this function can do, by destroying
 * the credential.
 *
 * It was destroying the wrong one. `user_pin` and `auth_token` are the single
 * account the app stored before the switcher existed; every account saved since
 * lives in `saved_accounts` as {email, token, pin}, and that is what PinEntry
 * unlocks and what activateAccount puts back into localStorage. Removing the
 * two legacy keys therefore removed nothing anyone still had: sign out, arrive
 * at the login screen, and the account was still listed, still holding a valid
 * token and its PIN, and four digits put you straight back into the session you
 * had just left. Every sign-out route in the app did this, from before the
 * switcher was introduced.
 *
 * So the signed-out account is dropped from `saved_accounts` outright, the way
 * the switcher's own "remove account" does it. Signing back in needs the
 * password again, which is the only thing that makes the token gone rather than
 * merely unused. Any *other* saved account is untouched — signing out of one is
 * a normal way to reach another, and taking the list with it would be its own
 * kind of broken.
 *
 * Note this is deliberately not what switching accounts does: activateAccount
 * leaves the account it moves away from signed in, so switching back needs no
 * password. Sign-out is the explicit act; switching is not.
 */
export async function clearNativeSession() {
  // Read before removing — it is how the account being signed out is identified.
  const token = localStorage.getItem('token');
  localStorage.removeItem('token');

  await removeKey('user_pin');
  await removeKey('auth_token');

  const raw = await readKey(SAVED_ACCOUNTS);
  if (!raw) return;

  let accounts;
  try {
    accounts = JSON.parse(raw);
  } catch {
    // Unreadable is as good as absent; leave it for loadStorage to replace.
    return;
  }
  if (!Array.isArray(accounts) || accounts.length === 0) return;

  const lastActiveEmail = await readKey(LAST_ACTIVE_EMAIL);
  // The token is the better identifier of the two: it says which account this
  // session actually belongs to, where `last_active_email` only says which one
  // was chosen last and can be left behind by a switch that failed part way.
  const signedOut =
    (token && accounts.find((account) => account.token === token)) ||
    accounts.find((account) => account.email === lastActiveEmail);
  if (!signedOut) return;

  const remaining = accounts.filter((account) => account !== signedOut);
  await SecureStoragePlugin.set({ key: SAVED_ACCOUNTS, value: JSON.stringify(remaining) });

  if (lastActiveEmail === signedOut.email) {
    if (remaining.length > 0) {
      await SecureStoragePlugin.set({ key: LAST_ACTIVE_EMAIL, value: remaining[0].email });
    } else {
      await removeKey(LAST_ACTIVE_EMAIL);
    }
  }
}

export default clearNativeSession;
