/**
 * The one rule that decides whether locking a timetable emails the teachers.
 *
 * Worth pinning on its own, because both wrong answers are invisible in the
 * product: a "no" simply does not put the question, the lock succeeds, and
 * nobody is told anything — which is how change notices stopped for a whole
 * session once its timetables were created unpublished — while a wrong "yes"
 * mails a whole department about a draft.
 */
import { describe, it, expect } from 'vitest';
import { notifyGate } from '../notifyGate';

describe('notifyGate', () => {
  const current = ['abc-def-ghi'];

  it('mails a published timetable without asking', () => {
    // Publishing is what put this table in front of its teachers. A change to
    // it afterwards is news they must have, so the lock does not offer a "no".
    expect(
      notifyGate({
        code: 'abc-def-ghi',
        currentSessionCodes: current,
        published: true,
      }),
    ).toEqual({ mode: 'auto', canNotify: true, reason: null });
  });

  it('asks about a draft in the current session', () => {
    const gate = notifyGate({
      code: 'abc-def-ghi',
      currentSessionCodes: current,
      published: false,
    });
    expect(gate.mode).toBe('ask');
    expect(gate.canNotify).toBe(true);
  });

  it('mails when the publish state is unknown', () => {
    // An `alldetails` call that failed, or a record predating the field. These
    // teachers are teaching this session, so the lock tells them rather than
    // holding the notice back over a flag it could not read.
    expect(
      notifyGate({ code: 'abc-def-ghi', currentSessionCodes: current }).mode,
    ).toBe('auto');
    expect(
      notifyGate({
        code: 'abc-def-ghi',
        currentSessionCodes: current,
        published: null,
      }).mode,
    ).toBe('auto');
  });

  it('asks only on an explicit draft', () => {
    expect(
      notifyGate({
        code: 'abc-def-ghi',
        currentSessionCodes: current,
        published: false,
      }).mode,
    ).toBe('ask');
  });

  it('refuses a timetable from another session, and says which', () => {
    const gate = notifyGate({
      code: 'old-ses-sion',
      currentSessionCodes: current,
      published: true,
    });
    expect(gate.mode).toBe('none');
    expect(gate.reason).toMatch(/not part of the current session/);
  });

  it('tells a missing answer apart from a negative one', () => {
    // No session marked current, or the lookup failed. An administrator can
    // act on that; "not the current session" would have been a lie.
    const gate = notifyGate({ code: 'abc-def-ghi', currentSessionCodes: [] });
    expect(gate.mode).toBe('none');
    expect(gate.reason).toMatch(/current session could not be read/);
  });

  it('survives a session lookup that answered with nothing usable', () => {
    for (const codes of [undefined, null, 'abc-def-ghi', {}]) {
      const gate = notifyGate({
        code: 'abc-def-ghi',
        currentSessionCodes: codes,
        published: true,
      });
      expect(gate.mode).toBe('none');
      expect(gate.reason).toBeTruthy();
    }
  });

  it('refuses a lock with no code at all', () => {
    // The First Year page holds its code in state and starts empty.
    expect(
      notifyGate({ code: '', currentSessionCodes: current, published: true })
        .mode,
    ).toBe('none');
  });
});
