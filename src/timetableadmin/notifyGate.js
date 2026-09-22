/**
 * What locking a timetable should do about telling the teachers.
 *
 * ## Why this exists
 *
 * The server mails affected faculty only when the lock request carries
 * `toInform: true`. So whatever decides that decides whether anybody is
 * emailed at all — and each of the three pages that lock a timetable decided
 * it differently, with a "no" that was always silent:
 *
 *   - the department page asked only when the timetable was in the current
 *     session *and* already published. A new session's timetables start
 *     unpublished, so from the day a session's tables were created the change
 *     notices stopped and nothing said so;
 *   - the v1 page asked on the current session alone;
 *   - the First Year page never asked and never sent `toInform`, so a
 *     first-year change could not notify anyone, ever.
 *
 * ## The rule
 *
 *   published  → `auto`: mail, without asking. Publishing is the act that put
 *                this timetable in front of its teachers; from then on a change
 *                to it is news they must have, and a confirmation that can be
 *                answered "no" by a tired hand at the end of a long edit is
 *                the only thing between them and not knowing. An unknown
 *                publish state is treated the same way: the teachers are in
 *                the session being taught now, and the cost of telling them
 *                about a change they could already see is nothing beside the
 *                cost of not telling them about one they could not.
 *   draft      → `ask`, and only on an explicit `publish: false`: the table is
 *                in the current session but has not been handed to anybody
 *                yet, so whether the change is worth a mail is the
 *                coordinator's call. The mail itself does work either way — it
 *                links to the faculty view, which reads the locked table and
 *                never consults the publish flag.
 *   otherwise  → `none`, with a reason to show. A timetable from another
 *                session mails nobody: those teachers are not teaching it.
 *
 * @param {object} args
 * @param {string} args.code                  the timetable being locked
 * @param {string[]} args.currentSessionCodes codes of the current session's
 *                                            timetables, from
 *                                            POST /timetable/get-current-session
 * @param {boolean} [args.published]          this timetable's `publish` flag
 * @returns {{mode: 'auto'|'ask'|'none', canNotify: boolean, reason: string|null}}
 */
export function notifyGate({ code, currentSessionCodes, published }) {
  const codes = Array.isArray(currentSessionCodes) ? currentSessionCodes : [];

  const no = (reason) => ({ mode: 'none', canNotify: false, reason });

  if (!code) return no('this timetable has no code');

  // The lookup failed, or no session is marked current. Not the same as "this
  // table is from an old session", and worth saying differently: one is an
  // answer, the other is a missing answer an administrator can supply.
  if (!codes.length) {
    return no(
      'the current session could not be read, so it is not known whether ' +
        'these teachers are teaching this timetable now'
    );
  }

  if (!codes.includes(code)) {
    return no('this timetable is not part of the current session');
  }

  return {
    mode: published === false ? 'ask' : 'auto',
    canNotify: true,
    reason: null,
  };
}

export default notifyGate;
