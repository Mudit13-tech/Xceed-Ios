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
/**
 * The origin a native build talks to.
 *
 * Production is the default and stays the default: a build with no env set --
 * a release build, a CI build, anyone's clone -- points at the live server, so
 * there is nothing to remember to undo before shipping. VITE_NATIVE_API_ORIGIN
 * is read only to override it, which is what a developer running the AMS server
 * locally sets in .env (gitignored).
 *
 * Vite inlines import.meta.env at build time, so this is decided by `yarn build`,
 * not at runtime -- change .env and rebuild for it to take effect.
 *
 * On the simulator http://localhost:8010 reaches the Mac directly. On a physical
 * device it does not: localhost there is the phone. Use the Mac's LAN address
 * (ipconfig getifaddr en0) with both on the same network -- Info.plist carries
 * NSAllowsLocalNetworking so ATS permits the cleartext hop.
 */
const NATIVE_API_ORIGIN =
  import.meta.env.VITE_NATIVE_API_ORIGIN || 'https://xceed.nitj.ac.in';

export default function getEnvironmentNative() {
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    return NATIVE_API_ORIGIN;
  }
  return getEnvironment();
}
