import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import useProctoring, { BLUR_GRACE_MS } from '../hooks/useProctoring';
import useQuizCountdown from '../hooks/useQuizCountdown';

/**
 * Leaving fullscreen during a quiz.
 *
 * The reported bug: a student pressed Escape, the paper stayed open behind a
 * "fullscreen required" screen, and the countdown carried on running — so leaving
 * cost them time but did not cost them the attempt, and coming back was free.
 *
 * The rule is that leaving the test screen submits the paper, and the server has
 * always enforced it (`countsAsLeaving` → `finaliseAttempt(..., "terminated")`).
 * The client did not, in two ways that these tests pin down:
 *
 *  1. It waited for the server's reply before believing the departure. On a
 *     dropped connection the report was queued and nothing came back, so the
 *     sitting stayed open for up to a heartbeat — thirty seconds of paper time
 *     bought by pulling the network before pressing Escape.
 *  2. The countdown had no dependency on any of it. It ran through the gate, and
 *     it also ran on *after* the attempt was terminated, because the flag saying
 *     so was a ref and refs do not re-run effects.
 *
 * The second half tests the countdown through `useQuizCountdown` rather than the
 * whole page, because what is being checked is precisely which dependencies stop
 * the interval — a property of the effect, not of anything visible in a rendered
 * paper.
 */

/** Puts `document.fullscreenElement` under the test's control. */
const setFullscreen = (on) => {
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: on ? document.body : null,
  });
};

const leaveFullscreen = () => {
  setFullscreen(false);
  act(() => {
    document.dispatchEvent(new Event('fullscreenchange'));
  });
};

describe('leaving fullscreen mid-sitting', () => {
  beforeEach(() => {
    setFullscreen(true);
    sessionStorage.clear();
  });

  afterEach(() => {
    setFullscreen(false);
    sessionStorage.clear();
  });

  it('reports the exit to the server', () => {
    const onViolation = vi.fn().mockResolvedValue({ terminated: true });
    renderHook(() =>
      useProctoring({ active: true, attemptId: 'a1', onViolation, settings: {} }),
    );

    leaveFullscreen();

    expect(onViolation).toHaveBeenCalledWith('fullscreen_exit', expect.any(String));
  });

  it('closes the paper the moment the exit happens, without waiting for the server', async () => {
    // The core of the bug. `onViolation` never settles here — the request is in
    // flight, or the connection is gone — and the sitting must still be over.
    const onViolation = vi.fn(() => new Promise(() => {}));
    const { result } = renderHook(() =>
      useProctoring({ active: true, attemptId: 'a1', onViolation, settings: {} }),
    );

    expect(result.current.departed).toBe(false);
    leaveFullscreen();
    expect(result.current.departed).toBe(true);
  });

  it('closes the paper even when the report fails outright', async () => {
    // Offline. The old code swallowed this, queued the report and left the sitting
    // open until the next heartbeat flushed it — which is the window that made
    // pulling the network worth doing.
    const onViolation = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() =>
      useProctoring({ active: true, attemptId: 'a1', onViolation, settings: {} }),
    );

    leaveFullscreen();

    await waitFor(() => expect(result.current.departed).toBe(true));
    // And the report is not lost: it waits in the queue for a connection.
    expect(JSON.parse(sessionStorage.getItem('lmProctorQueue:a1'))).toEqual([
      expect.objectContaining({ type: 'fullscreen_exit' }),
    ]);
  });

  it('does not reopen the paper when the student returns to fullscreen', async () => {
    const onViolation = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() =>
      useProctoring({ active: true, attemptId: 'a1', onViolation, settings: {} }),
    );

    leaveFullscreen();
    await waitFor(() => expect(result.current.departed).toBe(true));

    // Back in. The gate's old "Enter fullscreen and continue" button did exactly
    // this, and handed the paper back.
    setFullscreen(true);
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    expect(result.current.isFullscreen).toBe(true);
    expect(result.current.departed).toBe(true);
  });

  it('treats switching tab and switching window the same way', async () => {
    // The server's `countsAsLeaving` covers all three. A client that blocked on a
    // different set than the server terminates on is the same inconsistency in a
    // different place.
    //
    // Switching window is confirmed before it counts — see BLUR_GRACE_MS — so the
    // departure lands once focus has stayed gone, not on the raw event. What must
    // not change is that it lands at all.
    vi.useFakeTimers();
    try {
      const onViolation = vi.fn().mockResolvedValue({});
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      const { result } = renderHook(() =>
        useProctoring({ active: true, attemptId: 'a1', onViolation, settings: {} }),
      );

      act(() => {
        window.dispatchEvent(new Event('blur'));
      });
      await act(async () => {
        vi.advanceTimersByTime(BLUR_GRACE_MS + 50);
      });

      expect(result.current.departed).toBe(true);
      expect(onViolation).toHaveBeenCalledWith('blur', expect.any(String));
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it('does not close anything before the sitting has started', () => {
    // The pre-test brief runs the same hook with `active: false` and no attempt to
    // end. Latching a departure there would close a paper nobody had opened.
    const onViolation = vi.fn();
    const { result } = renderHook(() =>
      useProctoring({ active: false, attemptId: 'a1', onViolation, settings: {} }),
    );

    leaveFullscreen();

    expect(onViolation).not.toHaveBeenCalled();
    expect(result.current.departed).toBe(false);
  });

  it('notices an exit that happened before the watcher mounted', () => {
    // A reload outside fullscreen. `isFullscreen` has to be seeded from the
    // document rather than from `false` or `true`, or the gate never fires.
    setFullscreen(false);
    const { result } = renderHook(() =>
      useProctoring({ active: true, attemptId: 'a1', onViolation: vi.fn(), settings: {} }),
    );
    expect(result.current.isFullscreen).toBe(false);
  });
});

/**
 * The countdown.
 *
 * Driven through the real `useQuizCountdown` — the same module `QuizAttempt`
 * imports. An earlier version of this file reproduced the effect locally, which
 * was worse than useless: it passed against the broken code and would have gone
 * on passing after a regression, because it was testing the copy. Extracting the
 * hook was worth doing purely so these assertions land on shipped code.
 */
describe('the countdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const run = (props) => {
    const onExpire = vi.fn();
    const view = renderHook((p) => useQuizCountdown({ onExpire, ...p }), { initialProps: props });
    return { ...view, onExpire };
  };

  const in60s = () => new Date(Date.now() + 60_000).toISOString();

  it('counts down while the paper is open', () => {
    const { result } = run({ deadline: in60s(), departed: false, finished: false });
    expect(result.current).toBe(60);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toBe(57);
  });

  it('stops the moment the student leaves the test screen', () => {
    // The reported symptom, directly. Before the fix this kept counting, so a
    // student who left and came back had lost the intervening time.
    const { result, rerender } = run({ deadline: in60s(), departed: false, finished: false });
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current).toBe(58);

    rerender({ deadline: in60s(), departed: true, finished: false });
    expect(result.current).toBeNull();

    // And it is really stopped, not merely blanked once.
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current).toBeNull();
  });

  it('does not auto-submit a paper the student has already left', () => {
    // The interval used to survive, so on reaching zero it called `finish(true)`
    // against an attempt the server had already terminated.
    const { rerender, onExpire } = run({ deadline: in60s(), departed: false, finished: false });
    rerender({ deadline: in60s(), departed: true, finished: false });
    act(() => vi.advanceTimersByTime(120_000));
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('stops once the attempt is finished', () => {
    // `finishedRef` is a ref, so mutating it never re-ran the effect and the
    // interval outlived the attempt. `result` is state, which is why it is in the
    // dependency list.
    const { result, rerender, onExpire } = run({ deadline: in60s(), departed: false, finished: false });
    rerender({ deadline: in60s(), departed: false, finished: true });
    expect(result.current).toBeNull();
    act(() => vi.advanceTimersByTime(120_000));
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('still expires a paper nobody left', () => {
    // The countdown's actual job, which none of the above may break.
    const { onExpire } = run({
      deadline: new Date(Date.now() + 2000).toISOString(),
      departed: false,
      finished: false,
    });
    act(() => vi.advanceTimersByTime(3000));
    expect(onExpire).toHaveBeenCalled();
  });
});
