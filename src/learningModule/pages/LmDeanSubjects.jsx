import React from 'react';

import LmHodSubjects from './LmHodSubjects';

/**
 * Subjects & faculty, for the Dean (Academic) — the same screen as a head of
 * department's, with every department in the dropdown instead of the one they
 * head. See the sibling `LmDeanDashboard` for why it is one screen and not two.
 *
 * Still one department at a time: a timetable belongs to a department, and
 * merging two of them produces a table in which "Sem 3" names two different
 * cohorts.
 */
export default function LmDeanSubjects() {
  return <LmHodSubjects variant="dean" />;
}
