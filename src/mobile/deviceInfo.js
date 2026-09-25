/**
 * What this client reports about its device at sign-in — web implementation.
 * See ./README.md.
 *
 * Read by the login form and sent as `device` beside the credentials; the
 * server keeps it in the account's login history.
 *
 *  - `id`: a random ID made on this browser's first sign-in and kept in
 *    localStorage. It names this browser, not the hardware: clearing site
 *    data or a private window makes a new one.
 *  - `model` / `osVersion`: from User-Agent Client Hints, which Chrome, Edge
 *    and Samsung Internet on Android answer ("SM-S911B", "14.0.0"). Safari,
 *    Firefox and desktop browsers do not, and these are left empty.
 *  - `hint`: 'laptop' when the browser reports a battery that is not a
 *    desktop's permanent full charge, 'tablet' for an iPad reporting itself as
 *    a Mac — the two things a user agent cannot say.
 *
 * The app's deviceInfo.mobile.js reports the same shape from the native
 * device APIs, where the model is available on iOS too.
 */

const STORAGE_KEY = 'xceed.deviceId';

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/** This browser's device ID, made and stored on first use. Empty where storage
 *  is unavailable (some private modes), so no two sign-ins share a fake one. */
export function currentDeviceId() {
  try {
    let id = window.localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = randomId();
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

/** This browser's device ID if it has one, without making one. */
export function storedDeviceId() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/** Never slower than this: the sign-in does not wait on hardware answers. */
const within = (promise, ms = 200) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

async function modelAndVersion() {
  try {
    const hints = navigator.userAgentData;
    if (!hints || typeof hints.getHighEntropyValues !== 'function') return {};
    const values = await within(hints.getHighEntropyValues(['model', 'platformVersion']));
    return { model: values?.model || '', osVersion: values?.platformVersion || '' };
  } catch {
    return {};
  }
}

async function formFactorHint() {
  try {
    if (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) return 'tablet';
    if (typeof navigator.getBattery !== 'function') return '';
    const battery = await within(navigator.getBattery(), 150);
    if (!battery) return '';
    // A desktop reports a full battery on permanent charge; anything else is a
    // real battery, so a laptop.
    const hasRealBattery =
      battery.charging === false || battery.level < 1 || Number.isFinite(battery.dischargingTime);
    return hasRealBattery ? 'laptop' : '';
  } catch {
    return '';
  }
}

export async function getDeviceInfo() {
  const [{ model = '', osVersion = '' }, hint] = await Promise.all([modelAndVersion(), formFactorHint()]);
  return { id: currentDeviceId(), model, osVersion, hint };
}

export default getDeviceInfo;
