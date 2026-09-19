import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePolling from '../usePolling';

/** Drive document.visibilityState, which jsdom exposes read-only. */
function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('calls immediately and then on each interval', () => {
    const fn = vi.fn();
    renderHook(() => usePolling(fn, 1000));

    expect(fn).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('skips the leading call when immediate is false', () => {
    const fn = vi.fn();
    renderHook(() => usePolling(fn, 1000, { immediate: false }));

    expect(fn).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled, and starts when enabled flips', () => {
    const fn = vi.fn();
    const { rerender } = renderHook(
      ({ on }) => usePolling(fn, 1000, { enabled: on }),
      { initialProps: { on: false } },
    );

    act(() => { vi.advanceTimersByTime(5000); });
    expect(fn).not.toHaveBeenCalled();

    rerender({ on: true });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('treats a null or zero interval as disabled', () => {
    const fn = vi.fn();
    renderHook(() => usePolling(fn, null));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(fn).not.toHaveBeenCalled();
  });

  it('stops polling on unmount', () => {
    const fn = vi.fn();
    const { unmount } = renderHook(() => usePolling(fn, 1000));
    fn.mockClear();

    unmount();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(fn).not.toHaveBeenCalled();
  });

  describe('pausing in a background tab', () => {
    it('stops while hidden and resumes on return', () => {
      const fn = vi.fn();
      renderHook(() => usePolling(fn, 1000));
      fn.mockClear();

      act(() => { setVisibility('hidden'); });
      act(() => { vi.advanceTimersByTime(10000); });
      expect(fn).not.toHaveBeenCalled();

      act(() => { setVisibility('visible'); });
      // Fires straight away rather than waiting out an interval.
      expect(fn).toHaveBeenCalledTimes(1);

      act(() => { vi.advanceTimersByTime(2000); });
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('does not even make the leading call if mounted while hidden', () => {
      setVisibility('hidden');
      const fn = vi.fn();
      renderHook(() => usePolling(fn, 1000));

      expect(fn).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(5000); });
      expect(fn).not.toHaveBeenCalled();
    });

    it('keeps polling while hidden when pauseWhenHidden is false', () => {
      const fn = vi.fn();
      renderHook(() => usePolling(fn, 1000, { pauseWhenHidden: false }));
      fn.mockClear();

      act(() => { setVisibility('hidden'); });
      act(() => { vi.advanceTimersByTime(3000); });
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('removes its visibility listener on unmount', () => {
      const remove = vi.spyOn(document, 'removeEventListener');
      const { unmount } = renderHook(() => usePolling(vi.fn(), 1000));
      unmount();
      expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  describe('overlapping requests', () => {
    it('skips ticks while a slow call is still in flight', async () => {
      let release;
      const fn = vi.fn(() => new Promise((resolve) => { release = resolve; }));
      renderHook(() => usePolling(fn, 1000));

      expect(fn).toHaveBeenCalledTimes(1);

      // Four intervals pass while the first call is still outstanding.
      await act(async () => { vi.advanceTimersByTime(4000); });
      expect(fn).toHaveBeenCalledTimes(1);

      await act(async () => { release(); });
      await act(async () => { vi.advanceTimersByTime(1000); });
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('resumes after a rejected call rather than wedging', async () => {
      let reject;
      const fn = vi.fn(() => new Promise((_, r) => { reject = r; }));
      renderHook(() => usePolling(fn, 1000));
      expect(fn).toHaveBeenCalledTimes(1);

      await act(async () => { reject(new Error('network')); });
      await act(async () => { vi.advanceTimersByTime(1000); });
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('allows overlap when skipWhenInFlight is false', async () => {
      const fn = vi.fn(() => new Promise(() => {}));
      renderHook(() => usePolling(fn, 1000, { skipWhenInFlight: false }));

      await act(async () => { vi.advanceTimersByTime(3000); });
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('keeps the timer alive when the callback throws synchronously', () => {
      const fn = vi.fn(() => { throw new Error('boom'); });
      renderHook(() => usePolling(fn, 1000));

      expect(fn).toHaveBeenCalledTimes(1);
      act(() => { vi.advanceTimersByTime(2000); });
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  it('picks up a new callback without restarting the timer', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ cb }) => usePolling(cb, 1000),
      { initialProps: { cb: first } },
    );
    expect(first).toHaveBeenCalledTimes(1);

    // A changed callback identity must not re-fire the leading call — that is
    // what turns one render into one extra request.
    rerender({ cb: second });
    expect(second).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1000); });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });
});
