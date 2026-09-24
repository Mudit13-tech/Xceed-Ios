/**
 * How this client identifies itself to the API — web implementation.
 * See ./README.md.
 */

/**
 * Sent as X-App-Name on every request, signed in or not: the server's
 * csrfGuard accepts it in place of an Origin check.
 */
export const APP_NAME = 'xceed-web';

/** The `credentials` mode for a fetch to our own API: cookies always go. */
export function credentialsFor() {
  return 'include';
}

/**
 * Called when our API answers 401. On the web a 401 is left to the page that
 * received it, as it always was. (The app ends the session here, because its
 * stored credentials outlive the page.)
 */
export async function handleUnauthorized() {}

/**
 * Installs axios's session handling. Nothing beyond main.jsx's own setup on the
 * web. (The app stops sending cookies and ends the session on a 401.)
 */
export function installAxiosSessionGuard() {}
