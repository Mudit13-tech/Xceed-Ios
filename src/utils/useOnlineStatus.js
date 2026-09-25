import { useEffect, useState } from 'react';

/**
 * Whether the browser currently has a network.
 *
 * `navigator.onLine` is only trustworthy in one direction, and this hook is
 * written around that. `false` is reliable: the browser knows it has no
 * network and no request is going anywhere. `true` means only "attached to
 * something" — campus wifi that has you on the captive portal, or an access
 * point with no route out, both report online. So callers may use this to
 * explain a failure that has already happened, and must never use it to
 * decide a request would succeed.
 *
 * Read once on mount rather than at module scope, because the answer at import
 * time is not the answer when a page renders, and a stale `true` is exactly
 * the wrong one to cache.
 */
const read = () =>
  typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean'
    ? true
    : navigator.onLine;

export default function useOnlineStatus() {
  const [online, setOnline] = useState(read);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    // Re-read rather than assuming, so a browser that fires the events out of
    // order — or one that fired them before this mounted — still settles on
    // what it actually thinks.
    const update = () => setOnline(read());
    update();

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
