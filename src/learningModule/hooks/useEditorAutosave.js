import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Banks a teacher's edits while they author, instead of only when they press Save.
 *
 * The delay is thirty seconds of *silence*, not a thirty-second interval. Every
 * change restarts the timer, so an author typing steadily produces no requests
 * at all until they stop — which matters more here than it does for a student's
 * answers, because the payload is the whole document. An assignment with forty
 * questions saved per keystroke is that document on the wire hundreds of times a
 * minute, and the server rewrites it in full each time.
 *
 * Like the student-side save, this is deliberately quiet: it reports status for
 * a small indicator and nothing else. A failure raises nothing, because it is
 * usually not one yet — the work is still on screen, the Save button still
 * works, and the next edit tries again.
 *
 * @param {object} options
 * @param {object|null} options.payload  the document as it stands now — the same
 *        object the editor's own save sends. Null while the page is loading;
 *        the first non-null value becomes the baseline, so arriving on an editor
 *        never saves the document straight back.
 * @param {boolean} options.active  whether autosaving is wanted at all. False
 *        while loading, while validation is failing, and for anything already
 *        published — see the note on pausing below.
 * @param {(payload: object) => Promise<any>} options.save
 * @returns {{status: 'idle'|'dirty'|'saving'|'saved'|'error', lastSavedAt: Date|null, markSaved: () => void}}
 */

/** Long enough that authoring never triggers it, short enough to lose nothing. */
export const AUTOSAVE_IDLE_MS = 30000;

export default function useEditorAutosave({ payload, active, save }) {
  const [status, setStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const current = useMemo(() => (payload == null ? null : JSON.stringify(payload)), [payload]);

  // What the server is known to hold. Null until the first document arrives —
  // seeding it with that document is what stops the load itself looking like an
  // edit. Deliberately *not* re-seeded when `active` goes false: an author who
  // breaks validation, keeps typing, then fixes it must still have that work
  // saved, and re-basing while paused would swallow exactly those edits.
  const saved = useRef(null);
  const timer = useRef(null);
  // The save on the wire right now. A flush racing it would be two requests
  // rewriting the same document at once.
  const inFlight = useRef(null);
  const mounted = useRef(true);

  // Read through refs so the effect below depends on the signature alone — with
  // `payload` or `save` in the dependency list, a new object identity on every
  // render would restart the timer forever and the save would never fire.
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const saveRef = useRef(save);
  saveRef.current = save;

  const flushNow = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const sending = JSON.stringify(payloadRef.current);
    if (payloadRef.current == null || sending === saved.current) return Promise.resolve();

    if (mounted.current) setStatus('saving');
    const request = (async () => {
      try {
        await saveRef.current(payloadRef.current);
        // What was sent, not what is on screen now: the author may have typed
        // while it was in flight, and calling that saved is a lie the next
        // comparison would believe.
        saved.current = sending;
        if (!mounted.current) return;
        setLastSavedAt(new Date());
        setStatus(JSON.stringify(payloadRef.current) === sending ? 'saved' : 'dirty');
      } catch {
        // Kept quiet on purpose — see the note at the top.
        if (mounted.current) setStatus('error');
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = request;
    return request;
  }, []);

  useEffect(() => {
    if (current == null) return undefined;
    if (saved.current === null) {
      saved.current = current;
      return undefined;
    }
    if (current === saved.current) return undefined;

    setStatus((was) => (was === 'saving' ? was : 'dirty'));
    if (!active) return undefined;

    clearTimeout(timer.current);
    timer.current = setTimeout(flushNow, AUTOSAVE_IDLE_MS);
    return () => clearTimeout(timer.current);
  }, [current, active, flushNow]);

  /* Leaving the editor inside the thirty seconds — Back, a route change, the
     tab being torn down — is the one case where waiting out the debounce loses
     the work outright, which is the very thing this exists to prevent. Runs
     regardless of `active`, because a paused editor never got here with unsaved
     changes unless something genuinely changed. */
  useEffect(
    () => () => {
      mounted.current = false;
      clearTimeout(timer.current);
      flushNow();
    },
    [flushNow],
  );

  /**
   * Tells the hook the document has just been stored by some other path — the
   * Save button, or a publish that saves first. Without it the hook's baseline
   * stays behind and it re-sends identical bytes thirty seconds later.
   */
  const markSaved = useCallback(() => {
    clearTimeout(timer.current);
    if (payloadRef.current != null) saved.current = JSON.stringify(payloadRef.current);
    setLastSavedAt(new Date());
    setStatus('saved');
  }, []);

  return useMemo(() => ({ status, lastSavedAt, markSaved }), [status, lastSavedAt, markSaved]);
}
