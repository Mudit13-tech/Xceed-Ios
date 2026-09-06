import { queryPersister } from './queryPersister';
import { takePendingRoute } from './deepLink';

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
 * That teardown is right for a *switch* and wrong for a *resume*, which is the
 * distinction `isSameAccount` below draws. On a device this function is not
 * only reached by switching: the app always cold-starts at `/`, which redirects
 * to /login (see App.jsx), and LoginForm.mobile then unlocks the last-used
 * account by biometric or PIN and arrives here. Tearing the cache down
 * unconditionally therefore ran on *every launch* — which is what made the
 * persisted cache look broken. It worked perfectly while the app stayed open
 * and was empty again after a restart, because the restart itself deleted it a
 * moment before the first screen asked for it. Nothing was wrong with the
 * persister; the unlock was wiping what it had just restored.
 *
 * The active token is the identity to compare against, the same one
 * clearNativeSession uses to work out which saved account a session belongs to.
 * When it matches the account being activated there is nothing to protect
 * anyone from — it is the same user resuming their own session, and their cache
 * is exactly what should survive. Anything else, including a token that is
 * absent or has been rotated, falls through to the full teardown: the cost of
 * clearing when we did not have to is one round of refetches, and the cost of
 * not clearing when we should have is one account seeing another's data.
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

  // Read before the write below — afterwards there is nothing left to compare.
  const previousToken = localStorage.getItem('token');
  const isSameAccount = Boolean(previousToken) && previousToken === account.token;

  localStorage.setItem('token', account.token);

  if (updateLastActiveEmail && account.email) {
    await updateLastActiveEmail(account.email);
  }

  if (!isSameAccount) {
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
  }

  // A route saved before the session lapsed wins over the default landing page,
  // so a notification tap that hit the login wall resumes where it was headed.
  // `takePendingRoute` also drops a saved value that is not a route at all —
  // see src/utils/deepLink.js for the file URLs that used to end up in there.
  const target = (await takePendingRoute()) || fallbackTarget;

  // A full load rather than a client-side navigation: the platform navbar reads
  // the session once on mount, so a router push would land on the target with
  // the previous account still drawn in the chrome.
  window.location.href = target;
}
