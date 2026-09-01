import { Preferences } from '@capacitor/preferences';
import { queryPersister } from './queryPersister';

/**
 * Makes a saved account the active one, and lands on the page it should open.
 *
 * Every route into the app that changes *which* account is signed in goes
 * through here — password login, PIN unlock, biometric unlock, and picking an
 * account in the switcher. They used to each do their own half of the job, and
 * the halves they skipped were what made a switch look successful without being
 * one:
 *
 *   - The token is swapped, but the persisted React Query cache is not. The
 *     client keeps every query forever (`gcTime: Infinity`) and mirrors the
 *     whole cache into Capacitor Preferences (see main.jsx and queryPersister),
 *     so the hard navigation below rehydrates the previous account's name,
 *     roles and module data on the other side. Invalidating one key — which is
 *     all the PIN screen did — leaves the rest of that dump intact, and does
 *     not even remove the one key it names: `invalidateQueries` marks a query
 *     stale, it does not drop the data, so the old value still renders while
 *     the refetch is in flight.
 *
 *   - `clear()` alone is not enough either. It empties the cache in memory, and
 *     the persister writes on a throttle, so a hard navigation immediately
 *     afterwards can leave the old snapshot sitting on disk to be restored.
 *     `removeClient()` deletes that snapshot outright, which is why both are
 *     here and in this order.
 *
 * What it deliberately does NOT do is sign the previous account out. Its token
 * stays in secure storage and stays valid — the server's logout only clears the
 * cookie and keeps no blocklist — so it remains in the switcher and switching
 * back to it needs no password.
 */
export async function activateAccount({
  account,
  queryClient,
  updateLastActiveEmail,
  fallbackTarget = '/userroles',
}) {
  if (!account?.token) {
    throw new Error('Token missing from saved account');
  }

  localStorage.setItem('token', account.token);

  if (updateLastActiveEmail && account.email) {
    await updateLastActiveEmail(account.email);
  }

  if (queryClient) {
    queryClient.clear();
  }
  try {
    await queryPersister.removeClient();
  } catch (e) {
    // A persister that cannot be reached is not a reason to strand the user on
    // the login screen; the worst case is a stale card until the first refetch.
    console.error('Could not clear the persisted query cache on switch', e);
  }

  // A route saved before the session lapsed wins over the default landing page,
  // so a notification tap that hit the login wall resumes where it was headed.
  let target = fallbackTarget;
  try {
    const { value: pending } = await Preferences.get({ key: 'pendingRoute' });
    if (pending) {
      await Preferences.remove({ key: 'pendingRoute' });
      target = pending;
    }
  } catch (e) {
    console.error('Could not read the pending route', e);
  }

  // A full load rather than a client-side navigation: the platform navbar reads
  // the session once on mount, so a router push would land on the target with
  // the previous account still drawn in the chrome.
  window.location.href = target;
}
