import { Capacitor } from '@capacitor/core';
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';

export const useBiometricAuth = () => {
  const isAvailable = async () => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const result = await NativeBiometric.isAvailable();
      if (!result.isAvailable) return false;
      
      // Allow Fingerprint / Touch ID / Multiple (Android often returns Multiple)
      if (
        result.biometryType === BiometryType.FINGERPRINT ||
        result.biometryType === BiometryType.TOUCH_ID ||
        result.biometryType === BiometryType.MULTIPLE
      ) {
        return true;
      }
      return false;
    } catch (e) {
      console.error('Biometric isAvailable error:', e);
      return false;
    }
  };

  const authenticate = async (reason = 'Log in to your account') => {
    if (!Capacitor.isNativePlatform()) return { success: false, error: 'Not native platform' };
    
    try {
      const available = await isAvailable();
      if (!available) return { success: false, error: 'Biometrics not available' };

      await NativeBiometric.verifyIdentity({
        reason: reason,
        title: 'Fingerprint Authentication',
        subtitle: 'Log in using your fingerprint',
        description: 'Place your finger on the sensor to log in.',
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
