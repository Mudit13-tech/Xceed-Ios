import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from 'capacitor-native-biometric';

export const useBiometricAuth = () => {
  const isAvailable = async () => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
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
        title: 'Biometric Authentication',
        subtitle: 'Log in using your biometric credentials',
        description: 'Place your finger on the sensor or look at the camera to log in.',
      });
      return { success: true };
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return { success: false, error };
    }
  };

  return { isAvailable, authenticate };
};
