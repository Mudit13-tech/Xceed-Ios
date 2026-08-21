import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import useProctoring, { BLUR_GRACE_MS } from '../hooks/useProctoring';

/**
 * The lockdown is only worth having if it is actually on, and both ways it can
 * silently fail are invisible from the outside: a hook that never becomes
 * active leaves right-click working, and a fullscreen flag that stops tracking
 * leaves the "you have left fullscreen" gate reading "still fullscreen" for the
 * rest of the sitting. Both are tested here rather than through the screen,
 * because both were shipped once with the screen looking perfectly correct.
 */

/** jsdom implements neither the property nor the request. */
const setFullscreen = (on) => {
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: on ? document.body : null,
  });
  act(() => {
    document.dispatchEvent(new Event('fullscreenchange'));
  });
};

const rightClick = () => {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  act(() => {
    document.dispatchEvent(event);
  });
  return event;
};

describe('learningModule useProctoring', () => {
  it('blocks right-click and reports it while a sitting is live', () => {
    const onViolation = vi.fn().mockResolvedValue({});
    renderHook(() =>
      useProctoring({ settings: { disableRightClick: true }, active: true, onViolation }),
    );

    expect(rightClick().defaultPrevented).toBe(true);
    expect(onViolation).toHaveBeenCalledWith('right_click', expect.any(String));
  });

  it('leaves right-click alone when the paper did not ask for it', () => {
    renderHook(() => useProctoring({ settings: {}, active: true }));

    expect(rightClick().defaultPrevented).toBe(false);
  });

  it('holds the restrictions on the brief, where there is nothing to report to', () => {
    // No `onViolation`: the pre-test screen is already on the fullscreen stage,
    // so a working right-click there reads as the lockdown not being on.
    renderHook(() => useProctoring({ settings: { disableRightClick: true }, active: true }));

    expect(rightClick().defaultPrevented).toBe(true);
  });

  it('tracks fullscreen even before a sitting is active', () => {
    setFullscreen(true);
    const { result } = renderHook(() =>
      useProctoring({ settings: {}, active: false }),
    );
    expect(result.current.isFullscreen).toBe(true);

    setFullscreen(false);
    expect(result.current.isFullscreen).toBe(false);
  });

  it('reports leaving fullscreen only once a sitting is live', () => {
    setFullscreen(true);
    const onViolation = vi.fn().mockResolvedValue({});
    const { rerender, result } = renderHook(
      ({ active }) =>
        useProctoring({ settings: {}, active, onViolation }),
      { initialProps: { active: false } },
    );

    setFullscreen(false);
    expect(result.current.isFullscreen).toBe(false);
    expect(onViolation).not.toHaveBeenCalled();

    setFullscreen(true);
    rerender({ active: true });
    setFullscreen(false);
    expect(onViolation).toHaveBeenCalledWith('fullscreen_exit', expect.any(String));
  });

  /**
   * Leaving is no longer a per-quiz option, so the empty settings object below
   * is the point of the test: a paper that configures nothing is still locked
   * down, because the server ends the attempt on the first departure and the
   * report is what tells it one happened.
   */
  it('reports leaving the tab on a paper that configures nothing', () => {
    const onViolation = vi.fn().mockResolvedValue({});
    renderHook(() => useProctoring({ settings: {}, active: true, onViolation }));

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(onViolation).toHaveBeenCalledWith('tab_switch', expect.any(String));
  });

  /**
   * A window blur is not evidence of anything on its own.
   *
   * It fires for a notification toast, the Alt or Windows key, an IME switch, one
   * of the browser's own bubbles, a click that lands on a second monitor. Under
   * the old code each of those submitted the paper on the spot with no allowance
   * and no way back, which is what students reported as being thrown out of the
   * quiz at random. These tests pin both halves: the transient blur costs
   * nothing, and the real departure still ends the sitting.
   */
  describe('a window blur', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    /** Focus really is gone — an alt-tab, not a popup that took it for a moment. */
    const loseFocus = () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      act(() => {
        window.dispatchEvent(new Event('blur'));
      });
    };

    const waitOutGrace = async () => {
      await act(async () => {
        vi.advanceTimersByTime(BLUR_GRACE_MS + 50);
      });
    };

    it('is not reported until it has been given a chance to prove itself', async () => {
      const onViolation = vi.fn().mockResolvedValue({});
      const { result } = renderHook(() =>
        useProctoring({ settings: {}, active: true, onViolation }),
      );

      loseFocus();
      // The moment of the event: nothing has happened to the paper yet.
      expect(onViolation).not.toHaveBeenCalled();
      expect(result.current.departed).toBe(false);

      await waitOutGrace();
      expect(onViolation).toHaveBeenCalledWith('blur', expect.any(String));
      expect(result.current.departed).toBe(true);
    });

    it('costs nothing when focus comes straight back', async () => {
      // The whole class of false positives, in one test.
      const onViolation = vi.fn().mockResolvedValue({});
      const { result } = renderHook(() =>
        useProctoring({ settings: {}, active: true, onViolation }),
      );

      loseFocus();
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      await waitOutGrace();
      expect(onViolation).not.toHaveBeenCalled();
      expect(result.current.departed).toBe(false);
    });

    it('costs nothing when the window turns out to still have focus', async () => {
      // No `focus` event ever arrives — the bubble took focus and gave it back
      // without the window noticing. The confirmation has to check the state
      // itself rather than trust that it was told.
      const onViolation = vi.fn().mockResolvedValue({});
      const { result } = renderHook(() =>
        useProctoring({ settings: {}, active: true, onViolation }),
      );

      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event('blur'));
      });

      await waitOutGrace();
      expect(onViolation).not.toHaveBeenCalled();
      expect(result.current.departed).toBe(false);
    });

    it('is reported with the time it happened, not the time it was confirmed', async () => {
      // Nothing is bought by the wait: the server sees the moment the student
      // left, and judges the attempt against that.
      const onViolation = vi.fn().mockResolvedValue({});
      renderHook(() => useProctoring({ settings: {}, active: true, onViolation }));

      const before = Date.now();
      loseFocus();
      await waitOutGrace();

      const [, at] = onViolation.mock.calls[0];
      expect(new Date(at).getTime()).toBeLessThan(before + BLUR_GRACE_MS);
    });

    /**
     * The regression that would make all of the above worthless.
     *
     * The confirmation is a timer living in an effect, and the sitting re-renders
     * every second while the countdown ticks. If the effect depends on the
     * caller's callbacks — which arrive as fresh arrows each render — its cleanup
     * cancels the pending timer before it can ever fire, and no departure is ever
     * reported. That fails *open*, silently, which is the worst direction.
     */
    it('survives the re-renders that happen while it is being confirmed', async () => {
      let renders = 0;
      const onViolation = vi.fn().mockResolvedValue({});
      const { rerender } = renderHook(() => {
        renders += 1;
        return useProctoring({
          settings: {},
          active: true,
          // New identities on every render, exactly as `QuizAttempt` passes them.
          onViolation: (...args) => onViolation(...args),
          onHeartbeat: () => Promise.resolve({}),
          onTerminated: () => {},
        });
      });

      loseFocus();
      rerender();
      rerender();
      await waitOutGrace();

      expect(renders).toBeGreaterThan(1);
      expect(onViolation).toHaveBeenCalledWith('blur', expect.any(String));
    });

    it('does not report twice when the tab goes hidden as well', async () => {
      // One departure reaching us as two events. The unambiguous one wins, and it
      // carries the blur's earlier timestamp.
      const onViolation = vi.fn().mockResolvedValue({});
      renderHook(() => useProctoring({ settings: {}, active: true, onViolation }));

      loseFocus();
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await waitOutGrace();

      expect(onViolation).toHaveBeenCalledTimes(1);
      expect(onViolation).toHaveBeenCalledWith('tab_switch', expect.any(String));
    });
  });

  /**
   * The hole this closes: a student drops their connection *before* leaving
   * fullscreen, so the report that would have ended their attempt fails, and
   * nothing ever retried it. Pulling the network cable was a free pass.
   */
  describe('reports that could not be sent', () => {
    const attemptId = 'attempt-1';

    beforeEach(() => {
      sessionStorage.clear();
      setFullscreen(true);
    });

    it('keeps a failed report and replays it with the time it happened', async () => {
      const onViolation = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({});
      const onHeartbeat = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({});

      renderHook(() =>
        useProctoring({ settings: {}, active: true, attemptId, onViolation, onHeartbeat }),
      );
      await act(async () => {});

      setFullscreen(false);
      await act(async () => {});

      // Reported, refused, and not thrown away.
      expect(onViolation).toHaveBeenCalledTimes(1);
      const [, firstAt] = onViolation.mock.calls[0];
      expect(JSON.parse(sessionStorage.getItem(`lmProctorQueue:${attemptId}`))).toEqual([
        { type: 'fullscreen_exit', at: firstAt },
      ]);

      // Coming back online drains it, carrying the original timestamp rather
      // than the moment of reconnection.
      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      expect(onViolation).toHaveBeenCalledTimes(2);
      expect(onViolation).toHaveBeenLastCalledWith('fullscreen_exit', firstAt);
      expect(sessionStorage.getItem(`lmProctorQueue:${attemptId}`)).toBeNull();
    });

    it('terminates on the replay, and drops what is left behind it', async () => {
      const onViolation = vi
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue({ terminated: true, message: 'Submitted automatically.' });
      const onTerminated = vi.fn();

      const { result } = renderHook(() =>
        useProctoring({ settings: {}, active: true, attemptId, onViolation, onTerminated }),
      );

      setFullscreen(false);
      await act(async () => {});
      // A second departure behind the first. Deliberately the tab, not the
      // window: a blur is confirmed over two seconds and would be dropped here
      // anyway, because the fullscreen exit above has already closed the paper.
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await act(async () => {});
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      expect(JSON.parse(sessionStorage.getItem(`lmProctorQueue:${attemptId}`))).toHaveLength(2);

      await act(async () => {
        await result.current.flushViolations();
      });

      // The first replay ended the attempt, so the second is not sent: it would
      // be a no-op against a finished sitting, and the queue must not outlive it.
      expect(onViolation).toHaveBeenCalledTimes(3);
      expect(onTerminated).toHaveBeenCalledTimes(1);
      expect(result.current.warning).toBe('Submitted automatically.');
      expect(sessionStorage.getItem(`lmProctorQueue:${attemptId}`)).toBeNull();
    });

    it('holds the queue when the connection is still down', async () => {
      const onViolation = vi.fn().mockRejectedValue(new Error('offline'));

      const { result } = renderHook(() =>
        useProctoring({ settings: {}, active: true, attemptId, onViolation }),
      );

      setFullscreen(false);
      await act(async () => {});
      await act(async () => {
        await result.current.flushViolations();
      });

      expect(JSON.parse(sessionStorage.getItem(`lmProctorQueue:${attemptId}`))).toHaveLength(1);
    });
  });

  /**
   * The answer sitting in a debounced autosave when a departure fires.
   *
   * `answerAndAdvance`/`saveAttemptDraft` both refuse a write against an
   * attempt that is no longer `in_progress` — so once the violation report
   * lands and ends the sitting, whatever the autosave still had queued is
   * refused, permanently. `beforeLeave` exists to get it out first.
   */
  describe('flushing an answer before a departure ends the attempt', () => {
    beforeEach(() => setFullscreen(true));

    it('awaits beforeLeave before the violation report is sent', async () => {
      const order = [];
      const onViolation = vi.fn().mockImplementation(async (type) => {
        order.push(`reported:${type}`);
        return {};
      });
      let releaseFlush;
      const beforeLeave = vi.fn().mockImplementation(
        () => new Promise((resolve) => { releaseFlush = () => { order.push('flushed'); resolve(); }; }),
      );

      renderHook(() => useProctoring({ settings: {}, active: true, onViolation, beforeLeave }));

      setFullscreen(false);
      // The report must not have gone out yet — it is waiting on the flush.
      await act(async () => {});
      expect(onViolation).not.toHaveBeenCalled();

      await act(async () => {
        releaseFlush();
        await Promise.resolve();
      });

      expect(order).toEqual(['flushed', 'reported:fullscreen_exit']);
    });

    it('does not call beforeLeave for a report that is not a departure', () => {
      const onViolation = vi.fn().mockResolvedValue({});
      const beforeLeave = vi.fn().mockResolvedValue(undefined);
      renderHook(() =>
        useProctoring({
          settings: { disableRightClick: true },
          active: true,
          onViolation,
          beforeLeave,
        }),
      );

      rightClick();
      expect(onViolation).toHaveBeenCalledWith('right_click', expect.any(String));
      expect(beforeLeave).not.toHaveBeenCalled();
    });

    it('still ends the attempt when the flush itself fails', async () => {
      // `beforeLeave` is documented to never throw (the autosave's own flush
      // never rejects), but the departure must not be held hostage by one that
      // does — a caller's bug in the callback must not read as "leaving no
      // longer works".
      const onViolation = vi.fn().mockResolvedValue({ terminated: true });
      const beforeLeave = vi.fn().mockRejectedValue(new Error('boom'));
      const onTerminated = vi.fn();

      renderHook(() =>
        useProctoring({ settings: {}, active: true, onViolation, beforeLeave, onTerminated }),
      );

      setFullscreen(false);
      await act(async () => {});

      expect(onViolation).toHaveBeenCalledWith('fullscreen_exit', expect.any(String));
      expect(onTerminated).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * A second screen taking over the sitting mid-heartbeat — the losing side of
   * the very rebind that rescues a genuine crash. The attempt is not over, so
   * this must not be folded into `onTerminated`, and retrying buys nothing:
   * every request from here on gets the same refusal.
   */
  describe('a session taken over by another browser', () => {
    const conflict = () =>
      Object.assign(new Error('taken over'), { status: 409, payload: { code: 'SESSION_CONFLICT' } });

    it('calls onSessionConflict rather than onTerminated', async () => {
      const onHeartbeat = vi.fn().mockRejectedValue(conflict());
      const onTerminated = vi.fn();
      const onSessionConflict = vi.fn();

      renderHook(() =>
        useProctoring({ settings: {}, active: true, onHeartbeat, onTerminated, onSessionConflict }),
      );
      await act(async () => {});

      expect(onSessionConflict).toHaveBeenCalledTimes(1);
      expect(onSessionConflict.mock.calls[0][0]).toMatchObject({ status: 409 });
      expect(onTerminated).not.toHaveBeenCalled();
    });

    it('stops heartbeating once the session is known to be gone', async () => {
      vi.useFakeTimers();
      const onHeartbeat = vi.fn().mockRejectedValue(conflict());
      const onSessionConflict = vi.fn();

      renderHook(() => useProctoring({ settings: {}, active: true, onHeartbeat, onSessionConflict }));
      await act(async () => {});
      expect(onHeartbeat).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(120000);
      });

      // Not two, three, or four more — the loop noticed and stopped.
      expect(onHeartbeat).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('leaves a plain network failure alone — still no report, still retried on the next beat', async () => {
      vi.useFakeTimers();
      const onHeartbeat = vi.fn().mockRejectedValue(new Error('offline'));
      const onSessionConflict = vi.fn();

      renderHook(() => useProctoring({ settings: {}, active: true, onHeartbeat, onSessionConflict }));
      await act(async () => {});

      await act(async () => {
        await vi.advanceTimersByTimeAsync(35000);
      });

      expect(onSessionConflict).not.toHaveBeenCalled();
      expect(onHeartbeat.mock.calls.length).toBeGreaterThan(1);
      vi.useRealTimers();
    });
  });
});

/**
 * The keyboard on the pre-test screen.
 *
 * `keyboardLockdown` binds `keydown` on `window` in the capture phase and calls
 * `preventDefault`, so nothing can be typed anywhere on the page. That is right
 * for a paper answered by clicking, and wrong for the brief in front of it: the
 * brief carries the Safe Exam Browser access-code field, and the students who
 * need that field are exactly the ones who could not type into it.
 */
describe('keyboardLockdown and the brief', () => {
  const press = () => {
    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    return event;
  };

  it('swallows a keypress during the sitting', () => {
    renderHook(() =>
      useProctoring({ settings: { keyboardLockdown: true }, active: true, onViolation: vi.fn() }),
    );
    expect(press().defaultPrevented).toBe(true);
  });

  it('lets the brief keep its keyboard, so the access code can be typed', () => {
    renderHook(() =>
      useProctoring({
        settings: { keyboardLockdown: true },
        active: true,
        lockKeyboard: false,
        onViolation: vi.fn(),
      }),
    );
    expect(press().defaultPrevented).toBe(false);
  });

  it('reports nothing for a key the brief allowed', () => {
    // The report and the block are separate decisions; letting the key through
    // must not also file a proctoring flag against a student typing a code they
    // were told to type.
    const onViolation = vi.fn();
    renderHook(() =>
      useProctoring({
        settings: { keyboardLockdown: true },
        active: true,
        lockKeyboard: false,
        attemptId: 'a1',
        onViolation,
      }),
    );
    press();
    expect(onViolation).not.toHaveBeenCalled();
  });
});
