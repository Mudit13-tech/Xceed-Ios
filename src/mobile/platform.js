/**
 * Which native platform the app is running on.
 *
 * The iOS and Android apps ship from this one bundle, so anything that should
 * look or behave differently on one of them has to branch at runtime — there is
 * no build that contains only iOS. `build/mobileOverrides.js` swaps whole files
 * for the *mobile* build, which is both platforms at once; it cannot tell them
 * apart. This can.
 *
 * Shared rather than spelled out at each site because a branch on this is a
 * promise about the *other* platform too: Android and the web renderer keep
 * whatever they had. That promise is easier to keep when there is one place
 * that answers the question, and one name to grep for when auditing which
 * screens have been touched.
 *
 * Deliberately not cached. `getPlatform()` is a property read on an object
 * Capacitor has already built, so there is nothing to save, and a module-level
 * constant would freeze the answer at import time — which is the wrong moment
 * in a unit test and a needless constraint everywhere else.
 */
import { Capacitor } from '@capacitor/core';

/** @returns {'ios' | 'android' | 'web'} */
export function nativePlatform() {
  try {
    return Capacitor.getPlatform();
  } catch {
    // Capacitor is not initialised in a plain browser tab or under jsdom, and a
    // layout decision is never worth taking a screen down for.
    return 'web';
  }
}

/** True only inside the iOS app. Android and the web build both read false. */
export const isIosApp = () => nativePlatform() === 'ios';

/** True only inside the Android app. */
export const isAndroidApp = () => nativePlatform() === 'android';
