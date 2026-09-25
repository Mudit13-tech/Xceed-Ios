import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { DEFAULT_STALE_TIME, QUERY_RETRY, REFETCH_ON_WINDOW_FOCUS } from '../mobile/queryCache';

/**
 * What every visitor pays for, whether or not they use it.
 *
 * Two of these are one-line regressions that cost hundreds of kilobytes or a
 * multiple of the server's load, and neither shows up as a failing feature —
 * the site works perfectly while doing it. So they are pinned here rather than
 * left to be noticed in a profile.
 */

const read = (path) => readFileSync(path, 'utf8');

describe('the shared error page', () => {
  const source = read('src/pages/ErrorPage.jsx');

  it('does not pull in an animation runtime it never calls', () => {
    /* It imported `lottie-react` for a single usage that had been commented
       out, which put 318 kB of animation runtime into the chunk shown to
       somebody who is lost or on a failing connection — the page that most
       needs to arrive quickly was the heaviest one in the app. The animation
       is passed in as an element by the caller instead (see NotFound), so it
       is paid for only by the route that actually draws one. */
    expect(source).not.toMatch(/from ['"]lottie-react['"]/);
  });

  it('still renders whatever animation the caller hands it', () => {
    expect(source).toContain('{props.animation}');
  });
});

describe('the defaults every query inherits', () => {
  it('trusts an answer for a while rather than for no time at all', () => {
    // Zero here means every return to the tab refetches the whole page; see
    // QueryRefetchDefaults.test.jsx for what that does.
    expect(DEFAULT_STALE_TIME).toBeGreaterThan(0);
  });

  it('keeps refetch-on-focus, because coming back should show current work', () => {
    expect(REFETCH_ON_WINDOW_FOCUS).toBe(true);
  });

  it('retries a failed request once, not three times', () => {
    /* react-query's default of three is tuned for one user on a flaky phone.
       On a campus it means every client independently triples its load on a
       server at the moment it is least able to take it. */
    expect(QUERY_RETRY).toBe(1);
  });

  it('wires all three into the client', () => {
    const main = read('src/main.jsx');
    expect(main).toContain('staleTime: DEFAULT_STALE_TIME');
    expect(main).toContain('refetchOnWindowFocus: REFETCH_ON_WINDOW_FOCUS');
    expect(main).toContain('retry: QUERY_RETRY');
  });
});
