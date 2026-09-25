import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

import { DEFAULT_STALE_TIME, REFETCH_ON_WINDOW_FOCUS, CACHE_GC_TIME } from '../mobile/queryCache';

/**
 * What returning to the tab costs.
 *
 * The client was built with `staleTime: 0` — every answer out of date the
 * moment it arrived — and react-query's refetch-on-focus left on. Together
 * those mean every return to the tab refetches every query mounted on the
 * page, however briefly you were away, so a student switching between XCEED
 * and their notes re-ran the whole screen on each switch.
 *
 * These build a client from the same defaults the app does and drive a focus
 * at it, which is the only way to tell the fixed pairing from the broken one:
 * either setting alone reads as reasonable.
 */

/** The app's own defaults, as main.jsx assembles them. */
const appClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME,
        gcTime: CACHE_GC_TIME,
        refetchOnWindowFocus: REFETCH_ON_WINDOW_FOCUS,
        retry: false,
      },
    },
  });

const fetcher = vi.fn();

function Screen() {
  const { data } = useQuery({ queryKey: ['thing'], queryFn: fetcher });
  return <div>{data || 'loading'}</div>;
}

const focusTab = async () => {
  await act(async () => {
    window.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    await Promise.resolve();
  });
};

describe('the defaults every query inherits', () => {
  beforeEach(() => {
    fetcher.mockReset();
    fetcher.mockResolvedValue('answer');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('trusts an answer for a while rather than for no time at all', () => {
    // The regression this guards: back to 0 and every switch is a refetch.
    expect(DEFAULT_STALE_TIME).toBeGreaterThan(0);
  });

  it('keeps refetch-on-focus, because coming back should show current work', () => {
    expect(REFETCH_ON_WINDOW_FOCUS).toBe(true);
  });

  it('does not re-ask on a tab switch moments after it fetched', async () => {
    render(
      <QueryClientProvider client={appClient()}>
        <Screen />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('answer')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await focusTab();
    await focusTab();
    await focusTab();

    // Three switches away and back, and the screen still shows what it had.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does re-ask once the answer is genuinely old', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <QueryClientProvider client={appClient()}>
        <Screen />
      </QueryClientProvider>,
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // A lecture's worth of being away.
    await act(async () => { await vi.advanceTimersByTimeAsync(DEFAULT_STALE_TIME + 1000); });
    await focusTab();

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
