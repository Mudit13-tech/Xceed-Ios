import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import useQuizCountdown from '../hooks/useQuizCountdown';

/**
 * The per-question clock, in one-at-a-time delivery.
 *
 * This mode is the one where the countdown *does* something when it reaches zero:
 * a whole-paper clock submits the attempt, but a per-question clock moves the
 * student on to the next question. That makes two properties load-bearing which do
 * not matter at all for a paper clock, and neither of them held:
 *
 *  1. **Expiry has to happen once.** The interval kept running past zero, so it
 *     called the expiry callback again every second while the advance request was
 *     in flight. Each call advanced the cursor, so a student on a slow connection
 *     was carried past two or three questions they never saw.
 *
 *  2. **Expiry has to use the answer the student actually gave.** The callback
 *     closes over `answers`, and the effect only re-runs when the *deadline*
 *     changes — so the callback captured at the start of a question still held the
 *     answer state from that moment. A student who answered and let the clock run
 *     out had their answer replaced by whatever was there when the question
 *     loaded: usually nothing.
 *
 * In one-at-a-time delivery the answer is only sent to the server on advance, so
 * (2) means the answer was not saved anywhere else either — it was simply lost.
 */
describe('the per-question countdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const run = (props) => {
    const view = renderHook((p) => useQuizCountdown(p), { initialProps: props });
    return view;
  };

  const inSeconds = (n) => new Date(Date.now() + n * 1000).toISOString();

  it('moves the student on exactly once when the question runs out', () => {
    // The skipped-questions bug. Advancing is a request, and while it is in flight
    // the deadline has not changed yet — so every further tick fired again.
    const onExpire = vi.fn();
    run({ deadline: inSeconds(2), departed: false, finished: false, onExpire });

    act(() => vi.advanceTimersByTime(2000));
    expect(onExpire).toHaveBeenCalledTimes(1);

    // Ten more seconds of the deadline sitting in the past, as a slow advance
    // request would produce.
    act(() => vi.advanceTimersByTime(10_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('fires only once for a deadline that has already passed', () => {
    // A question served to a tab that was asleep, or a reload after the clock ran
    // out. The first tick is already past zero.
    const onExpire = vi.fn();
    run({ deadline: inSeconds(-5), departed: false, finished: false, onExpire });

    expect(onExpire).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(30_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('uses the answer as it stands at expiry, not as it stood when the question loaded', () => {
    // The lost-answer bug, and the reason `onExpire` cannot simply be left out of
    // the dependency list. The student answers after the countdown has started;
    // the callback that eventually runs must be the one that can see it.
    let submitted = null;
    const deadline = inSeconds(3);
    const { rerender } = run({
      deadline,
      departed: false,
      finished: false,
      onExpire: () => {
        submitted = 'nothing';
      },
    });

    // A keystroke: the page re-renders with a new callback closing over the new
    // answers. The countdown must *not* restart — that would hand the student a
    // fresh clock for typing — but it must use this callback.
    rerender({
      deadline,
      departed: false,
      finished: false,
      onExpire: () => {
        submitted = 'option B';
      },
    });

    act(() => vi.advanceTimersByTime(3000));
    expect(submitted).toBe('option B');
  });

  it('does not restart the clock when only the callback changes', () => {
    // The other half of the same requirement. If a new callback restarted the
    // countdown, a student could hold a question open indefinitely by typing.
    const onExpire = vi.fn();
    // Held in a variable and reused, because that is what the app does: the
    // deadline is a fixed string the server sent with the question, and it does
    // not move while the student types. Recomputing it here would hand the hook a
    // genuinely later deadline, which it is right to treat as a new question.
    const deadline = inSeconds(10);
    const { result, rerender } = run({ deadline, departed: false, finished: false, onExpire });

    act(() => vi.advanceTimersByTime(4000));
    expect(result.current).toBe(6);

    rerender({ deadline, departed: false, finished: false, onExpire: vi.fn() });
    // Still six seconds left, not ten again.
    expect(result.current).toBe(6);
  });

  it('starts a fresh clock for the next question', () => {
    // What a new deadline means: a different question, so the countdown restarts
    // and is allowed to expire again.
    const onExpire = vi.fn();
    const { result, rerender } = run({
      deadline: inSeconds(2),
      departed: false,
      finished: false,
      onExpire,
    });

    act(() => vi.advanceTimersByTime(2000));
    expect(onExpire).toHaveBeenCalledTimes(1);

    // The server answers the advance with the next question and its own deadline.
    rerender({ deadline: inSeconds(60), departed: false, finished: false, onExpire });
    expect(result.current).toBe(60);

    act(() => vi.advanceTimersByTime(60_000));
    expect(onExpire).toHaveBeenCalledTimes(2);
  });

  it('shows the question’s own remaining time, counting down each second', () => {
    const { result } = run({
      deadline: inSeconds(45),
      departed: false,
      finished: false,
      onExpire: vi.fn(),
    });
    expect(result.current).toBe(45);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(44);
    act(() => vi.advanceTimersByTime(14_000));
    expect(result.current).toBe(30);
  });

  it('does not expire a question the student has already been carried away from', () => {
    // Leaving the test screen ends the whole paper, so a question clock must not
    // fire an advance behind it.
    const onExpire = vi.fn();
    const deadline = inSeconds(2);
    const { rerender } = run({ deadline, departed: false, finished: false, onExpire });
    rerender({ deadline, departed: true, finished: false, onExpire });
    act(() => vi.advanceTimersByTime(10_000));
    expect(onExpire).not.toHaveBeenCalled();
  });
});
