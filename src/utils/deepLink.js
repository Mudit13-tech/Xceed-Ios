import { Preferences } from '@capacitor/preferences';

const PENDING_ROUTE = 'pendingRoute';

/**
 * Paths the *server* owns rather than the router.
 *
 * Android's app-links filter (android/app/src/main/AndroidManifest.xml) claims
 * every URL on xceed.nitj.ac.in and xceed.learning.app, `/api/...` included. So
 * a student tapping a PDF attachment does not fetch the PDF: Capacitor sees an
 * off-origin navigation, hands it to Android as an ACTION_VIEW intent, Android
 * matches that filter and routes the file straight back into this app, where it
 * arrives at `appUrlOpen` looking exactly like /learning/class/:id does.
 *
 * Treated as a route, it then becomes `window.location.href` — and the WebView
 * is served from xceed.learning.app, so the local asset server is asked for a
 * PDF it has never had: `net::ERR_INVALID_RESPONSE`, and the file is never
 * fetched from the API at all. Recognising these paths is what stops that.
 */
const SERVER_PATH = /^\/(api|uploads?|files?|static|assets|public)(\/|$)/i;

/**
 * The other tell: a trailing file extension. `/something/report.pdf` is a
 * stream, not a screen, and no route in the table can render one.
 */
const FILE_PATH =
  /\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar|7z|png|jpe?g|gif|webp|svg|bmp|ico|mp[34]|wav|m4a|mov|avi|mkv|apk|ipynb|seb|json|xml)(\?|#|$)/i;

/** Whether `path` is something this SPA can actually render. */
export const isInAppRoute = (path) =>
  typeof path === 'string' &&
  path.startsWith('/') &&
  !SERVER_PATH.test(path) &&
  !FILE_PATH.test(path);

/**
 * Stores a route to resume after the sign-in wall, if it is a route at all.
 * Returns whether it was kept.
 */
export async function savePendingRoute(path) {
  if (!isInAppRoute(path)) return false;
  try {
    await Preferences.set({ key: PENDING_ROUTE, value: path });
    return true;
  } catch (e) {
    console.error('Could not save the pending route', e);
    return false;
  }
}

/**
 * Reads and clears the saved route, or null if there is nothing usable.
 *
 * Clearing happens even when the value is rejected, on purpose: installs that
 * ran the older build have a file URL sitting in Preferences already, and
 * leaving it there would dead-end the next sign-in on every launch.
 */
export async function takePendingRoute() {
  try {
    const { value } = await Preferences.get({ key: PENDING_ROUTE });
    if (!value) return null;
    await Preferences.remove({ key: PENDING_ROUTE });
    return isInAppRoute(value) ? value : null;
  } catch (e) {
    console.error('Could not read the pending route', e);
    return null;
  }
}
