import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { defaultShouldDehydrateQuery } from '@tanstack/react-query';
import { safeLocalStorage } from './safeStorage';

export const queryPersister = createSyncStoragePersister({
  /* Not `window.localStorage` itself: that property access throws in a browser
     told to keep no site data, and this runs at import time — so the whole
     bundle would fail to evaluate rather than the cache merely being lost. See
     safeStorage. */
  storage: safeLocalStorage,
  // A cache written under a different buster is discarded instead of restored.
  // Raised when the signed-in user stopped being persisted (see main.jsx), so
  // a browser still holding a previous session's identity on disk drops it on
  // the next load rather than showing that user until the entry goes stale.
  buster: 'no-session-identity',
});

/**
 * Query keys that stay out of localStorage — either because the answer
 * describes the signed-in person rather than content everyone sees (the
 * platform session, the learning module's view of that account, that account's
 * private attendance record), or because it carries something that must not
 * outlive the sitting it belongs to. Matched by prefix, so `['user', 'details']`
 * is covered by `['user']`.
 */
const UNPERSISTED_KEYS = [
  ['user'],
  ['learning', 'me'],
  ['learning', 'profile'],
  /**
   * The quiz list, which a teacher is served with the room code and the Safe
   * Exam Browser access code in the clear — the two codes that admit somebody
   * to a locked-down paper from an ordinary browser. Cached in memory like every
   * other class list, so switching tabs is still instant; just never written to
   * the disk of a machine the next class sits down at.
   */
  ['learning', 'quizzes'],
];

/**
 * What may be written to localStorage and restored on the next load.
 *
 * Everything the app has fetched is cached to disk so the shell paints
 * instantly — which is exactly wrong for anything describing who is signed in.
 * That answer outlives the session it describes: after signing out (or once the
 * token lapsed) the browser came back up, restored the previous user from disk
 * and, being younger than the query's staleTime, never refetched to find out
 * otherwise. A signed-out page sat there showing the last person's email —
 * through reloads, and even after a different account signed in.
 *
 * It is not only the email. `['learning', 'profile']` is a student's own
 * attendance history, and these machines are shared: left on disk, one
 * student's record is restored into the next student's browser. Whoever is
 * signed in is the server's to answer, so none of it is taken from disk.
 */
export const shouldPersistQuery = (query) =>
  defaultShouldDehydrateQuery(query) &&
  !UNPERSISTED_KEYS.some((prefix) =>
    prefix.every((segment, index) => query.queryKey[index] === segment),
  );
