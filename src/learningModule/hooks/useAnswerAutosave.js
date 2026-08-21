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
 * either, because it is not one yet: the answer is still on screen, the commit
 * on Next still carries it, and this will try again.
 *
 * @param {object} options
 * @param {object} options.payload   answers as they stand now, keyed by question id
 * @param {object} options.baseline  answers as the server last handed them over.
 *        Changing this — a new question served, a paper reloaded — re-bases the
 *        comparison, so arriving at a question never saves it straight back.
 * @param {boolean} options.active   only while a paper is genuinely being sat
 * @param {(entries: Array) => Promise<any>} options.save
 * @returns {{status: 'idle'|'saving'|'saved'|'retrying', cancel: () => Promise<void>}}
 */

/** Long enough to not save every keystroke, short enough to lose nothing. */
export const AUTOSAVE_DELAY_MS = 1500;
/** After a failure. The next edit retries sooner; this is for a student sitting still. */
export const RETRY_DELAY_MS = 5000;

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
  // The save that is on the wire right now, so `cancel` has something to wait
  // for. `running` alone could only say that one existed, not when it ended.
  const inFlight = useRef(null);

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
    if (running.current) return inFlight.current || Promise.resolve();
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
      } catch {
        // Kept quiet on purpose — see the note at the top. The answer is still on
        // screen and still travels with the next commit.
        setStatus('retrying');
      } finally {
        running.current = false;
        inFlight.current = null;
      }
    })();
    inFlight.current = request;
    return request;
  }, []);

  useEffect(() => {
    if (!active) return undefined;
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
    // back for a save that did happen.
    if (!running.current) setStatus('idle');
    return inFlight.current || Promise.resolve();
  }, []);

  // Memoised so callers can put the whole hook result in a dependency list
  // without rebuilding their callbacks on every render.
  return useMemo(() => ({ status, cancel }), [status, cancel]);
}
