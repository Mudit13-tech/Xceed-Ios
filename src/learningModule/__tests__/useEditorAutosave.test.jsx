import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import useEditorAutosave, { AUTOSAVE_IDLE_MS } from '../hooks/useEditorAutosave';

/**
 * Banking a teacher's edits while they author.
 *
 * The behaviour worth pinning down is *when* it does not send. A save per
 * keystroke across an assignment with forty questions is a request storm
 * carrying the whole document each time, which is why the delay is thirty
 * seconds of silence rather than a fixed interval: the timer restarts on every
 * change, so it fires once the author has genuinely stopped, not once every
 * thirty seconds while they type.
 *
 * Timers are faked, so waits are `advanceTimersByTimeAsync` — `waitFor` polls
 * on real timers and deadlocks against fake ones.
 */

const tick = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('useEditorAutosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (props, save = vi.fn().mockResolvedValue(true)) => {
    const view = renderHook((p) => useEditorAutosave({ save, ...p }), { initialProps: props });
    return { ...view, save };
  };

  it('saves once the author stops editing', async () => {
    const { rerender, save } = setup({ payload: { title: 'Week 1' }, active: true });

    rerender({ payload: { title: 'Week 2' }, active: true });
    expect(save).not.toHaveBeenCalled(); // not on the keystroke

    await tick(AUTOSAVE_IDLE_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does not save while the author is still typing', async () => {
    // The point of the whole feature. Typing every few seconds for well over
    // the delay must still produce nothing, because the author has not stopped.
    const { rerender, save } = setup({ payload: { title: '' }, active: true });

    for (const title of ['W', 'We', 'Wee', 'Week']) {
      rerender({ payload: { title }, active: true });
      await tick(AUTOSAVE_IDLE_MS - 1000);
    }
    expect(save).not.toHaveBeenCalled();

    await tick(AUTOSAVE_IDLE_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('sends what is on screen when the timer finally fires, not the first edit', async () => {
    const { rerender, save } = setup({ payload: { title: 'a' }, active: true });

    rerender({ payload: { title: 'ab' }, active: true });
    await tick(1000);
    rerender({ payload: { title: 'abc' }, active: true });
    await tick(AUTOSAVE_IDLE_MS);

    expect(save).toHaveBeenCalledWith({ title: 'abc' });
  });

  it('does not save a document nobody has changed', async () => {
    // Arriving on the editor, or a re-render from anything else on the page.
    // Saving here is a write for a change that was never made.
    const loaded = { title: 'Week 1', questions: [] };
    const { rerender, save } = setup({ payload: loaded, active: true });

    rerender({ payload: { ...loaded }, active: true }); // new object, same content
    await tick(AUTOSAVE_IDLE_MS * 3);

    expect(save).not.toHaveBeenCalled();
  });

  it('stays quiet while inactive', async () => {
    // A published assignment, or a draft that is failing validation. The
    // manual Save button still works; the timer must not.
    const { rerender, save } = setup({ payload: { title: 'a' }, active: false });

    rerender({ payload: { title: 'b' }, active: false });
    await tick(AUTOSAVE_IDLE_MS * 2);

    expect(save).not.toHaveBeenCalled();
  });

  it('reports when the document last reached the server', async () => {
    const { result, rerender } = setup({ payload: { title: 'a' }, active: true });
    expect(result.current.lastSavedAt).toBeNull();

    rerender({ payload: { title: 'b' }, active: true });
    await tick(AUTOSAVE_IDLE_MS);

    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
    expect(result.current.status).toBe('saved');
  });

  it('reports an edit that has not been saved yet', async () => {
    const { result, rerender } = setup({ payload: { title: 'a' }, active: true });

    rerender({ payload: { title: 'b' }, active: true });
    expect(result.current.status).toBe('dirty');
  });

  it('keeps a failed save quiet and retries on the next edit', async () => {
    // No toast, no modal: the text is still on screen and Save still works.
    // Stealing focus from an author mid-sentence is worse than the failure.
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(true);
    const { result, rerender } = setup({ payload: { title: 'a' }, active: true }, save);

    rerender({ payload: { title: 'b' }, active: true });
    await tick(AUTOSAVE_IDLE_MS);
    expect(result.current.status).toBe('error');

    rerender({ payload: { title: 'c' }, active: true });
    await tick(AUTOSAVE_IDLE_MS);
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('saved');
  });

  it('saves a pending edit when the editor is left', async () => {
    // Typing, then Back within the thirty seconds. Losing that is the exact
    // thing autosave exists to prevent.
    const { rerender, unmount, save } = setup({ payload: { title: 'a' }, active: true });

    rerender({ payload: { title: 'b' }, active: true });
    await tick(2000);
    unmount();

    expect(save).toHaveBeenCalledWith({ title: 'b' });
  });

  it('does not re-send what a manual save already stored', async () => {
    // Pressing Save leaves the document identical to the server's copy. Without
    // being told, the hook would autosave the same bytes thirty seconds later.
    const { result, rerender, save } = setup({ payload: { title: 'a' }, active: true });

    rerender({ payload: { title: 'b' }, active: true });
    act(() => result.current.markSaved());
    await tick(AUTOSAVE_IDLE_MS * 2);

    expect(save).not.toHaveBeenCalled();
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });
});
