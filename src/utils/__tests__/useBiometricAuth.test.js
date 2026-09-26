import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Biometric unlock on iOS.
 *
 * The regression worth pinning: iPhones since the X report FACE_ID, and a check
 * that only accepted fingerprint types turned Face ID off on every one of them
 * without a word. biometryLabel() is what the PIN screen's "Use Face ID" button
 * reads, so it is asserted per type, and null on Android so that button never
 * appears there.
 */
let platform = 'ios';
const isAvailable = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => platform,
    isNativePlatform: () => platform !== 'web',
  },
}));

vi.mock('capacitor-native-biometric', () => ({
  BiometryType: { NONE: 0, TOUCH_ID: 1, FACE_ID: 2, FINGERPRINT: 3, FACE_AUTHENTICATION: 4, IRIS_AUTHENTICATION: 5, MULTIPLE: 6 },
  NativeBiometric: { isAvailable: (...args) => isAvailable(...args), verifyIdentity: vi.fn() },
}));

const { useBiometricAuth } = await import('../useBiometricAuth');

beforeEach(() => {
  platform = 'ios';
  isAvailable.mockReset();
});

describe('useBiometricAuth on iOS', () => {
  it('accepts Face ID', async () => {
    isAvailable.mockResolvedValue({ isAvailable: true, biometryType: 2 });
    expect(await useBiometricAuth().isAvailable()).toBe(true);
  });

  it.each([
    [2, 'Face ID'],
    [1, 'Touch ID'],
  ])('labels biometry type %s as %s', async (type, label) => {
    isAvailable.mockResolvedValue({ isAvailable: true, biometryType: type });
    expect(await useBiometricAuth().biometryLabel()).toBe(label);
  });

  it('offers no button when nothing is enrolled', async () => {
    isAvailable.mockResolvedValue({ isAvailable: false, biometryType: 0, errorCode: 7 });
    expect(await useBiometricAuth().biometryLabel()).toBeNull();
  });

  it('offers no button when the plugin throws', async () => {
    isAvailable.mockRejectedValue(new Error('bridge gone'));
    expect(await useBiometricAuth().biometryLabel()).toBeNull();
  });

  it('never offers the button on Android', async () => {
    platform = 'android';
    isAvailable.mockResolvedValue({ isAvailable: true, biometryType: 3 });
    expect(await useBiometricAuth().biometryLabel()).toBeNull();
    expect(isAvailable).not.toHaveBeenCalled();
  });
});
