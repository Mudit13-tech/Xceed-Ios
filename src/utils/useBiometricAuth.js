import { Capacitor } from '@capacitor/core';
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';

/**
 * Biometric unlock, with two deliberately separate paths.
 *
 * Android is the build that ships today and its biometric login works. Nothing
 * below changes what it does: the same three accepted types, the same prompt
 * wording, the same absence of a timeout. It is here verbatim rather than
 * shared with the iOS path because "shared" is how a working platform acquires
 * someone else's bug fix, and there is no Android problem to fix.
 *
 * iOS never worked at all, for one reason: the accepted list was FINGERPRINT,
 * TOUCH_ID and MULTIPLE, and BiometryType.FACE_ID is none of them. Every iPhone
 * since the X reports FACE_ID, so isAvailable() returned false on all of them
 * and LoginForm.mobile.jsx skipped the prompt without a word.
 */

/** Exactly what Android sent before this file grew an iOS path. Do not edit. */
const ANDROID_PROMPT = {
  title: 'Fingerprint Authentication',
  subtitle: 'Log in using your fingerprint',
  description: 'Place your finger on the sensor to log in.',
};

/** iOS shows its own system sheet and uses only `reason`; the rest is ignored. */
const IOS_PROMPT = {
  title: 'Face ID',
  subtitle: 'Log in with Face ID',
  description: 'Look at your device to log in.',
};

/**
 * How long to wait for a silent native check before giving up on it. iOS only.
 *
 * A plugin call that never settles is worse than one that fails: the login
 * screen awaits isAvailable() before it decides anything, so a hung bridge call
 * takes the PIN fallback down with it and leaves the user on a blank screen.
 * Losing biometrics is recoverable -- there is a PIN and a password behind it.
 *
 * capacitor-native-biometric@4.2.2 predates Capacitor 8 by four major versions,
 * which is reason enough not to assume every call on the newer platform comes
 * back. Android has years of evidence that its calls do.
 */
const IOS_CALL_TIMEOUT_MS = 4000;

function withTimeout(promise, label) {
  let timer;
  const clock = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} did not respond in ${IOS_CALL_TIMEOUT_MS}ms`)),
      IOS_CALL_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, clock]).finally(() => clearTimeout(timer));
}

const isIos = () => Capacitor.getPlatform() === 'ios';

export const useBiometricAuth = () => {
  const isAvailable = async () => {
    if (!Capacitor.isNativePlatform()) return false;

    if (!isIos()) {
      try {
        const result = await NativeBiometric.isAvailable();
        if (!result.isAvailable) return false;
        return (
          result.biometryType === BiometryType.FINGERPRINT ||
          result.biometryType === BiometryType.TOUCH_ID ||
          result.biometryType === BiometryType.MULTIPLE
        );
      } catch (e) {
        console.error('Biometric isAvailable error:', e);
        return false;
      }
    }

    try {
      console.log('[biometric] calling isAvailable (ios)');
      const result = await withTimeout(NativeBiometric.isAvailable(), 'isAvailable');
      console.log('[biometric] isAvailable ->', JSON.stringify(result));
      // Any modality the device offers is accepted. The plugin has already
      // accounted for hardware, enrolment and lockout in `isAvailable`; all that
      // is left is to reject NONE, and to let a type this code has not heard of
      // work rather than fail closed the way FACE_ID did.
      return Boolean(result.isAvailable) && result.biometryType !== BiometryType.NONE;
    } catch (e) {
      console.error('[biometric] isAvailable error:', e);
      return false;
    }
  };

  const authenticate = async (reason = 'Log in to your account') => {
    if (!Capacitor.isNativePlatform()) return { success: false, error: 'Not native platform' };

    try {
      const available = await isAvailable();
      if (!available) return { success: false, error: 'Biometrics not available' };

      if (isIos()) console.log('[biometric] prompting');
      // Not raced against a clock: the user is looking at a system sheet and may
      // take as long as they like over it. Only the silent check gets a timeout.
      await NativeBiometric.verifyIdentity({
        reason,
        ...(isIos() ? IOS_PROMPT : ANDROID_PROMPT),
        useFallback: false,
      });
      if (isIos()) console.log('[biometric] verifyIdentity succeeded');
      return { success: true };
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return { success: false, error };
    }
  };

  return { isAvailable, authenticate };
};
