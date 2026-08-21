import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import useAnswerAutosave, { AUTOSAVE_DELAY_MS, RETRY_DELAY_MS } from '../hooks/useAnswerAutosave';

/**
 * Banking answers while the student works.
 *
 * The behaviour that matters is about *when* it does and does not send, because
 * every one of these fires on the connection that made autosaving worth doing:
 * a save per keystroke, or a save on every question served, is load added at the
 * exact moment the server is least able to take it.
 *
 * The timers are faked, so the waits are `advanceTimersByTimeAsync` rather than
 * `waitFor` — the latter polls on real timers and simply deadlocks against fake
 * ones.
 */

const answer = (selected, text = '') => ({ selected, text });
const tick = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('useAnswerAutosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (props, save = vi.fn().mockResolvedValue({})) => {
    const view = renderHook((p) => useAnswerAutosave({ save, ...p }), { initialProps: props });
    return { ...view, save };
  };

  it('saves an answer once the student stops changing it', async () => {
    const { rerender, save } = setup({ payload: {}, baseline: {}, active: true });

    rerender({ payload: { q1: answer(['2']) }, baseline: {}, active: true });
    expect(save).not.toHaveBeenCalled(); // not on the first keystroke

    await tick(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledWith([{ questionId: 'q1', selected: ['2'], text: '' }]);
  });

  it('sends once for a burst of changes, not once each', async () => {
    // A student clicking through options, or typing a number. The debounce is
    // the whole reason this is safe to run during an exam.
    const { rerender, save } = setup({ payload: {}, baseline: {}, active: true });

    for (const pick of ['0', '1', '2']) {
      rerender({ payload: { q1: answer([pick]) }, baseline: {}, active: true });
      await tick(200);
    }

    await tick(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith([{ questionId: 'q1', selected: ['2'], text: '' }]);
  });

  it('does not save an answer the server just handed over', async () => {
    // Arriving at a question that already carries an answer — a resumed paper,
    // or walking back. Saving it straight back is a request per question for a
    // change nobody made.
    const served = { q1: answer(['1']) };
    const { save } = setup({ payload: served, baseline: served, active: true });

    await tick(AUTOSAVE_DELAY_MS * 3);
    expect(save).not.toHaveBeenCalled();
  });

  it('ignores a change that leaves the answer where it was', async () => {
    // Re-picking the same option, or trailing whitespace in a numerical box.
    const baseline = { q1: answer(['1'], '42') };
    const { rerender, save } = setup({ payload: baseline, baseline, active: true });

    rerender({ payload: { q1: answer(['1'], '42  ') }, baseline, active: true });

    await tick(AUTOSAVE_DELAY_MS * 2);
    expect(save).not.toHaveBeenCalled();
  });

  it('stays quiet while the paper is not being sat', async () => {
    // Before the paper loads, and after it is submitted. A draft written against
    // a finished attempt is refused by the server anyway.
    const { rerender, save } = setup({ payload: {}, baseline: {}, active: false });
    rerender({ payload: { q1: answer(['0']) }, baseline: {}, active: false });

    await tick(AUTOSAVE_DELAY_MS * 3);
    expect(save).not.toHaveBeenCalled();
  });

  it('reports a failure as retrying rather than as an error', async () => {
    // The answer is still on screen and still travels with Next, so this is not
    // yet anything the student needs to act on.
    const save = vi.fn().mockRejectedValue(new Error('offline'));
    const { rerender, result } = setup({ payload: {}, baseline: {}, active: true }, save);

    rerender({ payload: { q1: answer(['0']) }, baseline: {}, active: true });
    await tick(AUTOSAVE_DELAY_MS);

    expect(result.current.status).toBe('retrying');
  });

  it('tries again on its own after a failure', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({});
    const { rerender, result } = setup({ payload: {}, baseline: {}, active: true }, save);

    rerender({ payload: { q1: answer(['0']) }, baseline: {}, active: true });
    await tick(AUTOSAVE_DELAY_MS);
    expect(result.current.status).toBe('retrying');

    // Without the student touching anything — the student who has stopped
    // typing is exactly the one whose answer is sitting unsaved.
    await tick(RETRY_DELAY_MS + AUTOSAVE_DELAY_MS);
    expect(save.mock.calls.length).toBeGreaterThan(1);
    expect(result.current.status).toBe('saved');
  });

  it('drops a pending save when the answer is committed another way', async () => {
    // `advance` and `finish` carry the answer themselves, and on a sequential
    // paper the cursor is about to move — a draft in flight is aimed at where it
    // used to be.
    const { rerender, result, save } = setup({ payload: {}, baseline: {}, active: true });

    rerender({ payload: { q1: answer(['0']) }, baseline: {}, active: true });
    // Braces, not a bare arrow: `cancel` returns a promise now, and an `act`
    // callback that returns one puts `act` into its async form — which then has
    // to be awaited or it leaves React mid-update for the next test.
    act(() => { result.current.cancel(); });

    await tick(AUTOSAVE_DELAY_MS * 2);
    expect(save).not.toHaveBeenCalled();
  });

  /**
   * The other half of "drops a pending save", and the half that was missing.
   *
   * Clearing the timer only ever handled a draft that had not left yet. One
   * already on the wire kept going and landed *beside* the commit that followed
   * it - two requests loading, mutating and saving the same attempt document at
   * once, which is what put Mongoose's "No matching document found for id ...
   * version 19" across the top of a student's exam paper. So `cancel` has to be
   * waitable, and has to actually wait.
   */
  it('waits for a save already on the wire, so the commit does not race it', async () => {
    let land;
    const save = vi.fn(() => new Promise((resolve) => { land = resolve; }));
    const { rerender, result } = setup({ payload: {}, baseline: {}, active: true }, save);

    rerender({ payload: { q1: answer(['0']) }, baseline: {}, active: true });
    await tick(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1); // in flight, not finished

    let settled = false;
    let waiting;
    act(() => { waiting = result.current.cancel().then(() => { settled = true; }); });

    await tick(1000);
    expect(settled).toBe(false); // still waiting on the request, as it must

    await act(async () => { land({}); await waiting; });
    expect(settled).toBe(true);
  });

  it('cancels without waiting when nothing is in flight', async () => {
    // The ordinary case by far: `advance` awaits this on every question, and on
    // a paper where the autosave has nothing to send it must cost nothing.
    const { result } = setup({ payload: {}, baseline: {}, active: true });
    await act(async () => { await result.current.cancel(); });
    expect(result.current.status).toBe('idle');
  });
});
