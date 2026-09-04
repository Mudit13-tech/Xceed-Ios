import axios from 'axios';

import { clearNativeSession } from './session';

/**
 * What this client calls itself to our API.
 *
 * Sent on every request, signed in or not: the server's csrfGuard accepts it in
 * place of an Origin check, and the requests carrying no token — a guest
 * joining a Short, answering a shared form — are exactly the ones that would
 * otherwise arrive with nothing to prove.
 */
export const APP_NAME = 'xceed-learning';

/**
 * Whether a request to our own API should carry cookies. Only sign-in should.
 *
 * The server reads the session from the httpOnly `jwt` cookie *first*, and only
 * falls back to the Authorization header (server readAuthToken). That order is
 * what made switching accounts a no-op: the cookie is set once, by a password
 * login, and script can neither read it nor delete it — so choosing another
 * saved account swapped the header while the cookie still named the previous
 * one, and the cookie won. The app showed the new name while every request
 * resolved to the old user.
 *
 * The header is the only identity this client controls, so it has to be the
 * only one on the wire. Sending cookies merely when there is no token would not
 * do either: a 401 clears the token, and the next request would fall back onto
 * the stale cookie and silently restore the account the user had just left.
 *
 * Nothing is lost by omitting them. `jwt` is the only cookie the server reads
 * anywhere, csrfGuard is satisfied by APP_NAME above, the captcha carries its
 * token in the body, and a guest is identified by X-Short-Guest. Login keeps
 * them so the server can still set the cookie — which is what lets <img>
 * subresources on the attendance and ML screens authenticate at all, since they
 * cannot set a header and the cookie is their only credential.
 */
export function credentialsFor(target, apiOrigin) {
  return target.startsWith(`${apiOrigin}/auth/login`) ? 'include' : 'omit';
}

/**
 * What to do when the server stops recognising us.
 *
 * A 401 here is not a request that failed, it is a session that ended — expired
 * server-side, or revoked from another device. The stored credentials have to
 * go with it: on a device the PIN and token live in the keystore and outlast
 * the page, so leaving them means the next launch offers a PIN that unlocks a
 * session the server has already forgotten.
 */
export async function handleUnauthorized() {
  await clearNativeSession();

  // Guarded, or a 401 raised by something on the login screen itself would
  // reload it, fire again, and keep reloading.
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

/**
 * Makes axios end the session on a 401, the way the fetch wrapper does.
 *
 * Both are needed: this app talks to its API through both, and a session that
 * only ends on whichever one happened to notice first leaves the other holding
 * credentials the server has already rejected.
 */
export function installAxiosSessionGuard() {
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) {
        handleUnauthorized();
      }
      return Promise.reject(error);
    },
  );
}
