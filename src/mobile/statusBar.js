import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Keep the app's own header out from under the status bar.
 *
 * On iOS the Capacitor WebView is laid out over the entire screen, status bar
 * included, so the first thing the page draws lands underneath the clock and —
 * on a Dynamic Island device — behind the island itself. That is what put the
 * XCEED wordmark and the theme toggle under the cutout.
 *
 * The obvious fix is CSS: viewport-fit=cover plus env(safe-area-inset-top)
 * padding. It is not used here because there is nowhere of ours to put it. The
 * header is src/components/home/Navbar.jsx, the viewport meta is index.html,
 * and both belong to AMS — padding them means editing files the web team
 * rewrites, which .gitattributes merges against their copy on every sync. A
 * rule that has to be re-applied after each sync is a rule that will be lost
 * after some sync.
 *
 * Telling the status bar not to overlay the WebView moves the layout boundary
 * instead: iOS starts the view below the inset, every screen is correct at
 * once, and no markup is touched.
 *
 * iOS only, deliberately. setOverlaysWebView is not a no-op on Android -- that
 * platform is what it was built for -- and the Android app is the one that
 * ships today, with a header that already sits where it should. Changing its
 * status bar to fix a cutout it does not have would be trading a working app
 * for an untested one, so the guard is the platform, not merely "is native".
 */
export async function configureStatusBar() {
  if (Capacitor.getPlatform() !== 'ios') return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Light });
  } catch (error) {
    // A device without a configurable status bar is not a reason to fail
    // boot -- the app is entirely usable with the header where it was.
    console.warn('Status bar could not be configured', error);
  }
}
