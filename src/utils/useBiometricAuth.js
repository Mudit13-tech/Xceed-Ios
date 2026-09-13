import { Capacitor } from '@capacitor/core';
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';

/**
 * How the prompt should describe itself, per modality.
 *
 * The plugin renders title/subtitle/description on Android; iOS shows its own
 * system sheet and uses only `reason`. Getting the wording right therefore
 * matters most on Android, but a Face ID user should never be told to put a
 * finger on a sensor, so the copy is chosen from what the device reports
 * rather than assumed.
 */
const PROMPT = {
  [BiometryType.FACE_ID]: {
    title: 'Face ID',
    subtitle: 'Log in with Face ID',
    description: 'Look at your device to log in.',
  },
  [BiometryType.FACE_AUTHENTICATION]: {
    title: 'Face unlock',
    subtitle: 'Log in with face unlock',
    description: 'Look at your device to log in.',
  },
  [BiometryType.IRIS_AUTHENTICATION]: {
    title: 'Iris authentication',
    subtitle: 'Log in with iris authentication',
    description: 'Look at your device to log in.',
  },
};

const FINGERPRINT_PROMPT = {
  title: 'Fingerprint authentication',
  subtitle: 'Log in with your fingerprint',
  description: 'Place your finger on the sensor to log in.',
};

/**
 * How long to wait for the native side before giving up on it.
 *
 * A plugin call that never settles is worse than one that fails: the login
 * screen awaits isAvailable() before it decides anything, so a hung bridge call
 * takes the PIN fallback down with it and the user is left on a blank screen
 * with no way forward. Losing biometrics is recoverable -- there is a PIN and a
 * password behind it -- so the call is raced against a clock and a non-answer
 * is treated as "not available".
 *
 * capacitor-native-biometric@4.2.2 predates Capacitor 8 by four major versions,
 * which is reason enough not to assume every call comes back.
 */
const NATIVE_CALL_TIMEOUT_MS = 4000;

function withTimeout(promise, label) {
  let timer;
  const clock = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} did not respond in ${NATIVE_CALL_TIMEOUT_MS}ms`)),
      NATIVE_CALL_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, clock]).finally(() => clearTimeout(timer));
}

export const useBiometricAuth = () => {
  /**
   * Whether this device can authenticate the user biometrically.
   *
   * This used to whitelist FINGERPRINT, TOUCH_ID and MULTIPLE and return false
   * for anything else. BiometryType.FACE_ID is not in that set, so every Face ID
   * iPhone -- which is every iPhone since the X -- reported biometrics as
   * unavailable, and the login screen silently skipped straight past the
   * prompt. Android's FACE_AUTHENTICATION and IRIS_AUTHENTICATION fell through
   * the same gap.
   *
   * The whitelist was never the right shape: the plugin already answers the
   * question in `isAvailable`, which accounts for hardware, enrolment and
   * lockout. All that is left is to reject NONE, and to let a modality this
   * code has not heard of work rather than fail closed.
   */
  const isAvailable = async () => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      console.log('[biometric] calling isAvailable, platform =', Capacitor.getPlatform());
      const result = await withTimeout(NativeBiometric.isAvailable(), 'isAvailable');
      console.log('[biometric] isAvailable ->', JSON.stringify(result));
      if (!result.isAvailable) return false;

      // iOS: accept whatever the device offers. Face ID is the only modality on
      // every iPhone since the X, and it was the omission from the list below
      // that made this return false on all of them.
      if (Capacitor.getPlatform() === 'ios') {
        return result.biometryType !== BiometryType.NONE;
      }

      // Android keeps the original list unchanged. It is the build that ships
      // today and its biometric login works; widening it here would be an
      // untested change to a working app for no reported problem.
      return (
        result.biometryType === BiometryType.FINGERPRINT ||
        result.biometryType === BiometryType.TOUCH_ID ||
        result.biometryType === BiometryType.MULTIPLE
      );
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
      const result = await NativeBiometric.isAvailable();

      const copy = PROMPT[result.biometryType] || FINGERPRINT_PROMPT;
      console.log('[biometric] prompting, type =', result.biometryType);
      // No timeout here: the user is looking at a system sheet and may take as
      // long as they like over it. Only the silent checks get a clock.
      await NativeBiometric.verifyIdentity({
        reason,
        ...copy,
        useFallback: false,
      });
      console.log('[biometric] verifyIdentity succeeded');
      return { success: true };
    } catch (error) {
      console.error('[biometric] verifyIdentity failed:', JSON.stringify(error), error);
      return { success: false, error };
    }
  };

  return { isAvailable, authenticate };
};
