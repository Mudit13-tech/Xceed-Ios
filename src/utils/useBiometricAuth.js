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
      const result = await NativeBiometric.isAvailable();
      return Boolean(result.isAvailable) && result.biometryType !== BiometryType.NONE;
    } catch (e) {
      console.error('Biometric isAvailable error:', e);
      return false;
    }
  };

  const authenticate = async (reason = 'Log in to your account') => {
    if (!Capacitor.isNativePlatform()) return { success: false, error: 'Not native platform' };

    try {
      const result = await NativeBiometric.isAvailable();
      if (!result.isAvailable || result.biometryType === BiometryType.NONE) {
        return { success: false, error: 'Biometrics not available' };
      }

      const copy = PROMPT[result.biometryType] || FINGERPRINT_PROMPT;
      await NativeBiometric.verifyIdentity({
        reason,
        ...copy,
        useFallback: false,
      });
      return { success: true };
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return { success: false, error };
    }
  };

  return { isAvailable, authenticate };
};
