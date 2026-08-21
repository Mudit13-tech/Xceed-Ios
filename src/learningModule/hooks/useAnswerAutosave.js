import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Banks a student's answers while they work, instead of only when they move on.
 *
 * Before this, an answer existed in one place — the browser — until Next or
 * Submit was pressed, and that request was the only thing that had ever told the
 * server about it. On a bad connection that is a paper held hostage by a single
 * POST: the request hangs, the student reloads or switches window to see what is
 * wrong, and both of those end the attempt with the answer never having left the
 * machine.
 *
 * The save is deliberately quiet. It reports status for a small indicator and
 * nothing else — no toast, no modal, nothing that steals focus from a question
 * or moves the page under someone's hands. A failure is not shown as an error
 * either, because most of the time it is not one yet: the answer is still on
 * screen, the commit on Next still carries it, and this will try again — with
 * one exception, see `blocked` below.
 *
 * @param {object} options
 * @param {object} options.payload   answers as they stand now, keyed by question id
 * @param {object} options.baseline  answers as the server last handed them over.
 *        Changing this — a new question served, a paper reloaded — re-bases the
 *        comparison, so arriving at a question never saves it straight back.
 * @param {boolean} options.active   only while a paper is genuinely being sat
 * @param {(entries: Array) => Promise<any>} options.save
 * @returns {{status: 'idle'|'saving'|'saved'|'retrying'|'blocked', flush: () => Promise<void>, fatalError: object|null, cancel: () => Promise<void>}}
 */

/** Long enough to not save every keystroke, short enough to lose nothing. */
export const AUTOSAVE_DELAY_MS = 1500;
/** After a failure. The next edit retries sooner; this is for a student sitting still. */
export const RETRY_DELAY_MS = 5000;

/**
 * Codes the server sends when there is nothing left worth retrying for —
 * every one of them means this attempt is no longer accepting writes from
 * this browser, permanently, not for the length of one bad connection.
 * Retrying anyway would not just waste requests: it would sit in the
 * `retrying` state forever, which reads to a student as "still trying to
 * save" when the truth is closer to "nothing typed from here on will ever
 * reach the server."
 */
const FATAL_CODES = new Set(['FINISHED', 'TERMINATED', 'EXPIRED', 'SESSION_CONFLICT']);

/** Whether a failed save is one retrying can never fix. */
export const isFatalSaveError = (err) => Boolean(err?.payload?.code && FATAL_CODES.has(err.payload.code));

/**
 * A stable string for a set of answers.
 *
 * Sorted and trimmed so that re-picking the same options, or a text field that
 * ends where it started, is not a change worth a request.
 */
export const signature = (answers = {}) =>
  JSON.stringify(
    Object.keys(answers)
      .sort()
      .map((questionId) => [
        questionId,
        [...(answers[questionId]?.selected || [])].map(String).sort(),
        String(answers[questionId]?.text ?? '').trim(),
      ]),
  );

const toEntries = (answers = {}) =>
  Object.entries(answers).map(([questionId, value]) => ({
    questionId,
    selected: value?.selected || [],
    text: value?.text || '',
  }));

export default function useAnswerAutosave({ payload, baseline, active, save }) {
  const [status, setStatus] = useState('idle');

  const current = useMemo(() => signature(payload), [payload]);
  const base = useMemo(() => signature(baseline), [baseline]);

  // What the server is known to hold. Seeded from the baseline, and re-seeded
  // whenever the baseline changes — the moment a question is served, what is on
  // screen *is* what the server has, and saving it back would be a request per
  // question for no reason.
  const saved = useRef(base);
  const timer = useRef(null);
  const running = useRef(false);
  // The save that is on the wire right now, if any — what `cancel` awaits
  // rather than merely stopping the timer for (a draft already in flight would
  // otherwise land *beside* a commit that raced it, two requests mutating and
  // saving the same attempt document at once), and what a forced `flush`
  // arriving mid-save joins rather than racing: "already sending" is not
  // "already sent", and a departure firing in the same tick a debounce timer
  // does must never get ahead of the write already under way.
  const inFlight = useRef(null);
  // The error that put this hook into `blocked`, so a caller can tell a
  // session takeover from an attempt that finished under it. Cleared only by
  // a fresh baseline — a new attempt is a new hook lifetime in practice, but
  // this keeps the invariant true rather than assumed.
  const fatal = useRef(null);

  // Read through refs so the effect below depends on the signature alone. With
  // `payload` or `save` in the dependency list a new object identity on every
  // render would restart the timer forever and the save would never fire.
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    saved.current = base;
  }, [base]);

  const flushNow = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    if (fatal.current) return Promise.resolve();
    const sending = signature(payloadRef.current);
    if (sending === saved.current) return Promise.resolve();

    running.current = true;
    setStatus('saving');
    const request = (async () => {
      try {
        await saveRef.current(toEntries(payloadRef.current));
        // What was sent, not what is on screen now: the student may have typed
        // while it was in flight, and claiming that is saved would be a lie the
        // next comparison would then believe.
        saved.current = sending;
        setStatus(signature(payloadRef.current) === sending ? 'saved' : 'saving');
      } catch (err) {
        if (isFatalSaveError(err)) {
          // Not a hiccup: the server has said, in as many words, that nothing
          // sent from here on will land. Retrying would just repeat the same
          // failure forever while telling the student "still saving" — worse
          // than silence, because it reads as reassurance. The caller decides
          // what to show; this only stops digging.
          fatal.current = err;
          setStatus('blocked');
        } else {
          // Kept quiet on purpose — see the note at the top. The answer is
          // still on screen and still travels with the next commit.
          setStatus('retrying');
        }
      } finally {
        running.current = false;
        inFlight.current = null;
      }
    })();
    inFlight.current = request;
    return request;
  }, []);

  useEffect(() => {
    if (!active || fatal.current) return undefined;
    if (current === saved.current) {
      // Includes the moment a new question arrives, which is why this is not an
      // error state — there is simply nothing to send.
      if (!running.current) setStatus((was) => (was === 'saving' ? 'saved' : was));
      return undefined;
    }

    clearTimeout(timer.current);
    timer.current = setTimeout(flushNow, status === 'retrying' ? RETRY_DELAY_MS : AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer.current);
    // `status` is in here so a failure schedules its own retry rather than
    // waiting for the student to touch something.
  }, [current, active, status, flushNow]);

  /**
   * Drops a pending save, and waits for one already on the wire.
   *
   * Called by the paths that commit the answer themselves — advancing, and
   * submitting. Their request is authoritative and carries the same answer, so
   * letting a debounced draft race it would be a second write for nothing, and
   * on a sequential paper a write aimed at a cursor that is about to move.
   *
   * Clearing the timer only ever handled the draft that had not left yet. A
   * draft already in flight kept going and landed *beside* the commit — two
   * requests loading, mutating and saving the same attempt document at once,
   * which is what put Mongoose's "No matching document found for id … version
   * 19" on top of a student's exam paper. Awaiting it is what makes the two
   * writes sequential, and it costs the student nothing: it is the same answer
   * they have already given, and it is normally not there at all.
   *
   * @returns {Promise<void>} settles once nothing of this hook's is in flight
   */
  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    // Not while a save is running: its own completion will set the status, and
    // saying "idle" over the top of it flickers the indicator to nothing and
    // back for a save that did happen. Not reset to 'idle' once blocked either
    // — the caller may be watching for that status to show a persistent
    // notice, and `cancel` is called right before the paths (submit, advance)
    // that are about to hit the very same wall — clearing it a moment before
    // they do would drop the signal exactly when it is about to matter again.
    if (!running.current && !fatal.current) setStatus('idle');
    return inFlight.current || Promise.resolve();
  }, []);

  /* `flushNow` doubles as the public `flush`: callers that cannot wait out the
     debounce — a proctoring departure about to end the attempt, the page
     itself being torn down — need the answer on the wire before something
     else makes the server stop accepting it, and reusing the debounced path
     here is what keeps this the exact same write rather than a second
     mechanism that could disagree with it. It never rejects: a caller
     awaiting it to sequence "save, then end the attempt" does not want a
     throw abandoning that sequence, and `status` (with `fatalError`) already
     say whether it actually landed. */

  // Memoised so callers can put the whole hook result in a dependency list
  // without rebuilding their callbacks on every render.
  return useMemo(
    () => ({ status, cancel, flush: flushNow, fatalError: fatal.current }),
    // `fatal.current` is a ref and so cannot be a dependency; `status` moving
    // to 'blocked' happens in the same tick that sets it, so this object is
    // rebuilt at exactly the moment it would otherwise go stale.
    [status, cancel, flushNow],
  );
}
