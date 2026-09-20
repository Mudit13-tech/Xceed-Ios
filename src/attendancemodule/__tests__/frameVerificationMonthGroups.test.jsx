import { describe, it, expect } from 'vitest';
import { groupDatesByMonth } from '../FrameVerification';

// The dropdown groups the dates the API already ordered. It must never reorder
// them — the server sorts on YYYYMMDD, and a second sort here on the DD-MM-YYYY
// display string is exactly the bug this is paired with.

describe('groupDatesByMonth', () => {
  it('puts each month under one heading', () => {
    expect(groupDatesByMonth([
      '15-10-2026', '01-10-2026', '30-09-2026', '01-09-2026',
    ])).toEqual([
      { label: 'October 2026', dates: ['15-10-2026', '01-10-2026'] },
      { label: 'September 2026', dates: ['30-09-2026', '01-09-2026'] },
    ]);
  });

  it('keeps the order it was given', () => {
    const given = ['31-10-2026', '01-10-2026', '30-09-2026'];
    expect(groupDatesByMonth(given).flatMap((g) => g.dates)).toEqual(given);
  });

  it('separates the same month in different years', () => {
    expect(groupDatesByMonth(['05-01-2027', '05-01-2026']).map((g) => g.label))
      .toEqual(['January 2027', 'January 2026']);
  });

  it('opens a new group if a month reappears later in the list', () => {
    // Would only happen on unsorted input, but silently merging two runs of the
    // same month would move dates past each other, which is the one thing this
    // must not do.
    expect(groupDatesByMonth(['15-10-2026', '30-09-2026', '01-10-2026']))
      .toEqual([
        { label: 'October 2026', dates: ['15-10-2026'] },
        { label: 'September 2026', dates: ['30-09-2026'] },
        { label: 'October 2026', dates: ['01-10-2026'] },
      ]);
  });

  it('keeps an unparseable date rather than dropping it', () => {
    // A date we cannot parse is still a date somebody needs to open.
    const groups = groupDatesByMonth(['15-10-2026', '2026-10-16', '']);
    expect(groups.flatMap((g) => g.dates)).toEqual(['15-10-2026', '2026-10-16', '']);
    expect(groups.map((g) => g.label)).toEqual(['October 2026', 'Other']);
  });

  it('handles an empty or missing list', () => {
    expect(groupDatesByMonth([])).toEqual([]);
    expect(groupDatesByMonth(undefined)).toEqual([]);
  });

  it('names every month correctly', () => {
    const dates = Array.from({ length: 12 }, (_, i) =>
      `01-${String(i + 1).padStart(2, '0')}-2026`);
    expect(groupDatesByMonth(dates).map((g) => g.label)).toEqual([
      'January 2026', 'February 2026', 'March 2026', 'April 2026',
      'May 2026', 'June 2026', 'July 2026', 'August 2026',
      'September 2026', 'October 2026', 'November 2026', 'December 2026',
    ]);
  });
});
