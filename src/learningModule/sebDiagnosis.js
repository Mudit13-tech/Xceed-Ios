/**
 * What a refusal from the Safe Exam Browser gate means to whoever set the exam
 * up, rather than to the student who hit it.
 *
 * The reasons come from `services/sebGate.js`'s `describeFailure`, and the whole
 * value of having them is that they are three completely different jobs wearing
 * one face. From the student's chair every one of these renders as "open this in
 * Safe Exam Browser": a stale Config Key, an unticked checkbox, and a browser
 * that simply is not SEB are indistinguishable. Naming which is the difference
 * between a fix that takes a minute and an exam that is abandoned.
 *
 * One copy, read by both screens that show a verdict — the shared-configuration
 * card where the key is pasted in, and a quiz's own brief. Two copies of advice
 * this specific drift, and the half that drifts is always the one nobody read
 * while it was still true.
 */
export const SEB_DIAGNOSIS = {
  'hash-mismatch':
    'Safe Exam Browser is running, and its Config Key does not match the one stored here. The '
    + 'settings file SEB loaded is not the file whose key was pasted in — the usual cause is '
    + 'uploading the downloaded sample rather than the copy saved out of the Configuration Tool, '
    + 'or editing the settings after copying the key. Re-open the file in the Configuration Tool, '
    + 'save it, copy the Config Key it shows, and upload that file and that key together.',
  'config-key-header-missing':
    'Safe Exam Browser is running but is not sending the Config Key header, so there is nothing '
    + 'to check against. Tick the option that sends the exam keys in the Configuration Tool (the '
    + 'sample file sets sendBrowserExamKey), save, and re-upload with a fresh Config Key.',
  'no-seb-headers':
    'No Safe Exam Browser headers on this request at all. Either this page is open in an ordinary '
    + 'browser — in which case this says nothing about your setup, and the check has to be run '
    + 'again from inside SEB — or SEB is running with the exam keys switched off entirely.',
  'no-config-key':
    'No Config Key is stored, so no request can ever pass. Read the key in the Configuration Tool '
    + 'and upload it together with the file it belongs to.',
  'malformed-hash':
    'The Config Key header arrived but is not a valid hash. That is not a configuration mistake — '
    + 'something between Safe Exam Browser and this server is rewriting the header.',
  unknown:
    'Not verified, and no reason was given. Check that both the settings file and the Config Key '
    + 'have been uploaded.',
};

/** The advice for a reason, never undefined — an unknown code still says something. */
export const sebDiagnosis = (reason) => SEB_DIAGNOSIS[reason] || SEB_DIAGNOSIS.unknown;
