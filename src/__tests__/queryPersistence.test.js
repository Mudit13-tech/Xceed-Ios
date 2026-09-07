import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { shouldPersistQuery } from '../utils/queryPersister';

/**
 * The signed-in user must never be written to localStorage.
 *
 * Persisting it once left a signed-out browser showing the previous account's
 * email through reloads — the entry was restored on load and, being younger
 * than the query's staleTime, was never refetched to find out the session had
 * ended. Everything else still persists, which is what paints the shell fast.
 */
const queryFor = (queryKey, data) => {
  const client = new QueryClient();
  client.setQueryData(queryKey, data);
  return client.getQueryCache().find({ queryKey });
};

describe('what may be persisted to localStorage', () => {
  it('never persists the signed-in user', () => {
    expect(shouldPersistQuery(queryFor(['user', 'details'], { user: { email: ['a@b.com'] } }))).toBe(false);
  });

  // Same leak, different key. These machines are shared, so a student's own
  // attendance record must not be restored into the next student's browser.
  it('never persists the learning module\'s view of the account', () => {
    expect(shouldPersistQuery(queryFor(['learning', 'me'], { email: 'a@b.com' }))).toBe(false);
  });

  it('never persists a student\'s own attendance record', () => {
    expect(shouldPersistQuery(queryFor(['learning', 'profile'], { attendanceHistory: [] }))).toBe(false);
  });

  it('still persists ordinary cached data', () => {
    expect(shouldPersistQuery(queryFor(['learning', 'classes', 'active'], [{ id: 1 }]))).toBe(true);
  });

  // The gate matches by prefix, not by substring: a key that merely starts with
  // the same word as a session key is ordinary content and still persists.
  it('does not over-match a sibling key', () => {
    expect(shouldPersistQuery(queryFor(['learning', 'members'], [{ id: 1 }]))).toBe(true);
  });

  it('does not persist a query that has not succeeded', () => {
    const client = new QueryClient();
    const queryKey = ['learning', 'classes', 'archived'];
    client.getQueryCache().build(client, { queryKey });
    expect(shouldPersistQuery(client.getQueryCache().find({ queryKey }))).toBe(false);
  });
});
