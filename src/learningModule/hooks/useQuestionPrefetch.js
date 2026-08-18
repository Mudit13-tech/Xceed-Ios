import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Holds the next question before the student asks for it.
 *
 * Pressing Next costs a round trip and a payload. Only the payload can be
 * removed — the server still has to record the answer and move the cursor — so
 * this is worth having exactly when the payload is worth something: questions
 * carrying images or long passages. On a plain-text paper it saves bytes nobody
 * was waiting for (`server/scripts/questionWeight.js` says which you have).
 *
 * The server decides what it is willing to send, and there are two answers:
 *
 *  - `open` — the paper allows going back and has no per-question clock, so the
 *    student could already reach this question and come back. It arrives as an
 *    ordinary question object and is used directly.
 *  - `sealed` — anything stricter, exams included. It arrives encrypted, and the
 *    key comes back from the *advance*, not from here. Until then the browser
 *    holds bytes it cannot read, which is what makes prefetching a paper that is
 *    meant to be handed out one question at a time defensible at all.
 *
 * A refusal (403, or a quiz with prefetch off) is not an error: the sitting
 * works exactly as it did before, one question per round trip.
 */

/** AES-256-GCM, tag appended to the ciphertext — the layout WebCrypto expects. */
async function unseal({ sealed, iv }, keyBase64) {
  const bytes = (base64) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', bytes(keyBase64), 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, key, bytes(sealed));
  return JSON.parse(new TextDecoder().decode(plain));
}

export default function useQuestionPrefetch({ attemptId, questionId, active, fetchNext }) {
  // { questionId, question } for an open prefetch, or { questionId, sealed, iv }.
  const held = useRef(null);
  // Only so a caller can show something if it wants to; nothing depends on it.
  const [ready, setReady] = useState(false);

  const fetchRef = useRef(fetchNext);
  fetchRef.current = fetchNext;

  // A paper whose server said no. Asked once, then never again for this sitting
  // — a background request per question against a server that has already
  // refused is the opposite of what this is for.
  const refused = useRef(false);

  useEffect(() => {
    held.current = null;
    setReady(false);
    if (!active || refused.current || !questionId) return undefined;

    let cancelled = false;
    // After the current question has settled on screen. The student is reading;
    // the point is to use that time, not to compete with the render for it.
    const timer = setTimeout(async () => {
      try {
        const next = await fetchRef.current();
        if (cancelled || !next || next.done || !next.questionId) return;
        held.current = next;
        setReady(true);
      } catch (error) {
        // 403 is the quiz saying no. Anything else is a network hiccup on a
        // request nobody is waiting for, and is equally not worth reporting.
        if (error?.status === 403) refused.current = true;
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Re-runs per question, which is what drops the previous hold: whatever was
    // prefetched for the question just left is no longer next.
  }, [attemptId, questionId, active]);

  /**
   * The question the server has just served, taken from what we already hold.
   *
   * Returns null whenever anything does not line up — a different question than
   * expected, a key that does not open it, nothing held. The caller then uses
   * the server's own payload, so a prefetch that goes wrong costs a little
   * bandwidth and nothing else.
   */
  const open = useCallback(async (served) => {
    const have = held.current;
    if (!have || !served) return null;
    if (String(have.questionId) !== String(served.questionId || '')) return null;

    if (have.question) return have.question;
    if (!served.sealKey || !have.sealed) return null;
    try {
      return await unseal(have, served.sealKey);
    } catch {
      // Tampered, truncated, or a key that belongs to something else. The paper
      // must not be held up by it.
      return null;
    }
  }, []);

  /**
   * Which question we already have, told to the server so it can leave the
   * payload out of its reply — a key for a sealed one, nothing at all for an
   * open one.
   */
  const holding = useCallback(() => held.current?.questionId || undefined, []);

  return { ready, open, holding };
}
