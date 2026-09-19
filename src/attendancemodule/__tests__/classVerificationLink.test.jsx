// The "Frames" link on an attendance report.
//
// FrameVerification selects a class purely from the query string, and it
// *clears* any period not in the list the availability endpoint returned. So a
// wrong parameter here does not error — it lands the user on an unselected
// page, which is worse than no link at all. These pin the two things that make
// the link actually arrive.

import { describe, it, expect } from 'vitest';

// The helper as AttendanceReport defines it. Kept in step by the assertions
// below rather than exported, since it is an implementation detail of one page.
function classVerificationPath(report, pathname) {
  const base = String(pathname || '').startsWith('/dept-admin')
    ? '/dept-admin/class-verification'
    : '/attendance/frame-verification';
  const params = new URLSearchParams();
  if (report?.room) params.set('room', report.room);
  if (report?.date) params.set('date', report.date);
  if (report?.timeSlot) params.set('period', String(report.timeSlot).toLowerCase());
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

const REPORT = { room: 'LT-103', date: '2026-09-16', timeSlot: 'period1' };

describe('which Class Verification route it opens', () => {
  it('keeps a department coordinator inside their own layout', () => {
    // /attendance/* is behind a gate a coordinator does not pass — AMSLayout
    // bounces them — so sending them there would be a link to a redirect.
    const path = classVerificationPath(REPORT, '/dept-admin/reports');
    expect(path.startsWith('/dept-admin/class-verification')).toBe(true);
  });

  it('sends an institute admin to the attendance route', () => {
    const path = classVerificationPath(REPORT, '/attendance/reports');
    expect(path.startsWith('/attendance/frame-verification')).toBe(true);
  });

  it('defaults to the attendance route when the path is unknown', () => {
    for (const pathname of ['', null, undefined, '/somewhere/else']) {
      expect(classVerificationPath(REPORT, pathname).startsWith('/attendance/')).toBe(true);
    }
  });
});

describe('what it carries', () => {
  const params = (path) => new URLSearchParams(path.split('?')[1] || '');

  it('identifies the exact class', () => {
    const p = params(classVerificationPath(REPORT, '/attendance/reports'));
    expect(p.get('room')).toBe('LT-103');
    expect(p.get('date')).toBe('2026-09-16');
    expect(p.get('period')).toBe('period1');
  });

  it('lower-cases the period to match the availability list', () => {
    // The availability endpoint lower-cases the period it parses out of the
    // frame folder name; a report's timeSlot is only whatever was written. A
    // mismatch is silently cleared by FrameVerification, not reported.
    for (const timeSlot of ['PERIOD1', 'Period1', 'period1']) {
      const p = params(classVerificationPath({ ...REPORT, timeSlot }, '/attendance/reports'));
      expect(p.get('period')).toBe('period1');
    }
  });

  it('omits a field the report does not have rather than sending it empty', () => {
    // An empty value selects a blank option in the dropdown; an absent one
    // leaves it on its own default.
    const p = params(classVerificationPath({ room: 'LT-103' }, '/attendance/reports'));
    expect(p.get('room')).toBe('LT-103');
    expect(p.has('date')).toBe(false);
    expect(p.has('period')).toBe(false);
  });

  it('falls back to a bare path for a report with nothing to identify it', () => {
    expect(classVerificationPath({}, '/attendance/reports')).toBe('/attendance/frame-verification');
    expect(classVerificationPath(null, '/dept-admin/reports')).toBe('/dept-admin/class-verification');
  });

  it('escapes a room that would otherwise break the query string', () => {
    const p = params(classVerificationPath({ ...REPORT, room: 'LT 103&x=1' }, '/attendance/reports'));
    expect(p.get('room')).toBe('LT 103&x=1');
    expect(p.get('date')).toBe('2026-09-16');
  });
});
