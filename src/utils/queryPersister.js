import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { defaultShouldDehydrateQuery } from '@tanstack/react-query';

export const queryPersister = createSyncStoragePersister({
  storage: window.localStorage,
  // A cache written under a different buster is discarded instead of restored.
  // Raised when the signed-in user stopped being persisted (see main.jsx), so
  // a browser still holding a previous session's identity on disk drops it on
  // the next load rather than showing that user until the entry goes stale.
  buster: 'no-session-identity',
});

/**
 * Query keys whose answer describes the signed-in person rather than content
 * everyone sees: the platform session, the learning module's own view of that
 * account, and that account's private attendance record. Matched by prefix, so
 * `['user', 'details']` is covered by `['user']`.
 */
const SESSION_SCOPED_KEYS = [
  ['user'],
  ['learning', 'me'],
  ['learning', 'profile'],
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
  !SESSION_SCOPED_KEYS.some((prefix) =>
    prefix.every((segment, index) => query.queryKey[index] === segment),
  );
