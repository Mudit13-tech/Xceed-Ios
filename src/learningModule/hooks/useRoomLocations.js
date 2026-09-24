import { useEffect, useState } from 'react';

import lmApi from '../api/lmApi';

/**
 * Where a set of rooms are, from the timetable's master room records.
 *
 * The class header renders twice — a card below `md` and a row above it — and
 * both want the same answer, so the result is held in a module-level cache
 * keyed by room name. Without it the two compositions would each ask, and the
 * request would run again on every navigation between a class's tabs.
 *
 * A failed lookup is cached as "nothing known" rather than left empty: a
 * timetable that is down should cost the card its pins once, not ask again on
 * every render for the rest of the session.
 */
const cache = new Map();
const inFlight = new Map();

/** Test seam. Nothing in the app clears this; the page load does. */
export const forgetRoomLocations = () => {
  cache.clear();
  inFlight.clear();
};

const fetchMissing = async (names) => {
  const wanted = names.filter((name) => !cache.has(name));
  if (!wanted.length) return;

  const key = wanted.slice().sort().join(',');
  if (!inFlight.has(key)) {
    inFlight.set(
      key,
      lmApi
        .ttRoomLocations(key)
        .catch(() => ({}))
        .then((found) => {
          // Every room asked for is recorded, including the ones that came back
          // with nothing — that is the answer, and asking again will not change
          // it before the page is reloaded.
          wanted.forEach((name) => cache.set(name, found?.[name] || null));
          inFlight.delete(key);
        }),
    );
  }
  await inFlight.get(key);
};

export default function useRoomLocations(names) {
  // The array is rebuilt on every render by the caller splitting a string, so
  // the effect keys off its contents rather than its identity.
  const key = names.join(',');
  const [, bump] = useState(0);

  useEffect(() => {
    if (!key) return undefined;

    let cancelled = false;
    fetchMissing(key.split(',')).then(() => {
      if (!cancelled) bump((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const found = {};
  names.forEach((name) => {
    const hit = cache.get(name);
    if (hit) found[name] = hit;
  });
  return found;
}
