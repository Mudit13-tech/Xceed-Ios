/**
 * A semester is shown as the record holds it.
 *
 * It is typed once into the timetable's master semester list and copied
 * verbatim from there into a branch's semesters, onto each subject, and onto
 * the class created from that subject — so what a record holds is already a
 * name: `B.Tech-5`, carrying its degree.
 *
 * Half a dozen screens wrote `Sem` or `Semester` in front of it anyway, which
 * read "Sem B.Tech-5". The worse half of that is invisible: the string a screen
 * shows is the string every filter and every match in this module compares
 * against, so a decorated one is a spelling nothing is stored under, and
 * anybody who retyped what they saw into a filter got no rows and no reason.
 *
 * These are one-line assertions about a one-line function, and that is the
 * point — the rule is easy to state and was got wrong in eight places, so it is
 * written down here rather than left to be re-derived by whoever adds the
 * ninth.
 */

import { describe, expect, it } from 'vitest';

import { semesterLabel } from '../format';

describe('showing a semester', () => {
  it('shows the stored name, with nothing in front of it', () => {
    expect(semesterLabel('B.Tech-5')).toBe('B.Tech-5');
    expect(semesterLabel('M.Tech-1')).toBe('M.Tech-1');
    expect(semesterLabel('Ph.D-2')).toBe('Ph.D-2');
  });

  /* Records from before the create form asked for a semester hold a bare
     number. It is shown as it is too — inventing a degree for it would be
     inventing a fact. */
  it('leaves an older bare number alone as well', () => {
    expect(semesterLabel('5')).toBe('5');
  });

  it('is empty rather than "undefined" when there is no semester', () => {
    expect(semesterLabel('')).toBe('');
    expect(semesterLabel(null)).toBe('');
    expect(semesterLabel(undefined)).toBe('');
  });

  it('does not treat surrounding whitespace as part of the name', () => {
    expect(semesterLabel('  B.Tech-5 ')).toBe('B.Tech-5');
  });

  it('reads a number as the string it will be compared as', () => {
    expect(semesterLabel(5)).toBe('5');
  });
});
