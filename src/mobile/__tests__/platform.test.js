import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * platform.js, the one runtime check that keeps iOS-only behaviour off Android.
 *
 * One bundle serves both stores, so this check is the only thing between an
 * iOS change and the Android app. It is worth a test of its own: nothing in an
 * iOS screenshot will ever show that Android quietly moved with it.
 *
 * Each case resets the module registry and imports again against a different
 * Capacitor.
 */

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('@capacitor/core');
  vi.resetModules();
});

describe('the platform check', () => {
  it('reports the platform it was given', async () => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios' } }));
    const { isIosApp, isAndroidApp, nativePlatform } = await import('../platform');
    expect(nativePlatform()).toBe('ios');
    expect(isIosApp()).toBe(true);
    expect(isAndroidApp()).toBe(false);
  });

  it('falls back to web when Capacitor is not initialised', async () => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({
      Capacitor: {
        getPlatform: () => {
          throw new Error('not initialised');
        },
      },
    }));
    const { isIosApp, nativePlatform } = await import('../platform');
    expect(nativePlatform()).toBe('web');
    expect(isIosApp()).toBe(false);
  });
});
