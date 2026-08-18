import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { webcrypto } from 'node:crypto';

import useQuestionPrefetch from '../hooks/useQuestionPrefetch';

/**
 * Holding the next question before it is asked for.
 *
 * What matters here is restraint. This runs in the background during an exam, on
 * the connection that made the whole exercise necessary, so the tests are about
 * when it does *not* ask, and about it never being load-bearing: every failure
 * has to degrade to the ordinary one-question-per-round-trip sitting.
 */

// jsdom has no SubtleCrypto; the browser this ships to does. Node's is the same
// implementation, so borrowing it tests the real decrypt rather than a stub.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const seal = async (view, keyBytes) => {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const key = await webcrypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const data = new TextEncoder().encode(JSON.stringify(view));
  const sealed = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
  return { iv: b64(iv), sealed: b64(sealed) };
};

const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(500); });

describe('useQuestionPrefetch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (fetchNext, props = {}) =>
    renderHook(() =>
      useQuestionPrefetch({ attemptId: 'a1', questionId: 'q1', active: true, fetchNext, ...props }),
    );

  it('fetches the next question while the student reads this one', async () => {
    const fetchNext = vi.fn().mockResolvedValue({ mode: 'open', questionId: 'q2', question: { _id: 'q2' } });
    const { result } = setup(fetchNext);

    await settle();
    expect(fetchNext).toHaveBeenCalledTimes(1);
    expect(result.current.holding()).toBe('q2');
  });

  it('does not ask at all when the sitting is not live', async () => {
    // Before the paper loads, after it is submitted, and once the student has
    // left the screen — a background request there is pure waste.
    const fetchNext = vi.fn();
    setup(fetchNext, { active: false });

    await settle();
    expect(fetchNext).not.toHaveBeenCalled();
  });

  it('stops asking for good once the quiz refuses', async () => {
    // A 403 is the paper saying prefetch is not allowed. Asking again on every
    // question would be a background request per question against a server that
    // has already said no.
    const refuse = Object.assign(new Error('Forbidden'), { status: 403 });
    const fetchNext = vi.fn().mockRejectedValue(refuse);
    const { rerender } = renderHook(
      ({ questionId }) =>
        useQuestionPrefetch({ attemptId: 'a1', questionId, active: true, fetchNext }),
      { initialProps: { questionId: 'q1' } },
    );

    await settle();
    expect(fetchNext).toHaveBeenCalledTimes(1);

    rerender({ questionId: 'q2' });
    await settle();
    rerender({ questionId: 'q3' });
    await settle();
    expect(fetchNext).toHaveBeenCalledTimes(1);
  });

  it('drops what it held when the question changes', async () => {
    // Whatever was prefetched for the question just left is not next any more.
    const fetchNext = vi
      .fn()
      .mockResolvedValueOnce({ mode: 'open', questionId: 'q2', question: { _id: 'q2' } })
      .mockImplementation(() => new Promise(() => {}));
    const { result, rerender } = renderHook(
      ({ questionId }) =>
        useQuestionPrefetch({ attemptId: 'a1', questionId, active: true, fetchNext }),
      { initialProps: { questionId: 'q1' } },
    );

    await settle();
    expect(result.current.holding()).toBe('q2');

    rerender({ questionId: 'q2' });
    expect(result.current.holding()).toBeUndefined();
  });

  it('hands over an open prefetch without needing a key', async () => {
    const question = { _id: 'q2', question: 'Second' };
    const { result } = setup(vi.fn().mockResolvedValue({ mode: 'open', questionId: 'q2', question }));
    await settle();

    await expect(result.current.open({ questionId: 'q2' })).resolves.toEqual(question);
  });

  it('opens a sealed prefetch with the key the advance returned', async () => {
    const view = { _id: 'q2', question: 'Sealed second question' };
    const keyBytes = webcrypto.getRandomValues(new Uint8Array(32));
    const sealed = await seal(view, keyBytes);
    const sealKey = btoa(String.fromCharCode(...keyBytes));

    const { result } = setup(vi.fn().mockResolvedValue({ mode: 'sealed', questionId: 'q2', ...sealed }));
    await settle();

    await expect(result.current.open({ questionId: 'q2', sealKey })).resolves.toEqual(view);
  });

  it('gives up quietly on a key that does not fit', async () => {
    // Tampered, truncated, or a key for another question. The caller then asks
    // for the question plainly — a wasted round trip, never a stuck paper.
    const view = { _id: 'q2' };
    const sealed = await seal(view, webcrypto.getRandomValues(new Uint8Array(32)));
    const wrongKey = btoa(String.fromCharCode(...webcrypto.getRandomValues(new Uint8Array(32))));

    const { result } = setup(vi.fn().mockResolvedValue({ mode: 'sealed', questionId: 'q2', ...sealed }));
    await settle();

    await expect(result.current.open({ questionId: 'q2', sealKey: wrongKey })).resolves.toBeNull();
  });

  it('refuses to hand over a question the server did not serve', async () => {
    // Held q2, served q5 — the two have disagreed, so what is held is worthless
    // and the server's own answer must win.
    const { result } = setup(
      vi.fn().mockResolvedValue({ mode: 'open', questionId: 'q2', question: { _id: 'q2' } }),
    );
    await settle();

    await expect(result.current.open({ questionId: 'q5' })).resolves.toBeNull();
  });
});
