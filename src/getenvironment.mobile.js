import getEnvironment from './getenvironment';

/**
 * The API base, with the one case the web build cannot have.
 *
 * Inside the app the page is not served from our domain at all — Capacitor
 * serves the bundle from its own local asset server — so the URL sniffing in
 * the AMS original has nothing useful to look at and would fall through to a
 * default that happens to be right today for the wrong reason. Asking Capacitor
 * directly is the actual question: on a device the API is always the live
 * server, because there is no local one to reach.
 *
 * Everything else is delegated rather than copied. This file used to be a fork
 * of the original, and it drifted — it still carried the dead
 * nitjtt.onrender.com host months after AMS removed it, because a fork inherits
 * nothing. Delegating means a host AMS adds or retires reaches the app on the
 * next sync with no action here. See build/mobileOverrides.js.
 */
export default function getEnvironmentNative() {
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    return 'https://xceed.nitj.ac.in';
  }
  return getEnvironment();
}
