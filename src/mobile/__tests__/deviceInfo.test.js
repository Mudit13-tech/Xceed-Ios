import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDeviceInfo, currentDeviceId, storedDeviceId } from '../deviceInfo';

/**
 * What the web client reports about its device at sign-in: a device ID it
 * keeps, and the model and OS version where the browser answers Client Hints.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'userAgentData', { value: undefined, configurable: true });
});

describe('device ID', () => {
  it('is made once and then kept', () => {
    expect(storedDeviceId()).toBe('');
    const first = currentDeviceId();
    expect(first).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(currentDeviceId()).toBe(first);
    expect(storedDeviceId()).toBe(first);
  });
});

describe('getDeviceInfo', () => {
  it('reports the model and OS version from Client Hints', async () => {
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      value: { getHighEntropyValues: vi.fn(async () => ({ model: 'SM-S911B', platformVersion: '14.0.0' })) },
    });

    const info = await getDeviceInfo();

    expect(info).toMatchObject({ model: 'SM-S911B', osVersion: '14.0.0' });
    expect(info.id).toBe(storedDeviceId());
  });

  it('leaves the model empty where the browser gives none', async () => {
    const info = await getDeviceInfo();
    expect(info.model).toBe('');
    expect(info.osVersion).toBe('');
    expect(info.id).not.toBe('');
  });
});
