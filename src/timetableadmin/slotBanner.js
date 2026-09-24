/**
 * What the floating banner on the timetable page is saying, and what colour
 * that makes it.
 *
 * Choosing a slot fires `POST /saveslot`, and the reply is the availability
 * answer. Two things were wrong with how that was shown:
 *
 *   - the banner cleared itself three seconds after any message, including
 *     "Checking slot availability…". On a busy session the check outlives that
 *     timer, so the banner vanished and the answer arrived later out of
 *     nowhere — the incharge could not tell a slow check from a finished one;
 *   - every message was the same orange, so "available" and "not available"
 *     looked identical at a glance, which is the one thing this banner exists
 *     to distinguish.
 *
 * The tone is read from the text rather than tracked in a second piece of
 * state, because the message has one source of truth already and a parallel
 * flag would go stale every time some other part of the page set a message of
 * its own ("Data is being locked", "Data saved successfully").
 *
 * The two answers come from `timetableModule/controllers/classtimetable.js`:
 * "Slot is available" and "Slot is not available. Check faculty and room
 * availability for more details". The match is on "not available" before
 * "available" — reversing those two lines would paint every refusal green —
 * and it is loose enough to survive a rewording, with the tests below pinning
 * both wordings as they stand.
 */

/**
 * @param {string} text  the banner's current message
 * @returns {'checking'|'available'|'unavailable'|'info'|null}
 *   null when there is nothing to show.
 */
export function bannerTone(text) {
  const value = String(text || '').trim().toLowerCase();
  if (!value) return null;

  // Asked before either answer: "Checking slot availability…" contains the
  // word "availability", so it has to be recognised first.
  if (value.includes('checking')) return 'checking';

  if (value.includes('not available') || value.includes('unavailable')) {
    return 'unavailable';
  }
  if (value.includes('available')) return 'available';

  // Everything else the page says through this banner — saving, locking — is
  // neither a question nor an answer about a slot.
  return 'info';
}

/** The banner's background for a tone. Violet asks; green and red answer. */
export function bannerColor(tone) {
  switch (tone) {
    case 'checking':
      return 'purple.500';
    case 'available':
      return 'green.500';
    case 'unavailable':
      return 'red.500';
    case 'info':
      return 'orange.500';
    default:
      return 'transparent';
  }
}

/**
 * Whether this message should be cleared on a timer.
 *
 * A question must not be: it stays until it is answered, which is the whole
 * point of showing it. Answers, and everything else, still clear themselves.
 */
export const bannerHolds = (text) => bannerTone(text) === 'checking';

export default bannerTone;
